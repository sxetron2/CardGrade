import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCardTypeInfo } from "@/types";
import { readFile } from "fs/promises";
import path from "path";

const VALID_SCORES = [1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5, 5.5, 6, 6.5, 7, 7.5, 8, 8.5, 9, 9.5, 10];

function snapToScale(v: number): number {
  return VALID_SCORES.reduce((prev, curr) =>
    Math.abs(curr - v) < Math.abs(prev - v) ? curr : prev
  );
}

async function imageToDataUrl(imgPath: string | null | undefined): Promise<string | null> {
  if (!imgPath) return null;
  const fullPath = path.join(process.cwd(), "public", imgPath);
  const data = await readFile(fullPath);
  const ext = imgPath.split(".").pop()?.toLowerCase() ?? "jpg";
  const mimeType = ext === "png" ? "image/png" : "image/jpeg";
  return `data:${mimeType};base64,${data.toString("base64")}`;
}

export async function POST(request: NextRequest) {
  try {
    const { cardId } = await request.json();
    if (!cardId) return NextResponse.json({ error: "ไม่มี cardId" }, { status: 400 });

    const card = await prisma.card.findUnique({ where: { id: cardId } });
    if (!card) return NextResponse.json({ error: "ไม่พบการ์ด" }, { status: 404 });

    if (!process.env.OPENROUTER_API_KEY) {
      return NextResponse.json({ error: "ยังไม่ได้ตั้งค่า OPENROUTER_API_KEY ใน .env.local" }, { status: 500 });
    }

    const [frontDataUrl, backDataUrl] = await Promise.all([
      imageToDataUrl(card.imageFront),
      imageToDataUrl(card.imageBack),
    ]);

    if (!frontDataUrl && !backDataUrl) {
      return NextResponse.json({ error: "ไม่มีรูปการ์ดสำหรับวิเคราะห์" }, { status: 400 });
    }

    // Build content array: images first, then prompt text
    type ContentPart =
      | { type: "image_url"; image_url: { url: string } }
      | { type: "text"; text: string };

    const content: ContentPart[] = [];
    if (frontDataUrl) content.push({ type: "image_url", image_url: { url: frontDataUrl } });
    if (backDataUrl) content.push({ type: "image_url", image_url: { url: backDataUrl } });

    content.push({
      type: "text",
      text: `You are a professional trading card grading expert (like PSA/BGS).

## STEP 1 — VALIDATION
Look at the image(s) carefully. Determine whether they show a physical collectible trading card (e.g. Pokémon TCG, One Piece TCG, Magic: The Gathering, Yu-Gi-Oh!, sports card, or similar printed cardboard card).

If the image does NOT show a trading card (e.g. it shows a coin, food, document, person, object, blank paper, etc.), respond with ONLY this JSON:
{"valid": false, "detected": "<one short English phrase describing what you actually see>"}

## STEP 2 — GRADING (only if valid card)
Card info:
- Name: ${card.cardName}
- Set: ${card.cardSet} (${card.cardNumber})
- Type: ${getCardTypeInfo(card.cardType).label}
- Language: ${card.language}${card.rarity ? `\n- Rarity: ${card.rarity}` : ""}

Grade these 4 criteria:
1. Centering (20% weight): Border symmetry. Perfect 50/50 = 10.
2. Corners (30% weight): Sharpness, no whitening or fraying.
3. Edges (20% weight): Cleanliness, no chips, nicks, or roughness.
4. Surface (30% weight): Free of scratches, print lines, stains, or indentations.

Use ONLY these values: 1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5, 5.5, 6, 6.5, 7, 7.5, 8, 8.5, 9, 9.5, 10

Respond with ONLY valid JSON (no markdown, no extra text):
{"valid": true, "centering": <number>, "corners": <number>, "edges": <number>, "surface": <number>, "notes": "<2-3 sentences in Thai>"}`,
    });

    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://a7grading.com",
        "X-Title": "A7Grading",
      },
      body: JSON.stringify({
        model: "nvidia/nemotron-nano-12b-v2-vl:free",
        messages: [{ role: "user", content }],
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`OpenRouter error ${res.status}: ${err}`);
    }

    const json = await res.json();
    const text: string = json.choices?.[0]?.message?.content ?? "";

    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("AI ไม่ได้ตอบกลับเป็น JSON");

    const raw = JSON.parse(jsonMatch[0]);

    // Validation failed — not a trading card
    if (raw.valid === false) {
      const detected = String(raw.detected ?? "unknown object");
      return NextResponse.json(
        { error: `ไม่พบการ์ดในรูปภาพ — AI ตรวจพบ: ${detected}`, notACard: true, detected },
        { status: 422 }
      );
    }

    return NextResponse.json({
      centering: snapToScale(Number(raw.centering)),
      corners: snapToScale(Number(raw.corners)),
      edges: snapToScale(Number(raw.edges)),
      surface: snapToScale(Number(raw.surface)),
      notes: String(raw.notes ?? ""),
    });
  } catch (err) {
    console.error("[ai-grade]", err);
    const msg = err instanceof Error ? err.message : "เกิดข้อผิดพลาด";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
