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
      select: { pushToken: true, notifPrefs: true },
    });
    if (!user?.pushToken || !Expo.isExpoPushToken(user.pushToken)) return;

    // Kullanıcı tercihine göre filtre. Type prefix'lerinden hangi kategori
    // olduğunu çıkarıyoruz: session*/coin*/message → ilgili pref.
    try {
      const prefs = JSON.parse(user.notifPrefs ?? "{}") as {
        sessions?: boolean;
        messages?: boolean;
        coins?: boolean;
      };
      const type = String(payload.data?.type ?? "");
      if (type.startsWith("session") && prefs.sessions === false) return;
      if (type === "message" && prefs.messages === false) return;
      if (type === "coin" && prefs.coins === false) return;
    } catch {
      // pref parse edilemezse default davranış (gönder)
    }

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
