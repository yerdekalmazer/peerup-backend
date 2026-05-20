import "dotenv/config";
import express from "express";
import type { Request, Response, NextFunction } from "express";
import cors from "cors";

import { authRouter } from "./routes/auth";
import { publicRouter } from "./routes/public";
import { sessionsRouter } from "./routes/sessions";
import { messagesRouter } from "./routes/messages";
import { notificationsRouter } from "./routes/notifications";
import { profileRouter } from "./routes/profile";
import { adminRouter } from "./routes/admin";

const app = express();

app.use(cors()); // mobil uygulama ve admin paneli farklı origin'lerden erişir
app.use(express.json());

// İstek günlüğü
app.use((req, _res, next) => {
  console.log(`${req.method} ${req.url}`);
  next();
});

// Sağlık kontrolü
app.get("/", (_req, res) => {
  res.json({ service: "peerup-backend", status: "ok" });
});

// API rotaları (mobil uygulama ile uyum için /api ön eki)
app.use("/api/auth", authRouter);
app.use("/api", publicRouter);
app.use("/api/sessions", sessionsRouter);
app.use("/api/conversations", messagesRouter);
app.use("/api/notifications", notificationsRouter);
app.use("/api/profile", profileRouter);
app.use("/api/admin", adminRouter);

// 404
app.use((_req, res) => {
  res.status(404).json({ error: "Uç bulunamadı" });
});

// Hata yakalayıcı
app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  console.error("❌ Sunucu hatası:", err);
  res.status(500).json({ error: "Sunucu hatası" });
});

const PORT = Number(process.env.PORT ?? 4000);
app.listen(PORT, () => {
  console.log(`🚀 peerup-backend çalışıyor → http://localhost:${PORT}`);
});
