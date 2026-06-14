# my-budget
Budget tracker dengan PocketBase & Telegram Bot.

## Struktur Project

```
my-budget/
├── pocketbase/
│   ├── docker-compose.yaml
│   ├── Dockerfile
│   ├── pb_data/
│   ├── pb_public/
│   ├── pb_migrations/
│   └── pb_hooks/
├── schema/
│   └── collections.json
├── src/
│   ├── domain/
│   │   ├── entities/
│   │   ├── interfaces/
│   │   └── use-cases/
│   ├── infrastructure/
│   │   ├── actual-budget/
│   │   ├── database/pocketbase/
│   │   ├── web/
│   │   └── telegram/
│   └── index.ts
├── scripts/
│   └── export-pb-schema.mjs
├── package.json
├── tsconfig.json
└── README.md
```

## Setup

### 1. PocketBase

```bash
cd ~/projects/my-budget/pocketbase
docker compose up -d
```

### 2. Import Collections

Setelah PocketBase running, import schema:

```bash
cd ~/projects/my-budget
node scripts/export-pb-schema.mjs
```

Import hasil export ke PocketBase Admin UI via **Settings > Backup/Restore > Restore**.

### 3. Clone & Setup Project

```bash
cd ~/projects/my-budget
cp .env.example .env
# Edit .env dengan kredensial yang sesuai
bun install
```

### 4. Jalankan Server

```bash
bun run dev
```

Server akan berjalan di `http://localhost:3001`.

### 5. Telegram Bot

Edit `.env` dengan Telegram Bot Token, lalu jalankan:

```bash
bun run telegram
```

## Fitur

- **Transaksi**: Catat pengeluaran via Telegram atau API
- **Budgeting**: Atur budget per kategori & sub-kategori
- **Daily Allowance**: Hitung sisa budget harian
- **Telegram Bot**: Add, budget, report, help
- **Actual Budget Sync**: Sinkron ke Actual Budget API

## API Endpoints

| Method | Endpoint | Keterangan |
|--------|----------|------------|
| POST | `/api/budget/transactions` | Tambah transaksi |
| GET | `/api/budget/progress` | Progress budget per kategori |
| GET | `/api/budget/daily-report` | Laporan budget harian |

## Telegram Bot Commands

- `/start` - Welcome message
- `/add` - Tambah transaksi baru
- `/budget` - Lihat progress budget
- `/report` - Laporan budget harian
- `/help` - Bantuan

## Formula Daily Allowance

Jika budget = **Rp 1.000.000** dan periode = **30 hari**:

- Daily Allowance = 1.000.000 / 30 = **Rp 33.333/day**
- Jika hari ini beli **Rp 100.000**, sisa = **Rp 900.000**
- Sisa hari = 29 hari
- Sisa per hari = 900.000 / 29 = **Rp 31.034/hari**

Bot akan menampilkan sisa per hari agar user tidak melebihi budget.

## Deploy ke Production

### Prasyarat

- Docker & Docker Compose
- Node.js/Bun runtime
- Telegram Bot Token
- Actual Budget API (port 3001)
- PocketBase (port 8091)

### Langkah Deploy

1. **Copy project ke VPS**
   ```bash
   scp -r ~/projects/my-budget user@your-server:/opt/my-budget
   ```

2. **Setup PocketBase di server**
   ```bash
   cd /opt/my-budget/pocketbase
   # Update .env dengan kredensial server
   docker compose up -d
   ```

3. **Import schema**
   ```bash
   cd /opt/my-budget
   node scripts/export-pb-schema.mjs
   ```

4. **Setup environment**
   ```bash
   cp .env.example .env
   # Edit .env dengan production credentials
   ```

5. **Install dependencies & build**
   ```bash
   bun install
   bun build  # check types
   ```

6. **Run production**
   ```bash
   bun start
   ```

### Docker Deployment

```bash
docker build -t my-budget .
docker run -d -p 3001:3001 --env-file .env my-budget
```

## Troubleshooting

### PocketBase tidak start
- Pastikan port 8091 tidak terpakai
- Cek logs: `docker compose logs pocketbase`

### Actual Budget sync gagal
- Pastikan Actual Budget running di port 3001
- Cek kredensial di `.env`

### Telegram bot tidak merespon
- Pastikan token benar di `.env`
- Pastikan webhook/long polling aktif

## License
MIT
# my-budget
