import { PrismaClient } from "@prisma/client";

// Backend tek uzun ömürlü süreç olduğu için basit tekil istemci yeterli.
export const prisma = new PrismaClient({
  log: ["error", "warn"],
});
