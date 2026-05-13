import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { generateCertNumber } from "@/lib/certNumber";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import { v4 as uuidv4 } from "uuid";

async function validateCardImage(file: File): Promise<{ valid: boolean; detected?: string }> {
  if (!process.env.OPENROUTER_API_KEY) return { valid: true };
  try {
    const bytes = await file.arrayBuffer();
    const ext = file.name.split(".").pop()?.toLowerCase() ?? "jpg";
    const mime = ext === "png" ? "image/png" : "image/jpeg";
    const dataUrl = `data:${mime};base64,${Buffer.from(bytes).toString("base64")}`;

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
        messages: [{
          role: "user",
          content: [
            { type: "image_url", image_url: { url: dataUrl } },
            { type: "text", text: `Is this image a physical collectible trading card (e.g. Pokémon TCG, One Piece TCG, Magic: The Gathering, Yu-Gi-Oh!, sports card, or similar printed cardboard card)?\n\nRespond ONLY with valid JSON, no extra text:\n{"valid": true} if it IS a trading card\n{"valid": false, "detected": "<one short English phrase describing what you see>"} if it is NOT a trading card` },
          ],
        }],
      }),
    });

    if (!res.ok) return { valid: true }; // fail open if API is down

    const json = await res.json();
    const text: string = json.choices?.[0]?.message?.content ?? "";
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) return { valid: true };

    const raw = JSON.parse(match[0]);
    if (raw.valid === false) return { valid: false, detected: String(raw.detected ?? "unknown object") };
    return { valid: true };
  } catch {
    return { valid: true }; // fail open on any error
  }
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const type = searchParams.get("type");
  const status = searchParams.get("status");
  const search = searchParams.get("search");

  const where: Record<string, unknown> = {};
  if (type) where.cardType = type;
  if (status) where.status = status;
  if (search) {
    where.OR = [
      { cardName: { contains: search } },
      { certNumber: { contains: search } },
      { cardSet: { contains: search } },
    ];
  }

  const cards = await prisma.card.findMany({
    where,
    include: { grade: true },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(cards);
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();

    const cardName = formData.get("cardName") as string;
    const cardSet = formData.get("cardSet") as string;
    const cardNumber = formData.get("cardNumber") as string;
    const cardType = formData.get("cardType") as string;
    const language = (formData.get("language") as string) || "JP";
    const year = formData.get("year") as string | null;
    const rarity = formData.get("rarity") as string | null;

    if (!cardName || !cardSet || !cardNumber || !cardType) {
      return NextResponse.json({ error: "ข้อมูลไม่ครบ" }, { status: 400 });
    }

    const uploadDir = path.join(process.cwd(), "public", "uploads");
    await mkdir(uploadDir, { recursive: true });

    // Validate that at least one uploaded image is a trading card before saving anything
    const imageFrontFile = formData.get("imageFront") as File | null;
    const imageBackFile = formData.get("imageBack") as File | null;
    const imageToValidate = (imageFrontFile && imageFrontFile.size > 0) ? imageFrontFile
      : (imageBackFile && imageBackFile.size > 0) ? imageBackFile : null;

    if (imageToValidate) {
      const check = await validateCardImage(imageToValidate);
      if (!check.valid) {
        return NextResponse.json(
          { error: `ไม่พบการ์ดในรูปภาพ — AI ตรวจพบ: ${check.detected}`, notACard: true, detected: check.detected },
          { status: 422 }
        );
      }
    }

    async function saveImage(file: File | null): Promise<string | null> {
      if (!file || file.size === 0) return null;
      const ext = file.name.split(".").pop() || "jpg";
      const filename = `${uuidv4()}.${ext}`;
      const bytes = await file.arrayBuffer();
      await writeFile(path.join(uploadDir, filename), Buffer.from(bytes));
      return `/uploads/${filename}`;
    }

    const imageFront = await saveImage(imageFrontFile);
    const imageBack = await saveImage(imageBackFile);

    const card = await prisma.card.create({
      data: {
        certNumber: generateCertNumber(cardType),
        cardName,
        cardSet,
        cardNumber,
        cardType,
        language,
        year: year || null,
        rarity: rarity || null,
        imageFront,
        imageBack,
        status: "PENDING",
      },
    });

    return NextResponse.json(card, { status: 201 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "เกิดข้อผิดพลาด" }, { status: 500 });
  }
}
