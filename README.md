# Threads Trend Finder

Desktop app for affiliate marketers who research viral Threads posts and turn high-signal ideas into affiliate product angles. It fetches public Threads content with Playwright, stores posts locally in SQLite, scores viral and affiliate potential, and uses OpenAI for Vietnamese-market pain-point and product suggestions.

The default Home screen is an Opportunity Inbox. Use `Scan New Opportunities` to fetch enabled niches, measure engagement growth against prior snapshots, and ask AI to shortlist a small number of high-signal posts. Optional scheduled scans run only while the local desktop app is open.

This app is research-only. It does not render videos, auto-post to TikTok/Reels, create fake engagement, or run aggressive scraping.

## Stack

- Electron main process for desktop shell, IPC, SQLite, Playwright, and OpenAI calls
- Next.js + React + TypeScript renderer
- TailwindCSS dark dashboard UI
- SQLite via `better-sqlite3`
- Playwright Chromium scraper with saved Threads session state
- OpenAI Chat Completions JSON output

## Folder Structure

```text
.
├── data/                         # Local SQLite DB, exports, Threads session state
├── docs/
│   ├── architecture.md
│   └── database-schema.sql
├── src/
│   ├── app/                      # Next.js renderer
│   ├── components/
│   │   ├── analysis/             # AI analysis panel
│   │   ├── feed/                 # Threads post cards
│   │   ├── layout/               # Desktop shell layout
│   │   └── ui/                   # Reusable UI primitives
│   ├── electron/                 # Electron main and preload
│   ├── lib/                      # Shared types, utilities, demo data
│   ├── server/
│   │   ├── ai/                   # OpenAI affiliate suggestion service
│   │   ├── db/                   # SQLite schema and repository functions
│   │   ├── scraper/              # Playwright Threads scraper
│   │   ├── scoring/              # Trending score algorithm
│   │   └── services/             # Fetch orchestration and exports
│   └── styles/
└── .env.example
```

## Setup

```bash
npm.cmd install
npm.cmd run scraper:install
copy .env.example .env
npm.cmd run db:init
npm.cmd run dev
```

PowerShell blocks `npm.ps1` on this machine, so use `npm.cmd`.

If Electron is launched from a shell that has `ELECTRON_RUN_AS_NODE=1`, clear it first:

```powershell
$env:ELECTRON_RUN_AS_NODE=$null
npm.cmd start
```

Set `OPENAI_API_KEY` in `.env` or in the app Settings page for live AI analysis. The default model is `gpt-4.1-nano`, the cheapest listed test model for this workflow.

## Threads Session

Use the `Threads Login` button in Settings to open a Playwright browser window and sign in. The browser profile is saved to `data/threads-browser-profile`, and a cookie snapshot is saved to `data/threads-session.json`. Both are local and reused by future fetches, including after rebuilds, unless the `data/` directory is deleted.

## Development Workflow

```bash
npm.cmd run typecheck
npm.cmd run build
npm.cmd run dev
```

`npm.cmd run db:init` rebuilds SQLite for Node, initializes the database, then rebuilds SQLite for Electron. Run `npm.cmd run electron:rebuild` after dependency upgrades that affect Electron, Node, or `better-sqlite3`.

The dev command starts Next.js, watches Electron TypeScript files with `tsup`, waits for both, and launches Electron.

## Core Modules

- `src/server/scraper/threadsScraper.ts`: fetches home, keyword, hashtag, profile, and trending-style search pages.
- `src/server/scoring/trendingScore.ts`: computes viral, affiliate-fit, and combined opportunity scores with Vietnamese and English pain-point signals.
- `src/server/ai/affiliateAnalysisService.ts`: returns Vietnamese-market emotional triggers, pain points, personas, situations, product ideas, demo angles, content formats, hooks, CTAs, and skip reasons.
- `src/server/db/client.ts`: local SQLite persistence for posts, analysis, saved posts, keywords, and fetch logs.
- `src/electron/main.ts`: IPC boundary between renderer and local Node services.

## Safety Defaults

- Headless scraper uses capped post limits and delay controls from `.env`.
- Saved login state is local only.
- No posting, commenting, liking, bot engagement, or video generation is implemented.
