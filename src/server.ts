import "dotenv/config";
import express from "express";
import type { Request, Response, NextFunction } from "express";
import cors from "cors";
import swaggerUi from "swagger-ui-express";

import { authRouter } from "./routes/auth";
import { publicRouter } from "./routes/public";
import { sessionsRouter } from "./routes/sessions";
import { messagesRouter } from "./routes/messages";
import { notificationsRouter } from "./routes/notifications";
import { profileRouter } from "./routes/profile";
import { reportsRouter } from "./routes/reports";
import { adminRouter } from "./routes/admin";
import { openapiSpec } from "./openapi";

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

// Swagger UI ve ham OpenAPI JSON
app.get("/docs/openapi.json", (_req, res) => {
  res.json(openapiSpec);
});
app.use(
  "/docs",
  swaggerUi.serve,
  swaggerUi.setup(openapiSpec, {
    customSiteTitle: "PeerUP API Docs",
  }),
);

// API rotaları (mobil uygulama ile uyum için /api ön eki)
app.use("/api/auth", authRouter);
app.use("/api", publicRouter);
app.use("/api/sessions", sessionsRouter);
app.use("/api/conversations", messagesRouter);
app.use("/api/notifications", notificationsRouter);
app.use("/api/profile", profileRouter);
app.use("/api/reports", reportsRouter);
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
