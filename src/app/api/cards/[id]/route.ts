import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const card = await prisma.card.findUnique({
    where: { id: params.id },
    include: { grade: true },
  });
  if (!card) return NextResponse.json({ error: "ไม่พบการ์ด" }, { status: 404 });
  return NextResponse.json(card);
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const card = await prisma.card.findUnique({ where: { id: params.id } });
  if (!card) return NextResponse.json({ error: "ไม่พบการ์ด" }, { status: 404 });
  // Grade is cascade-deleted via Prisma schema (onDelete: Cascade)
  await prisma.card.delete({ where: { id: params.id } });
  return NextResponse.json({ success: true });
}
