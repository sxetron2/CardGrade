"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { CardData, getGradeColor, getCardTypeInfo } from "@/types";

export default function CertificatePage({ params }: { params: { id: string } }) {
  const [card, setCard] = useState<CardData | null>(null);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    fetch(`/api/cards/${params.id}`)
      .then((r) => r.json())
      .then(setCard);
  }, [params.id]);

  async function downloadPDF() {
    setDownloading(true);
    try {
      const res = await fetch(`/api/certificate?id=${params.id}`);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `certificate-${card?.certNumber}.pdf`;
      a.click();
    } finally {
      setDownloading(false);
    }
  }

  if (!card || !card.grade) {
    return (
      <div className="flex items-center justify-center h-64 text-white/40">
        กำลังโหลด...
      </div>
    );
  }

  const grade = card.grade;
  const gradeColor = getGradeColor(grade.finalGrade);
  const gradedDate = new Date(grade.gradedAt).toLocaleDateString("th-TH", {
    year: "numeric", month: "long", day: "numeric",
  });

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-white">Certificate</h1>
        <Link href="/database" className="text-white/50 hover:text-white text-sm">
          ← กลับฐานข้อมูล
        </Link>
      </div>

      {/* Certificate Card */}
      <div className="relative bg-gradient-to-b from-[#1a1a2e] to-[#16213e] border-2 rounded-3xl overflow-hidden"
        style={{ borderColor: gradeColor }}>

        {/* Top strip */}
        <div className="h-2 w-full" style={{ backgroundColor: gradeColor }} />

        <div className="p-8">
          {/* Header */}
          <div className="text-center mb-8">
            <div className="text-2xl font-black tracking-widest bg-gradient-to-r from-yellow-400 to-orange-500 bg-clip-text text-transparent">
              A7GRADING
            </div>
            <div className="text-white/40 text-xs tracking-widest mt-1">PROFESSIONAL GRADING SERVICE</div>
          </div>

          <div className="grid grid-cols-[1fr_auto_1fr] gap-6 items-center">
            {/* Card image */}
            <div className="aspect-[2.5/3.5] rounded-xl overflow-hidden relative border-2"
              style={{ borderColor: gradeColor + "60" }}>
              {card.imageFront ? (
                <Image src={card.imageFront} alt={card.cardName} fill className="object-cover" />
              ) : (
                <div className="h-full flex items-center justify-center bg-white/5 text-white/20 text-sm">
                  ไม่มีรูป
                </div>
              )}
            </div>

            {/* Grade */}
            <div className="text-center px-4">
              <div className="text-white/40 text-xs mb-2 tracking-wider">GRADE</div>
              <div className="text-8xl font-black leading-none" style={{ color: gradeColor }}>
                {grade.finalGrade}
              </div>
              <div className="text-sm font-bold mt-2 whitespace-nowrap" style={{ color: gradeColor }}>
                {grade.gradeName}
              </div>
              <div className="mt-4 grid grid-cols-2 gap-1 text-center text-xs">
                {[
                  { label: "CEN", value: grade.centering },
                  { label: "COR", value: grade.corners },
                  { label: "EDG", value: grade.edges },
                  { label: "SUR", value: grade.surface },
                ].map((s) => (
                  <div key={s.label} className="bg-white/5 rounded p-1">
                    <div className="text-white/30">{s.label}</div>
                    <div className="font-bold text-white">{s.value}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Back image */}
            <div className="aspect-[2.5/3.5] rounded-xl overflow-hidden relative border-2"
              style={{ borderColor: gradeColor + "60" }}>
              {card.imageBack ? (
                <Image src={card.imageBack} alt={card.cardName} fill className="object-cover" />
              ) : (
                <div className="h-full flex items-center justify-center bg-white/5 text-white/20 text-sm">
                  ไม่มีรูป
                </div>
              )}
            </div>
          </div>

          {/* Card info */}
          <div className="mt-8 space-y-2">
            <div className="flex justify-between text-sm border-b border-white/10 pb-2">
              <span className="text-white/40">ชื่อการ์ด</span>
              <span className="text-white font-medium">{card.cardName}</span>
            </div>
            <div className="flex justify-between text-sm border-b border-white/10 pb-2">
              <span className="text-white/40">Set / เลขการ์ด</span>
              <span className="text-white">{card.cardSet} · {card.cardNumber}</span>
            </div>
            <div className="flex justify-between text-sm border-b border-white/10 pb-2">
              <span className="text-white/40">ประเภท / ภาษา</span>
              <span className="text-white">
                {getCardTypeInfo(card.cardType).shortLabel} · {card.language}
                {card.rarity ? ` · ${card.rarity}` : ""}
              </span>
            </div>
            <div className="flex justify-between text-sm border-b border-white/10 pb-2">
              <span className="text-white/40">วันที่เกรด</span>
              <span className="text-white">{gradedDate}</span>
            </div>
          </div>

          {/* Cert Number */}
          <div className="mt-6 text-center">
            <div className="text-white/30 text-xs mb-1">CERTIFICATION NUMBER</div>
            <div className="text-white font-mono text-lg font-bold tracking-widest">
              {card.certNumber}
            </div>
          </div>
        </div>

        {/* Bottom strip */}
        <div className="h-2 w-full" style={{ backgroundColor: gradeColor }} />
      </div>

      {/* Actions */}
      <div className="flex gap-3">
        <button
          onClick={downloadPDF}
          disabled={downloading}
          className="flex-1 py-3 bg-gradient-to-r from-yellow-400 to-orange-500 text-black font-bold rounded-xl hover:opacity-90 disabled:opacity-50 transition-opacity"
        >
          {downloading ? "กำลังสร้าง PDF..." : "ดาวน์โหลด PDF Certificate"}
        </button>
        <Link
          href="/submit"
          className="px-6 py-3 bg-white/10 text-white font-bold rounded-xl hover:bg-white/20 transition-colors"
        >
          เกรดการ์ดใหม่
        </Link>
      </div>
    </div>
  );
}
