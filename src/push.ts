/**
 * Expo push gönderim yardımcısı.
 *
 * Kullanım:
 *   import { sendPushToUser } from "./push";
 *   await sendPushToUser(userId, { title: "...", body: "...", data: {...} });
 *
 * Notlar:
 *  - Token yoksa veya geçersizse sessizce yutulur — push'un çalışmaması
 *    asıl uygulama akışını (bildirim kaydı, oturum başlatma vs.) bozmamalı.
 *  - Hatalar log'lanır ama throw edilmez.
 */
import { Expo, type ExpoPushMessage } from "expo-server-sdk";
import { prisma } from "./prisma";

const expo = new Expo();

type PushPayload = {
  title: string;
  body?: string;
  data?: Record<string, unknown>;
};

export async function sendPushToUser(userId: string, payload: PushPayload) {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { pushToken: true },
    });
    if (!user?.pushToken || !Expo.isExpoPushToken(user.pushToken)) return;

    const message: ExpoPushMessage = {
      to: user.pushToken,
      sound: "default",
      title: payload.title,
      body: payload.body ?? "",
      data: payload.data ?? {},
    };

    const tickets = await expo.sendPushNotificationsAsync([message]);
    const ticket = tickets[0];
    if (ticket?.status === "error") {
      console.warn("[push] gönderim hatası", ticket.message, ticket.details);
      // Expo token geçersiz işaretlediyse temizle
      if (ticket.details?.error === "DeviceNotRegistered") {
        await prisma.user.update({
          where: { id: userId },
          data: { pushToken: null, pushPlatform: null },
        });
      }
    }
  } catch (err) {
    console.warn("[push] beklenmeyen hata", err);
  }
}
