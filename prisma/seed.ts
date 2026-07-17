import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seeding...');

  // Clean existing data
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

  // 1. Create Main User Client (demo.user@kitajaga.test)
  const clientUser = await prisma.user.create({
    data: {
      name: 'Zaki Ibrahim',
      email: 'demo.user@kitajaga.test',
      phone: '081234567890',
      photoUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=200',
      passwordHash,
      role: 'user',
    },
  });

  // Also create zaki@mail.com alias for backward compatibility in tests
  await prisma.user.create({
    data: {
      name: 'Zaki Ibrahim (Alias)',
      email: 'zaki@mail.com',
      phone: '081234567890',
      photoUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=200',
      passwordHash,
      role: 'user',
    },
  });

  // 2. Create 2 Patients for demo.user@kitajaga.test
  const patient1 = await prisma.patient.create({
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

  await prisma.patient.create({
    data: {
      userId: clientUser.id,
      name: 'Siti Aminah',
      dateOfBirth: new Date('1960-08-20'),
      gender: 'female',
      address: 'Jl. Kebon Sirih No.45, Jakarta',
      latitude: -6.183,
      longitude: 106.829,
      mobilityStatus: 'wheelchair',
      allergies: ['Kacang'],
      currentMedications: ['Allopurinol 100mg'],
      medicalNotes: 'Memerlukan kursi roda untuk mobilitas.',
      riskLevel: 'low',
      emergencyContactName: 'Zaki',
      emergencyContactPhone: '081234567890',
    },
  });

  // 3. Create 5 Caregivers (all availabilityStatus: "online", calibrated matching scores)
  const caregiversData = [
    {
      name: 'Suster Rina',
      email: 'rina@mail.com', // Rank 1 Caregiver
      phone: '081298765432',
      photoUrl: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&q=80&w=200',
      lat: -6.195, // 0 km distance to Menteng patient -> Score Rank 1 (1.000)
      lon: 106.832,
      averageRating: 5.0,
      rescheduleCount: 0,
      totalCompletedBookings: 15,
    },
    {
      name: 'Suster Siti',
      email: 'caregiver2@kitajaga.test', // Rank 2 Caregiver
      phone: '081211112222',
      photoUrl: 'https://images.unsplash.com/photo-1559839734-2b71ea197ec2?auto=format&fit=crop&q=80&w=200',
      lat: -6.177, // ~2 km distance -> Score Rank 2 (~0.65)
      lon: 106.832,
      averageRating: 4.8,
      rescheduleCount: 0,
      totalCompletedBookings: 10,
    },
    {
      name: 'Mba Maya',
      email: 'caregiver3@kitajaga.test', // Rank 3 Caregiver
      phone: '081233334444',
      photoUrl: 'https://images.unsplash.com/photo-1582750433449-648ed127bb54?auto=format&fit=crop&q=80&w=200',
      lat: -6.150, // ~5 km distance -> Score Rank 3 (~0.53)
      lon: 106.832,
      averageRating: 4.6,
      rescheduleCount: 1,
      totalCompletedBookings: 8,
    },
    {
      name: 'Mas Budi',
      email: 'caregiver4@kitajaga.test', // Rank 4 Caregiver
      phone: '081255556666',
      photoUrl: 'https://images.unsplash.com/photo-1622253692010-333f2da6031d?auto=format&fit=crop&q=80&w=200',
      lat: -6.123, // ~8 km distance -> Score Rank 4 (~0.45)
      lon: 106.832,
      averageRating: 4.2,
      rescheduleCount: 2,
      totalCompletedBookings: 5,
    },
    {
      name: 'Suster Dewi',
      email: 'caregiver5@kitajaga.test', // Rank 5 Caregiver
      phone: '081277778888',
      photoUrl: 'https://images.unsplash.com/photo-1594824813566-88855ce78905?auto=format&fit=crop&q=80&w=200',
      lat: -6.087, // ~12 km distance -> Score Rank 5 (~0.39)
      lon: 106.832,
      averageRating: 4.0,
      rescheduleCount: 3,
      totalCompletedBookings: 3,
    },
  ];

  for (const cg of caregiversData) {
    const cgUser = await prisma.user.create({
      data: {
        name: cg.name,
        email: cg.email,
        phone: cg.phone,
        photoUrl: cg.photoUrl,
        passwordHash,
        role: 'caregiver',
      },
    });

    await prisma.caregiver.create({
      data: {
        userId: cgUser.id,
        availabilityStatus: 'online', // All caregivers online by default for frontend display
        currentLatitude: cg.lat,
        currentLongitude: cg.lon,
        workingRadiusKm: 15,
        averageRating: cg.averageRating,
        totalCompletedBookings: cg.totalCompletedBookings,
        rescheduleCount: cg.rescheduleCount,
        photoUrl: cg.photoUrl,
        verificationStatus: 'verified',
      },
    });
  }

  console.log('✅ Seeding completed successfully!');
  console.log(`- Main User Client: demo.user@kitajaga.test (password: password123)`);
  console.log(`- 2 Patients created under demo.user@kitajaga.test (Budi Santoso & Siti Aminah)`);
  console.log(`- 5 Caregivers created (All ONLINE). Suster Rina (rina@mail.com) is calibrated as Rank 1!`);
}

main()
  .catch((e) => {
    console.error('❌ Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
