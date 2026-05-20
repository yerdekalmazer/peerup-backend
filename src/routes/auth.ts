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

// POST /auth/reset-password — basit parola sıfırlama (e-posta ile)
authRouter.post("/reset-password", async (req, res) => {
  const email = String(req.body?.email ?? "").trim().toLowerCase();
  const password = String(req.body?.password ?? "");
  if (!email || !password) {
    return res.status(400).json({ error: "E-posta ve yeni parola zorunludur" });
  }
  if (password.length < 6) {
    return res.status(400).json({ error: "Parola en az 6 karakter olmalı" });
  }

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    return res.status(404).json({ error: "Bu e-posta ile kayıtlı kullanıcı yok" });
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash: await hashPassword(password) },
  });
  res.json({ ok: true });
});
