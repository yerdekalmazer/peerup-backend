import { Router } from "express";
import { prisma } from "../prisma";
import { requireAdmin, requireRole, hashPassword } from "../auth";
import { serializeTeacher, safeParse } from "../serialize";
import { writeAudit } from "../audit";

export const adminRouter = Router();
adminRouter.use(requireAdmin);

const safeUser = { omit: { passwordHash: true } } as const;

// ── GET /admin/me ────────────────────────────────────────────
adminRouter.get("/me", async (req, res) => {
  const admin = await prisma.adminUser.findUnique({
    where: { id: req.adminId },
    select: { id: true, email: true, name: true, role: true },
  });
  if (!admin) return res.status(404).json({ error: "Admin bulunamadı" });
  res.json(admin);
});

// ── GET /admin/stats ─────────────────────────────────────────
adminRouter.get("/stats", async (_req, res) => {
  const [
    teacherCount, userCount, sessionCount, categoryCount, chainCount,
    upcoming, completed, cancelled, onlineTeachers,
    teachers, categories, recentSessions, recentUsers, chains,
  ] = await Promise.all([
    prisma.teacher.count(),
    prisma.user.count(),
    prisma.session.count(),
    prisma.category.count(),
    prisma.skillChain.count(),
    prisma.session.count({ where: { status: "upcoming" } }),
    prisma.session.count({ where: { status: "completed" } }),
    prisma.session.count({ where: { status: "cancelled" } }),
    prisma.teacher.count({ where: { online: true } }),
    prisma.teacher.findMany({ select: { rating: true, category: true } }),
    prisma.category.findMany({ orderBy: { order: "asc" } }),
    prisma.session.findMany({ orderBy: { createdAt: "desc" }, take: 6 }),
    prisma.user.findMany({
      orderBy: { createdAt: "desc" }, take: 6,
      select: { id: true, name: true, email: true, avatar: true, avatarColor: true, role: true, createdAt: true },
    }),
    prisma.skillChain.findMany({ select: { totalReach: true } }),
  ]);

  const avgRating =
    teachers.length > 0
      ? teachers.reduce((s, t) => s + t.rating, 0) / teachers.length
      : 0;

  res.json({
    totals: {
      teachers: teacherCount,
      users: userCount,
      sessions: sessionCount,
      categories: categoryCount,
      chains: chainCount,
      onlineTeachers,
      avgRating: Number(avgRating.toFixed(2)),
      totalReach: chains.reduce((s, c) => s + c.totalReach, 0),
    },
    sessions: { upcoming, completed, cancelled },
    categoryDistribution: categories.map((c) => ({
      label: c.label,
      count: teachers.filter((t) => t.category === c.label).length,
    })),
    recentSessions,
    recentUsers,
  });
});

// ── Teachers ─────────────────────────────────────────────────
adminRouter.get("/teachers", async (req, res) => {
  const q = (req.query.q as string | undefined)?.trim();
  const teachers = await prisma.teacher.findMany({
    where: q
      ? { OR: [{ name: { contains: q } }, { skill: { contains: q } }] }
      : {},
    orderBy: { createdAt: "desc" },
  });
  res.json(teachers.map(serializeTeacher));
});

adminRouter.post("/teachers", async (req, res) => {
  const b = req.body ?? {};
  const name = String(b.name ?? "").trim();
  const skill = String(b.skill ?? "").trim();
  const category = String(b.category ?? "").trim();
  if (!name || !skill || !category) {
    return res.status(400).json({ error: "Ad, beceri ve kategori zorunludur" });
  }
  const avatar =
    String(b.avatar ?? "").trim() ||
    name.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase();

  const created = await prisma.teacher.create({
    data: {
      name, skill, category, avatar,
      avatarColor: String(b.avatarColor ?? "#6366F1"),
      bio: String(b.bio ?? ""),
      rating: Number(b.rating ?? 0),
      reviews: Number(b.reviews ?? 0),
      coinRate: Number(b.coinRate ?? 1),
      sessionsCount: Number(b.sessionsCount ?? 0),
      online: Boolean(b.online ?? false),
      verified: Boolean(b.verified ?? false),
      badges: JSON.stringify(Array.isArray(b.badges) ? b.badges : []),
    },
  });
  res.status(201).json(serializeTeacher(created));
});

adminRouter.get("/teachers/:id", async (req, res) => {
  const teacher = await prisma.teacher.findUnique({ where: { id: req.params.id } });
  if (!teacher) return res.status(404).json({ error: "Öğretmen bulunamadı" });
  res.json(serializeTeacher(teacher));
});

adminRouter.put("/teachers/:id", async (req, res) => {
  const b = req.body ?? {};
  const data: Record<string, unknown> = {};
  const str = ["name", "skill", "category", "avatar", "avatarColor", "bio"];
  const num = ["rating", "reviews", "coinRate", "sessionsCount"];
  const bool = ["online", "verified"];
  for (const k of str) if (b[k] !== undefined) data[k] = String(b[k]);
  for (const k of num) if (b[k] !== undefined) data[k] = Number(b[k]);
  for (const k of bool) if (b[k] !== undefined) data[k] = Boolean(b[k]);
  if (b.badges !== undefined) {
    data.badges = JSON.stringify(Array.isArray(b.badges) ? b.badges : []);
  }
  try {
    const updated = await prisma.teacher.update({ where: { id: req.params.id }, data });
    res.json(serializeTeacher(updated));
  } catch {
    res.status(404).json({ error: "Öğretmen güncellenemedi" });
  }
});

adminRouter.delete("/teachers/:id", async (req, res) => {
  try {
    await prisma.teacher.delete({ where: { id: req.params.id } });
    res.json({ ok: true });
  } catch {
    res.status(404).json({ error: "Öğretmen silinemedi" });
  }
});

// ── Users ────────────────────────────────────────────────────
adminRouter.get("/users", async (req, res) => {
  const q = (req.query.q as string | undefined)?.trim();
  const users = await prisma.user.findMany({
    where: q
      ? { OR: [{ name: { contains: q } }, { email: { contains: q } }] }
      : {},
    orderBy: { createdAt: "desc" },
    ...safeUser,
  });
  res.json(users);
});

adminRouter.post("/users", async (req, res) => {
  const b = req.body ?? {};
  const name = String(b.name ?? "").trim();
  const email = String(b.email ?? "").trim().toLowerCase();
  const password = String(b.password ?? "");
  if (!name || !email || !password) {
    return res.status(400).json({ error: "Ad, e-posta ve parola zorunludur" });
  }
  if (password.length < 6) {
    return res.status(400).json({ error: "Parola en az 6 karakter olmalı" });
  }
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) return res.status(409).json({ error: "Bu e-posta zaten kayıtlı" });

  const avatar =
    String(b.avatar ?? "").trim() ||
    name.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase();

  const created = await prisma.user.create({
    data: {
      name, email, avatar,
      passwordHash: await hashPassword(password),
      avatarColor: String(b.avatarColor ?? "#6366F1"),
      bio: String(b.bio ?? ""),
      coins: Number(b.coins ?? 10),
      role: b.role === "teacher" ? "teacher" : "student",
    },
    ...safeUser,
  });
  res.status(201).json(created);
});

adminRouter.put("/users/:id", async (req, res) => {
  const b = req.body ?? {};
  const data: Record<string, unknown> = {};
  if (b.name !== undefined) data.name = String(b.name);
  if (b.avatar !== undefined) data.avatar = String(b.avatar);
  if (b.avatarColor !== undefined) data.avatarColor = String(b.avatarColor);
  if (b.bio !== undefined) data.bio = String(b.bio);
  if (b.coins !== undefined) data.coins = Number(b.coins);
  if (b.role !== undefined) data.role = b.role === "teacher" ? "teacher" : "student";
  if (b.status !== undefined) {
    data.status = b.status === "suspended" ? "suspended" : "active";
  }
  if (b.password) {
    if (String(b.password).length < 6) {
      return res.status(400).json({ error: "Parola en az 6 karakter olmalı" });
    }
    data.passwordHash = await hashPassword(String(b.password));
  }
  try {
    const updated = await prisma.user.update({
      where: { id: req.params.id }, data, ...safeUser,
    });
    res.json(updated);
  } catch {
    res.status(404).json({ error: "Kullanıcı güncellenemedi" });
  }
});

adminRouter.delete("/users/:id", async (req, res) => {
  try {
    await prisma.user.delete({ where: { id: req.params.id } });
    res.json({ ok: true });
  } catch {
    res.status(404).json({ error: "Kullanıcı silinemedi" });
  }
});

// ── Sessions ─────────────────────────────────────────────────
adminRouter.get("/sessions", async (req, res) => {
  const status = req.query.status as string | undefined;
  const sessions = await prisma.session.findMany({
    where: status ? { status } : {},
    orderBy: { createdAt: "desc" },
  });
  res.json(sessions);
});

adminRouter.post("/sessions", async (req, res) => {
  const b = req.body ?? {};
  const teacherName = String(b.teacherName ?? "").trim();
  const skill = String(b.skill ?? "").trim();
  const date = String(b.date ?? "").trim();
  const time = String(b.time ?? "").trim();
  if (!teacherName || !skill || !date || !time) {
    return res.status(400).json({ error: "Öğretmen, beceri, tarih ve saat zorunludur" });
  }
  const teacher = await prisma.teacher.findFirst({ where: { name: teacherName } });
  const created = await prisma.session.create({
    data: {
      teacherName,
      teacherAvatar: teacher?.avatar ?? String(b.teacherAvatar ?? ""),
      avatarColor: teacher?.avatarColor ?? String(b.avatarColor ?? "#6366F1"),
      skill, date, time,
      duration: Number(b.duration ?? 60),
      cost: Number(b.cost ?? 1),
      type: String(b.type ?? "online"),
      status: ["upcoming", "completed", "cancelled"].includes(String(b.status))
        ? String(b.status) : "upcoming",
    },
  });
  res.status(201).json(created);
});

adminRouter.put("/sessions/:id", async (req, res) => {
  const b = req.body ?? {};
  const data: Record<string, unknown> = {};
  for (const k of ["teacherName", "skill", "date", "time", "type"]) {
    if (b[k] !== undefined) data[k] = String(b[k]);
  }
  if (b.duration !== undefined) data.duration = Number(b.duration);
  if (b.cost !== undefined) data.cost = Number(b.cost);
  if (b.rating !== undefined) {
    data.rating = b.rating === null ? null : Number(b.rating);
  }
  if (b.status !== undefined && ["upcoming", "completed", "cancelled"].includes(String(b.status))) {
    data.status = String(b.status);
  }
  try {
    const updated = await prisma.session.update({ where: { id: req.params.id }, data });
    res.json(updated);
  } catch {
    res.status(404).json({ error: "Oturum güncellenemedi" });
  }
});

adminRouter.delete("/sessions/:id", async (req, res) => {
  try {
    await prisma.session.delete({ where: { id: req.params.id } });
    res.json({ ok: true });
  } catch {
    res.status(404).json({ error: "Oturum silinemedi" });
  }
});

// ── Categories ───────────────────────────────────────────────
adminRouter.get("/categories", async (_req, res) => {
  const categories = await prisma.category.findMany({ orderBy: { order: "asc" } });
  res.json(categories);
});

adminRouter.post("/categories", async (req, res) => {
  const label = String(req.body?.label ?? "").trim();
  if (!label) return res.status(400).json({ error: "Kategori adı zorunludur" });
  const last = await prisma.category.findFirst({ orderBy: { order: "desc" } });
  const created = await prisma.category.create({
    data: {
      label,
      icon: String(req.body?.icon ?? "grid-outline"),
      order: Number(req.body?.order ?? (last?.order ?? 0) + 1),
    },
  });
  res.status(201).json(created);
});

adminRouter.put("/categories/:id", async (req, res) => {
  const b = req.body ?? {};
  const data: Record<string, unknown> = {};
  if (b.label !== undefined) data.label = String(b.label);
  if (b.icon !== undefined) data.icon = String(b.icon);
  if (b.order !== undefined) data.order = Number(b.order);
  try {
    const updated = await prisma.category.update({ where: { id: req.params.id }, data });
    res.json(updated);
  } catch {
    res.status(404).json({ error: "Kategori güncellenemedi" });
  }
});

adminRouter.delete("/categories/:id", async (req, res) => {
  try {
    await prisma.category.delete({ where: { id: req.params.id } });
    res.json({ ok: true });
  } catch {
    res.status(404).json({ error: "Kategori silinemedi" });
  }
});

// ── Chains ───────────────────────────────────────────────────
function mapNodes(nodes: unknown, skill: string) {
  if (!Array.isArray(nodes)) return [];
  return (nodes as Record<string, unknown>[]).map((n, i) => ({
    name: String(n.name ?? ""),
    shortName: String(n.shortName ?? n.avatar ?? ""),
    avatar: String(n.avatar ?? ""),
    avatarColor: String(n.avatarColor ?? "#6366F1"),
    role: String(n.role ?? "student"),
    skill,
    sessions: Number(n.sessions ?? 0),
    rating: Number(n.rating ?? 0),
    isOnline: Boolean(n.isOnline ?? false),
    joinedDate: n.joinedDate ? String(n.joinedDate) : null,
    mockId: n.mockId ? String(n.mockId) : null,
    parentMockId: n.parentMockId ? String(n.parentMockId) : null,
    position: Number(n.position ?? i),
  }));
}

adminRouter.get("/chains", async (_req, res) => {
  const chains = await prisma.skillChain.findMany({
    include: { nodes: { orderBy: { position: "asc" } } },
    orderBy: { createdAt: "asc" },
  });
  res.json(chains.map((c) => ({ ...c, gradient: safeParse(c.gradient) })));
});

adminRouter.post("/chains", async (req, res) => {
  const b = req.body ?? {};
  const skill = String(b.skill ?? "").trim();
  const category = String(b.category ?? "").trim();
  if (!skill || !category) {
    return res.status(400).json({ error: "Beceri ve kategori zorunludur" });
  }
  const created = await prisma.skillChain.create({
    data: {
      skill, category,
      color: String(b.color ?? "#6366F1"),
      gradient: JSON.stringify(
        Array.isArray(b.gradient) ? b.gradient : ["#4F46E5", "#7C3AED"],
      ),
      icon: String(b.icon ?? "git-network-outline"),
      depth: Number(b.depth ?? 1),
      totalReach: Number(b.totalReach ?? 0),
      nodes: { create: mapNodes(b.nodes, skill) },
    },
    include: { nodes: true },
  });
  res.status(201).json({ ...created, gradient: safeParse(created.gradient) });
});

adminRouter.get("/chains/:id", async (req, res) => {
  const chain = await prisma.skillChain.findUnique({
    where: { id: req.params.id },
    include: { nodes: { orderBy: { position: "asc" } } },
  });
  if (!chain) return res.status(404).json({ error: "Zincir bulunamadı" });
  res.json({ ...chain, gradient: safeParse(chain.gradient) });
});

adminRouter.put("/chains/:id", async (req, res) => {
  const b = req.body ?? {};
  const data: Record<string, unknown> = {};
  if (b.skill !== undefined) data.skill = String(b.skill);
  if (b.category !== undefined) data.category = String(b.category);
  if (b.color !== undefined) data.color = String(b.color);
  if (b.icon !== undefined) data.icon = String(b.icon);
  if (b.depth !== undefined) data.depth = Number(b.depth);
  if (b.totalReach !== undefined) data.totalReach = Number(b.totalReach);
  if (b.gradient !== undefined) {
    data.gradient = JSON.stringify(Array.isArray(b.gradient) ? b.gradient : []);
  }
  try {
    await prisma.skillChain.update({ where: { id: req.params.id }, data });
    if (Array.isArray(b.nodes)) {
      const current = await prisma.skillChain.findUnique({
        where: { id: req.params.id }, select: { skill: true },
      });
      await prisma.chainNode.deleteMany({ where: { chainId: req.params.id } });
      await prisma.chainNode.createMany({
        data: mapNodes(b.nodes, current?.skill ?? "").map((n) => ({
          ...n, chainId: req.params.id,
        })),
      });
    }
    const chain = await prisma.skillChain.findUnique({
      where: { id: req.params.id },
      include: { nodes: { orderBy: { position: "asc" } } },
    });
    res.json({ ...chain, gradient: safeParse(chain!.gradient) });
  } catch {
    res.status(404).json({ error: "Zincir güncellenemedi" });
  }
});

adminRouter.delete("/chains/:id", async (req, res) => {
  try {
    await prisma.skillChain.delete({ where: { id: req.params.id } });
    res.json({ ok: true });
  } catch {
    res.status(404).json({ error: "Zincir silinemedi" });
  }
});

// ── Kullanıcı detayı + aksiyonlar ─────────────────────────────
adminRouter.get("/users/:id", async (req, res) => {
  const user = await prisma.user.findUnique({
    where: { id: req.params.id },
    ...safeUser,
  });
  if (!user) return res.status(404).json({ error: "Kullanıcı bulunamadı" });

  const [sessions, transactions, conversations, notifications] =
    await Promise.all([
      prisma.session.findMany({
        where: { userId: user.id },
        orderBy: { createdAt: "desc" },
        take: 20,
      }),
      prisma.coinTransaction.findMany({
        where: { userId: user.id },
        orderBy: { createdAt: "desc" },
        take: 30,
      }),
      prisma.conversation.count({ where: { ownerId: user.id } }),
      prisma.notification.count({ where: { userId: user.id } }),
    ]);

  res.json({
    user,
    sessions,
    transactions,
    counts: {
      sessions: sessions.length,
      conversations,
      notifications,
    },
  });
});

adminRouter.post("/users/:id/coins", async (req, res) => {
  const amount = Number(req.body?.amount);
  const description = String(req.body?.description ?? "Admin düzeltmesi");
  if (!Number.isFinite(amount) || amount === 0) {
    return res.status(400).json({ error: "Geçerli bir miktar gir (0 olamaz)" });
  }
  const user = await prisma.user.findUnique({ where: { id: req.params.id } });
  if (!user) return res.status(404).json({ error: "Kullanıcı bulunamadı" });

  const updated = await prisma.$transaction(async (tx) => {
    const u = await tx.user.update({
      where: { id: user.id },
      data: { coins: { increment: amount } },
      ...safeUser,
    });
    await tx.coinTransaction.create({
      data: {
        userId: user.id,
        amount,
        type: amount >= 0 ? "credit" : "debit",
        description,
      },
    });
    return u;
  });

  await writeAudit({
    adminId: req.adminId!,
    action: "user.coin_adjust",
    targetType: "user",
    targetId: user.id,
    payload: { amount, description },
  });
  res.json(updated);
});

adminRouter.post("/users/:id/ban", async (req, res) => {
  const reason = String(req.body?.reason ?? "").trim();
  try {
    const u = await prisma.user.update({
      where: { id: req.params.id },
      data: {
        status: "suspended",
        bannedAt: new Date(),
        bannedReason: reason,
      },
      ...safeUser,
    });
    await writeAudit({
      adminId: req.adminId!,
      action: "user.ban",
      targetType: "user",
      targetId: u.id,
      payload: { reason },
    });
    res.json(u);
  } catch {
    res.status(404).json({ error: "Kullanıcı bulunamadı" });
  }
});

adminRouter.post("/users/:id/unban", async (req, res) => {
  try {
    const u = await prisma.user.update({
      where: { id: req.params.id },
      data: { status: "active", bannedAt: null, bannedReason: "" },
      ...safeUser,
    });
    await writeAudit({
      adminId: req.adminId!,
      action: "user.unban",
      targetType: "user",
      targetId: u.id,
    });
    res.json(u);
  } catch {
    res.status(404).json({ error: "Kullanıcı bulunamadı" });
  }
});

// ── Oturum iptal + refund ─────────────────────────────────────
adminRouter.post("/sessions/:id/cancel", async (req, res) => {
  const refund = Boolean(req.body?.refund ?? true);
  const reason = String(req.body?.reason ?? "");
  const session = await prisma.session.findUnique({
    where: { id: req.params.id },
  });
  if (!session) return res.status(404).json({ error: "Oturum bulunamadı" });
  if (session.status === "cancelled") {
    return res.status(400).json({ error: "Oturum zaten iptal" });
  }

  const result = await prisma.$transaction(async (tx) => {
    const s = await tx.session.update({
      where: { id: session.id },
      data: { status: "cancelled" },
    });
    let refundedAmount = 0;
    if (refund && session.userId && session.cost > 0) {
      await tx.user.update({
        where: { id: session.userId },
        data: { coins: { increment: session.cost } },
      });
      await tx.coinTransaction.create({
        data: {
          userId: session.userId,
          amount: session.cost,
          type: "refund",
          description: `Oturum iadesi: ${session.skill}`,
        },
      });
      refundedAmount = session.cost;
    }
    return { session: s, refundedAmount };
  });

  await writeAudit({
    adminId: req.adminId!,
    action: "session.cancel",
    targetType: "session",
    targetId: session.id,
    payload: { refund, refundedAmount: result.refundedAmount, reason },
  });
  res.json(result);
});

adminRouter.post("/sessions/:id/refund", async (req, res) => {
  const amount = Number(req.body?.amount);
  const reason = String(req.body?.reason ?? "Manuel iade");
  const session = await prisma.session.findUnique({
    where: { id: req.params.id },
  });
  if (!session) return res.status(404).json({ error: "Oturum bulunamadı" });
  if (!session.userId) {
    return res.status(400).json({ error: "Bu oturum bir kullanıcıya bağlı değil" });
  }
  const refundAmount =
    Number.isFinite(amount) && amount > 0 ? amount : session.cost;

  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: session.userId! },
      data: { coins: { increment: refundAmount } },
    });
    await tx.coinTransaction.create({
      data: {
        userId: session.userId!,
        amount: refundAmount,
        type: "refund",
        description: `Manuel iade: ${session.skill} — ${reason}`,
      },
    });
  });

  await writeAudit({
    adminId: req.adminId!,
    action: "session.refund",
    targetType: "session",
    targetId: session.id,
    payload: { amount: refundAmount, reason },
  });
  res.json({ ok: true, refunded: refundAmount });
});

// ── Bildirim broadcast ────────────────────────────────────────
adminRouter.post("/notifications/broadcast", async (req, res) => {
  const audience = String(req.body?.audience ?? "all");
  const title = String(req.body?.title ?? "").trim();
  const body = String(req.body?.body ?? "").trim();
  const type = String(req.body?.type ?? "info");
  const icon = String(req.body?.icon ?? "notifications-outline");
  if (!title) return res.status(400).json({ error: "Başlık zorunludur" });

  const where =
    audience === "students"
      ? { role: "student" }
      : audience === "teachers"
        ? { role: "teacher" }
        : {};
  const targets = await prisma.user.findMany({ where, select: { id: true } });
  if (targets.length === 0) {
    return res.json({ ok: true, sent: 0 });
  }
  await prisma.notification.createMany({
    data: targets.map((u) => ({
      userId: u.id,
      type,
      title,
      body,
      icon,
    })),
  });

  await writeAudit({
    adminId: req.adminId!,
    action: "notification.broadcast",
    targetType: "broadcast",
    targetId: audience,
    payload: { title, body, type, icon, sent: targets.length },
  });
  res.json({ ok: true, sent: targets.length });
});

// ── Analitik ──────────────────────────────────────────────────
function startOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

adminRouter.get("/analytics/timeseries", async (req, res) => {
  const days = Math.max(
    1,
    Math.min(180, Number(req.query.days ?? 30) || 30),
  );
  const since = startOfDay(new Date());
  since.setDate(since.getDate() - (days - 1));

  const [users, sessions, transactions] = await Promise.all([
    prisma.user.findMany({
      where: { createdAt: { gte: since } },
      select: { createdAt: true },
    }),
    prisma.session.findMany({
      where: { createdAt: { gte: since } },
      select: { createdAt: true, status: true, cost: true },
    }),
    prisma.coinTransaction.findMany({
      where: { createdAt: { gte: since } },
      select: { createdAt: true, amount: true, type: true },
    }),
  ]);

  const buckets: Record<
    string,
    { newUsers: number; newSessions: number; completed: number; coinFlow: number }
  > = {};
  for (let i = 0; i < days; i++) {
    const d = new Date(since);
    d.setDate(since.getDate() + i);
    const key = d.toISOString().slice(0, 10);
    buckets[key] = { newUsers: 0, newSessions: 0, completed: 0, coinFlow: 0 };
  }
  const key = (d: Date) => d.toISOString().slice(0, 10);

  users.forEach((u) => {
    const k = key(u.createdAt);
    if (buckets[k]) buckets[k].newUsers += 1;
  });
  sessions.forEach((s) => {
    const k = key(s.createdAt);
    if (!buckets[k]) return;
    buckets[k].newSessions += 1;
    if (s.status === "completed") buckets[k].completed += 1;
  });
  transactions.forEach((t) => {
    const k = key(t.createdAt);
    if (!buckets[k]) return;
    buckets[k].coinFlow += Math.abs(t.amount);
  });

  res.json({
    days,
    points: Object.entries(buckets).map(([date, v]) => ({ date, ...v })),
  });
});

adminRouter.get("/analytics/revenue", async (_req, res) => {
  const [transactions, sessions, topCategoriesRaw] = await Promise.all([
    prisma.coinTransaction.findMany({
      select: { amount: true, type: true, createdAt: true },
    }),
    prisma.session.findMany({
      where: { status: "completed" },
      select: { cost: true, skill: true },
    }),
    prisma.teacher.groupBy({
      by: ["category"],
      _sum: { sessionsCount: true },
      orderBy: { _sum: { sessionsCount: "desc" } },
      take: 8,
    }),
  ]);

  const spent = transactions
    .filter((t) => t.type === "spend")
    .reduce((s, t) => s + Math.abs(t.amount), 0);
  const earned = transactions
    .filter((t) => t.type === "earn")
    .reduce((s, t) => s + Math.abs(t.amount), 0);
  const refunded = transactions
    .filter((t) => t.type === "refund")
    .reduce((s, t) => s + Math.abs(t.amount), 0);
  const sessionCoinSum = sessions.reduce((s, x) => s + x.cost, 0);

  res.json({
    coin: { spent, earned, refunded, net: earned - spent },
    completedSessionCoinSum: sessionCoinSum,
    topCategories: topCategoriesRaw.map((c) => ({
      label: c.category,
      sessions: c._sum.sessionsCount ?? 0,
    })),
  });
});

// ── Raporlar / şikayetler ─────────────────────────────────────
adminRouter.get("/reports", async (req, res) => {
  const status = req.query.status as string | undefined;
  const reports = await prisma.report.findMany({
    where: status ? { status } : {},
    orderBy: { createdAt: "desc" },
    include: {
      resolvedBy: { select: { id: true, name: true, email: true } },
    },
  });
  res.json(reports);
});

adminRouter.post("/reports", async (req, res) => {
  const b = req.body ?? {};
  const targetType = String(b.targetType ?? "");
  const targetId = String(b.targetId ?? "");
  const reason = String(b.reason ?? "").trim();
  if (!targetType || !targetId || !reason) {
    return res
      .status(400)
      .json({ error: "Hedef ve gerekçe zorunlu" });
  }
  const created = await prisma.report.create({
    data: {
      targetType,
      targetId,
      reason,
      note: String(b.note ?? ""),
      reporterName: String(b.reporterName ?? ""),
      reporterId: String(b.reporterId ?? ""),
    },
  });
  await writeAudit({
    adminId: req.adminId!,
    action: "report.create",
    targetType: "report",
    targetId: created.id,
    payload: { targetType, targetId, reason },
  });
  res.status(201).json(created);
});

adminRouter.put("/reports/:id", async (req, res) => {
  const b = req.body ?? {};
  const data: Record<string, unknown> = {};
  if (b.note !== undefined) data.note = String(b.note);
  if (b.status !== undefined) {
    const next = String(b.status);
    if (!["open", "resolved", "dismissed"].includes(next)) {
      return res.status(400).json({ error: "Geçersiz durum" });
    }
    data.status = next;
    if (next === "resolved" || next === "dismissed") {
      data.resolvedById = req.adminId;
      data.resolvedAt = new Date();
    } else {
      data.resolvedById = null;
      data.resolvedAt = null;
    }
  }
  try {
    const updated = await prisma.report.update({
      where: { id: req.params.id },
      data,
      include: {
        resolvedBy: { select: { id: true, name: true, email: true } },
      },
    });
    await writeAudit({
      adminId: req.adminId!,
      action: "report.update",
      targetType: "report",
      targetId: updated.id,
      payload: data,
    });
    res.json(updated);
  } catch {
    res.status(404).json({ error: "Şikayet güncellenemedi" });
  }
});

adminRouter.delete("/reports/:id", async (req, res) => {
  try {
    await prisma.report.delete({ where: { id: req.params.id } });
    await writeAudit({
      adminId: req.adminId!,
      action: "report.delete",
      targetType: "report",
      targetId: req.params.id,
    });
    res.json({ ok: true });
  } catch {
    res.status(404).json({ error: "Şikayet silinemedi" });
  }
});

// ── Multi-admin yönetimi (super_admin only) ───────────────────
const safeAdmin = {
  select: {
    id: true,
    email: true,
    name: true,
    role: true,
    lastLoginAt: true,
    createdAt: true,
  },
} as const;

adminRouter.get(
  "/admins",
  requireRole("super_admin"),
  async (_req, res) => {
    const admins = await prisma.adminUser.findMany({
      orderBy: { createdAt: "desc" },
      ...safeAdmin,
    });
    res.json(admins);
  },
);

adminRouter.post(
  "/admins",
  requireRole("super_admin"),
  async (req, res) => {
    const b = req.body ?? {};
    const name = String(b.name ?? "").trim();
    const email = String(b.email ?? "").trim().toLowerCase();
    const password = String(b.password ?? "");
    const role = ["super_admin", "admin", "moderator"].includes(String(b.role))
      ? String(b.role)
      : "admin";
    if (!name || !email || !password) {
      return res
        .status(400)
        .json({ error: "Ad, e-posta ve parola zorunludur" });
    }
    if (password.length < 6) {
      return res.status(400).json({ error: "Parola en az 6 karakter olmalı" });
    }
    const exists = await prisma.adminUser.findUnique({ where: { email } });
    if (exists) return res.status(409).json({ error: "Bu e-posta zaten kayıtlı" });

    const created = await prisma.adminUser.create({
      data: { name, email, role, passwordHash: await hashPassword(password) },
      ...safeAdmin,
    });
    await writeAudit({
      adminId: req.adminId!,
      action: "admin.create",
      targetType: "admin",
      targetId: created.id,
      payload: { email, role },
    });
    res.status(201).json(created);
  },
);

adminRouter.put(
  "/admins/:id",
  requireRole("super_admin"),
  async (req, res) => {
    const b = req.body ?? {};
    const data: Record<string, unknown> = {};
    if (b.name !== undefined) data.name = String(b.name);
    if (b.role !== undefined) {
      const role = String(b.role);
      if (!["super_admin", "admin", "moderator"].includes(role)) {
        return res.status(400).json({ error: "Geçersiz rol" });
      }
      data.role = role;
    }
    if (b.password) {
      if (String(b.password).length < 6) {
        return res
          .status(400)
          .json({ error: "Parola en az 6 karakter olmalı" });
      }
      data.passwordHash = await hashPassword(String(b.password));
    }
    const id = String(req.params.id);
    try {
      const updated = await prisma.adminUser.update({
        where: { id },
        data,
        ...safeAdmin,
      });
      await writeAudit({
        adminId: req.adminId!,
        action: "admin.update",
        targetType: "admin",
        targetId: updated.id,
        payload: { fields: Object.keys(data) },
      });
      res.json(updated);
    } catch {
      res.status(404).json({ error: "Admin güncellenemedi" });
    }
  },
);

adminRouter.delete(
  "/admins/:id",
  requireRole("super_admin"),
  async (req, res) => {
    const id = String(req.params.id);
    if (id === req.adminId) {
      return res
        .status(400)
        .json({ error: "Kendi hesabını silemezsin" });
    }
    try {
      await prisma.adminUser.delete({ where: { id } });
      await writeAudit({
        adminId: req.adminId!,
        action: "admin.delete",
        targetType: "admin",
        targetId: id,
      });
      res.json({ ok: true });
    } catch {
      res.status(404).json({ error: "Admin silinemedi" });
    }
  },
);

// ── Audit log listesi ─────────────────────────────────────────
adminRouter.get(
  "/audit-log",
  requireRole("super_admin"),
  async (req, res) => {
    const take = Math.max(1, Math.min(200, Number(req.query.take ?? 100) || 100));
    const adminId = req.query.adminId as string | undefined;
    const action = req.query.action as string | undefined;
    const logs = await prisma.adminAuditLog.findMany({
      where: {
        ...(adminId ? { adminId } : {}),
        ...(action ? { action: { contains: action } } : {}),
      },
      orderBy: { createdAt: "desc" },
      take,
      include: {
        admin: { select: { id: true, name: true, email: true } },
      },
    });
    res.json(
      logs.map((l) => ({ ...l, payload: safeParse(l.payload) })),
    );
  },
);

// ── CSV dışa aktarım ──────────────────────────────────────────
function toCsv(rows: Record<string, unknown>[], columns: string[]): string {
  const esc = (v: unknown) => {
    if (v === null || v === undefined) return "";
    const s = String(v).replace(/"/g, '""');
    return /[",\n]/.test(s) ? `"${s}"` : s;
  };
  const header = columns.join(",");
  const body = rows
    .map((r) => columns.map((c) => esc(r[c])).join(","))
    .join("\n");
  return `${header}\n${body}\n`;
}

adminRouter.get("/exports/users.csv", async (req, res) => {
  const users = await prisma.user.findMany({
    orderBy: { createdAt: "desc" },
    ...safeUser,
  });
  const csv = toCsv(
    users.map((u) => ({
      id: u.id,
      name: u.name,
      email: u.email,
      role: u.role,
      status: u.status,
      coins: u.coins,
      university: u.university,
      department: u.department,
      createdAt: u.createdAt.toISOString(),
    })),
    [
      "id",
      "name",
      "email",
      "role",
      "status",
      "coins",
      "university",
      "department",
      "createdAt",
    ],
  );
  await writeAudit({
    adminId: req.adminId!,
    action: "export.users_csv",
    targetType: "export",
    payload: { count: users.length },
  });
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader(
    "Content-Disposition",
    `attachment; filename="users-${Date.now()}.csv"`,
  );
  res.send(csv);
});

adminRouter.get("/exports/sessions.csv", async (req, res) => {
  const sessions = await prisma.session.findMany({
    orderBy: { createdAt: "desc" },
  });
  const csv = toCsv(
    sessions.map((s) => ({
      id: s.id,
      userId: s.userId ?? "",
      teacherName: s.teacherName,
      skill: s.skill,
      status: s.status,
      type: s.type,
      cost: s.cost,
      duration: s.duration,
      date: s.date,
      time: s.time,
      rating: s.rating ?? "",
      createdAt: s.createdAt.toISOString(),
    })),
    [
      "id",
      "userId",
      "teacherName",
      "skill",
      "status",
      "type",
      "cost",
      "duration",
      "date",
      "time",
      "rating",
      "createdAt",
    ],
  );
  await writeAudit({
    adminId: req.adminId!,
    action: "export.sessions_csv",
    targetType: "export",
    payload: { count: sessions.length },
  });
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader(
    "Content-Disposition",
    `attachment; filename="sessions-${Date.now()}.csv"`,
  );
  res.send(csv);
});

// ── Mentor Başvuruları ──────────────────────────────────────
// GET /admin/applications?status=pending|approved|rejected
adminRouter.get("/applications", async (req, res) => {
  const status = req.query.status as string | undefined;
  const where =
    status && ["pending", "approved", "rejected"].includes(status)
      ? { mentorAppStatus: status }
      : { mentorAppStatus: { not: null } };
  const users = await prisma.user.findMany({
    where,
    select: {
      id: true,
      name: true,
      email: true,
      avatar: true,
      avatarColor: true,
      bio: true,
      university: true,
      department: true,
      role: true,
      mentorAppStatus: true,
      mentorAppMessage: true,
      mentorAppAt: true,
    },
    orderBy: { mentorAppAt: "desc" },
  });
  res.json(users);
});

// POST /admin/applications/:userId/approve
adminRouter.post("/applications/:userId/approve", async (req, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.params.userId } });
  if (!user || !user.mentorAppStatus) {
    return res.status(404).json({ error: "Başvuru bulunamadı" });
  }
  await prisma.user.update({
    where: { id: user.id },
    data: { role: "teacher", mentorAppStatus: "approved" },
  });
  await prisma.notification.create({
    data: {
      userId: user.id,
      type: "info",
      title: "Mentor başvurun onaylandı 🎓",
      body: "Artık mentor olarak ders verebilirsin. Profilinden becerilerini güncelle.",
      icon: "school-outline",
    },
  });
  await writeAudit({
    adminId: req.adminId!,
    action: "application.approve",
    targetType: "user",
    targetId: user.id,
    payload: { email: user.email },
  });
  res.json({ ok: true });
});

// POST /admin/applications/:userId/reject  body: { reason? }
adminRouter.post("/applications/:userId/reject", async (req, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.params.userId } });
  if (!user || !user.mentorAppStatus) {
    return res.status(404).json({ error: "Başvuru bulunamadı" });
  }
  const reason = String(req.body?.reason ?? "").slice(0, 300);
  await prisma.user.update({
    where: { id: user.id },
    data: { mentorAppStatus: "rejected" },
  });
  await prisma.notification.create({
    data: {
      userId: user.id,
      type: "info",
      title: "Başvurun reddedildi",
      body:
        reason ||
        "Başvurun bu sefer kabul edilmedi. Açıklamanı geliştirip tekrar başvurabilirsin.",
      icon: "close-circle-outline",
    },
  });
  await writeAudit({
    adminId: req.adminId!,
    action: "application.reject",
    targetType: "user",
    targetId: user.id,
    payload: { reason },
  });
  res.json({ ok: true });
});
