import { prisma } from "./prisma";

/**
 * Admin aksiyonlarını AdminAuditLog tablosuna kaydeder.
 * Hatalar yutulur — denetim kaybı, asıl işlemi engellemesin.
 */
export async function writeAudit(input: {
  adminId: string;
  action: string;
  targetType?: string;
  targetId?: string;
  payload?: unknown;
}) {
  try {
    await prisma.adminAuditLog.create({
      data: {
        adminId: input.adminId,
        action: input.action,
        targetType: input.targetType ?? "",
        targetId: input.targetId ?? "",
        payload: JSON.stringify(input.payload ?? {}),
      },
    });
  } catch (e) {
    console.warn("audit log yazılamadı:", e);
  }
}
