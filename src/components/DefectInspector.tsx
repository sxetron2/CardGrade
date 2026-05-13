"use client";
import { useRef, useState, useEffect, useCallback } from "react";
import { GRADE_SCALE } from "@/types";

// ─── Types ────────────────────────────────────────────────────────────────────

type Side = "front" | "back";
type DefectType = "surface" | "corner" | "edge" | "print" | "other";

interface Scores { centering: number; corners: number; edges: number; surface: number; }
type PresetKey = "normal" | "scratch" | "surface" | "edges" | "uv";

interface FilterState {
  brightness: number;   // multiplier 0.3–2.0
  contrast: number;     // multiplier 0.5–3.5
  saturation: number;   // multiplier 0–3.5
  sharpen: number;      // 0–4
  invert: boolean;
  channel: "rgb" | "r" | "g" | "b";
}

interface DefectMark {
  id: string;
  x: number;  // 0-100 %
  y: number;  // 0-100 %
  side: Side;
  type: DefectType;
}

// ─── Config ───────────────────────────────────────────────────────────────────

const PRESETS: Record<PresetKey, { label: string; desc: string; filters: FilterState }> = {
  normal:  { label: "ปกติ",      desc: "สีจริง",
    filters: { brightness: 1,    contrast: 1,   saturation: 1,   sharpen: 0,   invert: false, channel: "rgb" } },
  scratch: { label: "รอยขีด",   desc: "เพิ่ม contrast + sharpen หา scratch",
    filters: { brightness: 1.1,  contrast: 2.8, saturation: 0.2, sharpen: 3,   invert: false, channel: "rgb" } },
  surface: { label: "ผิวหน้า",  desc: "เพิ่ม saturation หา print defect",
    filters: { brightness: 1.05, contrast: 1.4, saturation: 2.8, sharpen: 1,   invert: false, channel: "rgb" } },
  edges:   { label: "ขอบ/มุม",  desc: "Sobel edge detect หามุมและขอบ",
    filters: { brightness: 1,    contrast: 1,   saturation: 1,   sharpen: 0,   invert: false, channel: "rgb" } },
  uv:      { label: "UV Sim",    desc: "จำลอง UV light — blue channel inverted",
    filters: { brightness: 1.3,  contrast: 1.8, saturation: 0,   sharpen: 0,   invert: true,  channel: "b"   } },
};

const DEFECT_INFO: Record<DefectType, { label: string; color: string }> = {
  surface: { label: "ผิวหน้า",  color: "#F87171" },
  corner:  { label: "มุม",      color: "#FBBF24" },
  edge:    { label: "ขอบ",      color: "#60A5FA" },
  print:   { label: "Print",    color: "#C084FC" },
  other:   { label: "อื่นๆ",   color: "#94A3B8" },
};

const CHANNEL_LABELS: Record<FilterState["channel"], string> = {
  rgb: "RGB", r: "R เท่านั้น", g: "G เท่านั้น", b: "B เท่านั้น",
};

// ─── Score suggestion ─────────────────────────────────────────────────────────

// Deduction per defect type per category (capped per-category at −3)
const DEDUCTIONS: Record<DefectType, Partial<Record<keyof Scores, number>>> = {
  surface: { surface: 0.5 },
  corner:  { corners: 0.5 },
  edge:    { edges:   0.5 },
  print:   { surface: 0.5 },
  other:   { surface: 0.25, corners: 0.25, edges: 0.25 },
};

const MAX_DEDUCT = 3;

function snapToScale(v: number): number {
  return GRADE_SCALE.reduce((p, c) => Math.abs(c - v) < Math.abs(p - v) ? c : p);
}

function suggestScores(marks: DefectMark[], current: Scores): Scores {
  const delta: Record<keyof Scores, number> = { centering: 0, corners: 0, edges: 0, surface: 0 };
  for (const m of marks) {
    const d = DEDUCTIONS[m.type];
    for (const [k, v] of Object.entries(d) as [keyof Scores, number][]) {
      delta[k] = Math.max(-MAX_DEDUCT, delta[k] - v);
    }
  }
  return {
    centering: current.centering,
    corners:   snapToScale(Math.min(10, Math.max(1, current.corners + delta.corners))),
    edges:     snapToScale(Math.min(10, Math.max(1, current.edges   + delta.edges))),
    surface:   snapToScale(Math.min(10, Math.max(1, current.surface + delta.surface))),
  };
}

// ─── RAW pixel processing ─────────────────────────────────────────────────────

function processRaw(src: ImageData, f: FilterState, edgeMode: boolean): ImageData {
  const { width: w, height: h, data: inp } = src;

  // Pass 1: brightness / contrast / saturation / channel / invert
  const buf = new Uint8ClampedArray(inp.length);
  for (let i = 0; i < inp.length; i += 4) {
    let r = inp[i], g = inp[i + 1], b = inp[i + 2];

    if (f.channel === "r")      { g = r; b = r; }
    else if (f.channel === "g") { r = g; b = g; }
    else if (f.channel === "b") { r = b; g = b; }

    const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    r = lum + (r - lum) * f.saturation;
    g = lum + (g - lum) * f.saturation;
    b = lum + (b - lum) * f.saturation;

    r *= f.brightness; g *= f.brightness; b *= f.brightness;
    r = (r - 128) * f.contrast + 128;
    g = (g - 128) * f.contrast + 128;
    b = (b - 128) * f.contrast + 128;

    if (f.invert) { r = 255 - r; g = 255 - g; b = 255 - b; }

    buf[i]     = Math.min(255, Math.max(0, r));
    buf[i + 1] = Math.min(255, Math.max(0, g));
    buf[i + 2] = Math.min(255, Math.max(0, b));
    buf[i + 3] = 255;
  }

  // Sobel edge detection (replaces buf output)
  if (edgeMode) {
    const out = new Uint8ClampedArray(inp.length);
    const gray = (row: number, col: number) => {
      const i = (row * w + col) * 4;
      return (buf[i] * 77 + buf[i + 1] * 150 + buf[i + 2] * 29) >> 8;
    };
    for (let y = 1; y < h - 1; y++) {
      for (let x = 1; x < w - 1; x++) {
        const tl = gray(y-1,x-1), tc = gray(y-1,x), tr = gray(y-1,x+1);
        const ml = gray(y,  x-1),                    mr = gray(y,  x+1);
        const bl = gray(y+1,x-1), bc = gray(y+1,x), br = gray(y+1,x+1);
        const gx = -tl + tr - 2*ml + 2*mr - bl + br;
        const gy = -tl - 2*tc - tr + bl + 2*bc + br;
        const mag = Math.min(255, Math.hypot(gx, gy) * 1.4);
        const oi = (y * w + x) * 4;
        out[oi] = out[oi+1] = out[oi+2] = mag;
        out[oi + 3] = 255;
      }
    }
    return new ImageData(out, w, h);
  }

  // Unsharp mask (Laplacian sharpen)
  if (f.sharpen > 0) {
    const out = new Uint8ClampedArray(buf);
    const k = f.sharpen * 0.22;
    for (let y = 1; y < h - 1; y++) {
      for (let x = 1; x < w - 1; x++) {
        const ci = (y * w + x) * 4;
        for (let c = 0; c < 3; c++) {
          const ctr = buf[ci + c];
          const t = buf[((y-1)*w + x) * 4 + c];
          const btm = buf[((y+1)*w + x) * 4 + c];
          const l = buf[(y*w + x-1) * 4 + c];
          const rt = buf[(y*w + x+1) * 4 + c];
          out[ci + c] = Math.min(255, Math.max(0, ctr*(1+4*k) - (t+btm+l+rt)*k));
        }
      }
    }
    return new ImageData(out, w, h);
  }

  return new ImageData(buf, w, h);
}

// ─── Component ────────────────────────────────────────────────────────────────

interface Props {
  frontSrc?: string | null;
  backSrc?: string | null;
  currentScores: Scores;
  onApplyScores: (scores: Scores) => void;
}

export default function DefectInspector({ frontSrc, backSrc, currentScores, onApplyScores }: Props) {
  const canvasRef     = useRef<HTMLCanvasElement>(null);
  const rawImgRef     = useRef<HTMLImageElement | null>(null);
  const [side,        setSide]        = useState<Side>("front");
  const [preset,      setPreset]      = useState<PresetKey>("normal");
  const [filters,     setFilters]     = useState<FilterState>(PRESETS.normal.filters);
  const [imgLoaded,   setImgLoaded]   = useState(false);
  const [marks,       setMarks]       = useState<DefectMark[]>([]);
  const [markMode,    setMarkMode]    = useState(false);
  const [activeType,  setActiveType]  = useState<DefectType>("surface");
  const [open,        setOpen]        = useState(false);

  const imageSrc = side === "front" ? frontSrc : backSrc;

  // Load raw image whenever side or src changes
  useEffect(() => {
    if (!imageSrc) { setImgLoaded(false); rawImgRef.current = null; return; }
    setImgLoaded(false);
    const img = new Image();
    img.onload = () => { rawImgRef.current = img; setImgLoaded(true); };
    img.src = imageSrc;
  }, [imageSrc]);

  // Process pixels and draw to canvas whenever filters/preset/image change
  useEffect(() => {
    const canvas = canvasRef.current;
    const img    = rawImgRef.current;
    if (!canvas || !img || !imgLoaded || !open) return;

    const maxW  = 700;
    const scale = Math.min(1, maxW / img.naturalWidth);
    const w     = Math.round(img.naturalWidth  * scale);
    const h     = Math.round(img.naturalHeight * scale);

    canvas.width  = w;
    canvas.height = h;

    const ctx = canvas.getContext("2d")!;
    ctx.drawImage(img, 0, 0, w, h);
    const raw = ctx.getImageData(0, 0, w, h);
    ctx.putImageData(processRaw(raw, filters, preset === "edges"), 0, 0);
  }, [imgLoaded, filters, preset, open]);

  function selectPreset(key: PresetKey) {
    setPreset(key);
    setFilters(PRESETS[key].filters);
  }

  function setFilter<K extends keyof FilterState>(key: K, val: FilterState[K]) {
    setPreset("normal");
    setFilters(f => ({ ...f, [key]: val }));
  }

  const handleCanvasClick = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!markMode) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width)  * 100;
    const y = ((e.clientY - rect.top)  / rect.height) * 100;
    setMarks(prev => [...prev, { id: crypto.randomUUID(), x, y, side, type: activeType }]);
  }, [markMode, side, activeType]);

  const removeMark = useCallback((id: string) => setMarks(prev => prev.filter(m => m.id !== id)), []);

  const sideMarks = marks.filter(m => m.side === side);
  const hasImage  = !!imageSrc;
  const totalDefects = marks.length;

  return (
    <div className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden">
      {/* Header — always visible */}
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center gap-3 px-5 py-4 hover:bg-white/[0.03] transition-colors text-left"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none"
          stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
          className="text-cyan-400 shrink-0">
          <circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>
          <path d="M11 8v6M8 11h6"/>
        </svg>
        <span className="font-bold text-white">Defect Inspector</span>
        <span className="text-xs text-white/30">RAW pixel processing</span>
        {totalDefects > 0 && (
          <span className="text-xs px-2 py-0.5 rounded-full bg-red-500/20 text-red-400 font-bold">
            {totalDefects} จุด
          </span>
        )}
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none"
          stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
          className={`ml-auto text-white/30 transition-transform ${open ? "rotate-180" : ""}`}>
          <path d="m6 9 6 6 6-6"/>
        </svg>
      </button>

      {open && (
        <div className="border-t border-white/10 p-5 space-y-5">
          {/* Side tabs */}
          <div className="flex gap-1.5">
            {(["front", "back"] as Side[]).map(s => {
              const src   = s === "front" ? frontSrc : backSrc;
              const label = s === "front" ? "หน้าการ์ด" : "หลังการ์ด";
              const cnt   = marks.filter(m => m.side === s).length;
              return (
                <button key={s} onClick={() => setSide(s)} disabled={!src}
                  className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-all ${
                    side === s
                      ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/40"
                      : "bg-white/5 text-white/40 hover:bg-white/10"
                  } disabled:opacity-25 disabled:pointer-events-none`}>
                  {label}
                  {cnt > 0 && (
                    <span className="ml-1.5 text-xs bg-red-500/30 text-red-400 px-1.5 py-0.5 rounded-full">{cnt}</span>
                  )}
                </button>
              );
            })}
          </div>

          {!hasImage ? (
            <div className="text-center py-10 text-white/20 text-sm">
              ไม่มีรูปการ์ด{side === "front" ? "หน้า" : "หลัง"}
            </div>
          ) : (
            <>
              {/* Canvas + marks overlay */}
              <div
                className="relative rounded-xl overflow-hidden border border-white/10 bg-black"
                style={{ cursor: markMode ? "crosshair" : "default" }}
              >
                <canvas
                  ref={canvasRef}
                  className="w-full block"
                  onClick={handleCanvasClick}
                />
                {/* Defect mark pins */}
                {sideMarks.map((mark, idx) => {
                  const info = DEFECT_INFO[mark.type];
                  return (
                    <button
                      key={mark.id}
                      className="absolute -translate-x-1/2 -translate-y-1/2 w-6 h-6 rounded-full border-2 flex items-center justify-center text-[10px] font-black hover:scale-125 transition-transform z-10"
                      style={{
                        left: `${mark.x}%`, top: `${mark.y}%`,
                        borderColor: info.color,
                        backgroundColor: info.color + "55",
                        color: "#fff",
                        boxShadow: `0 0 0 2px rgba(0,0,0,0.6)`,
                      }}
                      onClick={(e) => { e.stopPropagation(); removeMark(mark.id); }}
                      title={`${info.label} — คลิกเพื่อลบ`}
                    >
                      {idx + 1}
                    </button>
                  );
                })}
                {markMode && (
                  <div className="absolute bottom-2 right-2 text-[10px] bg-black/70 text-cyan-300 px-2 py-1 rounded-lg pointer-events-none">
                    คลิกบนรูปเพื่อ pin จุดบกพร่อง
                  </div>
                )}
              </div>

              {/* Presets */}
              <div>
                <div className="text-[10px] font-bold text-white/30 uppercase tracking-widest mb-2">Preset</div>
                <div className="flex flex-wrap gap-1.5">
                  {(Object.entries(PRESETS) as [PresetKey, (typeof PRESETS)[PresetKey]][]).map(([key, p]) => (
                    <button key={key} onClick={() => selectPreset(key)}
                      title={p.desc}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all border ${
                        preset === key
                          ? "bg-cyan-500/20 text-cyan-300 border-cyan-500/40"
                          : "bg-white/5 text-white/40 border-white/10 hover:bg-white/10"
                      }`}>
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Filter sliders */}
              <div className="space-y-3">
                <div className="text-[10px] font-bold text-white/30 uppercase tracking-widest">
                  ปรับสี (RAW pixel)
                </div>

                {([
                  { key: "brightness" as const, label: "Brightness", min: 0.3, max: 2.0,  step: 0.05 },
                  { key: "contrast"   as const, label: "Contrast",   min: 0.5, max: 3.5,  step: 0.05 },
                  { key: "saturation" as const, label: "Saturation", min: 0,   max: 3.5,  step: 0.05 },
                  { key: "sharpen"    as const, label: "Sharpen",    min: 0,   max: 4,    step: 0.1  },
                ]).map(({ key, label, min, max, step }) => (
                  <div key={key} className="flex items-center gap-3">
                    <span className="text-white/50 text-xs w-20 shrink-0">{label}</span>
                    <input
                      type="range" min={min} max={max} step={step}
                      value={filters[key] as number}
                      onChange={e => setFilter(key, parseFloat(e.target.value))}
                      className="flex-1 h-1.5 accent-cyan-400"
                    />
                    <span className="text-white/30 text-xs w-8 text-right tabular-nums">
                      {(filters[key] as number).toFixed(1)}
                    </span>
                  </div>
                ))}

                {/* Invert + channel */}
                <div className="flex flex-wrap gap-3 pt-1">
                  <div className="flex items-center gap-2">
                    <span className="text-white/50 text-xs">Invert</span>
                    <button
                      onClick={() => setFilter("invert", !filters.invert)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all border ${
                        filters.invert
                          ? "bg-cyan-500/20 text-cyan-300 border-cyan-500/40"
                          : "bg-white/5 text-white/30 border-white/10 hover:bg-white/10"
                      }`}>
                      {filters.invert ? "เปิด" : "ปิด"}
                    </button>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-white/50 text-xs">Channel</span>
                    <div className="flex gap-1">
                      {(["rgb", "r", "g", "b"] as const).map(ch => (
                        <button key={ch} onClick={() => setFilter("channel", ch)}
                          className={`px-2 py-1 rounded text-xs font-bold transition-all border ${
                            filters.channel === ch
                              ? "bg-cyan-500/20 text-cyan-300 border-cyan-500/40"
                              : "bg-white/5 text-white/30 border-white/10 hover:bg-white/10"
                          }`}>
                          {CHANNEL_LABELS[ch]}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Mark mode */}
              <div className="border-t border-white/10 pt-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="text-[10px] font-bold text-white/30 uppercase tracking-widest">
                    ทำเครื่องหมายจุดบกพร่อง
                  </div>
                  <button
                    onClick={() => setMarkMode(v => !v)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all border ${
                      markMode
                        ? "bg-cyan-500/20 text-cyan-300 border-cyan-500/40"
                        : "bg-white/5 text-white/40 border-white/10 hover:bg-white/10"
                    }`}>
                    {markMode ? "✦ กำลัง pin..." : "เปิดโหมด pin"}
                  </button>
                </div>
                {/* Defect type selector */}
                <div className="flex flex-wrap gap-1.5">
                  {(Object.entries(DEFECT_INFO) as [DefectType, (typeof DEFECT_INFO)[DefectType]][]).map(([type, info]) => (
                    <button key={type} onClick={() => setActiveType(type)}
                      className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all border"
                      style={
                        activeType === type
                          ? { backgroundColor: info.color + "25", borderColor: info.color + "80", color: info.color }
                          : { backgroundColor: "rgba(255,255,255,0.04)", borderColor: "rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.4)" }
                      }>
                      {info.label}
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* Marks list + score preview + apply */}
          {marks.length > 0 && (() => {
            const suggested = suggestScores(marks, currentScores);
            const changed = (["corners", "edges", "surface"] as const).filter(
              k => suggested[k] !== currentScores[k]
            );
            const SCORE_LABEL: Record<string, string> = {
              corners: "Corners", edges: "Edges", surface: "Surface",
            };
            return (
              <div className="border-t border-white/10 pt-4 space-y-3">
                {/* List header */}
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold text-white/30 uppercase tracking-widest">
                    รายการข้อบกพร่อง ({marks.length})
                  </span>
                  <button onClick={() => setMarks([])}
                    className="text-xs text-white/30 hover:text-red-400 transition-colors">
                    ล้างทั้งหมด
                  </button>
                </div>

                {/* Marks */}
                <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                  {marks.map((mark, idx) => {
                    const info = DEFECT_INFO[mark.type];
                    return (
                      <div key={mark.id}
                        className="flex items-center gap-2 text-xs py-1 px-2 rounded-lg bg-white/[0.03] hover:bg-white/[0.06] group">
                        <div className="w-5 h-5 rounded-full flex items-center justify-center font-black shrink-0 text-[10px]"
                          style={{ backgroundColor: info.color + "30", color: info.color, border: `1px solid ${info.color}60` }}>
                          {idx + 1}
                        </div>
                        <span className="font-semibold" style={{ color: info.color }}>{info.label}</span>
                        <span className="text-white/25">{mark.side === "front" ? "หน้า" : "หลัง"}</span>
                        <span className="text-white/20 ml-auto tabular-nums">
                          {mark.x.toFixed(0)}%, {mark.y.toFixed(0)}%
                        </span>
                        <button onClick={() => removeMark(mark.id)}
                          className="text-white/20 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100 ml-1">
                          ×
                        </button>
                      </div>
                    );
                  })}
                </div>

                {/* Score preview */}
                <div className="rounded-xl bg-white/[0.04] border border-white/10 p-3 space-y-2">
                  <div className="text-[10px] font-bold text-white/30 uppercase tracking-widest mb-1">
                    ผลกระทบต่อคะแนน
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    {(["corners", "edges", "surface"] as const).map(k => {
                      const before = currentScores[k];
                      const after  = suggested[k];
                      const diff   = after - before;
                      return (
                        <div key={k} className="text-center">
                          <div className="text-[10px] text-white/30 mb-0.5">{SCORE_LABEL[k]}</div>
                          <div className="flex items-center justify-center gap-1">
                            <span className="text-sm font-bold text-white/50">{before}</span>
                            <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24"
                              fill="none" stroke="currentColor" strokeWidth="3"
                              className={diff < 0 ? "text-red-400" : "text-white/20"}>
                              <path d="M5 12h14M12 5l7 7-7 7"/>
                            </svg>
                            <span className={`text-sm font-black ${diff < 0 ? "text-red-400" : "text-white/50"}`}>
                              {after}
                            </span>
                          </div>
                          {diff < 0 && (
                            <div className="text-[10px] text-red-400/70 tabular-nums">{diff.toFixed(1)}</div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                  {changed.length === 0 && (
                    <p className="text-[10px] text-white/25 text-center">คะแนนไม่เปลี่ยนแปลง (ติดเพดาน max deduct แล้ว)</p>
                  )}
                </div>

                {/* Apply button */}
                <button
                  onClick={() => onApplyScores(suggested)}
                  className="w-full py-3 rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2
                    bg-cyan-500/15 border border-cyan-500/30 text-cyan-300
                    hover:bg-cyan-500/25 hover:border-cyan-400/60 active:scale-[0.98]"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none"
                    stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 20h9"/><path d="M16.376 3.622a1 1 0 0 1 3.002 3.002L7.368 18.635a2 2 0 0 1-.855.506l-2.872.838a.5.5 0 0 1-.62-.62l.838-2.872a2 2 0 0 1 .506-.854z"/>
                  </svg>
                  ปรับคะแนนตาม {marks.length} จุดบกพร่อง
                </button>
              </div>
            );
          })()}
        </div>
      )}
    </div>
  );
}
