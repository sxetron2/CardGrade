"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { CardData, getGradeColor, getCardTypeInfo, CARD_TYPE_SECTIONS, CARD_TYPES } from "@/types";

function DeleteConfirmModal({
  card,
  onConfirm,
  onCancel,
}: {
  card: CardData;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
      <div className="bg-[#1a1a2e] border border-white/10 rounded-2xl p-6 max-w-sm w-full space-y-4">
        <div className="text-red-400 text-xl font-bold">ลบการ์ด?</div>
        <p className="text-white/70 text-sm">
          คุณต้องการลบ <span className="text-white font-bold">{card.cardName}</span>{" "}
          ({card.certNumber}) ออกจากฐานข้อมูลหรือไม่? การกระทำนี้ไม่สามารถย้อนกลับได้
        </p>
        <div className="flex gap-3">
          <button
            onClick={onConfirm}
            className="flex-1 py-2.5 bg-red-500 hover:bg-red-600 text-white font-bold rounded-xl transition-colors text-sm"
          >
            ลบออก
          </button>
          <button
            onClick={onCancel}
            className="flex-1 py-2.5 bg-white/10 hover:bg-white/20 text-white font-bold rounded-xl transition-colors text-sm"
          >
            ยกเลิก
          </button>
        </div>
      </div>
    </div>
  );
}

export default function DatabasePage() {
  const [cards, setCards] = useState<CardData[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<CardData | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    fetchCards();
  }, [search, filterType, filterStatus]);

  async function fetchCards() {
    setLoading(true);
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    if (filterType) params.set("type", filterType);
    if (filterStatus) params.set("status", filterStatus);
    const res = await fetch(`/api/cards?${params}`);
    const data = await res.json();
    setCards(data);
    setLoading(false);
  }

  async function handleDelete(card: CardData) {
    setDeleting(true);
    try {
      const res = await fetch(`/api/cards/${card.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("ลบไม่สำเร็จ");
      setCards((prev) => prev.filter((c) => c.id !== card.id));
    } catch {
      alert("ลบการ์ดไม่สำเร็จ กรุณาลองใหม่");
    } finally {
      setDeleting(false);
      setDeleteTarget(null);
    }
  }

  const statusLabel: Record<string, string> = {
    PENDING: "รอเกรด",
    GRADING: "กำลังเกรด",
    COMPLETED: "เกรดแล้ว",
  };
  const statusColor: Record<string, string> = {
    PENDING: "text-yellow-400 bg-yellow-400/10",
    GRADING: "text-blue-400 bg-blue-400/10",
    COMPLETED: "text-green-400 bg-green-400/10",
  };

  return (
    <>
      {deleteTarget && (
        <DeleteConfirmModal
          card={deleteTarget}
          onConfirm={() => handleDelete(deleteTarget)}
          onCancel={() => setDeleteTarget(null)}
        />
      )}

      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold text-white">ฐานข้อมูลการ์ด</h1>
          <Link
            href="/submit"
            className="px-4 py-2 bg-gradient-to-r from-yellow-400 to-orange-500 text-black font-bold rounded-xl hover:opacity-90 transition-opacity text-sm"
          >
            + ส่งการ์ดใหม่
          </Link>
        </div>

        {/* Filters */}
        <div className="flex gap-3 flex-wrap">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="ค้นหาชื่อ, cert number, set..."
            className="flex-1 min-w-[200px] bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-white placeholder-white/30 focus:outline-none focus:border-orange-400"
          />
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-white focus:outline-none"
          >
            <option value="">ทุกประเภท</option>
            {CARD_TYPE_SECTIONS.map((section) => (
              <optgroup key={section.label} label={section.label}>
                {section.types.map((type) => (
                  <option key={type} value={type}>{CARD_TYPES[type].shortLabel}</option>
                ))}
              </optgroup>
            ))}
          </select>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-white focus:outline-none"
          >
            <option value="">ทุกสถานะ</option>
            <option value="PENDING">รอเกรด</option>
            <option value="COMPLETED">เกรดแล้ว</option>
          </select>
        </div>

        {/* Cards */}
        {loading ? (
          <div className="text-center py-16 text-white/40">กำลังโหลด...</div>
        ) : cards.length === 0 ? (
          <div className="text-center py-16">
            <div className="text-white/30 text-lg mb-4">ยังไม่มีการ์ดในฐานข้อมูล</div>
            <Link href="/submit" className="text-orange-400 hover:underline">
              ส่งการ์ดแรกเลย →
            </Link>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {cards.map((card) => {
              const grade = card.grade;
              const gradeColor = grade ? getGradeColor(grade.finalGrade) : "#6B7280";
              const href = card.status === "COMPLETED"
                ? `/certificate/${card.id}`
                : `/grade/${card.id}`;

              return (
                <div key={card.id} className="relative group">
                  <Link href={href}>
                    <div className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden hover:border-white/20 transition-all hover:scale-[1.02] cursor-pointer">
                      {/* Card image */}
                      <div className="aspect-[2.5/3.5] relative bg-white/5">
                        {card.imageFront ? (
                          <Image src={card.imageFront} alt={card.cardName} fill className="object-cover" />
                        ) : (
                          <div className="h-full flex items-center justify-center text-white/20 text-sm">
                            ไม่มีรูป
                          </div>
                        )}
                        {grade && (
                          <div
                            className="absolute top-2 right-2 w-12 h-12 rounded-full flex items-center justify-center font-black text-lg border-2"
                            style={{ backgroundColor: gradeColor + "30", borderColor: gradeColor, color: gradeColor }}
                          >
                            {grade.finalGrade}
                          </div>
                        )}
                      </div>

                      {/* Info */}
                      <div className="p-3">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <div className="font-bold text-white text-sm truncate">{card.cardName}</div>
                            <div className="text-white/40 text-xs truncate">{card.cardSet} · {card.cardNumber}</div>
                          </div>
                          {(() => {
                            const info = getCardTypeInfo(card.cardType);
                            return (
                              <span className="text-xs px-2 py-0.5 rounded-full shrink-0"
                                style={{ backgroundColor: info.color + "18", color: info.color }}>
                                {info.certPrefix}
                              </span>
                            );
                          })()}
                        </div>
                        <div className="mt-2 flex items-center justify-between">
                          <span className={`text-xs px-2 py-0.5 rounded-full ${statusColor[card.status]}`}>
                            {statusLabel[card.status]}
                          </span>
                          {grade && (
                            <span className="text-xs font-bold" style={{ color: gradeColor }}>
                              {grade.gradeName}
                            </span>
                          )}
                        </div>
                        <div className="text-white/20 text-xs mt-1 font-mono">{card.certNumber}</div>
                      </div>
                    </div>
                  </Link>

                  {/* Delete button — shown on hover (desktop) or always visible (mobile) */}
                  <button
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setDeleteTarget(card);
                    }}
                    disabled={deleting}
                    className="absolute top-2 left-2 w-8 h-8 flex items-center justify-center rounded-full bg-black/60 border border-white/10 text-white/40 hover:bg-red-500/80 hover:text-white hover:border-red-400 transition-all opacity-0 group-hover:opacity-100 focus:opacity-100"
                    title="ลบการ์ด"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="3 6 5 6 21 6" />
                      <path d="M19 6l-1 14H6L5 6" />
                      <path d="M10 11v6M14 11v6" />
                      <path d="M9 6V4h6v2" />
                    </svg>
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}
