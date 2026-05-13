import { NextResponse } from "next/server";
import React from "react";
import {
  Document, Page, Text, View, StyleSheet, renderToBuffer,
} from "@react-pdf/renderer";

// ─── Styles ───────────────────────────────────────────────────────────────────

const S = StyleSheet.create({
  page:      { backgroundColor: "#09090f", fontFamily: "Helvetica", paddingBottom: 0 },
  topBar:    { height: 8, backgroundColor: "#F59E0B" },
  bottomBar: { height: 8, backgroundColor: "#F59E0B" },
  body:      { paddingHorizontal: 36, paddingTop: 28, paddingBottom: 28, flex: 1 },

  // Header
  headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 6 },
  brand:     { fontSize: 22, fontWeight: "bold", color: "#F59E0B", letterSpacing: 3 },
  tagline:   { fontSize: 7,  color: "#6B7280", letterSpacing: 2 },
  docLabel:  { fontSize: 8,  color: "#6B7280", letterSpacing: 1, textAlign: "right" },
  docDate:   { fontSize: 7,  color: "#374151", marginTop: 2, textAlign: "right" },

  divider:   { height: 1, backgroundColor: "#1f2937", marginVertical: 12 },
  dividerAccent: { height: 2, backgroundColor: "#F59E0B", width: 32, marginBottom: 12 },

  // Section
  sectionTitle:   { fontSize: 9,  fontWeight: "bold", color: "#F59E0B", letterSpacing: 2, marginBottom: 8 },
  sectionSubtitle:{ fontSize: 8,  color: "#9CA3AF", marginBottom: 10 },

  // Overview box
  overviewBox: {
    backgroundColor: "#0f1628",
    borderRadius: 8, borderWidth: 1, borderColor: "#1e2d4a",
    padding: 14, marginBottom: 14,
  },
  overviewText: { fontSize: 9, color: "#CBD5E1", lineHeight: 1.7 },

  // Tech stack grid
  stackGrid: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: 14 },
  stackCard: {
    width: "47%", backgroundColor: "#111827",
    borderRadius: 6, borderWidth: 1, borderColor: "#1f2937",
    padding: 10,
  },
  stackName:  { fontSize: 9,  fontWeight: "bold", color: "#e5e7eb", marginBottom: 2 },
  stackRole:  { fontSize: 7,  color: "#6B7280",   marginBottom: 4 },
  stackDetail:{ fontSize: 7.5,color: "#9CA3AF",   lineHeight: 1.5 },

  // Feature list
  featureRow: { flexDirection: "row", gap: 8, marginBottom: 7, alignItems: "flex-start" },
  featureDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: "#F59E0B", marginTop: 2 },
  featureText:{ fontSize: 8, color: "#CBD5E1", flex: 1, lineHeight: 1.5 },
  featureSub: { fontSize: 7, color: "#6B7280", marginTop: 1 },

  // AI section
  aiBox: {
    backgroundColor: "#0a1628",
    borderRadius: 8, borderLeftWidth: 3, borderLeftColor: "#6366F1",
    paddingHorizontal: 12, paddingVertical: 10, marginBottom: 10,
  },
  aiTitle: { fontSize: 9, fontWeight: "bold", color: "#818CF8", marginBottom: 4 },
  aiText:  { fontSize: 8, color: "#CBD5E1", lineHeight: 1.7 },

  // Criteria table
  tableHeader: { flexDirection: "row", backgroundColor: "#111827", paddingVertical: 5, paddingHorizontal: 8, borderRadius: 4, marginBottom: 4 },
  tableRow:    { flexDirection: "row", paddingVertical: 5, paddingHorizontal: 8, borderBottomWidth: 1, borderBottomColor: "#1f2937" },
  colCriterion:{ width: "22%", fontSize: 7.5, fontWeight: "bold" },
  colWeight:   { width: "15%", fontSize: 7.5, textAlign: "center" },
  colDesc:     { flex: 1,      fontSize: 7.5 },
  colScale:    { width: "20%", fontSize: 7.5, textAlign: "right" },
  headerText:  { fontSize: 7, color: "#6B7280", fontWeight: "bold", letterSpacing: 1 },
  rowText:     { color: "#CBD5E1" },

  // Flow diagram
  flowRow: { flexDirection: "row", alignItems: "center", gap: 4, marginBottom: 8 },
  flowBox: {
    backgroundColor: "#111827", borderRadius: 5, borderWidth: 1, borderColor: "#1f2937",
    paddingVertical: 5, paddingHorizontal: 8, alignItems: "center",
  },
  flowBoxAccent: {
    backgroundColor: "#1e1040", borderRadius: 5, borderWidth: 1, borderColor: "#4c3a8c",
    paddingVertical: 5, paddingHorizontal: 8, alignItems: "center",
  },
  flowLabel: { fontSize: 7, color: "#9CA3AF" },
  flowLabelAccent: { fontSize: 7, color: "#a78bfa" },
  flowArrow: { fontSize: 10, color: "#374151" },

  // Footer
  footer:     { flexDirection: "row", justifyContent: "space-between", marginTop: 16 },
  footerText: { fontSize: 6.5, color: "#374151" },
});

// ─── Data ─────────────────────────────────────────────────────────────────────

const TECH_STACK = [
  {
    name: "Next.js 14  (App Router)",
    role: "Full-stack Framework",
    detail: "React 18 server & client components. API Routes for backend logic (cards, grading, PDF, AI). TypeScript throughout.",
  },
  {
    name: "Prisma 5  +  SQLite",
    role: "ORM & Database",
    detail: "Schema-first ORM. SQLite for zero-config local storage. Cascade deletes on Grade model. Migrations via db push.",
  },
  {
    name: "Tailwind CSS v4",
    role: "Styling",
    detail: "Utility-first CSS with @import syntax. Dark theme (#09090f base). Inline style overrides for dynamic grade colors.",
  },
  {
    name: "@react-pdf/renderer",
    role: "PDF Generation",
    detail: "Server-side PDF via React createElement API. Grading Report with score bars, descriptions, and AI notes.",
  },
  {
    name: "Canvas 2D API",
    role: "Image Processing (client)",
    detail: "Perspective warp (homography / Gaussian elimination) for CardCropper. Raw pixel manipulation (brightness, contrast, Sobel edge) for DefectInspector.",
  },
  {
    name: "OpenRouter API",
    role: "AI Vision Gateway",
    detail: "Routes to free vision models. Current model: nvidia/nemotron-nano-12b-v2-vl:free. OpenAI-compatible REST interface.",
  },
];

const FEATURES = [
  {
    title: "Card Submission  —  Multi-type support",
    desc: "11 card types across 4 sections (Japanese TCG, Western TCG, Sports, Other). Image upload for front & back.",
  },
  {
    title: "CardCropper  —  Perspective correction",
    desc: "4-corner drag with edge midpoint handles and center handle. Zoom 1–5x with scroll wheel. Sobel auto-detect card boundary. Bilinear warp to 500×700 output.",
  },
  {
    title: "AI Grading  —  Vision model via OpenRouter",
    desc: "Card images converted to base64, sent with structured prompt. Returns centering / corners / edges / surface scores + Thai analysis notes. Values snapped to PSA scale.",
  },
  {
    title: "DefectInspector  —  RAW pixel analysis",
    desc: "5 presets (Normal, Scratch, Surface, Edge detect, UV Sim). Sliders for brightness / contrast / saturation / sharpen + invert + channel isolation. Click-to-pin defect marks. Auto score deduction.",
  },
  {
    title: "Grading Report PDF  —  @react-pdf/renderer",
    desc: "Score bars, per-criterion descriptions, weighted formula, AI notes. Grade-color themed. No image dependency.",
  },
  {
    title: "Database  —  Search, filter & delete",
    desc: "Full-text search across name / set / cert number. Filter by all 11 card types (grouped optgroups) and status. Confirmation modal before delete.",
  },
];

const AI_CRITERIA = [
  { c: "Centering", w: "20%", d: "Border symmetry — ratio of left/right and top/bottom margins", s: "1 – 10" },
  { c: "Corners",   w: "30%", d: "Sharpness of all four corners — no whitening or fraying",      s: "1 – 10" },
  { c: "Edges",     w: "20%", d: "Edge cleanliness — no chips, nicks, or rough texture",          s: "1 – 10" },
  { c: "Surface",   w: "30%", d: "Surface quality — no scratches, print lines, stains, indentations", s: "1 – 10" },
];

// ─── Document ─────────────────────────────────────────────────────────────────

function ProjectPDF() {
  const E = React.createElement;

  const now = new Date();
  const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  const dateStr = `${now.getDate()} ${MONTHS[now.getMonth()]} ${now.getFullYear()}`;

  const feature = (title: string, desc: string, i: number) =>
    E(View, { key: i, style: S.featureRow },
      E(View, { style: S.featureDot }),
      E(View, { style: { flex: 1 } },
        E(Text, { style: S.featureText }, title),
        E(Text, { style: S.featureSub  }, desc)
      )
    );

  return E(Document, null,

    // ── Page 1: Overview + Tech Stack ──────────────────────────────────────
    E(Page, { size: "A4", style: S.page },
      E(View, { style: S.topBar }),
      E(View, { style: S.body },

        // Header
        E(View, { style: S.headerRow },
          E(View, null,
            E(Text, { style: S.brand   }, "A7GRADING"),
            E(Text, { style: S.tagline }, "PROFESSIONAL TRADING CARD GRADING SYSTEM")
          ),
          E(View, null,
            E(Text, { style: S.docLabel }, "PROJECT SUMMARY"),
            E(Text, { style: S.docDate  }, dateStr)
          )
        ),
        E(View, { style: S.divider }),

        // Overview
        E(Text, { style: S.sectionTitle }, "PROJECT OVERVIEW"),
        E(View, { style: S.overviewBox },
          E(Text, { style: S.overviewText },
            "A7Grading is a full-stack web application for professional-grade evaluation of collectible trading cards, " +
            "modelled on PSA/BGS grading methodology. Users submit cards (front and back photos), optionally " +
            "use a perspective-correction cropper, then receive AI-assisted scores across four criteria. " +
            "A grader may review the AI suggestion, inspect defects using the RAW-pixel DefectInspector, " +
            "manually adjust scores, and issue a downloadable PDF Grading Report with a unique certification number."
          )
        ),

        // Tech stack
        E(Text, { style: S.sectionTitle }, "TECH STACK"),
        E(View, { style: S.stackGrid },
          ...TECH_STACK.map((t, i) =>
            E(View, { key: i, style: S.stackCard },
              E(Text, { style: S.stackName   }, t.name),
              E(Text, { style: S.stackRole   }, t.role),
              E(Text, { style: S.stackDetail }, t.detail)
            )
          )
        ),

        // Request flow
        E(Text, { style: S.sectionTitle }, "REQUEST FLOW"),
        E(View, { style: S.flowRow },
          ...[
            { label: "Browser",      accent: false },
            { label: "→",            arrow: true   },
            { label: "Next.js\nAPI Route", accent: false },
            { label: "→",            arrow: true   },
            { label: "Prisma\nSQLite",     accent: false },
            { label: "→",            arrow: true   },
            { label: "OpenRouter\n(AI Vision)", accent: true },
            { label: "→",            arrow: true   },
            { label: "PDF\nRenderer",      accent: false },
          ].map((item, i) =>
            item.arrow
              ? E(Text, { key: i, style: S.flowArrow }, item.label)
              : E(View, { key: i, style: item.accent ? S.flowBoxAccent : S.flowBox },
                  E(Text, { style: item.accent ? S.flowLabelAccent : S.flowLabel }, item.label)
                )
          )
        ),

        E(View, { style: S.footer },
          E(Text, { style: S.footerText }, "A7Grading  |  Project Summary"),
          E(Text, { style: S.footerText }, "Page 1 of 2")
        )
      ),
      E(View, { style: S.bottomBar })
    ),

    // ── Page 2: Features + AI Grading ──────────────────────────────────────
    E(Page, { size: "A4", style: S.page },
      E(View, { style: S.topBar }),
      E(View, { style: S.body },

        E(View, { style: S.headerRow },
          E(View, null,
            E(Text, { style: S.brand   }, "A7GRADING"),
            E(Text, { style: S.tagline }, "PROFESSIONAL TRADING CARD GRADING SYSTEM")
          ),
          E(View, null,
            E(Text, { style: S.docLabel }, "FEATURES & AI GRADING"),
            E(Text, { style: S.docDate  }, dateStr)
          )
        ),
        E(View, { style: S.divider }),

        // Features
        E(Text, { style: S.sectionTitle }, "KEY FEATURES"),
        ...FEATURES.map((f, i) => feature(f.title, f.desc, i)),

        E(View, { style: S.divider }),

        // AI Grading section
        E(Text, { style: S.sectionTitle }, "AI GRADING — HOW IT WORKS"),

        E(View, { style: S.aiBox },
          E(Text, { style: S.aiTitle }, "Model  :  nvidia/nemotron-nano-12b-v2-vl:free  via  OpenRouter"),
          E(Text, { style: S.aiText },
            "Card images (front and back) are read from disk, converted to base64 data URLs, and sent as " +
            "vision content to OpenRouter's OpenAI-compatible chat completions endpoint. " +
            "A structured system prompt instructs the model to act as a PSA/BGS grading expert and return " +
            "a strict JSON object with four numeric scores and a 2-3 sentence analysis in Thai. " +
            "Each returned value is snapped to the valid PSA scale: 1, 1.5, 2, 2.5 ... 9.5, 10."
          )
        ),

        // Criteria table
        E(Text, { style: { ...S.sectionTitle, marginBottom: 6 } }, "GRADING CRITERIA"),
        E(View, { style: S.tableHeader },
          E(Text, { style: { ...S.colCriterion, ...S.headerText } }, "CRITERION"),
          E(Text, { style: { ...S.colWeight,    ...S.headerText } }, "WEIGHT"),
          E(Text, { style: { ...S.colDesc,      ...S.headerText } }, "WHAT IS EVALUATED"),
          E(Text, { style: { ...S.colScale,     ...S.headerText } }, "SCALE"),
        ),
        ...AI_CRITERIA.map((r, i) =>
          E(View, { key: i, style: S.tableRow },
            E(Text, { style: { ...S.colCriterion, ...S.rowText, fontWeight: "bold" } }, r.c),
            E(Text, { style: { ...S.colWeight,    ...S.rowText, color: "#F59E0B"   } }, r.w),
            E(Text, { style: { ...S.colDesc,      ...S.rowText } }, r.d),
            E(Text, { style: { ...S.colScale,     ...S.rowText } }, r.s),
          )
        ),

        // Final grade formula
        E(View, { style: { ...S.aiBox, borderLeftColor: "#F59E0B", marginTop: 12 } },
          E(Text, { style: { ...S.aiTitle, color: "#FBBF24" } }, "Final Grade Formula"),
          E(Text, { style: S.aiText },
            "Final = (Centering x 0.20) + (Corners x 0.30) + (Edges x 0.20) + (Surface x 0.30)\n" +
            "Result is rounded to the nearest 0.5, then clamped to [1, 10].\n" +
            "Grade names follow PSA convention: GEM MT 10, MINT 9, NM-MT 8, EX-NM 6, VG 3, etc."
          )
        ),

        E(View, { style: S.footer },
          E(Text, { style: S.footerText }, "A7Grading  |  Project Summary"),
          E(Text, { style: S.footerText }, "Page 2 of 2")
        )
      ),
      E(View, { style: S.bottomBar })
    )
  );
}

// ─── Route ────────────────────────────────────────────────────────────────────

export async function GET() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const element = React.createElement(ProjectPDF) as any;
  const buf = await renderToBuffer(element);

  return new NextResponse(new Uint8Array(buf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": 'attachment; filename="A7Grading-ProjectSummary.pdf"',
    },
  });
}
