"use client";
import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import CardCropper from "@/components/CardCropper";
import { CardType, CARD_TYPE_SECTIONS, CARD_TYPES } from "@/types";

type Side = "front" | "back";

function dataUrlToFile(dataUrl: string, filename: string): File {
  const [header, data] = dataUrl.split(",");
  const mime = header.match(/:(.*?);/)![1];
  const bytes = atob(data);
  const arr = new Uint8Array(bytes.length);
  for (let i = 0; i < bytes.length; i++) arr[i] = bytes.charCodeAt(i);
  return new File([arr], filename, { type: mime });
}

export default function SubmitPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [submitError, setSubmitError] = useState<{ message: string; notACard?: boolean; detected?: string } | null>(null);
  const [frontPreview, setFrontPreview] = useState<string | null>(null);
  const [backPreview, setBackPreview] = useState<string | null>(null);
  const [croppedFront, setCroppedFront] = useState<string | null>(null);
  const [croppedBack, setCroppedBack] = useState<string | null>(null);
  const [cropping, setCropping] = useState<Side | null>(null);
  const frontRef = useRef<HTMLInputElement>(null);
  const backRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState({
    cardName: "",
    cardSet: "",
    cardNumber: "",
    cardType: "POKEMON" as CardType,
    language: "JP",
    year: "",
    rarity: "",
  });

  function handleFileChange(side: Side, file: File | null) {
    if (!file) return;
    const url = URL.createObjectURL(file);
    if (side === "front") {
      setFrontPreview(url);
      setCroppedFront(null);
    } else {
      setBackPreview(url);
      setCroppedBack(null);
    }
  }

  function handleCropComplete(side: Side, dataUrl: string) {
    if (side === "front") setCroppedFront(dataUrl);
    else setCroppedBack(dataUrl);
    setCropping(null);
  }

  const getDisplayImage = (side: Side) =>
    side === "front"
      ? croppedFront ?? frontPreview
      : croppedBack ?? backPreview;

  const getOriginalPreview = (side: Side) =>
    side === "front" ? frontPreview : backPreview;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.cardName || !form.cardSet || !form.cardNumber) {
      setSubmitError({ message: "กรุณากรอกข้อมูลให้ครบ" });
      return;
    }
    setLoading(true);
    setSubmitError(null);
    try {
      const formData = new FormData();
      Object.entries(form).forEach(([k, v]) => formData.append(k, v));

      // Use cropped image if available, otherwise use original file
      if (croppedFront) {
        formData.append("imageFront", dataUrlToFile(croppedFront, "front.jpg"));
      } else if (frontRef.current?.files?.[0]) {
        formData.append("imageFront", frontRef.current.files[0]);
      }

      if (croppedBack) {
        formData.append("imageBack", dataUrlToFile(croppedBack, "back.jpg"));
      } else if (backRef.current?.files?.[0]) {
        formData.append("imageBack", backRef.current.files[0]);
      }

      const res = await fetch("/api/cards", { method: "POST", body: formData });
      const data = await res.json();
      if (!res.ok) {
        if (data.notACard) {
          setSubmitError({ message: data.error, notACard: true, detected: data.detected });
        } else {
          setSubmitError({ message: data.error || "เกิดข้อผิดพลาด" });
        }
        return;
      }
      router.push(`/grade/${data.id}`);
    } catch (err: unknown) {
      setSubmitError({ message: err instanceof Error ? err.message : "เกิดข้อผิดพลาด" });
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      {/* Perspective cropper overlay */}
      {cropping && getOriginalPreview(cropping) && (
        <CardCropper
          imageSrc={getOriginalPreview(cropping)!}
          onComplete={(dataUrl) => handleCropComplete(cropping, dataUrl)}
          onCancel={() => setCropping(null)}
        />
      )}

      <div className="max-w-2xl mx-auto">
        <h1 className="text-3xl font-bold mb-8 text-white">ส่งการ์ดเพื่อเกรด</h1>
        <form onSubmit={handleSubmit} className="space-y-6">

          {/* Card Type */}
          <div className="bg-white/5 border border-white/10 rounded-2xl p-6 space-y-5">
            <h2 className="font-bold text-white">ประเภทการ์ด</h2>
            {CARD_TYPE_SECTIONS.map((section) => (
              <div key={section.label}>
                <div className="text-xs font-bold text-white/30 uppercase tracking-widest mb-2">
                  {section.label}
                </div>
                <div className="flex flex-wrap gap-2">
                  {section.types.map((type) => {
                    const info = CARD_TYPES[type];
                    const selected = form.cardType === type;
                    return (
                      <button
                        key={type}
                        type="button"
                        onClick={() => setForm((f) => ({ ...f, cardType: type }))}
                        className="px-4 py-2 rounded-xl font-semibold text-sm transition-all border"
                        style={
                          selected
                            ? { backgroundColor: info.color + "30", borderColor: info.color, color: info.color }
                            : { backgroundColor: "rgba(255,255,255,0.04)", borderColor: "rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.45)" }
                        }
                      >
                        {info.shortLabel}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
            {/* Selected type display */}
            <div className="flex items-center gap-2 pt-1 border-t border-white/5">
              <span className="text-white/30 text-xs">เลือก:</span>
              <span
                className="text-sm font-bold px-3 py-1 rounded-full"
                style={{
                  backgroundColor: CARD_TYPES[form.cardType].color + "20",
                  color: CARD_TYPES[form.cardType].color,
                }}
              >
                {CARD_TYPES[form.cardType].label}
              </span>
            </div>
          </div>

          {/* Card Info */}
          <div className="bg-white/5 border border-white/10 rounded-2xl p-6 space-y-4">
            <h2 className="font-bold text-white">ข้อมูลการ์ด</h2>
            <div className="grid gap-4">
              <div>
                <label className="text-white/60 text-sm mb-1 block">ชื่อการ์ด *</label>
                <input
                  value={form.cardName}
                  onChange={(e) => setForm((f) => ({ ...f, cardName: e.target.value }))}
                  placeholder="เช่น Charizard, Monkey D. Luffy"
                  className="w-full bg-white/10 border border-white/10 rounded-lg px-4 py-3 text-white placeholder-white/30 focus:outline-none focus:border-orange-400"
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-white/60 text-sm mb-1 block">Set/ชุด *</label>
                  <input
                    value={form.cardSet}
                    onChange={(e) => setForm((f) => ({ ...f, cardSet: e.target.value }))}
                    placeholder="เช่น Base Set, OP-01"
                    className="w-full bg-white/10 border border-white/10 rounded-lg px-4 py-3 text-white placeholder-white/30 focus:outline-none focus:border-orange-400"
                    required
                  />
                </div>
                <div>
                  <label className="text-white/60 text-sm mb-1 block">เลขการ์ด *</label>
                  <input
                    value={form.cardNumber}
                    onChange={(e) => setForm((f) => ({ ...f, cardNumber: e.target.value }))}
                    placeholder="เช่น 004/102, OP01-001"
                    className="w-full bg-white/10 border border-white/10 rounded-lg px-4 py-3 text-white placeholder-white/30 focus:outline-none focus:border-orange-400"
                    required
                  />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="text-white/60 text-sm mb-1 block">ภาษา</label>
                  <select
                    value={form.language}
                    onChange={(e) => setForm((f) => ({ ...f, language: e.target.value }))}
                    className="w-full bg-white/10 border border-white/10 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-orange-400"
                  >
                    <option value="JP">ญี่ปุ่น (JP)</option>
                    <option value="EN">อังกฤษ (EN)</option>
                    <option value="TH">ไทย (TH)</option>
                    <option value="KR">เกาหลี (KR)</option>
                    <option value="SC">จีน (SC)</option>
                  </select>
                </div>
                <div>
                  <label className="text-white/60 text-sm mb-1 block">ปีที่ออก</label>
                  <input
                    value={form.year}
                    onChange={(e) => setForm((f) => ({ ...f, year: e.target.value }))}
                    placeholder="2024"
                    className="w-full bg-white/10 border border-white/10 rounded-lg px-4 py-3 text-white placeholder-white/30 focus:outline-none focus:border-orange-400"
                  />
                </div>
                <div>
                  <label className="text-white/60 text-sm mb-1 block">Rarity</label>
                  <input
                    value={form.rarity}
                    onChange={(e) => setForm((f) => ({ ...f, rarity: e.target.value }))}
                    placeholder="SR, SAR, SP"
                    className="w-full bg-white/10 border border-white/10 rounded-lg px-4 py-3 text-white placeholder-white/30 focus:outline-none focus:border-orange-400"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Photo Tips */}
          <div className="bg-blue-500/5 border border-blue-500/20 rounded-2xl p-5">
            <div className="flex items-center gap-2 mb-3">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-blue-400 shrink-0"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/></svg>
              <span className="text-blue-400 font-bold text-sm">เคล็ดลับ: ถ่ายรูปยังไงให้ AI เกรดแม่นขึ้น</span>
            </div>
            <div className="grid sm:grid-cols-2 gap-2">
              {[
                { icon: "☀️", text: "แสงสว่างเพียงพอ — ใช้แสงธรรมชาติหรือแสงจาก 2 ด้าน หลีกเลี่ยง Flash ตรง" },
                { icon: "🎯", text: "วางการ์ดบนพื้นหลังสีเรียบ เช่น ผ้าดำหรือขาว ให้เห็นขอบชัดเจน" },
                { icon: "📐", text: "ถ่ายตรงจากด้านบน ไม่เอียง เห็นมุมการ์ดทั้ง 4 ชัดเจน" },
                { icon: "🔍", text: "ถ่ายให้เห็นรายละเอียด — ขอบ, มุม, ผิวหน้า ที่ความละเอียดสูง" },
              ].map((tip, i) => (
                <div key={i} className="flex gap-2 items-start text-xs text-white/50">
                  <span className="text-base shrink-0">{tip.icon}</span>
                  <span>{tip.text}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Image Upload */}
          <div className="bg-white/5 border border-white/10 rounded-2xl p-6 space-y-4">
            <h2 className="font-bold text-white">รูปการ์ด</h2>
            <div className="grid grid-cols-2 gap-4">
              {(["front", "back"] as Side[]).map((side) => {
                const displayImg = getDisplayImage(side);
                const originalImg = getOriginalPreview(side);
                const ref = side === "front" ? frontRef : backRef;
                const isCropped = side === "front" ? !!croppedFront : !!croppedBack;

                return (
                  <div key={side}>
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-white/60 text-sm">
                        {side === "front" ? "หน้าการ์ด" : "หลังการ์ด"}
                      </label>
                      {isCropped && (
                        <span className="text-xs text-green-400 bg-green-400/10 px-2 py-0.5 rounded-full">
                          ✓ ปรับแล้ว
                        </span>
                      )}
                    </div>

                    {/* Image preview / upload area */}
                    <div
                      onClick={() => !displayImg && ref.current?.click()}
                      className={`aspect-[2.5/3.5] border-2 border-dashed rounded-xl flex items-center justify-center overflow-hidden relative ${
                        displayImg
                          ? "border-white/20 cursor-default"
                          : "border-white/20 cursor-pointer hover:border-orange-400/50"
                      }`}
                    >
                      {displayImg ? (
                        <Image src={displayImg} alt={side} fill className="object-cover" />
                      ) : (
                        <div className="text-center text-white/30">
                          <div className="text-3xl mb-2">+</div>
                          <div className="text-sm">คลิกเพื่ออัพโหลด</div>
                        </div>
                      )}
                    </div>

                    {/* Action buttons below image */}
                    {displayImg ? (
                      <div className="flex gap-2 mt-2">
                        {originalImg && (
                          <button
                            type="button"
                            onClick={() => setCropping(side)}
                            className="flex-1 py-2 text-xs font-bold rounded-lg bg-yellow-400/10 text-yellow-400 hover:bg-yellow-400/20 transition-colors"
                          >
                            ✦ ปรับมุมการ์ด
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => {
                            if (side === "front") {
                              setFrontPreview(null);
                              setCroppedFront(null);
                              if (frontRef.current) frontRef.current.value = "";
                            } else {
                              setBackPreview(null);
                              setCroppedBack(null);
                              if (backRef.current) backRef.current.value = "";
                            }
                          }}
                          className="px-3 py-2 text-xs font-bold rounded-lg bg-white/5 text-white/40 hover:bg-white/10 transition-colors"
                        >
                          เปลี่ยน
                        </button>
                      </div>
                    ) : null}

                    <input
                      ref={ref}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => handleFileChange(side, e.target.files?.[0] ?? null)}
                    />
                  </div>
                );
              })}
            </div>
          </div>

          {/* Inline error display */}
          {submitError && (
            submitError.notACard ? (
              <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4 space-y-2">
                <div className="flex items-center gap-2">
                  <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-amber-400 shrink-0"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg>
                  <span className="text-amber-400 font-bold text-sm">ไม่พบการ์ดในรูปภาพ</span>
                </div>
                <p className="text-amber-200/70 text-xs leading-relaxed">
                  AI ตรวจพบว่ารูปภาพที่อัพโหลดไม่ใช่การ์ดสะสม —{" "}
                  <span className="font-semibold text-amber-300">พบ: {submitError.detected}</span>
                </p>
                <p className="text-white/40 text-xs">
                  กรุณาอัพโหลดรูปการ์ดจริง (Pokemon TCG, One Piece, MTG ฯลฯ) แล้วลองใหม่อีกครั้ง
                </p>
              </div>
            ) : (
              <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3 text-red-400 text-sm">
                {submitError.message}
              </div>
            )
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-4 bg-gradient-to-r from-yellow-400 to-orange-500 text-black font-bold text-lg rounded-xl hover:opacity-90 disabled:opacity-50 transition-opacity"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="animate-spin" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
                กำลังตรวจสอบและส่ง...
              </span>
            ) : "ส่งเพื่อเกรด"}
          </button>
        </form>
      </div>
    </>
  );
}
