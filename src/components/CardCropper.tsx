"use client";
import { useRef, useState, useEffect, useCallback } from "react";

// ---- Perspective math ----

function gaussianElimination(A: number[][], b: number[]): number[] {
  const n = b.length;
  const M = A.map((row, i) => [...row, b[i]]);
  for (let p = 0; p < n; p++) {
    let maxR = p;
    for (let r = p + 1; r < n; r++)
      if (Math.abs(M[r][p]) > Math.abs(M[maxR][p])) maxR = r;
    [M[p], M[maxR]] = [M[maxR], M[p]];
    for (let r = p + 1; r < n; r++) {
      const f = M[r][p] / M[p][p];
      for (let c = p; c <= n; c++) M[r][c] -= f * M[p][c];
    }
  }
  const x = new Array(n).fill(0);
  for (let i = n - 1; i >= 0; i--) {
    x[i] = M[i][n];
    for (let j = i + 1; j < n; j++) x[i] -= M[i][j] * x[j];
    x[i] /= M[i][i];
  }
  return x;
}

function computeH(src: [number, number][], dst: [number, number][]): number[] {
  const A: number[][] = [];
  const b: number[] = [];
  for (let i = 0; i < 4; i++) {
    const [x, y] = src[i];
    const [u, v] = dst[i];
    A.push([x, y, 1, 0, 0, 0, -u * x, -u * y]);
    b.push(u);
    A.push([0, 0, 0, x, y, 1, -v * x, -v * y]);
    b.push(v);
  }
  return [...gaussianElimination(A, b), 1];
}

function warpPerspective(
  img: HTMLImageElement,
  corners: [number, number][],
  outW: number,
  outH: number
): string {
  const tmp = document.createElement("canvas");
  tmp.width = img.naturalWidth;
  tmp.height = img.naturalHeight;
  const tCtx = tmp.getContext("2d")!;
  tCtx.drawImage(img, 0, 0);
  const src = tCtx.getImageData(0, 0, tmp.width, tmp.height);
  const srcW = tmp.width, srcH = tmp.height;

  const dstPts: [number, number][] = [[0,0],[outW-1,0],[outW-1,outH-1],[0,outH-1]];
  const H = computeH(dstPts, corners);
  const [h0,h1,h2,h3,h4,h5,h6,h7] = H;

  const out = document.createElement("canvas");
  out.width = outW; out.height = outH;
  const oCtx = out.getContext("2d")!;
  const outImg = oCtx.createImageData(outW, outH);

  for (let ov = 0; ov < outH; ov++) {
    for (let ou = 0; ou < outW; ou++) {
      const w = h6*ou + h7*ov + 1;
      const sx = (h0*ou + h1*ov + h2) / w;
      const sy = (h3*ou + h4*ov + h5) / w;
      const x0 = Math.floor(sx), y0 = Math.floor(sy);
      const x1 = x0+1, y1 = y0+1;
      if (x0<0||y0<0||x1>=srcW||y1>=srcH) continue;
      const fx = sx-x0, fy = sy-y0;
      const i00=(y0*srcW+x0)*4, i10=(y0*srcW+x1)*4;
      const i01=(y1*srcW+x0)*4, i11=(y1*srcW+x1)*4;
      const oi=(ov*outW+ou)*4;
      for (let c=0;c<4;c++) {
        outImg.data[oi+c] = Math.round(
          (1-fx)*(1-fy)*src.data[i00+c] + fx*(1-fy)*src.data[i10+c] +
          (1-fx)*fy*src.data[i01+c]     + fx*fy    *src.data[i11+c]
        );
      }
    }
  }
  oCtx.putImageData(outImg, 0, 0);
  return out.toDataURL("image/jpeg", 0.93);
}

// ---- Auto card detection (Sobel edge projection) ----

function autoDetectCardCorners(
  img: HTMLImageElement,
  canvasW: number,
  canvasH: number
): [number, number][] | null {
  const maxDim = 600;
  const scale = Math.min(1, maxDim / Math.max(img.naturalWidth, img.naturalHeight));
  const w = Math.round(img.naturalWidth * scale);
  const h = Math.round(img.naturalHeight * scale);

  const tmp = document.createElement("canvas");
  tmp.width = w; tmp.height = h;
  const ctx = tmp.getContext("2d")!;
  ctx.drawImage(img, 0, 0, w, h);
  const data = ctx.getImageData(0, 0, w, h).data;

  const gray = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++)
    gray[i] = (data[i*4]*77 + data[i*4+1]*150 + data[i*4+2]*29) >> 8;

  const rowProf = new Float32Array(h);
  const colProf = new Float32Array(w);
  for (let y = 1; y < h-1; y++) {
    for (let x = 1; x < w-1; x++) {
      rowProf[y] += Math.abs(
        -gray[(y-1)*w+(x-1)] - 2*gray[(y-1)*w+x] - gray[(y-1)*w+(x+1)] +
         gray[(y+1)*w+(x-1)] + 2*gray[(y+1)*w+x] + gray[(y+1)*w+(x+1)]
      );
      colProf[x] += Math.abs(
        -gray[(y-1)*w+(x-1)] - 2*gray[y*w+(x-1)] - gray[(y+1)*w+(x-1)] +
         gray[(y-1)*w+(x+1)] + 2*gray[y*w+(x+1)] + gray[(y+1)*w+(x+1)]
      );
    }
  }
  for (let y = 0; y < h; y++) rowProf[y] /= w;
  for (let x = 0; x < w; x++) colProf[x] /= h;

  const smooth = (arr: Float32Array, r = 5): Float32Array => {
    const out = new Float32Array(arr.length);
    for (let i = 0; i < arr.length; i++) {
      let s = 0, c = 0;
      for (let j = Math.max(0,i-r); j <= Math.min(arr.length-1,i+r); j++) { s+=arr[j]; c++; }
      out[i] = s/c;
    }
    return out;
  };

  const rp = smooth(rowProf);
  const cp = smooth(colProf);

  const peakIn = (arr: Float32Array, from: number, to: number): number => {
    let maxVal = -1, maxIdx = Math.round((from+to)/2);
    for (let i = from; i < to; i++) if (arr[i] > maxVal) { maxVal=arr[i]; maxIdx=i; }
    return maxIdx;
  };

  const mh = Math.max(2, Math.round(h*0.03));
  const mw = Math.max(2, Math.round(w*0.03));
  const top    = peakIn(rp, mh,               Math.round(h*0.48));
  const bottom = peakIn(rp, Math.round(h*0.52), h-mh);
  const left   = peakIn(cp, mw,               Math.round(w*0.48));
  const right  = peakIn(cp, Math.round(w*0.52), w-mw);

  if (right-left < w*0.2 || bottom-top < h*0.2) return null;

  const tc = (ix: number, iy: number): [number, number] => [
    (ix/w)*canvasW, (iy/h)*canvasH,
  ];
  return [tc(left,top), tc(right,top), tc(right,bottom), tc(left,bottom)];
}

// ---- Types & helpers ----

type DragKind =
  | { kind: "corner"; idx: number }
  | { kind: "edge";   idx: number }   // 0=top 1=right 2=bottom 3=left
  | { kind: "center" }
  | { kind: "pan" };

const CORNER_R  = 14;
const EDGE_R    = 11;
const CENTER_R  = 19;
const MAX_ZOOM  = 5;
const OUT_W = 500;
const OUT_H = 700;

const CORNER_COLORS = ["#F59E0B", "#34D399", "#60A5FA", "#F472B6"];
const CORNER_LABELS = ["บนซ้าย", "บนขวา", "ล่างขวา", "ล่างซ้าย"];

function defaultCorners(w: number, h: number): [number, number][] {
  const px = w*0.06, py = h*0.06;
  return [[px,py],[w-px,py],[w-px,h-py],[px,h-py]];
}

function edgeMids(corners: [number,number][]): [number,number][] {
  return corners.map((c,i) => {
    const n = corners[(i+1)%4];
    return [(c[0]+n[0])/2, (c[1]+n[1])/2] as [number,number];
  });
}

function quadCenter(corners: [number,number][]): [number,number] {
  return [corners.reduce((s,c)=>s+c[0],0)/4, corners.reduce((s,c)=>s+c[1],0)/4];
}

// ---- Component ----

export interface CardCropperProps {
  imageSrc: string;
  onComplete: (dataUrl: string) => void;
  onCancel: () => void;
}

export default function CardCropper({ imageSrc, onComplete, onCancel }: CardCropperProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imgRef    = useRef<HTMLImageElement | null>(null);
  const dragRef   = useRef<{ raw: [number,number]; corners: [number,number][]; pan: [number,number] } | null>(null);

  const [corners,      setCorners]      = useState<[number,number][]>([]);
  const [dragging,     setDragging]     = useState<DragKind | null>(null);
  const [applying,     setApplying]     = useState(false);
  const [canvasSize,   setCanvasSize]   = useState({ w: 600, h: 400 });
  const [autoDetecting,setAutoDetecting]= useState(false);
  const [autoFailed,   setAutoFailed]   = useState(false);
  const [zoom,         setZoom]         = useState(1);
  // pan = virtual offset of viewport center from canvas center (in canvas pixels)
  const [pan,          setPan]          = useState<[number,number]>([0, 0]);

  useEffect(() => {
    const img = new Image();
    img.onload = () => {
      imgRef.current = img;
      const maxW = Math.min(560, (typeof window !== "undefined" ? window.innerWidth : 700) - 32);
      const scale = maxW / img.naturalWidth;
      const w = maxW, h = Math.round(img.naturalHeight * scale);
      setCanvasSize({ w, h });
      setCorners(defaultCorners(w, h));
    };
    img.src = imageSrc;
  }, [imageSrc]);

  // virtual → display canvas coords
  // viewCenter = (canvasW/2 + pan[0], canvasH/2 + pan[1])
  // display(v) = (v - viewCenter) * zoom + canvasCenter
  const toDisp = useCallback((vx: number, vy: number): [number,number] => {
    const cx = canvasSize.w/2, cy = canvasSize.h/2;
    return [(vx - cx - pan[0]) * zoom + cx, (vy - cy - pan[1]) * zoom + cy];
  }, [canvasSize, zoom, pan]);

  const toVirt = useCallback((dx: number, dy: number): [number,number] => {
    const cx = canvasSize.w/2, cy = canvasSize.h/2;
    return [(dx - cx)/zoom + cx + pan[0], (dy - cy)/zoom + cy + pan[1]];
  }, [canvasSize, zoom, pan]);

  // Canvas draw
  useEffect(() => {
    const canvas = canvasRef.current;
    const img    = imgRef.current;
    if (!canvas || !img || corners.length !== 4) return;
    const ctx = canvas.getContext("2d")!;
    canvas.width  = canvasSize.w;
    canvas.height = canvasSize.h;
    ctx.clearRect(0, 0, canvasSize.w, canvasSize.h);

    // === Zoomed layer: image + selection overlay ===
    const cx = canvasSize.w/2, cy = canvasSize.h/2;
    ctx.save();
    ctx.setTransform(zoom, 0, 0, zoom, cx-(cx+pan[0])*zoom, cy-(cy+pan[1])*zoom);

    ctx.drawImage(img, 0, 0, canvasSize.w, canvasSize.h);
    ctx.fillStyle = "rgba(0,0,0,0.62)";
    ctx.fillRect(0, 0, canvasSize.w, canvasSize.h);

    ctx.save();
    ctx.beginPath();
    ctx.moveTo(corners[0][0], corners[0][1]);
    corners.slice(1).forEach(([x,y]) => ctx.lineTo(x,y));
    ctx.closePath();
    ctx.clip();
    ctx.drawImage(img, 0, 0, canvasSize.w, canvasSize.h);
    ctx.restore();

    ctx.beginPath();
    ctx.moveTo(corners[0][0], corners[0][1]);
    corners.forEach(([x,y]) => ctx.lineTo(x,y));
    ctx.closePath();
    ctx.strokeStyle = "rgba(255,255,255,0.9)";
    ctx.lineWidth = 2 / zoom;
    ctx.stroke();

    ctx.restore(); // end zoom

    // === Handle layer: drawn in display (screen) coords ===
    const mids = edgeMids(corners);
    const [qcx, qcy] = quadCenter(corners);
    const [dcx, dcy] = toDisp(qcx, qcy);

    // — Edge midpoint handles —
    // edge 0 = top (connects corner 0→1), 1 = right (1→2), 2 = bottom (2→3), 3 = left (3→0)
    const edgeDirs: [number,number][] = [[0,-1],[1,0],[0,1],[-1,0]];
    mids.forEach(([vx,vy], i) => {
      const [dx,dy] = toDisp(vx,vy);
      const active = dragging?.kind === "edge" && (dragging as {idx:number}).idx === i;
      const r = active ? EDGE_R + 3 : EDGE_R;

      ctx.beginPath();
      ctx.arc(dx, dy, r, 0, Math.PI*2);
      ctx.fillStyle = active ? "rgba(255,255,255,0.95)" : "rgba(255,255,255,0.42)";
      ctx.fill();
      ctx.strokeStyle = "rgba(255,255,255,0.7)";
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // directional arrow in the perpendicular direction of the edge
      const [nx,ny] = edgeDirs[i];
      const aLen = 4;
      ctx.strokeStyle = active ? "rgba(0,0,0,0.8)" : "rgba(0,0,0,0.55)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(dx - nx*aLen, dy - ny*aLen);
      ctx.lineTo(dx + nx*aLen, dy + ny*aLen);
      ctx.stroke();
    });

    // — Corner handles —
    corners.forEach(([vx,vy], i) => {
      const [dx,dy] = toDisp(vx,vy);
      const color  = CORNER_COLORS[i];
      const active = dragging?.kind === "corner" && (dragging as {idx:number}).idx === i;

      ctx.beginPath();
      ctx.arc(dx, dy, CORNER_R + (active ? 8 : 4), 0, Math.PI*2);
      ctx.fillStyle = color + (active ? "40" : "20");
      ctx.fill();

      ctx.beginPath();
      ctx.arc(dx, dy, CORNER_R, 0, Math.PI*2);
      ctx.fillStyle = active ? color : color + "dd";
      ctx.fill();

      ctx.strokeStyle = "#fff";
      ctx.lineWidth = active ? 2.5 : 1.5;
      ctx.stroke();

      ctx.fillStyle = "#000";
      ctx.font = `bold ${CORNER_R - 1}px sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(String(i+1), dx, dy);
    });

    // — Center handle (move all) —
    const centerActive = dragging?.kind === "center";
    ctx.beginPath();
    ctx.arc(dcx, dcy, CENTER_R + (centerActive ? 5 : 2), 0, Math.PI*2);
    ctx.fillStyle = "rgba(255,255,255,0.06)";
    ctx.fill();
    ctx.beginPath();
    ctx.arc(dcx, dcy, CENTER_R, 0, Math.PI*2);
    ctx.fillStyle = centerActive ? "rgba(255,255,255,0.38)" : "rgba(255,255,255,0.13)";
    ctx.fill();
    ctx.strokeStyle = centerActive ? "rgba(255,255,255,0.85)" : "rgba(255,255,255,0.45)";
    ctx.lineWidth = 1.5;
    ctx.stroke();
    // 4-way arrow icon
    const ar = CENTER_R - 5;
    ctx.strokeStyle = centerActive ? "rgba(255,255,255,0.95)" : "rgba(255,255,255,0.65)";
    ctx.lineWidth = 2;
    ([[0,-ar],[0,ar],[-ar,0],[ar,0]] as [number,number][]).forEach(([ox,oy]) => {
      ctx.beginPath();
      ctx.moveTo(dcx + ox*0.25, dcy + oy*0.25);
      ctx.lineTo(dcx + ox*0.85, dcy + oy*0.85);
      ctx.stroke();
    });

  }, [corners, canvasSize, dragging, zoom, pan, toDisp]);

  // Raw canvas pixel coords from mouse/touch event
  const getRaw = useCallback((e: React.MouseEvent | React.TouchEvent): [number,number] => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    const sx = canvas.width / rect.width, sy = canvas.height / rect.height;
    let ex: number, ey: number;
    if ("touches" in e) {
      const t = e.touches[0] ?? e.changedTouches[0];
      ex = t.clientX; ey = t.clientY;
    } else { ex = e.clientX; ey = e.clientY; }
    return [(ex - rect.left)*sx, (ey - rect.top)*sy];
  }, []);

  // Hit test in display coords
  const hitTest = useCallback((dx: number, dy: number): DragKind | null => {
    // Center handle
    const [cdx, cdy] = toDisp(...quadCenter(corners));
    if (Math.hypot(dx-cdx, dy-cdy) < CENTER_R * 1.8) return { kind: "center" };

    // Corner handles
    for (let i = 0; i < 4; i++) {
      const [hx,hy] = toDisp(corners[i][0], corners[i][1]);
      if (Math.hypot(dx-hx, dy-hy) < CORNER_R * 2.5) return { kind: "corner", idx: i };
    }

    // Edge handles
    const mids = edgeMids(corners);
    for (let i = 0; i < 4; i++) {
      const [hx,hy] = toDisp(mids[i][0], mids[i][1]);
      if (Math.hypot(dx-hx, dy-hy) < EDGE_R * 2.5) return { kind: "edge", idx: i };
    }

    return zoom > 1 ? { kind: "pan" } : null;
  }, [corners, toDisp, zoom]);

  const onDown = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    const raw = getRaw(e);
    const hit = hitTest(raw[0], raw[1]);
    if (!hit) return;
    setDragging(hit);
    dragRef.current = {
      raw,
      corners: corners.map(c => [c[0], c[1]]) as [number,number][],
      pan: [pan[0], pan[1]],
    };
  }, [getRaw, hitTest, corners, pan]);

  const onMove = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    if (!dragging || !dragRef.current) return;
    e.preventDefault();
    const raw = getRaw(e);
    // delta in virtual space = raw delta / zoom
    const dvx = (raw[0] - dragRef.current.raw[0]) / zoom;
    const dvy = (raw[1] - dragRef.current.raw[1]) / zoom;
    const sc  = dragRef.current.corners;
    const clx = (v: number) => Math.max(0, Math.min(canvasSize.w, v));
    const cly = (v: number) => Math.max(0, Math.min(canvasSize.h, v));

    if (dragging.kind === "corner") {
      const i = (dragging as {idx:number}).idx;
      setCorners(prev => prev.map((c,j) =>
        j === i ? [clx(sc[i][0]+dvx), cly(sc[i][1]+dvy)] : c
      ) as [number,number][]);

    } else if (dragging.kind === "edge") {
      const i = (dragging as {idx:number}).idx;
      const j = (i+1)%4;
      setCorners(prev => {
        const n = [...prev] as [number,number][];
        n[i] = [clx(sc[i][0]+dvx), cly(sc[i][1]+dvy)];
        n[j] = [clx(sc[j][0]+dvx), cly(sc[j][1]+dvy)];
        return n;
      });

    } else if (dragging.kind === "center") {
      setCorners(sc.map(([x,y]) => [clx(x+dvx), cly(y+dvy)]) as [number,number][]);

    } else if (dragging.kind === "pan") {
      // Pan: viewport moves opposite to drag
      const sp = dragRef.current.pan;
      setPan([sp[0] - dvx, sp[1] - dvy]);
    }
  }, [dragging, getRaw, zoom, canvasSize]);

  const onUp = useCallback(() => {
    setDragging(null);
    dragRef.current = null;
  }, []);

  // Wheel zoom
  const onWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const factor = e.deltaY < 0 ? 1.15 : 1/1.15;
    setZoom(z => Math.min(MAX_ZOOM, Math.max(1, z * factor)));
  }, []);

  function handleReset() {
    setAutoFailed(false);
    setZoom(1);
    setPan([0, 0]);
    setCorners(defaultCorners(canvasSize.w, canvasSize.h));
  }

  function handleAutoDetect() {
    const img = imgRef.current;
    if (!img || autoDetecting) return;
    setAutoDetecting(true);
    setAutoFailed(false);
    setTimeout(() => {
      const detected = autoDetectCardCorners(img, canvasSize.w, canvasSize.h);
      if (detected) { setCorners(detected); setZoom(1); setPan([0,0]); }
      else setAutoFailed(true);
      setAutoDetecting(false);
    }, 30);
  }

  function handleZoomIn() {
    const newZoom = Math.min(MAX_ZOOM, zoom * 1.6);
    setZoom(newZoom);
    if (corners.length === 4) {
      const [qcx,qcy] = quadCenter(corners);
      setPan([qcx - canvasSize.w/2, qcy - canvasSize.h/2]);
    }
  }

  function handleZoomOut() {
    const newZoom = Math.max(1, zoom / 1.6);
    setZoom(newZoom);
    if (newZoom <= 1) setPan([0, 0]);
  }

  function handleApply() {
    const img = imgRef.current;
    if (!img || applying) return;
    setApplying(true);
    setTimeout(() => {
      const sx = img.naturalWidth / canvasSize.w;
      const sy = img.naturalHeight / canvasSize.h;
      const imgCorners = corners.map(([x,y]) => [x*sx, y*sy]) as [number,number][];
      onComplete(warpPerspective(img, imgCorners, OUT_W, OUT_H));
    }, 60);
  }

  const zoomPct = Math.round(zoom * 100);

  return (
    <div className="fixed inset-0 z-50 bg-black/95 flex flex-col overflow-y-auto">
      {/* Header */}
      <div className="flex items-center justify-between px-4 pt-4 pb-3 border-b border-white/10 shrink-0">
        <div>
          <h2 className="text-white font-bold text-lg">ปรับกรอบการ์ด</h2>
          <p className="text-white/40 text-xs mt-0.5">ลากจุดสีให้ตรงกับมุมทั้ง 4 ของการ์ด</p>
        </div>
        <button onClick={onCancel}
          className="w-9 h-9 flex items-center justify-center rounded-full bg-white/10 text-white/60 hover:bg-white/20 hover:text-white transition-colors">
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18M6 6l12 12"/></svg>
        </button>
      </div>

      {/* Legend */}
      <div className="flex gap-1.5 px-4 py-2.5 flex-wrap shrink-0 items-center">
        {CORNER_LABELS.map((label, i) => (
          <span key={i} className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-semibold"
            style={{ backgroundColor: CORNER_COLORS[i]+"20", color: CORNER_COLORS[i] }}>
            <span className="font-black">{i+1}</span> {label}
          </span>
        ))}
        <span className="text-xs px-2 py-0.5 rounded-full bg-white/10 text-white/40">○ ขอบ = เลื่อน 2 มุม</span>
        <span className="text-xs px-2 py-0.5 rounded-full bg-white/10 text-white/40">⊕ กลาง = ย้ายทั้งหมด</span>
      </div>

      {/* Canvas */}
      <div className="flex-1 flex items-center justify-center px-4 pb-4">
        <div className="w-full max-w-[560px]">
          <canvas
            ref={canvasRef}
            className="w-full rounded-2xl touch-none select-none border border-white/10 shadow-2xl"
            style={{ cursor: dragging ? "grabbing" : zoom > 1 ? "grab" : "crosshair" }}
            onMouseDown={onDown}
            onMouseMove={onMove}
            onMouseUp={onUp}
            onMouseLeave={onUp}
            onTouchStart={onDown}
            onTouchMove={onMove}
            onTouchEnd={onUp}
            onWheel={onWheel}
          />

          {/* Hint */}
          {autoFailed ? (
            <p className="text-amber-400/80 text-xs text-center mt-2 px-2">
              ตรวจจับขอบการ์ดไม่ได้อัตโนมัติ — ลองถ่ายบนพื้นหลังสีเรียบ หรือลากจุดด้วยตนเอง
            </p>
          ) : zoom > 1 ? (
            <p className="text-blue-400/60 text-xs text-center mt-2">
              {zoomPct}% — ลากพื้นที่ว่างเพื่อเลื่อนวิว · Scroll เพื่อซูม
            </p>
          ) : (
            <p className="text-white/30 text-xs text-center mt-2 px-2">
              จุดสี = มุม · ขอบขาว = 2 มุม · ⊕ = ย้ายทั้งหมด · Scroll = ซูม
            </p>
          )}

          {/* Buttons */}
          <div className="flex gap-2 mt-3">
            {/* Reset */}
            <button onClick={handleReset} title="รีเซ็ต"
              className="w-11 h-11 flex items-center justify-center rounded-xl bg-white/8 border border-white/10 text-white/50 hover:bg-white/15 hover:text-white transition-all shrink-0">
              <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>
            </button>

            {/* Zoom out */}
            <button onClick={handleZoomOut} disabled={zoom <= 1} title="ซูมออก"
              className="w-11 h-11 flex items-center justify-center rounded-xl bg-white/8 border border-white/10 text-white/50 hover:bg-white/15 hover:text-white disabled:opacity-25 transition-all shrink-0 text-xl font-light leading-none">
              −
            </button>

            {/* Zoom in */}
            <button onClick={handleZoomIn} disabled={zoom >= MAX_ZOOM} title="ซูมเข้า"
              className="w-11 h-11 flex items-center justify-center rounded-xl bg-white/8 border border-white/10 text-white/50 hover:bg-white/15 hover:text-white disabled:opacity-25 transition-all shrink-0 text-xl font-light leading-none">
              +
            </button>

            {/* Auto */}
            <button onClick={handleAutoDetect} disabled={autoDetecting || applying}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl border font-semibold text-sm transition-all disabled:opacity-50 shrink-0 bg-purple-500/10 border-purple-500/30 text-purple-300 hover:bg-purple-500/20 hover:border-purple-400/50">
              {autoDetecting ? (
                <svg className="animate-spin" xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
              ) : (
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/><path d="M5 3v4M19 17v4M3 5h4M17 19h4"/></svg>
              )}
              Auto
            </button>

            {/* Confirm */}
            <button onClick={handleApply} disabled={applying || corners.length !== 4}
              className="flex-1 py-2.5 bg-gradient-to-r from-yellow-400 to-orange-500 text-black font-bold rounded-xl hover:opacity-90 disabled:opacity-50 transition-opacity flex items-center justify-center gap-2 text-sm">
              {applying ? (
                <><svg className="animate-spin" xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>กำลังประมวลผล...</>
              ) : (
                <><svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>ยืนยัน</>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
