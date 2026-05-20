import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import type { Request, Response, NextFunction } from "express";

const USER_SECRET = process.env.JWT_SECRET ?? "dev-user-secret";
const ADMIN_SECRET = process.env.ADMIN_JWT_SECRET ?? "dev-admin-secret";

// ── Parola ───────────────────────────────────────────────────
export const hashPassword = (plain: string) => bcrypt.hash(plain, 10);
export const verifyPassword = (plain: string, hash: string) =>
  bcrypt.compare(plain, hash);

// ── Token üretimi ────────────────────────────────────────────
export function signUserToken(userId: string): string {
  return jwt.sign({ kind: "user" }, USER_SECRET, {
    subject: userId,
    expiresIn: "30d",
  });
}

export function signAdminToken(admin: { id: string; role: string }): string {
  return jwt.sign({ kind: "admin", role: admin.role }, ADMIN_SECRET, {
    subject: admin.id,
    expiresIn: "7d",
  });
}

// İstek tiplerine eklenen alanlar
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      userId?: string;
      adminId?: string;
      adminRole?: string;
    }
  }
}

function bearer(req: Request): string | null {
  const h = req.headers.authorization;
  if (h && h.startsWith("Bearer ")) return h.slice(7);
  return null;
}

// ── Middleware ───────────────────────────────────────────────
/** Geçerli kullanıcı token'ı ister. */
export function requireUser(req: Request, res: Response, next: NextFunction) {
  const token = bearer(req);
  if (!token) return res.status(401).json({ error: "Giriş yapmalısınız" });
  try {
    const payload = jwt.verify(token, USER_SECRET) as jwt.JwtPayload;
    req.userId = String(payload.sub);
    next();
  } catch {
    res.status(401).json({ error: "Oturum geçersiz veya süresi dolmuş" });
  }
}

/** Geçerli admin token'ı ister. */
export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  const token = bearer(req);
  if (!token) return res.status(401).json({ error: "Yetkisiz erişim" });
  try {
    const payload = jwt.verify(token, ADMIN_SECRET) as jwt.JwtPayload;
    req.adminId = String(payload.sub);
    req.adminRole = String(payload.role);
    next();
  } catch {
    res.status(401).json({ error: "Admin oturumu geçersiz" });
  }
}

/** Token varsa kullanıcıyı tanır, yoksa da devam eder (opsiyonel kimlik). */
export function optionalUser(req: Request, _res: Response, next: NextFunction) {
  const token = bearer(req);
  if (token) {
    try {
      const payload = jwt.verify(token, USER_SECRET) as jwt.JwtPayload;
      req.userId = String(payload.sub);
    } catch {
      /* yok say */
    }
  }
  next();
}
