/**
 * AI mentor eşleştirme.
 *
 * POST /api/match-mentor { goal: string }
 *   - Mevcut öğretmenleri Claude'a verir, kullanıcının hedefine en uygun
 *     1-3 mentor önerir (id + neden).
 *   - ANTHROPIC_API_KEY tanımlı değilse heuristik fallback: skill/category
 *     metin eşleşmesi ile en yüksek rating'liyi döner.
 */
import { Router } from "express";
import Anthropic from "@anthropic-ai/sdk";
import { prisma } from "../prisma";
import { requireUser } from "../auth";
import { serializeTeacher } from "../serialize";

export const matchRouter = Router();
matchRouter.use(requireUser);

type Recommendation = { teacherId: string; reason: string };

const apiKey = process.env.ANTHROPIC_API_KEY;
const anthropic = apiKey ? new Anthropic({ apiKey }) : null;

matchRouter.post("/", async (req, res) => {
  const goal = String(req.body?.goal ?? "").trim();
  if (goal.length < 10) {
    return res
      .status(400)
      .json({ error: "Lütfen hedefini en az 10 karakter ile yaz" });
  }

  const teachers = await prisma.teacher.findMany({
    orderBy: { rating: "desc" },
    take: 30,
  });
  const summary = teachers.map((t) => ({
    id: t.id,
    name: t.name,
    skill: t.skill,
    category: t.category,
    rating: t.rating,
    coinRate: t.coinRate,
    bio: t.bio.slice(0, 200),
  }));

  let recommendations: Recommendation[] = [];

  if (anthropic) {
    try {
      const message = await anthropic.messages.create({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 600,
        system:
          "Sen PeerUP adlı bir öğrenme platformunda öğrencilere mentor öneren bir yardımcısın. " +
          "Verilen mentor listesinden öğrencinin hedefine en uygun 1 ila 3 mentoru seç. " +
          "Cevabını SADECE şu JSON formatında ver, başka metin yazma: " +
          `{"recommendations":[{"teacherId":"...","reason":"Türkçe kısa gerekçe (~140 karakter)"}, ...]}`,
        messages: [
          {
            role: "user",
            content: `Öğrenci hedefi: "${goal}"\n\nMentor listesi (JSON):\n${JSON.stringify(summary)}`,
          },
        ],
      });
      const text =
        message.content
          .filter((c) => c.type === "text")
          .map((c) => (c as { text: string }).text)
          .join("") ?? "";
      const match = text.match(/\{[\s\S]*\}/);
      if (match) {
        const parsed = JSON.parse(match[0]) as { recommendations?: Recommendation[] };
        recommendations = Array.isArray(parsed.recommendations)
          ? parsed.recommendations.slice(0, 3)
          : [];
      }
    } catch (e) {
      console.warn("[match] Claude hatası, fallback'e geçiliyor:", e);
    }
  }

  // Fallback (API yok veya hata): hedef metnini öğretmen skill/category/bio
  // ile basit skorlayıp en yüksek rating'lileri döner.
  if (recommendations.length === 0) {
    const goalLower = goal.toLowerCase();
    const scored = teachers
      .map((t) => {
        const text = `${t.skill} ${t.category} ${t.bio}`.toLowerCase();
        const overlap = text.split(/\s+/).filter((w) => goalLower.includes(w)).length;
        return { t, score: overlap + t.rating };
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, 3);
    recommendations = scored.map(({ t }) => ({
      teacherId: t.id,
      reason: `${t.skill} alanında ${t.rating.toFixed(1)} puanlı mentor.`,
    }));
  }

  // Önerilen mentor'ların tam kayıtlarını döndür.
  const ids = recommendations.map((r) => r.teacherId);
  const records = await prisma.teacher.findMany({ where: { id: { in: ids } } });
  const byId = new Map(records.map((r) => [r.id, r]));
  const result = recommendations
    .filter((r) => byId.has(r.teacherId))
    .map((r) => ({
      teacher: serializeTeacher(byId.get(r.teacherId)),
      reason: r.reason,
    }));

  res.json({ recommendations: result, usedAi: !!anthropic });
});
