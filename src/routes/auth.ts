import { Router } from "express";
import { prisma } from "../prisma";
import {
  hashPassword,
  verifyPassword,
  signUserToken,
  signAdminToken,
} from "../auth";
import { publicUser } from "../serialize";
import { sendMail, codeEmailHtml } from "../email";
import { OAuth2Client } from "google-auth-library";

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

  const isDev = process.env.NODE_ENV !== "production";
  const devCode = makeVerifyCode(email);

  res
    .status(201)
    .json({
      user: publicUser(user),
      token: signUserToken(user.id),
      ...(isDev ? { devVerifyCode: devCode } : {}),
    });
});

authRouter.post("/send-verify-email", async (req, res) => {
  const email = String(req.body?.email ?? "").trim().toLowerCase();
  if (!email) return res.status(400).json({ error: "E-posta zorunlu" });
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) return res.json({ ok: true }); // sızdırma
  if (user.emailVerified) return res.json({ ok: true, alreadyVerified: true });
  const code = makeVerifyCode(email);
  const isDev = process.env.NODE_ENV !== "production";
  res.json({ ok: true, ...(isDev ? { devCode: code } : {}) });
});

authRouter.post("/verify-email", async (req, res) => {
  pruneVerifyStore();
  const email = String(req.body?.email ?? "").trim().toLowerCase();
  const code = String(req.body?.code ?? "").trim();
  if (!email || !code) {
    return res.status(400).json({ error: "E-posta ve kod gerekli" });
  }
  const entry = verifyStore.get(email);
  if (!entry || entry.expiresAt < Date.now() || entry.code !== code) {
    return res.status(400).json({ error: "Kod hatalı veya süresi dolmuş" });
  }
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) return res.status(404).json({ error: "Kullanıcı bulunamadı" });
  await prisma.user.update({
    where: { id: user.id },
    data: { emailVerified: true },
  });
  verifyStore.delete(email);
  res.json({ ok: true });
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

/**
 * POST /auth/google
 * Body: { idToken: string }
 *
 * Mobil tarafta `expo-auth-session/providers/google` ile alınan id_token
 * burada doğrulanır. Audience olarak env'deki Google OAuth client ID'leri
 * kabul edilir (iOS / Android / Web — virgülle ayırarak ekle).
 *
 * Kullanıcı yoksa otomatik kayıt olur (emailVerified: true, çünkü Google
 * adresi zaten doğrulamış demektir). Varsa direkt login eder.
 */
const googleAudiences = (process.env.GOOGLE_CLIENT_IDS ?? "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);
const googleClient = new OAuth2Client();

authRouter.post("/google", async (req, res) => {
  const idToken = String(req.body?.idToken ?? "");
  if (!idToken) return res.status(400).json({ error: "idToken gerekli" });
  if (googleAudiences.length === 0) {
    return res
      .status(500)
      .json({ error: "Google girişi henüz yapılandırılmadı" });
  }

  let payload;
  try {
    const ticket = await googleClient.verifyIdToken({
      idToken,
      audience: googleAudiences,
    });
    payload = ticket.getPayload();
  } catch (e) {
    console.warn("[auth/google] token doğrulanamadı:", e);
    return res.status(401).json({ error: "Google token geçersiz" });
  }

  if (!payload?.email || !payload.email_verified) {
    return res.status(401).json({ error: "Google hesabı doğrulanmamış" });
  }
  const email = payload.email.toLowerCase();
  const name = payload.name || email.split("@")[0];

  let user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    const avatar = name
      .split(" ")
      .map((p) => p[0])
      .slice(0, 2)
      .join("")
      .toUpperCase();
    user = await prisma.user.create({
      data: {
        name,
        email,
        passwordHash: "", // Google girişli kullanıcı için boş; reset-password ile sonradan ayarlanabilir
        avatar,
        emailVerified: true,
      },
    });
    await prisma.notification.create({
      data: {
        userId: user.id,
        type: "info",
        title: "PeerUP'a hoş geldin! 🎉",
        body: "Google hesabınla giriş yaptın.",
        icon: "sparkles-outline",
      },
    });
  } else if (!user.emailVerified) {
    user = await prisma.user.update({
      where: { id: user.id },
      data: { emailVerified: true },
    });
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

// Email doğrulama kodları — aynı pattern, ayrı map.
const verifyStore = new Map<string, { code: string; expiresAt: number }>();
const VERIFY_TTL_MS = 30 * 60 * 1000;
function pruneVerifyStore() {
  const now = Date.now();
  for (const [email, entry] of verifyStore.entries()) {
    if (entry.expiresAt < now) verifyStore.delete(email);
  }
}
function makeVerifyCode(email: string) {
  const code = String(Math.floor(100000 + Math.random() * 900000));
  verifyStore.set(email, { code, expiresAt: Date.now() + VERIFY_TTL_MS });
  console.log(`[auth] verify code for ${email}: ${code}`);
  void sendMail({
    to: email,
    subject: "PeerUP — E-posta doğrulama kodun",
    html: codeEmailHtml({
      title: "E-postanı doğrula",
      intro: "PeerUP hesabını aktif etmek için bu 6 haneli kodu kullan:",
      code,
      ttlMinutes: 30,
    }),
  });
  return code;
}

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
    void sendMail({
      to: email,
      subject: "PeerUP — Şifre sıfırlama kodun",
      html: codeEmailHtml({
        title: "Şifre sıfırlama kodun",
        intro: "Aşağıdaki 6 haneli kodu uygulamada \"Şifre Sıfırla\" ekranına gir:",
        code,
        ttlMinutes: 10,
      }),
    });
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
