# DECISIONS.md

> Log keputusan yang berubah/override dari rencana awal di PRD.md/backend.md. Ini penting supaya AI tidak bingung mana yang harus diikuti kalau ada kontradiksi dengan dokumen rencana awal.

- Drop sistem tiering caregiver (general/semi-professional/professional), ganti dengan field `patient.riskLevel` (low/high) sebagai badge warning UI saja, bukan gating logic. Alasan: keterbatasan waktu 36 jam.
- **[Payment]** Payment pakai Midtrans **Snap**. Alasan: mengejar kecepatan development di hackathon, tidak perlu bikin UI checkout custom sendiri. Trade-off: kontrol tampilan checkout diserahkan ke Midtrans, tapi logic bisnis (booking status, escrow held/released) tetap dikontrol backend sendiri.
- Escrow disimulasikan lewat kolom `payments.status` (held/released), bukan fitur native Midtrans (Midtrans tidak native escrow).
- Map pakai **Leaflet.js + OpenStreetMap**, bukan Google Maps JS SDK atau Google Static Map. Alasan: tidak butuh API key/billing setup, render marker beda per booking, lebih ringan untuk hackathon.
- Progress tracking berbasis **checkpoint snapshot** (status + GPS otomatis + foto di titik kunci), BUKAN realtime GPS streaming lewat WebSocket. Alasan: lebih ringan di server & baterai device caregiver.
- Foto bukti hanya wajib di 4 checkpoint kunci (`picked_up_patient`, `arrived_registration`, `in_consultation`, `completed`), bukan di semua 8 status. Alasan: mengurangi beban UX caregiver.
- Fasilitas kesehatan tujuan dipilih **User saat create booking**, bukan diinput caregiver di tengah jalan.
- [2026-07-16] — Runtime/package manager diganti dari **Node.js + npm + tsx** ke **Bun**. Alasan: `bun install` jauh lebih cepat, Bun natively run TypeScript tanpa perlu `tsx`, built-in watch mode. Prisma tetap kompatibel via `bunx prisma`. Trade-off: Bun belum 100% kompatibel dengan semua Node.js API, tapi untuk scope hackathon ini cukup.
- [2026-07-17] — **[Booking Overlap Validation]**: Pasien diizinkan memiliki lebih dari 1 booking aktif sekaligus dengan jadwal berbeda (misalnya 1 booking immediate hari ini dan 1 booking scheduled 3 hari ke depan). Validasi backend hanya menolak booking baru jika terdapat jadwal yang bertabrakan (*overlap*) dalam rentang ±24 jam dari jadwal booking baru untuk status aktif (`pending_matching`, `matched`, `paid`, `scheduled`, `in_progress`). Status `completed`, `reported`, `cancelled`, dan `reschedule_failed` dikecualikan dari pengecekan overlap.
- [2026-07-17] — **[Booking Detail Payload Extension]**: Menyembunyikan pemanggilan endpoint terpisah yang tidak terdaftar di backend (seperti query spesifik ke `GET /bookings/:id/report`). Sebagai gantinya, data `report`, `rating`, dan `review` digabungkan langsung ke dalam payload response `GET /bookings/:id` untuk kedua role (User & Caregiver).

