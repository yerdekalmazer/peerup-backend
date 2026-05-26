import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const email = process.env.PROMOTE_EMAIL ?? "admin@peerup.com";
  const updated = await prisma.adminUser.update({
    where: { email },
    data: { role: "super_admin" },
    select: { id: true, email: true, name: true, role: true },
  });
  console.log("✓ Yükseltildi:", updated);
}

main()
  .catch((e) => {
    console.error("Hata:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
