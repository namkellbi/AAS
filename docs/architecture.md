# Architecture

## Process Boundary

The renderer is a Next.js app with no direct Node access. Electron preload exposes a narrow `desktopAPI` bridge. The main process owns filesystem, database, Playwright, OpenAI, FFmpeg, and export operations.

```text
React UI -> preload desktopAPI -> Electron IPC -> server services -> SQLite / Playwright / OpenAI / FFmpeg
```

## Data Flow

1. User chooses a fetch mode and query.
2. Renderer calls `threads:fetch`.
3. Electron main calls `fetchAndStoreThreads`.
4. Playwright opens Threads with saved session cookies and extracts visible posts.
5. Each post receives viral, affiliate-fit, and combined opportunity scores from `scorePost`.
6. Posts are upserted into SQLite and returned to the UI.
7. User clicks `Analyze`.
8. Main process calls OpenAI and stores normalized JSON in `ai_analysis`.

## Opportunity Inbox

The Home screen is a local-first opportunity inbox. A manual scan:

1. fetches each enabled keyword sequentially with a conservative delay
2. stores an engagement snapshot for every fetched post
3. compares new snapshots with prior snapshots to estimate engagement velocity
4. ranks posts by combined opportunity score
5. sends only a small number of top candidates to OpenAI for Vietnamese-market triage

AI triage classifies candidates as `make_now`, `watch`, or `skip`. Home only exposes the qualified shortlist and decision-oriented fields: why to make it, product direction, and a suggested hook. Optional scheduled scans run only while the desktop app is open.

## Closed Affiliate Loop

The product workflow is:

```text
Keywords -> Threads discovery -> AI shortlist -> content/video -> Results -> future AI context
```

The keyword screen starts from Vietnamese audience presets, expands them into natural pain-point searches, and can mine new phrases from strong posts, replies, and winning videos. Each keyword receives a dynamic effectiveness score from fetch yield, AI verdicts, product fit, orders, and commission. New untested keywords are prioritized by the scanner; weak keywords receive a disable recommendation. The Results screen stores views, clicks, orders, revenue, commission, hook, and format. Successful records are included as channel-specific context in later OpenAI analyses.

## Trending Score

The score is capped at 100 and combines:

- likes velocity from engagement per hour
- weighted replies
- weighted reposts
- emotional wording
- controversial wording
- relatability phrases

The scoring module is isolated so future ranking signals can be added without touching the scraper or UI.

## Affiliate Opportunity Score

The local affiliate-fit score is tuned for Vietnamese and English Threads content. It combines:

- pain-point clarity
- whether a product can directly solve the problem
- whether the result is easy to demonstrate in a short video
- audience clarity
- buying-intent wording

The opportunity score weights affiliate fit more heavily than raw virality so high-engagement drama does not outrank actionable product opportunities. OpenAI adds Vietnamese personas, situations, demo angles, content formats, and skip reasons after the user requests analysis.

## Video Draft Flow

After AI analysis, the user can choose one of three hook variants, review and edit the TikTok brief, choose a background asset, and render a local 9:16 draft. The selected hook is rendered as the opening scene. OpenAI TTS creates narration while FFmpeg composes the background, Threads-style cards, audio, metadata, and thumbnails. Upload remains manual.

## Future Modules

Reserved extension points:

- affiliate link manager tables and UI
- analytics service
- multi-account profile/session manager
- scheduled background keyword workers

The app intentionally avoids auto-posting, fake engagement, and aggressive scraping.
