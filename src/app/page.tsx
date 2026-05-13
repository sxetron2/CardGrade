import Link from "next/link";
import { prisma } from "@/lib/prisma";

async function getStats() {
  try {
    const total = await prisma.card.count();
    const completed = await prisma.card.count({ where: { status: "COMPLETED" } });
    const pending = await prisma.card.count({ where: { status: "PENDING" } });
    const gem10 = await prisma.grade.count({ where: { finalGrade: 10 } });
    return { total, completed, pending, gem10 };
  } catch {
    return { total: 0, completed: 0, pending: 0, gem10: 0 };
  }
}

export default async function HomePage() {
  const stats = await getStats();

  return (
    <div className="space-y-12">
      {/* Hero */}
      <div className="text-center py-16">
        <h1 className="text-5xl font-black tracking-tight mb-4">
          <span className="bg-gradient-to-r from-yellow-400 via-orange-400 to-red-500 bg-clip-text text-transparent">
            A7Grading
          </span>
        </h1>
        <p className="text-white/60 text-xl max-w-xl mx-auto mb-8">
          ระบบเกรดการ์ดสะสมมืออาชีพ — Pokémon, One Piece, MTG และอีกมากมาย
        </p>
        <div className="flex gap-4 justify-center flex-wrap">
          <Link
            href="/submit"
            className="px-8 py-3 bg-gradient-to-r from-yellow-400 to-orange-500 text-black font-bold rounded-xl hover:opacity-90 transition-opacity"
          >
            ส่งเกรดการ์ด
          </Link>
          <Link
            href="/database"
            className="px-8 py-3 bg-white/10 text-white font-bold rounded-xl hover:bg-white/20 transition-colors border border-white/10"
          >
            ดูฐานข้อมูล
          </Link>
          <a
            href="/api/project-pdf"
            download="A7Grading-ProjectSummary.pdf"
            className="px-8 py-3 bg-white/5 text-white/60 font-bold rounded-xl hover:bg-white/10 hover:text-white transition-all border border-white/10 flex items-center gap-2 text-sm"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/><line x1="12" y1="18" x2="12" y2="12"/><line x1="9" y1="15" x2="12" y2="18"/><line x1="15" y1="15" x2="12" y2="18"/></svg>
            Project Summary PDF
          </a>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "การ์ดทั้งหมด", value: stats.total, color: "text-white" },
          { label: "เกรดแล้ว", value: stats.completed, color: "text-green-400" },
          { label: "รอเกรด", value: stats.pending, color: "text-orange-400" },
          { label: "GEM MT 10", value: stats.gem10, color: "text-yellow-300" },
        ].map((stat) => (
          <div
            key={stat.label}
            className="bg-white/5 border border-white/10 rounded-2xl p-6 text-center"
          >
            <div className={`text-4xl font-black ${stat.color}`}>{stat.value}</div>
            <div className="text-white/50 text-sm mt-1">{stat.label}</div>
          </div>
        ))}
      </div>

      {/* How it works */}
      <div>
        <h2 className="text-2xl font-bold mb-6 text-center text-white/90">วิธีการทำงาน</h2>
        <div className="grid md:grid-cols-4 gap-4">
          {[
            { step: "01", title: "ส่งข้อมูลการ์ด", desc: "กรอกชื่อ, Set, เลขการ์ด และอัพโหลดรูปหน้า/หลัง" },
            { step: "02", title: "ให้คะแนน", desc: "ประเมิน Centering, Corners, Edges, Surface (1-10)" },
            { step: "03", title: "คำนวณเกรด", desc: "ระบบคำนวณ Final Grade จาก 4 หมวดอัตโนมัติ" },
            { step: "04", title: "รับ Certificate", desc: "ดาวน์โหลด PDF certificate พร้อมเลข cert" },
          ].map((item) => (
            <div key={item.step} className="bg-white/5 border border-white/10 rounded-2xl p-6">
              <div className="text-3xl font-black text-orange-400/50 mb-2">{item.step}</div>
              <div className="font-bold text-white mb-1">{item.title}</div>
              <div className="text-white/50 text-sm">{item.desc}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
