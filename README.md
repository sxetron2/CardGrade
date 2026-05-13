# CardGrade Pro

ระบบเกรดการ์ด Pokemon & One Piece มืออาชีพ พร้อม AI วิเคราะห์รูปการ์ด

## Features

- ส่งการ์ดเพื่อเกรด (Pokemon / One Piece)
- AI (Claude Vision) วิเคราะห์รูปการ์ดและเสนอคะแนน
- ระบบให้คะแนน 4 หมวด: Centering, Corners, Edges, Surface
- สเกล 1-10 (ทศนิยม .5) พร้อม Grade Name (GEM MT 10, MINT 9 ...)
- ออก PDF Certificate
- ฐานข้อมูลการ์ดพร้อมค้นหา

## Setup

```bash
# 1. ติดตั้ง dependencies
npm install

# 2. สร้าง database
npm run db:push

# 3. ใส่ Anthropic API Key ใน .env.local
# ANTHROPIC_API_KEY=sk-ant-...

# 4. รัน dev server
npm run dev
```

เปิด http://localhost:3000

## Tech Stack

- Next.js 14 + TypeScript + Tailwind CSS
- Prisma + SQLite
- Anthropic Claude API (Vision)
- @react-pdf/renderer
