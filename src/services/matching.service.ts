import { Caregiver, Booking, BookingType } from '@prisma/client';
import { prisma } from '../config/database';
import { getDistanceKm } from '../utils/distance';
import { logger } from '../utils/logger';

export type ScoredCaregiver = Caregiver & {
  distance: number;
  score: number;
  user: {
    name: string;
  };
};

export async function findCandidates(
  patientLat: number,
  patientLon: number,
  radiusKm: number,
  excludeIds: string[] = []
): Promise<ScoredCaregiver[]> {
  // Query online caregivers that are not in excludeIds
  const onlineCaregivers = await prisma.caregiver.findMany({
    where: {
      availabilityStatus: 'online',
      id: { notIn: excludeIds },
    },
    include: {
      user: {
        select: {
          name: true,
        },
      },
    },
  });

  // Filter caregivers who do NOT have an active booking
  // Active booking status: pending_matching (if immediate and assigned), matched, paid, scheduled, in_progress
  const busyCaregivers = await prisma.booking.findMany({
    where: {
      status: {
        in: ['matched', 'paid', 'scheduled', 'in_progress'],
      },
      caregiverId: { not: null },
    },
    select: {
      caregiverId: true,
    },
  });
  const busyIds = busyCaregivers.map((b) => b.caregiverId as string);

  const availableCaregivers = onlineCaregivers.filter(
    (cg) => !busyIds.includes(cg.id)
  );

  const scored: ScoredCaregiver[] = [];

  for (const cg of availableCaregivers) {
    if (cg.currentLatitude === null || cg.currentLongitude === null) continue;

    const distance = getDistanceKm(
      patientLat,
      patientLon,
      cg.currentLatitude,
      cg.currentLongitude
    );

    if (distance <= radiusKm) {
      // Score calculation:
      // Distance (50%) -> 1 / (1 + distance)
      // Rating (40%) -> rating / 5
      // Reschedule Penalty (10%) -> 1 - Math.min(rescheduleCount / 5, 1)
      const distanceScore = 1 / (1 + distance);
      const ratingScore = cg.averageRating / 5;
      const reschedulePenalty = 1 - Math.min(cg.rescheduleCount / 5, 1);

      const score = 0.5 * distanceScore + 0.4 * ratingScore + 0.1 * reschedulePenalty;

      scored.push({
        ...cg,
        distance,
        score,
      });
    }
  }

  // Sort by score descending
  return scored.sort((a, b) => b.score - a.score);
}

// In-memory registry to keep track of active timeouts for immediate bookings
// key: bookingId, value: NodeJS.Timeout
const matchingTimeouts = new Map<string, NodeJS.Timeout>();

export async function runMatching(bookingId: string): Promise<void> {
  try {
    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      include: { patient: true },
    });

    if (!booking) {
      logger.warn(`Matching failed: Booking ${bookingId} not found`);
      return;
    }

    // Only run matching for pending_matching bookings
    if (booking.status !== 'pending_matching') {
      return;
    }

    const excludeIds = booking.previousCaregiverId ? [booking.previousCaregiverId] : [];

    // immediate booking has a larger radius (e.g. 25km) than scheduled (e.g. 15km)
    const radiusKm = booking.bookingType === BookingType.immediate ? 25 : 15;

    const candidates = await findCandidates(
      booking.patient.latitude,
      booking.patient.longitude,
      radiusKm,
      excludeIds
    );

    if (candidates.length === 0) {
      logger.info(`No available caregivers found in radius for booking ${bookingId}`);
      // If immediate and we already had a caregiver proposed who timed out, reset caregiverId to null
      if (booking.caregiverId) {
        await prisma.booking.update({
          where: { id: bookingId },
          data: { caregiverId: null },
        });
      }
      return;
    }

    if (booking.bookingType === BookingType.immediate) {
      const bestCandidate = candidates[0];
      logger.info(`Matching: Proposed caregiver ${bestCandidate.user.name} (${bestCandidate.id}) for immediate booking ${bookingId}`);

      // Assign to this candidate but keep status as pending_matching until they accept
      await prisma.booking.update({
        where: { id: bookingId },
        data: { caregiverId: bestCandidate.id },
      });

      // Clear any existing timeout for this booking
      if (matchingTimeouts.has(bookingId)) {
        clearTimeout(matchingTimeouts.get(bookingId));
      }

      // Set 30-second timeout for acceptance
      const timeout = setTimeout(async () => {
        try {
          const currentBooking = await prisma.booking.findUnique({
            where: { id: bookingId },
          });

          // If still pending_matching and caregiver has not accepted, trigger reschedule/re-match
          if (currentBooking && currentBooking.status === 'pending_matching' && currentBooking.caregiverId === bestCandidate.id) {
            logger.info(`Matching timeout: Caregiver ${bestCandidate.id} did not accept booking ${bookingId} within 30 seconds. Re-matching...`);
            
            // Set candidate as previousCaregiverId to exclude them from the next round
            await prisma.booking.update({
              where: { id: bookingId },
              data: {
                previousCaregiverId: bestCandidate.id,
                caregiverId: null,
              },
            });

            // Run matching again
            runMatching(bookingId);
          }
        } catch (err) {
          logger.error(`Error in matching timeout handler for booking ${bookingId}:`, err);
        }
      }, 30000);

      matchingTimeouts.set(bookingId, timeout);
    } else {
      // Scheduled booking: We don't assign caregiverId yet.
      // Top 5 candidates will be able to see this booking and accept it.
      logger.info(`Matching: Broadcast scheduled booking ${bookingId} to ${Math.min(candidates.length, 5)} top candidates`);
    }
  } catch (err) {
    logger.error(`Error running matching for booking ${bookingId}:`, err);
  }
}

export function clearMatchingTimeout(bookingId: string) {
  if (matchingTimeouts.has(bookingId)) {
    clearTimeout(matchingTimeouts.get(bookingId));
    matchingTimeouts.delete(bookingId);
  }
}
