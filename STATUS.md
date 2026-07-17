# STATUS.md

> Update file ini setiap kali selesai 1 task. Ini source of truth progress, jangan andalkan cuma memory AI antar sesi.

## Done
- [x] Setup Docker Compose + Prisma schema + migrate
- [x] Auth (register/login) + middleware role
- [x] Patient CRUD
- [x] Booking create + state machine service
- [x] Matching engine (tanpa payment dulu)
- [x] Caregiver profile & status update endpoints
- [x] Midtrans charge + webhook
- [x] Guidebook service (fallback dulu, baru LLM call)
- [x] Reschedule & no-show handling (manual reschedule & cancel)
- [x] Progress tracking (GPS + foto) + Leaflet map
- [x] WebSocket chat + auto system message
- [x] Report & rating + payment release
- [x] Seed data & rehearsal demo end-to-end
- [x] Fix: Integrasi modul report dan rating pada detail booking (backend + frontend)
- [x] Fix: Filter dashboard caregiver untuk mengecualikan booking dengan status selesai (reported/completed)
- [x] Fix: Sinkronisasi tipe mobilitas 'wheelchair' dan penanganan auto-logout pada token kedaluwarsa

## In Progress
- [ ] (Sesi verifikasi E2E & perbaikan integrasi selesai)

## Next (Urutan Prioritas)
- (Semua prioritas utama sudah di-deploy)

## Known Blockers
- (isi kalau ada, misal: menunggu API key Midtrans/LLM dari anggota tim lain)
