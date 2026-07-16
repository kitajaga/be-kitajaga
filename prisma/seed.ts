import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seeding...');

  // Clean existing data to avoid constraint violations on re-seeding
  await prisma.chat.deleteMany();
  await prisma.bookingProgress.deleteMany();
  await prisma.trackingLog.deleteMany();
  await prisma.report.deleteMany();
  await prisma.payment.deleteMany();
  await prisma.guidebook.deleteMany();
  await prisma.booking.deleteMany();
  await prisma.caregiver.deleteMany();
  await prisma.patient.deleteMany();
  await prisma.user.deleteMany();

  console.log('🧹 Existing data cleaned.');

  const passwordHash = await bcrypt.hash('password123', 10);

  // 1. Create User (Client role)
  const clientUser = await prisma.user.create({
    data: {
      name: 'Zaki Ibrahim',
      email: 'zaki@mail.com',
      phone: '081234567890',
      passwordHash,
      role: 'user',
    },
  });

  // 2. Create Caregiver User
  const caregiverUser = await prisma.user.create({
    data: {
      name: 'Suster Rina',
      email: 'rina@mail.com',
      phone: '081298765432',
      passwordHash,
      role: 'caregiver',
    },
  });

  // 3. Create Caregiver Profile (Initially offline, centered in Menteng Jakarta)
  const caregiverProfile = await prisma.caregiver.create({
    data: {
      userId: caregiverUser.id,
      availabilityStatus: 'offline',
      currentLatitude: -6.195,
      currentLongitude: 106.832,
      workingRadiusKm: 15,
      averageRating: 4.8,
      totalCompletedBookings: 12,
      rescheduleCount: 0,
      photoUrl: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&q=80&w=200',
      verificationStatus: 'verified',
    },
  });

  // 4. Create Patient for Client User
  await prisma.patient.create({
    data: {
      userId: clientUser.id,
      name: 'Budi Santoso',
      dateOfBirth: new Date('1958-03-12'),
      gender: 'male',
      address: 'Jl. Menteng Raya No.10, Jakarta',
      latitude: -6.195,
      longitude: 106.832,
      mobilityStatus: 'assisted',
      allergies: ['Diabetes', 'Debu'],
      currentMedications: ['Metformin 500mg'],
      medicalNotes: 'Mengidap diabetes, sering lupa minum obat sore.',
      riskLevel: 'high',
      emergencyContactName: 'Rina',
      emergencyContactPhone: '081298765432',
    },
  });

  console.log('✅ Seeding completed successfully!');
  console.log(`- User client: zaki@mail.com (password: password123)`);
  console.log(`- Caregiver:   rina@mail.com (password: password123)`);
}

main()
  .catch((e) => {
    console.error('❌ Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
