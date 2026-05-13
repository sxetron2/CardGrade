"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { CardData, GRADE_SCALE, calculateFinalGrade, getGradeName, getGradeColor, getCardTypeInfo } from "@/types";
import DefectInspector from "@/components/DefectInspector";

function ScoreSlider({
  label,
  value,
  onChange,
  weight,
  aiValue,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  weight: string;
  aiValue?: number;
}) {
  return (
    <div className="space-y-2">
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-2">
          <span className="font-medium text-white">{label}</span>
          <span className="text-white/40 text-xs">น้ำหนัก {weight}</span>
          {aiValue !== undefined && aiValue !== value && (
            <span className="text-xs text-purple-400/70">AI: {aiValue}</span>
          )}
        </div>
        <span className="text-2xl font-black" style={{ color: getGradeColor(value) }}>
          {value}
        </span>
      </div>
      <div className="flex gap-1 flex-wrap">
        {GRADE_SCALE.map((v) => (
          <button
            key={v}
            type="button"
            onClick={() => onChange(v)}
            className={`flex-1 min-w-[28px] py-2 rounded text-xs font-bold transition-all ${
              value === v ? "text-black" : "bg-white/5 text-white/40 hover:bg-white/10"
            }`}
            style={value === v ? { backgroundColor: getGradeColor(v) } : {}}
          >
            {v}
          </button>
        ))}
      </div>
    </div>
  );
}

export default function GradePage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const [card, setCard] = useState<CardData | null>(null);
  const [scores, setScores] = useState({ centering: 8, corners: 8, edges: 8, surface: 8 });
  const [submitting, setSubmitting] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiNotes, setAiNotes] = useState<string | null>(null);
  const [aiScores, setAiScores] = useState<{ centering: number; corners: number; edges: number; surface: number } | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);
  const [aiNotACard, setAiNotACard] = useState<string | null>(null); // detected object when not a card

  const finalGrade = calculateFinalGrade(scores.centering, scores.corners, scores.edges, scores.surface);
  const gradeName = getGradeName(finalGrade);

  useEffect(() => {
    fetch(`/api/cards/${params.id}`)
      .then((r) => r.json())
      .then((data) => {
        setCard(data);
        if (data.grade) {
          setScores({
            centering: data.grade.centering,
            corners: data.grade.corners,
            edges: data.grade.edges,
            surface: data.grade.surface,
          });
        }
      });
  }, [params.id]);

  async function handleAiGrade() {
    setAiLoading(true);
    setAiError(null);
    setAiNotes(null);
    setAiNotACard(null);
    try {
      const res = await fetch("/api/ai-grade", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cardId: params.id }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (data.notACard) {
          setAiNotACard(data.detected ?? "unknown");
          return;
        }
        throw new Error(data.error || "เกิดข้อผิดพลาด");
      }
      setAiScores({ centering: data.centering, corners: data.corners, edges: data.edges, surface: data.surface });
      setScores({ centering: data.centering, corners: data.corners, edges: data.edges, surface: data.surface });
      setAiNotes(data.notes);
    } catch (err) {
      setAiError(err instanceof Error ? err.message : "เกิดข้อผิดพลาด");
    } finally {
      setAiLoading(false);
    }
  }

  async function submitGrade() {
    setSubmitting(true);
    try {
      await fetch("/api/grade", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cardId: params.id, ...scores }),
      });
      router.push(`/certificate/${params.id}`);
    } catch {
      alert("บันทึกเกรดไม่สำเร็จ");
    } finally {
      setSubmitting(false);
    }
  }

  if (!card) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-white/40">กำลังโหลด...</div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex items-center gap-3 mb-8">
        <h1 className="text-3xl font-bold text-white">เกรดการ์ด</h1>
        <span className="px-3 py-1 rounded-full text-xs font-bold bg-white/10 text-white/60">
          {card.certNumber}
        </span>
      </div>

      <div className="grid md:grid-cols-2 gap-8">
        {/* Left: card info + images */}
        <div className="space-y-4">
          <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
            <div className="flex justify-between items-start mb-3">
              <div>
                <h2 className="text-xl font-bold text-white">{card.cardName}</h2>
                <p className="text-white/50">{card.cardSet} · {card.cardNumber}</p>
              </div>
              {(() => {
                const info = getCardTypeInfo(card.cardType);
                return (
                  <span className="px-3 py-1 rounded-full text-xs font-bold"
                    style={{ backgroundColor: info.color + "20", color: info.color }}>
                    {info.shortLabel}
                  </span>
                );
              })()}
            </div>
            <div className="flex gap-2 text-sm text-white/40">
              <span>{card.language}</span>
              {card.year && <span>· {card.year}</span>}
              {card.rarity && <span>· {card.rarity}</span>}
            </div>
          </div>

          {/* Images */}
          <div className="grid grid-cols-2 gap-3">
            {[card.imageFront, card.imageBack].map((img, i) => (
              <div key={i} className="aspect-[2.5/3.5] bg-white/5 rounded-xl overflow-hidden relative border border-white/10">
                {img ? (
                  <Image src={img} alt={i === 0 ? "หน้า" : "หลัง"} fill className="object-cover" />
                ) : (
                  <div className="flex items-center justify-center h-full text-white/20 text-sm">
                    {i === 0 ? "ไม่มีรูปหน้า" : "ไม่มีรูปหลัง"}
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* AI Grade button */}
          <button
            onClick={handleAiGrade}
            disabled={aiLoading}
            className="w-full py-3 rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2
              bg-purple-500/10 border border-purple-500/30 text-purple-300
              hover:bg-purple-500/20 hover:border-purple-400/60 disabled:opacity-50"
          >
            {aiLoading ? (
              <>
                <svg className="animate-spin" xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
                AI กำลังวิเคราะห์...
              </>
            ) : (
              <>
                <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/><path d="M5 3v4M19 17v4M3 5h4M17 19h4"/></svg>
                ให้ AI ช่วยเกรด (Gemini)
              </>
            )}
          </button>

          {/* AI Notes */}
          {aiNotes && (
            <div className="bg-purple-500/5 border border-purple-500/20 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-purple-400"><path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/></svg>
                <span className="text-purple-400 text-xs font-bold">AI Analysis</span>
              </div>
              <p className="text-white/60 text-sm leading-relaxed">{aiNotes}</p>
            </div>
          )}

          {/* Not a card warning */}
          {aiNotACard && (
            <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4 space-y-2">
              <div className="flex items-center gap-2">
                <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-amber-400 shrink-0"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg>
                <span className="text-amber-400 font-bold text-sm">ไม่พบการ์ดในรูปภาพ</span>
              </div>
              <p className="text-amber-200/70 text-xs leading-relaxed">
                AI ตรวจพบว่ารูปภาพที่อัพโหลดไม่ใช่การ์ดสะสม —{" "}
                <span className="font-semibold text-amber-300">พบ: {aiNotACard}</span>
              </p>
              <p className="text-white/40 text-xs">
                กรุณาอัพโหลดรูปการ์ดจริง (Pokemon TCG, One Piece, MTG ฯลฯ) แล้วลองใหม่อีกครั้ง
              </p>
            </div>
          )}

          {/* AI Error */}
          {aiError && (
            <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3 text-red-400 text-sm">
              {aiError}
            </div>
          )}

          {/* Grading guide */}
          <div className="bg-white/5 border border-white/10 rounded-xl p-4 text-sm space-y-2">
            <div className="font-bold text-white/70 mb-2">เกณฑ์การให้คะแนน</div>
            {[
              { label: "Centering", desc: "ความสมดุลของกรอบ — 50/50 = 10" },
              { label: "Corners", desc: "มุมการ์ด — คม ไม่มีรอยขาว = 10" },
              { label: "Edges", desc: "ขอบการ์ด — เรียบ ไม่มีรอยหยัก = 10" },
              { label: "Surface", desc: "ผิวหน้า — ใส ไม่มีรอยขีด = 10" },
            ].map((g) => (
              <div key={g.label} className="flex gap-2">
                <span className="text-white/60 w-20 shrink-0">{g.label}</span>
                <span className="text-white/30">{g.desc}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Right: scoring */}
        <div className="space-y-4">
          <div className="bg-white/5 border border-white/10 rounded-2xl p-6 space-y-6">
            <ScoreSlider label="Centering" value={scores.centering} onChange={(v) => setScores((s) => ({ ...s, centering: v }))} weight="20%" aiValue={aiScores?.centering} />
            <ScoreSlider label="Corners" value={scores.corners} onChange={(v) => setScores((s) => ({ ...s, corners: v }))} weight="30%" aiValue={aiScores?.corners} />
            <ScoreSlider label="Edges" value={scores.edges} onChange={(v) => setScores((s) => ({ ...s, edges: v }))} weight="20%" aiValue={aiScores?.edges} />
            <ScoreSlider label="Surface" value={scores.surface} onChange={(v) => setScores((s) => ({ ...s, surface: v }))} weight="30%" aiValue={aiScores?.surface} />
          </div>

          {/* Final Grade Preview */}
          <div className="bg-white/5 border border-white/10 rounded-2xl p-6 text-center">
            <div className="text-white/50 text-sm mb-2">เกรดสุดท้าย</div>
            <div className="text-7xl font-black mb-2" style={{ color: getGradeColor(finalGrade) }}>
              {finalGrade}
            </div>
            <div className="text-xl font-bold" style={{ color: getGradeColor(finalGrade) }}>
              {gradeName}
            </div>
            <div className="mt-4 grid grid-cols-4 gap-2 text-center text-xs">
              {[
                { label: "CEN", value: scores.centering },
                { label: "COR", value: scores.corners },
                { label: "EDG", value: scores.edges },
                { label: "SUR", value: scores.surface },
              ].map((s) => (
                <div key={s.label} className="bg-white/5 rounded-lg py-2">
                  <div className="text-white/40">{s.label}</div>
                  <div className="font-bold text-white">{s.value}</div>
                </div>
              ))}
            </div>
          </div>

          <button
            onClick={submitGrade}
            disabled={submitting}
            className="w-full py-4 bg-gradient-to-r from-yellow-400 to-orange-500 text-black font-bold text-lg rounded-xl hover:opacity-90 disabled:opacity-50 transition-opacity"
          >
            {submitting ? "กำลังบันทึก..." : "ยืนยันเกรด & ออก Certificate"}
          </button>
        </div>
      </div>

      {/* Defect Inspector — full width below main grid */}
      <div className="mt-6">
        <DefectInspector
          frontSrc={card.imageFront}
          backSrc={card.imageBack}
          currentScores={scores}
          onApplyScores={(s) => setScores(s)}
        />
      </div>
    </div>
  );
}
