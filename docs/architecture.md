# Architecture

## Process Boundary

The renderer is a Next.js app with no direct Node access. Electron preload exposes a narrow `desktopAPI` bridge. The main process owns filesystem, database, Playwright, OpenAI, and export operations.

```text
React UI -> preload desktopAPI -> Electron IPC -> server services -> SQLite / Playwright / OpenAI
```

## Data Flow

1. User chooses a fetch mode and query.
2. Renderer calls `threads:fetch`.
3. Electron main calls `fetchAndStoreThreads`.
4. Playwright opens Threads with saved session cookies and extracts visible posts.
5. Each post is scored by `scorePost`.
6. Posts are upserted into SQLite and returned to the UI.
7. User clicks `Analyze`.
8. Main process calls OpenAI and stores normalized JSON in `ai_analysis`.

## Trending Score

The score is capped at 100 and combines:

- likes velocity from engagement per hour
- weighted replies
- weighted reposts
- emotional wording
- controversial wording
- relatability phrases

The scoring module is isolated so future ranking signals can be added without touching the scraper or UI.

## Future Modules

Reserved extension points:

- video idea generator service
- affiliate link manager tables and UI
- analytics service
- multi-account profile/session manager
- scheduled background keyword workers

The MVP intentionally avoids auto-posting, fake engagement, and aggressive scraping.
