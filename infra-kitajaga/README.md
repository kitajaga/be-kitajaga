# Infrastructure Setup (infra-kitajaga)

Directory ini berisi konfigurasi infrastruktur Docker Compose untuk menjalankan database PostgreSQL dan aplikasi backend Kitajaga secara kontainerisasi.

## Struktur File Relasional
- `infra-kitajaga/docker-compose.yml` -> Konfigurasi orchestration (Postgres 16 + Bun App Service).
- `Dockerfile` (di root) -> Image definition berbasis `oven/bun:1`.
- `.env` (di root) -> Environment variables yang dibaca oleh container.

---

## Cara Menjalankan

Ikuti langkah-langkah berikut untuk menjalankan environment development:

### 1. Jalankan Docker Compose
Masuk ke directory ini dan nyalakan kontainer:
```bash
cd infra-kitajaga
docker compose up --build -d
```
*Note: `--build` memaksa docker me-rebuild image jika ada perubahan dependencies, `-d` menjalankannya di background.*

### 2. Jalankan Database Migration
Setelah kontainer database (`kitajaga-postgres-1`) sehat dan kontainer aplikasi (`kitajaga-app-1`) menyala, jalankan migrasi database di dalam kontainer aplikasi:
```bash
docker compose exec app bunx prisma migrate dev --name init
```

### 3. Memasukkan Seed Data (Opsional)
Jika sudah siap melakukan testing dengan dummy data:
```bash
docker compose exec app bun run seed
```

---

## Perintah Penting Lainnya

- **Melihat Log Aplikasi:**
  ```bash
  docker compose logs -f app
  ```
- **Mematikan Kontainer:**
  ```bash
  docker compose down
  ```
- **Masuk ke Terminal Kontainer Aplikasi (Interactive Shell):**
  ```bash
  docker compose exec app sh
  ```
- **Membuka Prisma Studio (Database GUI):**
  ```bash
  docker compose exec app bunx prisma studio
  ```
  *(Akses studio via http://localhost:5555 di browser lokal Anda jika port diforward).*
