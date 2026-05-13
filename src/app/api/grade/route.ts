import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { calculateFinalGrade, getGradeName } from "@/types";

export async function POST(request: NextRequest) {
  try {
    const { cardId, centering, corners, edges, surface } = await request.json();

    if (!cardId || centering == null || corners == null || edges == null || surface == null) {
      return NextResponse.json({ error: "ข้อมูลไม่ครบ" }, { status: 400 });
    }

    const finalGrade = calculateFinalGrade(centering, corners, edges, surface);
    const gradeName = getGradeName(finalGrade);

    const grade = await prisma.grade.upsert({
      where: { cardId },
      create: { cardId, centering, corners, edges, surface, finalGrade, gradeName, gradedBy: "Manual" },
      update: { centering, corners, edges, surface, finalGrade, gradeName, gradedAt: new Date() },
    });

    await prisma.card.update({
      where: { id: cardId },
      data: { status: "COMPLETED" },
    });

    return NextResponse.json({ grade, finalGrade, gradeName });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "เกิดข้อผิดพลาด" }, { status: 500 });
  }
}
