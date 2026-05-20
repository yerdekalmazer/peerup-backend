/**
 * PeerUP backend veritabanını başlangıç verisiyle doldurur.
 * Çalıştırma: npm run db:seed
 */
import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const categories = [
  { label: "Programlama", icon: "code-slash-outline", order: 1 },
  { label: "Dil", icon: "language-outline", order: 2 },
  { label: "Müzik", icon: "musical-notes-outline", order: 3 },
  { label: "Tasarım", icon: "brush-outline", order: 4 },
  { label: "Matematik", icon: "calculator-outline", order: 5 },
  { label: "Fotoğraf", icon: "camera-outline", order: 6 },
  { label: "Spor", icon: "fitness-outline", order: 7 },
];

const teachers = [
  { name: "Zeynep Arslan", skill: "React Native", category: "Programlama", rating: 4.9, reviews: 47, coinRate: 1.2, online: true, avatar: "ZA", avatarColor: "#6366F1", bio: "5 yıllık React Native deneyimi. 200+ öğrenci yetiştirdim.", sessionsCount: 89, badges: ["Doğrulanmış", "Top Öğretmen"], verified: true },
  { name: "Mehmet Kaya", skill: "İspanyolca", category: "Dil", rating: 4.8, reviews: 63, coinRate: 0.9, online: false, avatar: "MK", avatarColor: "#EC4899", bio: "Anadili İspanyolca olan öğretmen. B2-C1 odaklı.", sessionsCount: 124, badges: ["Doğrulanmış"], verified: true },
  { name: "Ayşe Demir", skill: "UI/UX Tasarım", category: "Tasarım", rating: 5.0, reviews: 31, coinRate: 1.4, online: true, avatar: "AD", avatarColor: "#F59E0B", bio: "Figma & Sketch uzmanı. Google deneyimi var.", sessionsCount: 56, badges: ["Doğrulanmış", "Top Öğretmen", "Yeni"], verified: true },
  { name: "Can Yılmaz", skill: "Piyano", category: "Müzik", rating: 4.7, reviews: 28, coinRate: 1.0, online: true, avatar: "CY", avatarColor: "#10B981", bio: "Konservatuvar mezunu. Klasik ve pop piyano.", sessionsCount: 45, badges: ["Doğrulanmış"], verified: true },
  { name: "Elif Şahin", skill: "Python", category: "Programlama", rating: 4.9, reviews: 55, coinRate: 1.1, online: false, avatar: "EŞ", avatarColor: "#7C3AED", bio: "Veri bilimi & ML. Kaggle Master.", sessionsCount: 102, badges: ["Doğrulanmış", "Top Öğretmen"], verified: true },
  { name: "Burak Öztürk", skill: "Fotoğrafçılık", category: "Fotoğraf", rating: 4.6, reviews: 19, coinRate: 0.8, online: true, avatar: "BÖ", avatarColor: "#F43F5E", bio: "Manzara ve portre fotoğrafçılığı. Adobe Lightroom.", sessionsCount: 33, badges: ["Doğrulanmış"], verified: false },
];

const users = [
  { name: "Taha Yerdekalmazer", email: "taha@peerup.com", avatar: "TY", avatarColor: "#4F46E5", coins: 12.5, role: "student", bio: "React Native öğreniyorum.", university: "Selçuk Üniversitesi", department: "Bilgisayar Mühendisliği" },
  { name: "Ali Koç", email: "ali@peerup.com", avatar: "AK", avatarColor: "#0EA5E9", coins: 6, role: "student", bio: "" },
  { name: "Selin Mert", email: "selin@peerup.com", avatar: "SM", avatarColor: "#EC4899", coins: 8, role: "student", bio: "" },
  { name: "Zeynep Arslan", email: "zeynep@peerup.com", avatar: "ZA", avatarColor: "#6366F1", coins: 42, role: "teacher", bio: "5 yıllık React Native deneyimi." },
  { name: "Elif Şahin", email: "elif@peerup.com", avatar: "EŞ", avatarColor: "#7C3AED", coins: 38, role: "teacher", bio: "Veri bilimi & ML." },
];

type SeedNode = {
  mockId: string;
  parentMockId: string | null;
  name: string;
  shortName: string;
  avatar: string;
  avatarColor: string;
  role: string;
  sessions: number;
  rating: number;
  isOnline?: boolean;
  joinedDate?: string;
};

const chains: {
  skill: string; category: string; color: string;
  gradient: [string, string]; icon: string; depth: number;
  totalReach: number; nodes: SeedNode[];
}[] = [
  {
    skill: "React Native", category: "Programlama", color: "#6366F1",
    gradient: ["#4F46E5", "#7C3AED"], icon: "code-slash-outline", depth: 5, totalReach: 14,
    nodes: [
      { mockId: "a1", parentMockId: null, name: "Mehmet Şimşek", shortName: "MS", avatar: "MŞ", avatarColor: "#8B5CF6", role: "root", sessions: 312, rating: 4.9, joinedDate: "2021" },
      { mockId: "m1", parentMockId: "a1", name: "Zeynep Arslan", shortName: "ZA", avatar: "ZA", avatarColor: "#6366F1", role: "mentor", sessions: 89, rating: 4.9, isOnline: true, joinedDate: "2022" },
      { mockId: "you", parentMockId: "m1", name: "Taha Yerdekalmazer", shortName: "TY", avatar: "TY", avatarColor: "#4F46E5", role: "you", sessions: 7, rating: 4.8, isOnline: true, joinedDate: "2024" },
      { mockId: "s1", parentMockId: "you", name: "Ali Koç", shortName: "AK", avatar: "AK", avatarColor: "#0EA5E9", role: "student", sessions: 3, rating: 0, isOnline: false },
      { mockId: "s2", parentMockId: "you", name: "Selin Mert", shortName: "SM", avatar: "SM", avatarColor: "#EC4899", role: "student", sessions: 2, rating: 0, isOnline: true },
      { mockId: "s3", parentMockId: "you", name: "Ege Doğan", shortName: "ED", avatar: "ED", avatarColor: "#10B981", role: "student", sessions: 1, rating: 0, isOnline: false },
      { mockId: "g1", parentMockId: "s1", name: "Bora Tan", shortName: "BT", avatar: "BT", avatarColor: "#F59E0B", role: "grandstudent", sessions: 1, rating: 0, isOnline: false },
      { mockId: "g2", parentMockId: "s2", name: "Deniz Yıl.", shortName: "DY", avatar: "DY", avatarColor: "#F43F5E", role: "grandstudent", sessions: 1, rating: 0, isOnline: true },
    ],
  },
  {
    skill: "TypeScript", category: "Programlama", color: "#0EA5E9",
    gradient: ["#0EA5E9", "#6366F1"], icon: "terminal-outline", depth: 3, totalReach: 4,
    nodes: [
      { mockId: "tm1", parentMockId: null, name: "Elif Şahin", shortName: "EŞ", avatar: "EŞ", avatarColor: "#7C3AED", role: "mentor", sessions: 102, rating: 4.9, isOnline: false, joinedDate: "2023" },
      { mockId: "tyou", parentMockId: "tm1", name: "Taha Yerdekalmazer", shortName: "TY", avatar: "TY", avatarColor: "#4F46E5", role: "you", sessions: 4, rating: 4.8, isOnline: true },
      { mockId: "ts1", parentMockId: "tyou", name: "Mert Akın", shortName: "MA", avatar: "MA", avatarColor: "#0EA5E9", role: "student", sessions: 2, rating: 0, isOnline: false },
    ],
  },
];

// Sohbetler (ilk kullanıcı = Taha sahibi)
const conversations = [
  { peerName: "Zeynep Arslan", peerAvatar: "ZA", peerColor: "#6366F1", online: true, messages: [
    { fromOwner: false, text: "Merhaba! Oturumumuza hazır mısın?", read: true },
    { fromOwner: true, text: "Evet, hazırım. Materyalleri inceledim.", read: true },
    { fromOwner: false, text: "Oturum için gerekli materyalleri paylaştım, kontrol eder misiniz?", read: false },
  ]},
  { peerName: "Mehmet Kaya", peerAvatar: "MK", peerColor: "#EC4899", online: false, messages: [
    { fromOwner: true, text: "Hocam alıştırmaları tamamladım.", read: true },
    { fromOwner: false, text: "Harika ilerliyorsunuz! Bir sonraki derse kadar alıştırmaları yapın.", read: true },
  ]},
  { peerName: "Ayşe Demir", peerAvatar: "AD", peerColor: "#F59E0B", online: true, messages: [
    { fromOwner: false, text: "Figma dosyasını güncelledim, birlikte inceleyebiliriz.", read: false },
  ]},
  { peerName: "Can Yılmaz", peerAvatar: "CY", peerColor: "#10B981", online: false, messages: [
    { fromOwner: false, text: "Güzel çalışma! Parmaklarınızı doğru yerleştiriyorsunuz.", read: true },
  ]},
];

const notifications = [
  { type: "session", title: "Oturum hatırlatması", body: "Zeynep Arslan ile oturumunuz 1 saat sonra.", icon: "calendar-outline", read: false },
  { type: "message", title: "Yeni mesaj", body: "Ayşe Demir size bir mesaj gönderdi.", icon: "chatbubble-outline", read: false },
  { type: "coin", title: "SkillCoin kazandınız", body: "Tamamlanan oturum için +1.0 SkillCoin.", icon: "logo-bitcoin", read: true },
  { type: "chain", title: "Zinciriniz büyüdü", body: "Ali Koç sayesinde zincir erişiminiz arttı.", icon: "git-network-outline", read: true },
];

async function main() {
  console.log("🌱 Seed başlıyor...");

  await prisma.coinTransaction.deleteMany();
  await prisma.review.deleteMany();
  await prisma.message.deleteMany();
  await prisma.conversation.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.chainNode.deleteMany();
  await prisma.skillChain.deleteMany();
  await prisma.session.deleteMany();
  await prisma.teacher.deleteMany();
  await prisma.category.deleteMany();
  await prisma.user.deleteMany();
  await prisma.adminUser.deleteMany();

  // Admin
  const adminEmail = process.env.SEED_ADMIN_EMAIL ?? "admin@peerup.com";
  const adminPassword = process.env.SEED_ADMIN_PASSWORD ?? "peerup1234";
  await prisma.adminUser.create({
    data: {
      email: adminEmail,
      name: process.env.SEED_ADMIN_NAME ?? "PeerUP Admin",
      passwordHash: await bcrypt.hash(adminPassword, 10),
      role: "superadmin",
    },
  });
  console.log(`✅ Admin: ${adminEmail} / ${adminPassword}`);

  // Kategoriler
  await prisma.category.createMany({ data: categories });

  // Öğretmenler
  const teacherRecords: Record<string, string> = {};
  for (const t of teachers) {
    const rec = await prisma.teacher.create({
      data: { ...t, badges: JSON.stringify(t.badges) },
    });
    teacherRecords[t.name] = rec.id;
  }

  // Kullanıcılar
  const userPassword = await bcrypt.hash("peerup123", 10);
  const userRecords: Record<string, string> = {};
  for (const u of users) {
    const rec = await prisma.user.create({
      data: {
        ...u,
        university: u.university ?? "",
        department: u.department ?? "",
        passwordHash: userPassword,
      },
    });
    userRecords[u.email] = rec.id;
  }
  const tahaId = userRecords["taha@peerup.com"];

  // Taha'nın becerileri ve kaydettiği öğretmen
  await prisma.user.update({
    where: { id: tahaId },
    data: {
      skillsTeach: JSON.stringify(["React Native", "TypeScript", "Node.js"]),
      skillsLearn: JSON.stringify(["UI/UX Tasarım", "İspanyolca", "Piyano"]),
      savedTeachers: JSON.stringify([teacherRecords["Ayşe Demir"]]),
    },
  });

  // Oturumlar (Taha'ya bağlı)
  const sessions = [
    { teacherName: "Zeynep Arslan", teacherAvatar: "ZA", avatarColor: "#6366F1", skill: "React Native - Navigation", date: "8 Nisan 2026", time: "15:00", duration: 60, cost: 1.2, status: "upcoming", type: "online" },
    { teacherName: "Mehmet Kaya", teacherAvatar: "MK", avatarColor: "#EC4899", skill: "İspanyolca - Konuşma", date: "10 Nisan 2026", time: "18:30", duration: 60, cost: 0.9, status: "upcoming", type: "online" },
    { teacherName: "Ayşe Demir", teacherAvatar: "AD", avatarColor: "#F59E0B", skill: "UI/UX - Figma Temelleri", date: "2 Nisan 2026", time: "14:00", duration: 90, cost: 2.1, status: "completed", type: "online", rating: 5 },
    { teacherName: "Can Yılmaz", teacherAvatar: "CY", avatarColor: "#10B981", skill: "Piyano - Başlangıç", date: "28 Mart 2026", time: "11:00", duration: 60, cost: 1.0, status: "completed", type: "online", rating: 4 },
  ];
  const sessionRecords: { id: string; teacherName: string; rating: number | null }[] = [];
  for (const s of sessions) {
    const rec = await prisma.session.create({
      data: { ...s, userId: tahaId },
    });
    sessionRecords.push({ id: rec.id, teacherName: s.teacherName, rating: s.rating ?? null });
  }

  // Mentor zincirleri
  for (const c of chains) {
    await prisma.skillChain.create({
      data: {
        skill: c.skill, category: c.category, color: c.color,
        gradient: JSON.stringify(c.gradient), icon: c.icon,
        depth: c.depth, totalReach: c.totalReach,
        nodes: {
          create: c.nodes.map((n, i) => ({
            name: n.name, shortName: n.shortName, avatar: n.avatar,
            avatarColor: n.avatarColor, role: n.role, skill: c.skill,
            sessions: n.sessions, rating: n.rating, isOnline: n.isOnline ?? false,
            joinedDate: n.joinedDate ?? null, mockId: n.mockId,
            parentMockId: n.parentMockId, position: i,
          })),
        },
      },
    });
  }

  // Sohbetler + mesajlar
  for (const conv of conversations) {
    await prisma.conversation.create({
      data: {
        ownerId: tahaId,
        peerName: conv.peerName,
        peerAvatar: conv.peerAvatar,
        peerColor: conv.peerColor,
        online: conv.online,
        messages: { create: conv.messages },
      },
    });
  }

  // Bildirimler
  await prisma.notification.createMany({
    data: notifications.map((n) => ({ ...n, userId: tahaId })),
  });

  // Tamamlanan oturumlar için değerlendirmeler
  for (const s of sessionRecords) {
    if (s.rating) {
      await prisma.review.create({
        data: {
          teacherId: teacherRecords[s.teacherName],
          userId: tahaId,
          sessionId: s.id,
          rating: s.rating,
          comment: "Çok faydalı bir oturumdu, teşekkürler!",
        },
      });
    }
  }

  // SkillCoin işlemleri
  await prisma.coinTransaction.createMany({
    data: [
      { userId: tahaId, amount: 20, type: "topup", description: "Başlangıç bakiyesi" },
      { userId: tahaId, amount: -2.1, type: "spend", description: "UI/UX - Figma Temelleri oturumu" },
      { userId: tahaId, amount: -1.0, type: "spend", description: "Piyano - Başlangıç oturumu" },
      { userId: tahaId, amount: 1.5, type: "earn", description: "Öğrettiğin oturum için kazanç" },
    ],
  });

  console.log("🎉 Seed tamamlandı.");
}

main()
  .catch((e) => {
    console.error("❌ Seed hatası:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
