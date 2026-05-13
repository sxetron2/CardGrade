import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getGradeColor, getCardTypeInfo } from "@/types";
import React from "react";
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  renderToBuffer,
} from "@react-pdf/renderer";

// ─── Score descriptions (English — PDF Helvetica doesn't support Thai) ────────

function criterionDesc(criterion: "centering" | "corners" | "edges" | "surface", score: number): string {
  const t: Record<string, string[]> = {
    centering: [
      "Severe centering defects — heavily misaligned borders",
      "Significant off-centering visible on multiple sides",
      "Noticeable off-centering on one or more sides",
      "Slight off-centering, within acceptable range",
      "Near-perfect centering with negligible deviation",
      "Perfect 50/50 border symmetry on all sides",
    ],
    corners: [
      "Heavy corner wear, fraying or rounding on all corners",
      "Visible corner wear on multiple corners",
      "Light fraying or whitening noticeable on corners",
      "Minor corner wear visible under close inspection",
      "Corners nearly perfect with barely visible wear",
      "All four corners perfectly sharp — zero whitening or fraying",
    ],
    edges: [
      "Heavy edge damage — significant chips, nicks or roughness",
      "Notched or chipped edges on one or more sides",
      "Light edge wear visible to the naked eye",
      "Minor edge roughness visible under close inspection",
      "Edges near-perfect with only trace wear",
      "All edges perfectly clean — no chips, nicks or roughness",
    ],
    surface: [
      "Heavy surface damage — deep scratches, creases or stains",
      "Noticeable scratches, print lines, or surface stains",
      "Visible surface wear, light scratches or print defects",
      "Very light surface scratches or minor print lines",
      "Surface near-perfect with minimal imperfections",
      "Flawless surface — no scratches, print lines or stains",
    ],
  };
  const idx = score >= 9.5 ? 5 : score >= 8.5 ? 4 : score >= 7 ? 3 : score >= 5 ? 2 : score >= 3 ? 1 : 0;
  return t[criterion][idx];
}

function overallDesc(grade: number): string {
  if (grade === 10)  return "Gem Mint — a virtually perfect specimen in every regard.";
  if (grade >= 9.5)  return "Mint+ — exceptionally preserved with only the most minor imperfections.";
  if (grade >= 9)    return "Mint — sharp, well-centred card with minimal surface wear.";
  if (grade >= 8.5)  return "Near Mint-Mint+ — above-average condition with very light flaws.";
  if (grade >= 8)    return "Near Mint-Mint — strong condition, minor imperfections on close inspection.";
  if (grade >= 7.5)  return "Near Mint+ — attractive card with slight wear across criteria.";
  if (grade >= 7)    return "Near Mint — above-average card showing light overall wear.";
  if (grade >= 6.5)  return "Excellent-Near Mint+ — moderate wear across one or more criteria.";
  if (grade >= 6)    return "Excellent-Near Mint — clearly used but well-preserved card.";
  if (grade >= 5)    return "Excellent — average condition, visible wear but structurally intact.";
  if (grade >= 4)    return "Very Good — heavy play wear noticeable throughout.";
  if (grade >= 3)    return "Good — significant wear and possible creasing.";
  return "Poor / Fair — heavily damaged card, major defects present.";
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const S = StyleSheet.create({
  page:      { backgroundColor: "#09090f", fontFamily: "Helvetica" },
  bar:       { height: 8, width: "100%" },
  body:      { paddingHorizontal: 32, paddingVertical: 24 },

  // Header
  headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 },
  brand:     { fontSize: 18, fontWeight: "bold", color: "#F59E0B", letterSpacing: 3 },
  reportTag: { fontSize: 7,  color: "#6B7280", letterSpacing: 2, marginTop: 3 },
  certBlock: { alignItems: "flex-end" },
  certTag:   { fontSize: 7,  color: "#6B7280", letterSpacing: 1 },
  certNum:   { fontSize: 11, fontWeight: "bold", letterSpacing: 2, marginTop: 2 },

  divider:   { height: 1, backgroundColor: "#1f2937", marginVertical: 14 },

  // Card info grid
  infoGrid:   { flexDirection: "row", gap: 0 },
  infoCol:    { flex: 1 },
  infoRow:    { marginBottom: 7 },
  infoLabel:  { fontSize: 7,  color: "#6B7280", letterSpacing: 1, marginBottom: 1 },
  infoValue:  { fontSize: 9,  color: "#e5e7eb", fontWeight: "bold" },

  // Final grade block
  gradeBlock: { alignItems: "center", marginVertical: 18 },
  gradeTag:   { fontSize: 7,  color: "#9CA3AF", letterSpacing: 3 },
  gradeNum:   { fontSize: 80, fontWeight: "bold", lineHeight: 1, marginTop: 2 },
  gradeName:  { fontSize: 12, fontWeight: "bold", marginTop: 4 },
  gradeDesc:  { fontSize: 8,  color: "#9CA3AF", marginTop: 6, textAlign: "center", maxWidth: 340 },

  // Weighted formula row
  formulaRow:  { flexDirection: "row", justifyContent: "center", gap: 6, marginTop: 10 },
  formulaBox:  { alignItems: "center", backgroundColor: "#111827", borderRadius: 6, paddingVertical: 5, paddingHorizontal: 10 },
  formulaVal:  { fontSize: 13, fontWeight: "bold", color: "#ffffff" },
  formulaLbl:  { fontSize: 6,  color: "#6B7280", marginTop: 1 },
  formulaSep:  { fontSize: 14, color: "#374151", alignSelf: "center" },

  // Criteria section
  sectionTitle: { fontSize: 7, color: "#6B7280", letterSpacing: 2, fontWeight: "bold", marginBottom: 10 },

  criterionRow:   { marginBottom: 12 },
  criterionHeader:{ flexDirection: "row", justifyContent: "space-between", alignItems: "baseline", marginBottom: 4 },
  criterionName:  { fontSize: 9,  color: "#e5e7eb", fontWeight: "bold" },
  criterionWeight:{ fontSize: 7,  color: "#6B7280" },
  criterionScore: { fontSize: 14, fontWeight: "bold" },
  barTrack:       { height: 5,  backgroundColor: "#1f2937", borderRadius: 3 },
  barFill:        { height: 5,  borderRadius: 3 },
  criterionDesc:  { fontSize: 7.5, color: "#9CA3AF", marginTop: 4, lineHeight: 1.4 },

  // AI notes
  notesBox:   { backgroundColor: "#0f1628", borderRadius: 6, borderWidth: 1, borderColor: "#1e2d4a", padding: 10, marginTop: 4 },
  notesText:  { fontSize: 8, color: "#93C5FD", lineHeight: 1.6 },

  // Footer
  footer:     { flexDirection: "row", justifyContent: "space-between", marginTop: 18 },
  footerText: { fontSize: 7, color: "#374151" },
});

// ─── Component ────────────────────────────────────────────────────────────────

interface CardInput {
  certNumber: string;
  cardName: string;
  cardSet: string;
  cardNumber: string;
  cardType: string;
  language: string;
  rarity: string | null;
  grade: {
    finalGrade: number;
    gradeName: string;
    centering: number;
    corners: number;
    edges: number;
    surface: number;
    aiNotes: string | null;
    gradedAt: Date;
  };
}

function GradingReport({ card }: { card: CardInput }) {
  const gc = getGradeColor(card.grade.finalGrade);
  const g  = card.grade;

  const d = new Date(g.gradedAt);
  const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  const dateStr = `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;

  const typeInfo = getCardTypeInfo(card.cardType);

  const E = React.createElement;

  const criterion = (
    key: "centering" | "corners" | "edges" | "surface",
    label: string,
    weight: string,
    score: number
  ) =>
    E(View, { key, style: S.criterionRow },
      E(View, { style: S.criterionHeader },
        E(View, { style: { flexDirection: "row", alignItems: "baseline", gap: 6 } },
          E(Text, { style: S.criterionName }, label),
          E(Text, { style: S.criterionWeight }, `weight ${weight}`)
        ),
        E(Text, { style: { ...S.criterionScore, color: gc } }, score.toString())
      ),
      // Progress bar
      E(View, { style: S.barTrack },
        E(View, { style: { ...S.barFill, width: `${score * 10}%`, backgroundColor: gc } })
      ),
      E(Text, { style: S.criterionDesc }, criterionDesc(key, score))
    );

  return E(Document, null,
    E(Page, { size: [500, 720], style: S.page },
      E(View, { style: { ...S.bar, backgroundColor: gc } }),

      E(View, { style: S.body },

        // Header: brand left, cert right
        E(View, { style: S.headerRow },
          E(View, null,
            E(Text, { style: S.brand }, "A7GRADING"),

            E(Text, { style: S.reportTag }, "GRADING REPORT")
          ),
          E(View, { style: S.certBlock },
            E(Text, { style: S.certTag }, "CERT NUMBER"),
            E(Text, { style: { ...S.certNum, color: gc } }, card.certNumber)
          )
        ),

        E(View, { style: S.divider }),

        // Card info — 2-column
        E(View, { style: S.infoGrid },
          E(View, { style: S.infoCol },
            E(View, { style: S.infoRow },
              E(Text, { style: S.infoLabel }, "CARD NAME"),
              E(Text, { style: S.infoValue }, card.cardName)
            ),
            E(View, { style: S.infoRow },
              E(Text, { style: S.infoLabel }, "SET"),
              E(Text, { style: S.infoValue }, card.cardSet)
            ),
            E(View, { style: S.infoRow },
              E(Text, { style: S.infoLabel }, "CARD NUMBER"),
              E(Text, { style: S.infoValue }, card.cardNumber)
            ),
          ),
          E(View, { style: S.infoCol },
            E(View, { style: S.infoRow },
              E(Text, { style: S.infoLabel }, "TYPE"),
              E(Text, { style: S.infoValue }, typeInfo.label)
            ),
            E(View, { style: S.infoRow },
              E(Text, { style: S.infoLabel }, "LANGUAGE" + (card.rarity ? " / RARITY" : "")),
              E(Text, { style: S.infoValue }, card.language + (card.rarity ? ` / ${card.rarity}` : ""))
            ),
            E(View, { style: S.infoRow },
              E(Text, { style: S.infoLabel }, "GRADED DATE"),
              E(Text, { style: S.infoValue }, dateStr)
            ),
          )
        ),

        E(View, { style: S.divider }),

        // Final grade
        E(View, { style: S.gradeBlock },
          E(Text, { style: S.gradeTag }, "FINAL GRADE"),
          E(Text, { style: { ...S.gradeNum, color: gc } }, g.finalGrade.toString()),
          E(Text, { style: { ...S.gradeName, color: gc } }, g.gradeName),
          E(Text, { style: S.gradeDesc }, overallDesc(g.finalGrade))
        ),

        // Weighted formula row
        E(View, { style: S.formulaRow },
          ...[
            { lbl: "CEN  x20%", val: g.centering },
            { lbl: "COR  x30%", val: g.corners   },
            { lbl: "EDG  x20%", val: g.edges      },
            { lbl: "SUR  x30%", val: g.surface    },
          ].flatMap((item, i, arr) => [
            E(View, { key: item.lbl, style: S.formulaBox },
              E(Text, { style: S.formulaVal }, item.val.toString()),
              E(Text, { style: S.formulaLbl }, item.lbl)
            ),
            ...(i < arr.length - 1
              ? [E(Text, { key: `sep${i}`, style: S.formulaSep }, "+")]
              : [])
          ])
        ),

        E(View, { style: { ...S.divider, marginTop: 18 } }),

        // Criteria breakdown
        E(Text, { style: S.sectionTitle }, "CRITERIA BREAKDOWN"),
        criterion("centering", "Centering", "20%", g.centering),
        criterion("corners",   "Corners",   "30%", g.corners),
        criterion("edges",     "Edges",     "20%", g.edges),
        criterion("surface",   "Surface",   "30%", g.surface),

        // AI notes
        ...(g.aiNotes
          ? [
              E(View, { style: S.divider }),
              E(Text, { style: S.sectionTitle }, "ANALYSIS NOTES"),
              E(View, { style: S.notesBox },
                E(Text, { style: S.notesText }, g.aiNotes)
              ),
            ]
          : []
        ),

        // Footer
        E(View, { style: S.footer },
          E(Text, { style: S.footerText }, "A7Grading  |  Professional Grading Service"),
          E(Text, { style: S.footerText }, dateStr)
        )
      ),

      E(View, { style: { ...S.bar, backgroundColor: gc } })
    )
  );
}

// ─── Route ────────────────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "ไม่ระบุ ID" }, { status: 400 });

  const card = await prisma.card.findUnique({
    where: { id },
    include: { grade: true },
  });

  if (!card || !card.grade) {
    return NextResponse.json({ error: "ไม่พบข้อมูล" }, { status: 404 });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const element = React.createElement(GradingReport, { card: { ...card, grade: card.grade } }) as any;
  const pdfBuffer = await renderToBuffer(element);

  return new NextResponse(new Uint8Array(pdfBuffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="certificate-${card.certNumber}.pdf"`,
    },
  });
}
