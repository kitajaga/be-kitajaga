import { prisma } from '../config/database';
import { Patient, Guidebook } from '@prisma/client';
import { logger } from '../utils/logger';
import { env } from '../config/env';
import axios from 'axios';

export interface GuidebookContent {
  quickSummary: string;
  do: string[];
  dont: string[];
  warningSigns: string[];
}

export function getFallbackTemplate(patient: Patient): GuidebookContent {
  const name = patient.name;
  const mobility = patient.mobilityStatus.toLowerCase();
  
  // Custom list based on mobility status
  let doList = [
    'Pastikan lingkungan sekitar pasien aman dari barang pecah belah atau kabel berserakan.',
    'Bantu pasien minum obat tepat waktu sesuai resep medis.',
    'Pantau pola makan dan asupan air pasien secara berkala.',
  ];
  let dontList = [
    'Jangan tinggalkan pasien tanpa pengawasan dalam waktu yang lama.',
    'Jangan memaksakan pasien melakukan aktivitas fisik berat.',
  ];
  let warningSigns = [
    'Pasien mengeluh pusing hebat, sesak nafas, atau nyeri dada.',
    'Terjadi penurunan kesadaran atau kebingungan mental yang mendadak.',
    'Pasien terjatuh atau mengalami cedera fisik.',
  ];

  if (mobility === 'immobile' || mobility === 'bedridden') {
    doList.push('Ubah posisi tidur pasien setiap 2 jam untuk mencegah luka tekan (dekubitus).');
    doList.push('Lakukan latihan peregangan sendi pasif secara lembut.');
    dontList.push('Jangan menarik lengan atau kaki pasien dengan kasar saat mengubah posisi.');
    warningSigns.push('Adanya kemerahan atau luka pada kulit di area tulang yang menonjol.');
  } else if (mobility === 'assisted' || mobility === 'wheelchair') {
    doList.push('Bantu pasien berpindah dari tempat tidur ke kursi roda dengan teknik pemindahan yang aman.');
    doList.push('Pastikan kunci roda pada kursi roda terkunci sebelum memindahkan pasien.');
    dontList.push('Jangan membiarkan pasien berjalan atau berdiri tanpa alat bantu atau pegangan.');
  } else {
    doList.push('Temani pasien saat berjalan di area yang licin seperti kamar mandi.');
  }

  // Include emergency contact detail into quick summary
  const summary = `Panduan pendampingan untuk pasien bernama ${name}. Tingkat mobilitas pasien adalah ${mobility}. Kontak darurat dapat dihubungi via Rina (${patient.emergencyContactPhone}).`;

  return {
    quickSummary: summary,
    do: doList,
    dont: dontList,
    warningSigns,
  };
}

async function generateWithLLM(patient: Patient): Promise<GuidebookContent> {
  const patientDataText = `
    Nama: ${patient.name}
    Mobilitas: ${patient.mobilityStatus}
    Alergi: ${JSON.stringify(patient.allergies)}
    Obat Saat Ini: ${JSON.stringify(patient.currentMedications)}
    Catatan Medis / Notes: ${patient.medicalNotes || 'Tidak ada'}
    Kontak Darurat: ${patient.emergencyContactName} (${patient.emergencyContactPhone})
  `;

  const model = env.LLM_MODEL || 'gpt-4o-mini';

  const response = await axios.post(
    'https://api.openai.com/v1/chat/completions',
    {
      model: model,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content: `Anda adalah asisten medis profesional. Buat panduan perawatan (guidebook) pasien dalam bahasa Indonesia. Response HARUS berupa JSON object dengan keys:
            - "quickSummary": ringkasan singkat kondisi pasien, kebutuhan medisnya, dan kontak darurat.
            - "do": array string berisi setidaknya 4 instruksi perawatan konkret yang wajib dilakukan caregiver.
            - "dont": array string berisi setidaknya 3 pantangan/hal dilarang demi keselamatan pasien.
            - "warningSigns": array string berisi setidaknya 3 tanda-tanda bahaya darurat yang membutuhkan tindakan segera.`
        },
        {
          role: 'user',
          content: `Berikut data medis pasien:\n${patientDataText}`
        }
      ],
      temperature: 0.3
    },
    {
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${env.LLM_API_KEY}`
      },
      timeout: 10000 // 10s timeout
    }
  );

  const jsonText = response.data.choices[0].message.content;
  return JSON.parse(jsonText) as GuidebookContent;
}

export async function generateGuidebook(bookingId: string): Promise<Guidebook> {
  try {
    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      include: { patient: true },
    });

    if (!booking) {
      throw new Error(`Booking ${bookingId} tidak ditemukan untuk pembuatan guidebook`);
    }

    let content: GuidebookContent;

    // Check if real LLM API Key is configured
    const hasRealKey = env.LLM_API_KEY && !env.LLM_API_KEY.includes('xxxx');

    if (hasRealKey) {
      try {
        logger.info(`Generating guidebook with OpenAI GPT (${env.LLM_MODEL})...`);
        content = await generateWithLLM(booking.patient);
        logger.info('Guidebook generated successfully with LLM');
      } catch (err: any) {
        logger.warn('LLM Generation failed, falling back to static template:', err.message);
        content = getFallbackTemplate(booking.patient);
      }
    } else {
      logger.info('LLM Key not configured or placeholder, using static template');
      content = getFallbackTemplate(booking.patient);
    }

    const guidebook = await prisma.guidebook.create({
      data: {
        bookingId: booking.id,
        patientId: booking.patientId,
        content: content as any, // Cast as Prisma Json
      },
    });

    logger.info(`Guidebook record created in DB: ${guidebook.id}`);
    return guidebook;
  } catch (err: any) {
    logger.error(`Error in generateGuidebook for booking ${bookingId}:`, err);
    throw err;
  }
}
