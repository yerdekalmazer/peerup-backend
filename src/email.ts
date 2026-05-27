/**
 * Email gönderim helper'ı — Brevo (eski Sendinblue) HTTP API'sini kullanır.
 *
 * Neden HTTP API: Render free tier'da outbound SMTP portları (465/587)
 * sessizce drop edilebiliyor. HTTP API HTTPS (443) üzerinden çalıştığı için
 * bu kısıtlamadan etkilenmez. Bonus: domain doğrulaması gerekmez, sadece
 * tek bir sender email'inin Brevo tarafında onaylanması yeterli.
 *
 * Kurulum:
 *   1. https://app.brevo.com → ücretsiz hesap (300 mail/gün kalıcı).
 *   2. Settings → Senders & IP → Senders → "Add a sender":
 *        - Name: PeerUP
 *        - Email: tyerdekalmazer01@gmail.com  (gönderici olarak görünür)
 *        - Brevo bu adrese doğrulama maili atar, link'e tıkla.
 *   3. SMTP & API → API Keys → "Generate a new API key" → kopyala.
 *   4. Lokal .env ve Render env'e ekle:
 *        BREVO_API_KEY="xkeysib-..."
 *        EMAIL_FROM="tyerdekalmazer01@gmail.com"
 *        EMAIL_FROM_NAME="PeerUP"
 *
 * Env eksikse `sendMail` no-op olur ve `false` döner; ana akış bozulmaz.
 */

const BREVO_API_KEY = process.env.BREVO_API_KEY ?? "";
const EMAIL_FROM = process.env.EMAIL_FROM ?? "";
const EMAIL_FROM_NAME = process.env.EMAIL_FROM_NAME ?? "PeerUP";

export function isEmailConfigured(): boolean {
  return !!(BREVO_API_KEY && EMAIL_FROM);
}

type SendArgs = {
  to: string;
  subject: string;
  html: string;
  text?: string;
};

export async function sendMail(args: SendArgs): Promise<boolean> {
  if (!isEmailConfigured()) {
    console.warn(
      "[email] BREVO_API_KEY/EMAIL_FROM eksik, mail gönderilmedi:",
      args.subject,
    );
    return false;
  }
  try {
    const res = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        accept: "application/json",
        "api-key": BREVO_API_KEY,
      },
      body: JSON.stringify({
        sender: { name: EMAIL_FROM_NAME, email: EMAIL_FROM },
        to: [{ email: args.to }],
        subject: args.subject,
        htmlContent: args.html,
        textContent: args.text ?? args.html.replace(/<[^>]+>/g, ""),
      }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      console.warn(
        `[email] Brevo ${res.status} ${res.statusText}: ${body.slice(0, 200)}`,
      );
      return false;
    }
    return true;
  } catch (e) {
    console.warn("[email] gönderim hatası:", e);
    return false;
  }
}

/** 6 haneli kod için ortak HTML template. */
export function codeEmailHtml(opts: {
  title: string;
  intro: string;
  code: string;
  ttlMinutes: number;
}) {
  return `
<!DOCTYPE html>
<html>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #F8FAFC; padding: 24px; margin: 0;">
  <table role="presentation" width="100%" style="max-width: 480px; margin: 0 auto; background: #fff; border-radius: 16px; padding: 32px; box-shadow: 0 1px 3px rgba(0,0,0,0.06);">
    <tr><td>
      <h1 style="margin: 0 0 16px; color: #4F46E5; font-size: 22px; letter-spacing: -0.3px;">PeerUP</h1>
      <h2 style="margin: 0 0 12px; color: #0F172A; font-size: 18px;">${opts.title}</h2>
      <p style="margin: 0 0 24px; color: #475569; font-size: 14px; line-height: 22px;">${opts.intro}</p>
      <div style="background: #EEF2FF; border-radius: 12px; padding: 20px; text-align: center; margin-bottom: 24px;">
        <div style="font-size: 32px; font-weight: 800; letter-spacing: 8px; color: #4F46E5;">${opts.code}</div>
      </div>
      <p style="margin: 0; color: #94A3B8; font-size: 12px; line-height: 18px;">
        Bu kod ${opts.ttlMinutes} dakika boyunca geçerlidir. Bu işlemi sen yapmadıysan bu e-postayı görmezden gel.
      </p>
    </td></tr>
  </table>
</body>
</html>`;
}
