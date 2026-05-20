# PeerUP Backend

PeerUP mobil uygulamasının ve admin panelinin paylaştığı backend servisi.
Node.js + Express + TypeScript + Prisma (SQLite).

## Kurulum

```bash
npm install
npx prisma migrate dev   # veritabanını oluşturur
npm run db:seed          # örnek verileri yükler
```

## Çalıştırma

```bash
npm run dev    # http://localhost:4000 (otomatik yeniden başlatma)
# veya
npm start
```

## Varsayılan hesaplar

- **Admin:** `admin@peerup.com` / `peerup1234`
- **Mobil kullanıcılar:** `taha@peerup.com` (ve ali/selin/zeynep/elif @peerup.com) — parola `peerup123`

## API Uçları

### Genel (kimlik gerektirmez)
- `GET  /api/teachers` · `GET /api/teachers/:id`
- `GET  /api/categories`
- `GET  /api/chains`
- `POST /api/auth/register` · `POST /api/auth/login`
- `POST /api/auth/admin/login`

### Kullanıcı (Bearer token)
- `GET/POST /api/sessions` · `PATCH /api/sessions/:id` · `POST /api/sessions/:id/review`
- `GET /api/conversations` · `GET/POST /api/conversations/:id/messages`
- `GET /api/notifications` · `POST /api/notifications/read-all`
- `GET/PUT /api/profile` · `GET /api/profile/transactions` · `GET /api/profile/reviews`

### Admin (admin Bearer token)
- `GET /api/admin/stats` · `GET /api/admin/me`
- `/api/admin/{teachers,users,sessions,categories,chains}` — tam CRUD

## Mimari

```
┌─────────────┐      ┌──────────────────┐      ┌───────────────┐
│ PeerUP      │      │  peerup-backend  │      │  peerup-web   │
│ (mobil app) │─────▶│  Express + DB    │◀─────│  admin paneli │
└─────────────┘      └──────────────────┘      └───────────────┘
   Bearer token         tek veritabanı          proxy + çerez
```

- **peerup-web** admin paneli `/api/admin/*` isteklerini bu servise iletir.
- **PeerUP** mobil uygulaması `src/api/config.ts` içindeki adresle bağlanır.

## Komutlar

| Komut | Açıklama |
|-------|----------|
| `npm run dev` | Geliştirme sunucusu (watch) |
| `npm run db:seed` | Veritabanını örnek veriyle doldurur |
| `npm run db:reset` | Veritabanını sıfırlar ve yeniden seed eder |
