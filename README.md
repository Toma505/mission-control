# Mission Control

AI Agent & Project Management Dashboard - A high-fidelity replica based on the OpenClaw Mission Control app.

## 🚀 Quick Start

### 1. Install Dependencies
```bash
cd /data/workspace/mission-control
npm install
```

### 2. Setup Database

**Option A: Use SQLite (Easiest - No setup required)**
```bash
# Edit .env file
DATABASE_URL="file:./dev.db"

# Update prisma/schema.prisma
# Change: datasource db { provider = "postgresql" }
# To:     datasource db { provider = "sqlite" }
```

**Option B: Use PostgreSQL**
```bash
# Make sure PostgreSQL is running
# Update .env with your connection string
DATABASE_URL="postgresql://user:password@localhost:5432/mission_control"
```

### 3. Initialize Database
```bash
# Push schema to database
npx prisma db push

# Seed with demo data
npx prisma db seed
```

### 4. Run Development Server
```bash
npm run dev
```

### 5. Open in Browser
```
http://localhost:3000
```

---

## 📂 Project Structure

```
mission-control/
├── src/
│   ├── app/              # Next.js pages
│   ├── components/       # React components
│   │   ├── layout/      # AppShell, Sidebar, Header
│   │   └── ui/          # Button, Badge, Card, etc.
│   └── lib/             # Utilities, Prisma client
├── prisma/
│   ├── schema.prisma    # Database schema
│   └── seed.ts          # Demo data
└── tailwind.config.ts   # Custom dark theme
```

---

## 🎨 Features Built

✅ **Layout**
- Sidebar navigation with 10 sections
- Top header with search and profile
- Dark mode AI workspace aesthetic

✅ **Components**
- Button (4 variants)
- Badge (status-coded)
- Card components
- Progress bars

✅ **Database**
- Full schema (8 models)
- Realistic seed data
- Agents, Tasks, Activities, Commits, Documents, Clients, Cron Jobs

⏳ **In Progress**
- Dashboard page
- Workshop (task management)
- Other pages

---

## 🛠 Development

```bash
# Run dev server
npm run dev

# View database
npx prisma studio

# Reset database
npx prisma db push --force-reset
npx prisma db seed
```

---

## 🎯 Current Status

**Phase 2: Setup & Design System** - 70% Complete

Next: Building dashboard page with status cards, activity feed, and task lists.

---

Built with: Next.js 14, TypeScript, Tailwind CSS, Prisma, PostgreSQL
