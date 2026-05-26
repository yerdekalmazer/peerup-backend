import { Router } from "express";
import { prisma } from "../prisma";
import {
  hashPassword,
  verifyPassword,
  signUserToken,
  signAdminToken,
} from "../auth";
import { publicUser } from "../serialize";

export const authRouter = Router();

// POST /auth/register — mobil uygulama kaydı
authRouter.post("/register", async (req, res) => {
  const name = String(req.body?.name ?? "").trim();
  const email = String(req.body?.email ?? "").trim().toLowerCase();
  const password = String(req.body?.password ?? "");

  if (!name || !email || !password) {
    return res.status(400).json({ error: "Ad, e-posta ve parola zorunludur" });
  }
  if (password.length < 6) {
    return res.status(400).json({ error: "Parola en az 6 karakter olmalı" });
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return res.status(409).json({ error: "Bu e-posta zaten kayıtlı" });
  }

  const avatar = name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  const user = await prisma.user.create({
    data: {
      name,
      email,
      passwordHash: await hashPassword(password),
      avatar,
      role: req.body?.role === "teacher" ? "teacher" : "student",
    },
  });

  // Hoş geldin bildirimi
  await prisma.notification.create({
    data: {
      userId: user.id,
      type: "info",
      title: "PeerUP'a hoş geldin! 🎉",
      body: "Becerini öğret, yeni beceriler kazan.",
      icon: "sparkles-outline",
    },
  });

  res
    .status(201)
    .json({ user: publicUser(user), token: signUserToken(user.id) });
});

// POST /auth/login — mobil uygulama girişi
authRouter.post("/login", async (req, res) => {
  const email = String(req.body?.email ?? "").trim().toLowerCase();
  const password = String(req.body?.password ?? "");
  if (!email || !password) {
    return res.status(400).json({ error: "E-posta ve parola zorunludur" });
  }

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || user.status === "suspended") {
    return res.status(401).json({ error: "E-posta veya parola hatalı" });
  }
  const valid = await verifyPassword(password, user.passwordHash);
  if (!valid) {
    return res.status(401).json({ error: "E-posta veya parola hatalı" });
  }

  res.json({ user: publicUser(user), token: signUserToken(user.id) });
});

// POST /auth/admin/login — admin paneli girişi
authRouter.post("/admin/login", async (req, res) => {
  const email = String(req.body?.email ?? "").trim().toLowerCase();
  const password = String(req.body?.password ?? "");
  if (!email || !password) {
    return res.status(400).json({ error: "E-posta ve parola zorunludur" });
  }

  const admin = await prisma.adminUser.findUnique({ where: { email } });
  if (!admin) {
    return res.status(401).json({ error: "E-posta veya parola hatalı" });
  }
  const valid = await verifyPassword(password, admin.passwordHash);
  if (!valid) {
    return res.status(401).json({ error: "E-posta veya parola hatalı" });
  }

  await prisma.adminUser.update({
    where: { id: admin.id },
    data: { lastLoginAt: new Date() },
  });

  res.json({
    admin: { id: admin.id, email: admin.email, name: admin.name, role: admin.role },
    token: signAdminToken({ id: admin.id, role: admin.role }),
  });
});

/**
 * Şifre sıfırlama akışı.
 *
 * Çift adım:
 *   1) POST /auth/forgot-password { email }
 *      → 6 haneli OTP üretir, bellekte 10 dk saklar, kullanıcı email'i
 *        kayıtlı değilse bile aynı 200 cevabı döner (kullanıcı varlığı sızdırmaz).
 *   2) POST /auth/reset-password { email, code, password }
 *      → kod + email eşleşirse parolayı günceller, kodu siler.
 *
 * In-memory store: process restart sonrası kaybolur. Production'da Redis
 * veya DB tablosu kullanılmalı. Kod kullanıcıya nasıl iletilir:
 *   - Üretimde: email servisi (Resend, Postmark, SES vb.) — TODO.
 *   - Dev/staging'de: response içinde `devCode` döner ki UI test edilebilsin.
 *     `NODE_ENV=production` ise `devCode` gönderilmez.
 */
type ResetEntry = { code: string; expiresAt: number; userId: string };
const resetStore = new Map<string, ResetEntry>();
const RESET_TTL_MS = 10 * 60 * 1000;

function pruneResetStore() {
  const now = Date.now();
  for (const [email, entry] of resetStore.entries()) {
    if (entry.expiresAt < now) resetStore.delete(email);
  }
}

authRouter.post("/forgot-password", async (req, res) => {
  pruneResetStore();
  const email = String(req.body?.email ?? "").trim().toLowerCase();
  if (!email) return res.status(400).json({ error: "E-posta zorunlu" });

  const user = await prisma.user.findUnique({ where: { email } });
  const code = String(Math.floor(100000 + Math.random() * 900000));

  // Sadece kayıtlı kullanıcılar için kod sakla, ama yine 200 döndür ki
  // saldırgan hangi e-postaların kayıtlı olduğunu sıralayamasın.
  if (user) {
    resetStore.set(email, {
      code,
      expiresAt: Date.now() + RESET_TTL_MS,
      userId: user.id,
    });
    console.log(`[auth] reset code for ${email}: ${code}`);
    // TODO: production'da bu kodu email ile gönder.
  }

  const isDev = process.env.NODE_ENV !== "production";
  res.json({ ok: true, ...(isDev && user ? { devCode: code } : {}) });
});

authRouter.post("/reset-password", async (req, res) => {
  pruneResetStore();
  const email = String(req.body?.email ?? "").trim().toLowerCase();
  const code = String(req.body?.code ?? "").trim();
  const password = String(req.body?.password ?? "");
  if (!email || !code || !password) {
    return res
      .status(400)
      .json({ error: "E-posta, kod ve yeni parola zorunludur" });
  }
  if (password.length < 6) {
    return res.status(400).json({ error: "Parola en az 6 karakter olmalı" });
  }

  const entry = resetStore.get(email);
  if (!entry || entry.expiresAt < Date.now() || entry.code !== code) {
    return res.status(400).json({ error: "Kod hatalı veya süresi dolmuş" });
  }

  await prisma.user.update({
    where: { id: entry.userId },
    data: { passwordHash: await hashPassword(password) },
  });
  resetStore.delete(email);
  res.json({ ok: true });
});
