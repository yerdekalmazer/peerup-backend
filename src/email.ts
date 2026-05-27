/**
 * Gmail SMTP üzerinden email gönderim helper'ı.
 *
 * Kurulum:
 *   1. https://myaccount.google.com/security
 *      → "2-Step Verification"u açık tut (zorunlu).
 *   2. https://myaccount.google.com/apppasswords
 *      → Yeni "App password" oluştur (Mail + Other "PeerUP").
 *      → 16 haneli kodu kopyala (boşluklar olmadan).
 *   3. .env (lokal) ve Render env:
 *        SMTP_USER="senin@gmail.com"
 *        SMTP_PASS="16haneliappkodu"
 *        SMTP_FROM="PeerUP <senin@gmail.com>"   (opsiyonel)
 *
 * Notlar:
 *   - Env eksikse fonksiyon sessizce no-op olur ve `false` döner.
 *     Asıl akış (kod üretimi, vb.) bu yüzden bozulmaz.
 *   - Gmail SMTP gönderici adresini değiştirmene izin vermez —
 *     SMTP_FROM her ne olursa olsun mail SMTP_USER'dan gönderilmiş gözükür.
 */
import nodemailer, { type Transporter } from "nodemailer";

const SMTP_USER = process.env.SMTP_USER ?? "";
const SMTP_PASS = process.env.SMTP_PASS ?? "";
const SMTP_FROM = process.env.SMTP_FROM ?? SMTP_USER;

let transporter: Transporter | null = null;
if (SMTP_USER && SMTP_PASS) {
  transporter = nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 465,
    secure: true,
    auth: { user: SMTP_USER, pass: SMTP_PASS },
  });
}

export function isEmailConfigured(): boolean {
  return !!transporter;
}

type SendArgs = {
  to: string;
  subject: string;
  html: string;
  text?: string;
};

export async function sendMail(args: SendArgs): Promise<boolean> {
  if (!transporter) {
    console.warn("[email] SMTP konfigi eksik, mail gönderilmedi:", args.subject);
    return false;
  }
  try {
    await transporter.sendMail({
      from: SMTP_FROM,
      to: args.to,
      subject: args.subject,
      html: args.html,
      text: args.text ?? args.html.replace(/<[^>]+>/g, ""),
    });
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
