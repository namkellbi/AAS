# Tài liệu dự án: Threads Affiliate Trend Finder

Ngày rà soát: 04/07/2026

Tài liệu này mô tả trạng thái hiện tại của code trong repo `AffiliateAutomationSystem`. Mục tiêu là làm rõ dự án dùng để làm gì, code hiện đang chạy những phần nào, đã cover được gì, chưa cover gì, và kỳ vọng đúng khi tiếp tục phát triển.

## 1. Tóm tắt ngắn gọn

Threads Affiliate Trend Finder là một desktop app chạy local dành cho workflow nghiên cứu affiliate content từ Threads. App giúp người dùng:

1. Đăng nhập Threads bằng Playwright browser profile local.
2. Quét bài Threads theo keyword, hashtag, profile, home feed hoặc link post cụ thể.
3. Lưu bài, tương tác và lịch sử snapshot vào SQLite.
4. Chấm điểm local để tìm bài có pain point, khả năng viral, khả năng demo sản phẩm và tốc độ tăng trưởng.
5. Dùng OpenAI để phân tích bài thành cơ hội affiliate cho thị trường Việt Nam.
6. Tạo shortlist `Make Now` / `Watch` / `Skip`.
7. Sinh brief TikTok/Reels gồm hook, sản phẩm gợi ý, persona, demo angle, CTA, caption, hashtag và script.
8. Render video draft 9:16 local bằng OpenAI TTS, Playwright screenshot card và FFmpeg.
9. Ghi kết quả publish thủ công như views, clicks, orders, revenue, commission để các lần phân tích AI sau học từ nội dung thắng.

Điểm cần highlight: dự án hiện đã phát triển tới mức MVP end-to-end cho một quy trình kiếm tiền affiliate: từ tìm insight trên Threads, lọc cơ hội, tạo brief, dựng video nháp, đến ghi nhận kết quả sau khi đăng. Mục đích chính của dự án không chỉ là làm một tool nghiên cứu nội dung, mà là từng bước biến nó thành một tool automation hỗ trợ kiếm tiền thụ động hoặc bán thụ động từ affiliate content. Ở trạng thái hiện tại, các bước tạo tiền vẫn cần con người review, chọn sản phẩm, upload và tối ưu; automation đang đóng vai trò giảm thời gian nghiên cứu và sản xuất.

App hiện chưa phải hệ thống auto-post, chưa crawl marketplace, chưa tạo affiliate link, chưa chạy cloud 24/7 và chưa thay thế video editor hoàn chỉnh.

## 2. Purpose của dự án

### 2.1. Vấn đề cần giải quyết

Người làm affiliate thường phải tự vào Threads/TikTok để tìm:

- Người dùng đang than phiền vấn đề gì.
- Bài nào đang có tín hiệu tăng tương tác.
- Pain point nào có thể gắn với sản phẩm vật lý dễ mua.
- Sản phẩm nào có thể demo trung thực trong video ngắn.
- Hook nào đủ relatable để làm TikTok/Reels.
- Video nào sau khi đăng thật sự có click, đơn hoặc hoa hồng.

Nếu làm thủ công, workflow này tốn thời gian và dễ bị nhiễu bởi bài drama, chính trị, PR brand, joke không gắn được sản phẩm hoặc bài viral nhưng không có buying intent.

### 2.2. Mục đích sản phẩm

Mục đích sản phẩm chính là xây dựng một hệ thống automation hỗ trợ tạo doanh thu affiliate thụ động/bán thụ động. Thay vì người dùng phải tự đọc feed, tự đoán sản phẩm, tự viết hook và tự dựng từng video từ đầu, app sẽ dần tự động hóa các bước lặp lại nhiều nhất trong quá trình kiếm tiền từ nội dung affiliate.

Dự án cố gắng biến workflow thủ công thành một vòng lặp local:

```text
Keyword / audience
  -> Threads discovery
  -> local scoring
  -> AI affiliate analysis
  -> opportunity shortlist
  -> TikTok/Reels brief
  -> local video draft
  -> manual upload
  -> performance result
  -> better future AI context
```

Điểm quan trọng là app ưu tiên cơ hội affiliate có thể triển khai, không chỉ ưu tiên bài viral. Một bài có nhiều tương tác nhưng không có pain point, không có sản phẩm giải quyết trực tiếp hoặc không demo được sẽ không phải cơ hội tốt.

Kỳ vọng cuối cùng là biến app thành một "affiliate automation engine": hệ thống liên tục tìm pain point mới, đề xuất sản phẩm, tạo nội dung, hỗ trợ dựng video, theo dõi kết quả và dùng dữ liệu thắng để tối ưu các vòng sau. Thu nhập thụ động không được xem là cam kết chắc chắn; nó là mục tiêu kinh doanh mà tool được thiết kế để hỗ trợ bằng cách giảm công việc thủ công và tăng tốc vòng thử nghiệm nội dung.

### 2.3. Định vị đúng

Đúng:

- Local-first research tool.
- Desktop assistant cho affiliate marketer.
- Threads scraper + AI analyst + TikTok brief generator.
- Local video draft renderer để review thủ công.
- Performance tracker đơn giản để học từ kênh của chính người dùng.
- Nền móng cho một affiliate automation tool hướng tới doanh thu thụ động/bán thụ động.

Không đúng:

- Không phải official Threads API client.
- Không phải TikTok auto-post bot.
- Không phải marketplace crawler.
- Không tự tạo affiliate link.
- Không tự mua tương tác, like, comment, follow.
- Không phải SaaS cloud chạy nền khi app đóng.
- Không phải video editor chuyên nghiệp.

## 3. Stack kỹ thuật

### 3.1. Runtime chính

- Electron: desktop shell, IPC, filesystem, SQLite, Playwright, OpenAI, FFmpeg.
- Next.js 14 static export: renderer UI.
- React 18 + TypeScript strict.
- TailwindCSS: dark dashboard UI.
- SQLite qua `better-sqlite3`.
- Playwright Chromium: login/session/scrape Threads và render screenshot card.
- OpenAI Node SDK: chat completion cho phân tích và keyword discovery.
- OpenAI audio speech API: TTS cho voiceover video.
- FFmpeg/ffprobe: render video, probe duration, thumbnail.

### 3.2. Các command quan trọng

```bash
npm.cmd install
npm.cmd run scraper:install
copy .env.example .env
npm.cmd run db:init
npm.cmd run dev
```

Các command kiểm tra/phát triển:

```bash
npm.cmd run typecheck
npm.cmd run build
npm.cmd start
```

Trên máy Windows/PowerShell, README khuyến nghị dùng `npm.cmd` thay vì `npm` nếu PowerShell policy chặn `npm.ps1`.

## 4. Cấu trúc thư mục

```text
.
├── data/
│   ├── app.sqlite                 # SQLite local DB
│   ├── threads-browser-profile    # Playwright persistent browser profile
│   ├── threads-session.json       # Cookie/session snapshot
│   ├── video-resources            # Background clip auto-sync vào Asset Library
│   ├── video-thumbnails           # Thumbnail asset
│   └── video-exports              # Output video draft
├── docs/
│   ├── architecture.md
│   ├── database-schema.sql
│   ├── requirements-v2-implementation.md
│   ├── tool-feature-audit.md
│   └── project-documentation.md
├── scripts/
│   ├── debug-post-containers.ts
│   ├── debug-threads.ts
│   └── test-fetch-threads.ts
├── src/
│   ├── app/                       # Next.js renderer entry
│   ├── components/                # UI components
│   ├── electron/                  # Electron main/preload
│   ├── lib/                       # Shared types, i18n, utils, model options
│   ├── server/                    # Local backend services
│   └── styles/
└── package.json
```

## 5. Kiến trúc tổng thể

Renderer không truy cập Node trực tiếp. Tất cả tác vụ nhạy cảm đi qua Electron preload bridge:

```text
React UI
  -> window.desktopAPI
  -> Electron preload
  -> ipcMain handlers
  -> server services
  -> SQLite / Playwright / OpenAI / FFmpeg / filesystem
```

### 5.1. Electron boundary

File chính:

- `src/electron/main.ts`
- `src/electron/preload.ts`

`preload.ts` expose `desktopAPI` với các nhóm action:

- Threads: fetch, import post, fetch replies, login, check login, open post.
- Opportunities: scan opportunity inbox, listen scan progress.
- AI: analyze post, test OpenAI.
- Posts: list, save, unsave, saved list.
- Keywords: CRUD, insights, AI discovery, exclusions.
- Settings: get/update.
- Ideas: export saved ideas.
- Video: render draft, listen render progress, open output folder.
- Assets: list/add/delete/preview.
- Upload logs: list/save/delete.

### 5.2. Process ownership

Renderer sở hữu:

- State UI.
- Navigation giữa views.
- Form input.
- Modal TikTok brief.
- Filter/sort hiển thị.

Electron/server sở hữu:

- DB schema/migration.
- Threads session/profile.
- Playwright scraping.
- OpenAI calls.
- FFmpeg calls.
- File picker/open folder/open external link.
- Asset thumbnail generation.
- Secret encryption.

## 6. Các màn hình hiện có

### 6.1. Home / Opportunity Inbox

Component: `src/components/opportunities/opportunity-inbox.tsx`

Vai trò: màn hình chính để xem shortlist cơ hội hôm nay.

Hiện có:

- Metrics: `Make Now`, `Watch`, `Ready to Create`, `Tracked Results`.
- Nút `Scan Opportunities`.
- Progress bar khi scan keyword/AI/cleanup.
- Shortlist tối đa 8 post đã có AI analysis và verdict không phải `skip`.
- Mỗi item hiển thị:
  - author
  - keyword
  - source post content
  - lý do đáng làm
  - sản phẩm/direction
  - hook gợi ý
  - create content
  - inspect
  - save
  - open link

Shortlist sort theo:

```text
verdict priority + AI confidence + local opportunity score
```

Trong đó `make_now` được ưu tiên cao hơn `watch`.

### 6.2. Trending / Explore Posts

Code chính nằm trong `src/app/page.tsx`, component phụ `FeedView`, `FeedCard`, `AnalysisPanel`.

Vai trò: feed nghiên cứu thủ công.

Hiện có:

- Fetch toolbar:
  - keyword
  - hashtag
  - profile
  - home
  - trending
- Search trong post đã fetch.
- Manual import một link Threads permalink.
- Filter:
  - replies >= 10
  - trend `EMERGING` hoặc `GROWING`
  - video potential >= 70
- Sort nhanh theo replies.
- Feed card hiển thị:
  - author/handle
  - emotion category
  - keyword
  - growth badge
  - trend state
  - opportunity score ring
  - content
  - image URLs nếu có
  - likes/replies/reposts
  - analyze
  - save
  - generate TikTok idea
  - open link
  - load/show replies
- Analysis side panel hiển thị:
  - verdict
  - buying intent
  - why viral
  - emotion/pain point
  - affiliate categories/products
  - personas/situations
  - demo angle/content format
  - reject reason nếu skip
  - hooks/CTAs
  - technical scores

### 6.3. Saved Posts

Saved Posts dùng lại feed view nhưng chỉ hiển thị post đã bookmark trong `saved_posts`.

Hiện có:

- Save/unsave collection `Inbox`.
- Tags lưu từ emotional category và keyword/source.
- Feed, analyze, open link, TikTok brief như Trending.

### 6.4. Keywords

Component: `src/components/keywords/keyword-manager.tsx`

Vai trò: quản lý nguồn scan.

Hiện có hai mode:

1. AI Discovery
2. Add Manually

AI Discovery:

- Chọn audience preset:
  - office women
  - students
  - glasses wearers
  - oily skin
  - small-space renters
  - sleep comfort
  - active people
  - young moms
- Nhập refine seed tùy chọn.
- Discover pain points từ audience.
- Expand from winners dựa trên bài/analysis tốt và upload log có kết quả.
- Add từng suggestion hoặc add all.

Manual:

- Thêm keyword thủ công.

Keyword Portfolio:

- List keyword đã lưu.
- Sort theo status/score/name.
- Edit phrase.
- Delete keyword.
- Toggle enabled/disabled.
- Fetch keyword ngay.
- Badge nguồn:
  - manual
  - default/starter
  - AI audience
  - AI expansion
- Badge status:
  - potential
  - testing
  - poor
- Metrics:
  - scans
  - posts found
  - make now
  - product fit rate
  - orders
- Gợi ý disable keyword kém.

Excluded Terms:

- Thêm/xóa phrase loại trừ.
- Scanner loại các post có content/keyword chứa excluded phrase khỏi shortlist.

### 6.5. Kho clip / Asset Library

Code trong `AssetLibraryView` và `src/server/services/assetLibraryService.ts`.

Vai trò: quản lý clip nền retention và clip demo sản phẩm.

Hiện có:

- Hai loại asset: `background`, `product`.
- Add clip qua file picker.
- Auto-sync video trong `data/video-resources` thành background asset.
- Probe duration bằng `ffprobe`.
- Generate thumbnail bằng `ffmpeg`.
- Preview clip bằng app mặc định của hệ điều hành.
- Delete asset khỏi DB và xóa thumbnail local.
- Đếm số lần dùng asset khi render video.

Lưu ý: delete asset hiện chỉ xóa registration/thumbnail, không xóa file video gốc.

### 6.6. Results / Upload Log

Component: `src/components/results/results-view.tsx`

Vai trò: ghi performance sau khi người dùng upload thủ công.

Hiện có:

- Add/edit/delete upload log.
- Chọn source post.
- Lưu:
  - TikTok URL
  - product name
  - hook
  - content format
  - uploaded_at
  - views
  - clicks
  - orders
  - revenue
  - commission
  - status
  - notes
- Dashboard tổng:
  - total views
  - click rate
  - click-to-order conversion
  - total commission
- Learned signals:
  - top winners theo commission/orders.

Phần này quan trọng vì `getAffiliatePerformanceContext()` đưa các kết quả thắng vào prompt AI sau này.

### 6.7. Settings

Code UI hiện expose:

- OpenAI API key.
- OpenAI model.
- OpenAI billing link.
- Threads Login.
- Check Threads session.
- Language `en`/`vi`.
- Auto scan while app is open.
- Auto scan interval: 30 min, 1 hour, 3 hours.
- Scan when app opens.

Backend settings còn hỗ trợ thêm:

- TikTok channel name.
- Default TTS voice.
- Default TTS speed.
- Transition sound enabled.
- Post age hours.

Nhưng các setting video/scraper nâng cao này hiện chưa có control đầy đủ trong Settings UI. Code dùng default hoặc giá trị đã tồn tại trong DB.

## 7. Workflow chính của app

### 7.1. Fetch thủ công

Luồng code:

```text
UI FetchToolbar
  -> desktopAPI.fetchThreads()
  -> ipcMain 'threads:fetch'
  -> fetchAndStoreThreads()
  -> fetchThreadsPosts()
  -> scorePost()
  -> upsertPosts()
  -> recordEngagementSnapshots()
  -> listPosts()
  -> UI mergePosts()
```

Chi tiết:

1. Tạo fetch log `running`.
2. Playwright mở Threads bằng persistent context.
3. Điều hướng theo mode/query.
4. Nếu cần login thì throw error.
5. Chờ DOM và collect posts.
6. Attach top replies cho một số post có nhiều replies.
7. Enrich velocity từ snapshot cũ.
8. Chấm điểm local.
9. Upsert SQLite.
10. Ghi engagement snapshot.
11. Xóa legacy posts cho keyword nếu đã có permalink tốt.
12. Prune data cũ không dùng.
13. Finish fetch log.
14. Return posts, newPosts, seenPosts.

### 7.2. Manual import link Threads

Luồng:

```text
Paste Threads permalink
  -> importThreadsPost()
  -> fetchThreadsPostByUrl()
  -> extract exact post
  -> fetch top replies
  -> score/upsert/snapshot
  -> auto analyze nếu chưa có analysis
```

Chỉ nhận URL dạng:

```text
https://www.threads.com/@account/post/ABC123
https://www.threads.net/@account/post/ABC123
```

### 7.3. Opportunity scan

Code: `src/server/services/opportunityScanService.ts`

Các hằng số hiện tại:

```text
MAX_KEYWORDS_PER_SCAN = 12
POSTS_PER_KEYWORD = 14
MAX_AI_ANALYSES_PER_SCAN = 8
MIN_OPPORTUNITY_FOR_AI = 35
```

Luồng:

1. Lấy keyword đang enabled.
2. Ưu tiên keyword chưa từng fetch, sau đó sort theo keyword insight score.
3. Lấy tối đa 12 keyword.
4. Với mỗi keyword:
   - fetch tối đa 14 posts
   - cộng fetched/new/seen
   - lưu latest scan posts
   - mark keyword fetched
   - delay 900 ms
5. Lọc post để shortlist:
   - opportunity score >= 15
   - tuổi post <= `postAgeHours` mặc định 24h
   - không chứa excluded terms
6. Load analysis đã có.
7. Nếu có OpenAI key:
   - chọn post opportunity >= 35
   - chưa có analysis hoặc confidence = 0
   - ưu tiên bài trong latest scan
   - tối đa 8 bài
   - chạy AI analysis
8. Prune unused research data.
9. Return posts, latestScanPosts, analyses, keyword count, fetched/analyzed/new/seen/pruned/errors.

Nếu chưa có OpenAI key, scan vẫn có thể fetch và score local nhưng không tạo AI shortlist mới.

### 7.4. AI affiliate analysis

Code: `src/server/ai/affiliateAnalysisService.ts`

Input AI:

- Post content.
- Author.
- Likes/replies/reposts.
- Timestamp.
- Trend state.
- Likes/replies per hour.
- Local scores.
- Emotional category.
- Top replies.
- Performance history từ upload logs.
- Prompt chiến lược TikTok affiliate cho thị trường Việt Nam.

Output normalized:

- verdict: `make_now`, `watch`, `skip`
- confidence score
- emotion
- pain point
- buying intent
- affiliate fit score
- personas
- situations
- affiliate categories
- affiliate products
- content angle
- demo angle
- content format
- solution script
- product search keywords
- script outline
- why viral
- hooks
- CTAs
- relatability score
- controversy score
- reject reason
- comment classifications
- best replies
- video potential score/breakdown
- TikTok caption
- hashtags
- marketplace keywords
- video script:
  - post read version
  - transition line
  - solution text
  - CTA text
  - caption variants

Sau khi lưu analysis, code update lại `threads_posts.video_potential_score` và `opportunity_score` theo video potential từ AI. Code hiện không overwrite `threads_posts.affiliate_fit_score` bằng AI affiliate fit score; local affiliate fit vẫn là nguồn chính trong post table.

### 7.5. AI keyword discovery

Code: `src/server/ai/keywordIntelligenceService.ts`

Input:

- Audience preset/seed.
- Existing keywords.
- Excluded terms.
- Strong post signals từ posts + analyses.
- Channel sales signals từ upload logs.

Output:

- Up to 10 keyword suggestions.
- Mỗi suggestion gồm phrase, pain point, reason, evidence.

Filter sau AI:

- Không trùng keyword hiện có.
- Không trùng suggestion trong cùng response.
- Không chứa excluded terms.

### 7.6. TikTok brief và video draft

UI: `src/components/analysis/tiktok-brief-modal.tsx`

Renderer: `src/server/video/videoDraftService.ts`

Người dùng có thể edit trước khi render:

- Hook opening.
- Post read version.
- Replies được đọc, có thể reorder/delete.
- Transition.
- CTA.
- Solution text.
- Background clip.
- Product clip optional.

Render flow:

1. Kiểm tra OpenAI API key.
2. Kiểm tra background clip tồn tại.
3. Tạo export folder:

```text
data/video-exports/<post_id>/
```

4. Tạo voiceover bằng OpenAI TTS model `gpt-4o-mini-tts`.
5. Render card ảnh bằng Playwright screenshot:
   - hook text card
   - post card
   - reply cards
   - transition card
   - solution card
   - product overlay nếu có product clip
   - outro card
6. Render từng segment bằng FFmpeg:
   - scale/crop background về 1080x1920
   - overlay card
   - map audio
7. Nếu có product demo clip:
   - overlay product text lên demo clip
   - silent audio track
8. Concat segments.
9. Tạo output:

```text
data/video-exports/<post_id>/affiliate-video-final.mp4
data/video-exports/<post_id>/tiktok-metadata.json
data/video-exports/<post_id>/upload-checklist.txt
data/video-exports/<post_id>/thumbnails/thumb_001.jpg
data/video-exports/<post_id>/thumbnails/thumb_002.jpg
data/video-exports/<post_id>/thumbnails/thumb_003.jpg
```

## 8. Scoring hiện tại

Code: `src/server/scoring/trendingScore.ts`

### 8.1. Viral score

Viral score tối đa 100, cộng từ:

- Likes velocity: tối đa 25.
- Replies: tối đa 18.
- Reposts: tối đa 20.
- Emotional wording: tối đa 14.
- Controversial wording: tối đa 12.
- Relatability: tối đa 11.

Text được normalize:

- lowercase
- bỏ dấu Unicode
- thay `đ` thành `d`
- gom whitespace

### 8.2. Affiliate fit local

Tín hiệu local gồm:

- Pain point clarity.
- Product solvability.
- Demo potential.
- Audience clarity.
- Buying intent.
- Reply volume bonus.
- Top reply bonus nếu có reply >= 50 likes.
- Age bonus nếu post dưới 24h.

Điểm thực tế hiện được tính chủ yếu từ:

```text
painPointClarity
+ productSolvability
+ reply bonus nếu replies >= 10
+ topReplyBonus
+ ageBonus
+ buyingIntent
```

Nếu post rơi vào excluded terms hoặc không có pain point/buying intent hoặc không có product solvability, affiliate fit bị set về 0.

### 8.3. Video potential score

Tính local từ:

- Demo terms: tối đa 35.
- Emotional terms: tối đa 25.
- Controversial terms: tối đa 15.
- Pain point terms: tối đa 25.

AI analysis cũng trả về video potential score; sau khi lưu analysis, video potential trong post table được cập nhật từ AI.

### 8.4. Trend velocity score

Trend state map:

```text
EMERGING  -> 90
GROWING   -> 75
PEAK      -> 50
DECLINING -> 20
DEAD      -> 0
```

Trend state dựa trên:

- Tuổi post.
- Likes/hour hiện tại.
- Rate snapshot trước đó.
- Rate snapshot cũ hơn.

### 8.5. Opportunity score

Công thức code hiện tại:

```text
opportunityScore =
  affiliateFitScore * 0.4
  + videoPotentialScore * 0.3
  + velocityScore * 0.2
  + viralScore * 0.1
```

Điều này khác một số tài liệu cũ trong repo. Source of truth hiện tại là `src/server/scoring/trendingScore.ts` và đoạn update trong `storeAnalysis()`.

## 9. Scraper Threads hiện tại

Code: `src/server/scraper/threadsScraper.ts`

### 9.1. Login/session

- Dùng Playwright Chromium persistent context.
- Profile lưu ở `data/threads-browser-profile`.
- Storage state lưu ở `data/threads-session.json`.
- Login mở browser non-headless để người dùng tự đăng nhập.
- Fetch chạy headless.
- Có check login required qua URL `/login` hoặc password input.
- Có đọc/lưu account name vào `threads-account.json`.

### 9.2. Fetch modes

```text
home      -> https://www.threads.com/
keyword   -> https://www.threads.com/search?q=<query>
hashtag   -> https://www.threads.com/t/<tag>
profile   -> https://www.threads.com/@<account>
trending  -> fixed pseudo query: people with always struggle
manual    -> exact normalized post permalink
```

`trending` hiện không phải feed trending chính thức của Threads. Nó là query cố định để tìm dạng nội dung pain point.

### 9.3. Extract post

Scraper ưu tiên parse anchors có permalink:

- Tìm link `threads.com/@.../post/...` hoặc `threads.net/@.../post/...`.
- Tìm container cha.
- Parse author, content, metrics, timestamp, images.
- Nếu không có anchor parse được thì fallback sang DOM containers hoặc text feed.
- Scroll tối đa 8 lần.
- Dedupe bằng post id/permalink.

### 9.4. Extract replies

- Tự attach top replies cho posts có replies >= 10.
- Chỉ xử lý tối đa 8 post trong một fetch.
- Mỗi post lấy tối đa 10 replies.
- Replies được filter content rác và sort theo likes.
- Manual `Load replies` có thể refresh replies cho một post cụ thể.

### 9.5. Giới hạn scraper

Scraper là phần rủi ro nhất vì Threads không cung cấp public API ổn định cho use case này.

Giới hạn hiện tại:

- DOM selector có thể hỏng khi Threads đổi UI.
- Metrics có thể sai thứ tự nếu Threads đổi layout.
- Timestamp locale/format cần test liên tục.
- Image extraction có thể lấy sót carousel hoặc media đặc biệt.
- Có filter avatar nhưng vẫn có thể sai trong một số layout.
- Reply extraction phụ thuộc nhiều vào container DOM.
- Không có health check selector định kỳ.
- Không có test tự động regression cho scraper.
- Không nên xem mode `trending` là trending thật.

## 10. Database hiện tại

Source of truth schema: `src/server/db/schema.ts`

Lưu ý: `docs/database-schema.sql` có thể stale so với schema runtime vì thiếu một số field mới của `ai_analysis`.

### 10.1. `threads_posts`

Lưu bài Threads:

- id
- author
- author_handle
- content
- likes
- replies
- reposts
- timestamp
- image_urls
- url
- source
- keyword
- fetched_at
- trending_score
- affiliate_fit_score
- opportunity_score
- velocity_score
- engagement_growth_percent
- emotional_category
- top_replies
- trend_state
- likes_per_hour
- replies_per_hour
- video_potential_score

Indexes:

- trending score
- opportunity score
- keyword
- fetched_at

### 10.2. `ai_analysis`

Lưu kết quả AI:

- post_id
- verdict
- confidence_score
- emotion
- pain_point
- buying_intent
- affiliate_categories
- affiliate_products
- content_angle
- why_viral
- hooks
- ctas
- relatability_score
- controversy_score
- affiliate_fit_score
- personas
- situations
- demo_angle
- content_format
- solution_script
- product_search_keywords
- script_outline
- reject_reason
- comment_classifications
- best_replies
- video_potential_score
- video_potential_breakdown
- tiktok_caption
- hashtags
- product_keywords
- video_script
- created_at

### 10.3. `engagement_snapshots`

Lưu lịch sử tương tác để tính velocity/growth:

- id
- post_id
- likes
- replies
- reposts
- captured_at

### 10.4. `saved_posts`

Bookmark post:

- post_id
- collection
- tags
- saved_at

### 10.5. `keywords`

Nguồn scan:

- id
- phrase
- enabled
- cadence_minutes
- last_fetched_at
- source
- seed_audience
- created_at

### 10.6. `keyword_exclusions`

Phrase loại trừ khỏi shortlist:

- id
- phrase

### 10.7. `fetch_logs`

Lịch sử fetch:

- id
- mode
- query
- status
- message
- post_count
- started_at
- finished_at

### 10.8. `app_settings`

Key/value settings local:

- OpenAI key/model.
- Language.
- Auto scan.
- Video defaults.
- Scraper post age.
- Default keyword seeded flag.

### 10.9. `asset_library`

Clip local:

- id
- type
- label
- file_path
- duration_secs
- times_used
- last_used_at

### 10.10. `upload_log`

Performance sau publish:

- id
- post_id
- tiktok_url
- product_name
- hook
- content_format
- uploaded_at
- views
- clicks
- orders
- revenue
- commission
- status
- note

## 11. Data retention và cleanup

`getDb()` tự chạy:

- create schema
- migrate schema
- prune unused research data
- rescore stored posts
- seed default keywords

Prune logic:

- Xóa post cũ hơn 7 ngày nếu không được save, không có analysis, không có upload log.
- Giữ tối đa 20 unused posts mới nhất.
- Xóa fetch logs cũ hơn 30 ngày.

Các post đã saved/analyzed/uploaded được bảo vệ khỏi prune.

## 12. Security và privacy

### 12.1. Local-first

Dữ liệu chính lưu local:

- SQLite trong `data/app.sqlite`.
- Threads browser profile/session trong `data/`.
- Video output trong `data/video-exports`.
- Asset thumbnails trong `data/video-thumbnails`.

### 12.2. OpenAI data flow

Nội dung gửi tới OpenAI:

- Post content.
- Metrics.
- Top replies.
- Performance context từ upload logs.
- Prompt phân tích affiliate.
- Text để tạo TTS.

Không nên nhập dữ liệu nhạy cảm vào post/result nếu không muốn gửi dữ liệu đó sang OpenAI khi analyze hoặc render voice.

### 12.3. API key

Code hiện lưu API key qua Electron `safeStorage`:

- `setOpenAiApiKey()` gọi `encryptSecret()`.
- Nếu `safeStorage` không khả dụng, save API key sẽ throw error.
- `getOpenAiApiKey()` vẫn có fallback đọc `OPENAI_API_KEY` từ env.
- Plaintext key cũ nếu còn trong DB vẫn có thể được đọc để backward compatibility, nhưng đường save mới yêu cầu secure storage.

### 12.4. Safety boundary

Code hiện không có:

- Auto-post TikTok.
- Auto-comment/like/follow Threads.
- Fake engagement.
- Background cloud worker.
- Aggressive scraper loop khi app đóng.

Open output folder có guard path: chỉ mở file nằm trong `data/video-exports`.

## 13. Đã cover được gì

### 13.1. Product workflow

Đã cover MVP end-to-end:

- Login Threads local.
- Fetch Threads theo nhiều mode.
- Import exact post link.
- Store posts local.
- Store engagement snapshots.
- Local scoring.
- Keyword management.
- AI keyword discovery.
- AI affiliate analysis.
- Opportunity inbox.
- Saved posts.
- TikTok/Reels brief.
- Reply loading/drawer.
- Asset library.
- Local video draft render.
- Metadata/checklist/thumbnails.
- Upload log/results.
- Future AI context từ winners.

### 13.2. Backend/infrastructure

Đã cover:

- Electron IPC boundary.
- TypeScript shared types cho desktop API.
- SQLite schema + migration.
- Default keyword seed.
- App settings.
- Encrypted API key storage nếu safeStorage có sẵn.
- Retry wrapper cho OpenAI/Threads/FFmpeg flows.
- Fetch logs.
- Data cleanup.
- FFmpeg integration.
- Playwright login/scrape/render screenshot.

### 13.3. UI/UX

Đã cover:

- Dashboard dark UI.
- Sidebar navigation.
- Loading/progress states cho scan và video render.
- Error/health messages.
- Keyboard shortcuts cơ bản:
  - `/` focus search
  - `a` analyze selected post
- Modal brief có pre-render editing.
- Asset thumbnails.
- Results metrics.

## 14. Đã cover một phần nhưng chưa hoàn chỉnh

### 14.1. Scheduler

Có auto scan interval trong renderer, nhưng chỉ chạy khi app đang mở. Không có background worker khi Electron đóng, không có OS-level scheduled task, không có cloud queue.

### 14.2. Video settings

Backend có default voice/speed/TikTok channel/transition sound/post age. UI hiện chưa expose đầy đủ các control này.

### 14.3. Video editor

Có pre-render editor dạng form:

- sửa hook
- sửa post read version
- reorder/delete replies
- sửa transition
- sửa solution
- sửa CTA
- chọn clip

Nhưng chưa có:

- timeline editor
- live preview video trong app
- waveform/audio preview
- per-scene duration editor
- text positioning editor
- template system

### 14.4. Scraper quality

Có scraper hoạt động theo DOM hiện tại và có debug scripts. Nhưng chưa có:

- test regression tự động
- selector health dashboard
- fallback API chính thức
- warning chi tiết khi DOM Threads đổi

### 14.5. AI ranking

AI trả affiliate fit score, video potential, verdict, confidence. Tuy nhiên post table hiện chỉ cập nhật video potential/opportunity score sau analysis, chưa đồng bộ đầy đủ AI affiliate fit vào ranking. Home shortlist có dùng AI verdict/confidence, còn feed vẫn chủ yếu dựa vào local opportunity score.

### 14.6. Docs

Repo có README và docs cũ, nhưng một số nội dung đã lệch code hiện tại:

- Số bài auto AI analysis trong scan hiện là 8, không phải 3.
- Opportunity score hiện là 40/30/20/10, không phải công thức cũ.
- Output video hiện là `affiliate-video-final.mp4`.
- Runtime schema trong `src/server/db/schema.ts` có nhiều field hơn `docs/database-schema.sql`.
- Một số file docs/source strings hiển thị lỗi encoding khi đọc qua terminal, cần chuẩn hóa UTF-8 nếu muốn làm tài liệu chính thức.

## 15. Chưa cover / ngoài phạm vi hiện tại

Chưa cover:

- Auto-post TikTok/Reels.
- Auto attach TikTok Shop affiliate product.
- Crawl TikTok Shop/Shopee.
- Tạo affiliate link.
- Product catalog manager.
- Multi-account Threads/TikTok.
- Cloud sync.
- Team workspace.
- Full analytics attribution.
- A/B testing tự động.
- Comment moderation.
- Official OAuth/API integration.
- Installer/package release.
- CI test pipeline rõ ràng.
- Automated unit/integration/e2e tests.
- Backup/restore SQLite trong UI.
- Reset local data/session trong UI.
- Cost estimate trước khi AI analyze hoặc TTS render.
- Quota/budget guard cho OpenAI.
- Transition sound burn-in dù setting đã tồn tại.
- Drag/drop upload asset.
- In-app video playback preview.
- Render history UI.

## 16. Strategic gap: đã develop tới đây nhưng vẫn thiếu gì để build video kiếm tiền

Dù dự án đã có workflow end-to-end, vẫn có một khoảng trống chiến lược quan trọng: pipeline hiện tại giúp tìm post, phân tích pain point, tạo brief và render video nháp, nhưng chưa chứng minh rằng video tạo ra sẽ đủ mạnh để kiếm tiền đều. Nói cách khác, app đã có "máy sản xuất draft", nhưng chưa có đủ "hệ thống chọn offer, chứng minh nhu cầu, tối ưu creative và đo conversion" để biến draft thành video affiliate có doanh thu ổn định.

Các phần có vẻ còn thiếu để video thật sự kiếm tiền:

- Offer/product validation: AI đang gợi ý loại sản phẩm, nhưng chưa xác thực sản phẩm cụ thể có bán được, có rating tốt, có giá/commission hợp lý, có tồn kho, có visual demo mạnh và có affiliate link sẵn.
- Conversion angle: brief hiện tập trung vào pain point và hook, nhưng chưa có framework rõ để biến người xem từ "đồng cảm" sang "muốn click/mua".
- Creative pattern library: app chưa có thư viện pattern video thắng theo niche, ví dụ problem/solution, comment compilation, before/after, myth busting, top 3, daily routine, comparison, regret/lesson.
- Video quality bar: renderer tạo được video draft, nhưng chưa đảm bảo nhịp dựng, pacing, retention, visual proof, product demonstration và CTA đủ cạnh tranh với content thật trên TikTok/Reels.
- Marketplace/product loop: chưa có bước lấy sản phẩm thật từ TikTok Shop/Shopee/Amazon, kiểm tra link, commission, price, review, fulfillment và claim compliance.
- Testing system: chưa có kế hoạch test nhiều biến thể hook/offer/format, chưa có tiêu chí kill/scale video sau khi đăng.
- Attribution: upload log có views/clicks/orders, nhưng chưa liên kết đủ chặt với từng creative variable để biết vì sao video thắng hoặc thua.
- Compliance/review: chưa có checklist claim, policy, category risk, medical/financial claims, copyright asset, disclosure affiliate.

Vì vậy, trạng thái hiện tại nên được hiểu là:

```text
Đã có automation nền tảng để tìm insight và tạo video nháp.
Chưa đủ để gọi là money-making video engine hoàn chỉnh.
Cần thêm tầng offer validation, creative strategy, conversion testing và marketplace workflow.
```

Tài liệu brief riêng để gửi AI khác advise thêm: [`docs/ai-advice-brief.md`](ai-advice-brief.md).

## 17. Expected behavior đúng

### 17.1. Khi setup đúng

Kỳ vọng:

- App mở bằng Electron, không chỉ browser Next.js.
- `window.desktopAPI` có sẵn.
- SQLite tự init khi app ready.
- Default keywords được seed nếu DB chưa có keyword.
- Người dùng login Threads một lần bằng Settings.
- Session/profile được reuse giữa các lần chạy.
- Fetch keyword trả bài nếu Threads session còn hợp lệ và DOM parse được.
- Analyze chạy nếu OpenAI key hợp lệ.
- Video render chạy nếu:
  - OpenAI key hợp lệ
  - FFmpeg/ffprobe nằm trong PATH
  - background clip tồn tại

### 17.2. Khi thiếu Threads session

Kỳ vọng:

- Fetch/import/replies fail với message yêu cầu login.
- Người dùng vào Settings -> Threads Login.
- Sau login, check session báo có session/profile.

### 17.3. Khi thiếu OpenAI key

Kỳ vọng:

- Fetch/local scoring vẫn chạy.
- AI analyze fail với message thiếu API key.
- Keyword discovery fail với message thiếu API key.
- Video render fail vì TTS cần OpenAI key.
- Opportunity scan vẫn có thể fetch, nhưng không auto-analyze bài mới.

### 17.4. Khi thiếu FFmpeg/ffprobe

Kỳ vọng:

- App vẫn mở và fetch/analyze được.
- Asset duration/thumbnail có thể fail.
- Video render fail với message yêu cầu cài FFmpeg và thêm vào PATH.

### 17.5. Khi Threads đổi DOM

Kỳ vọng:

- Fetch có thể trả ít bài hoặc no posts.
- Một số metrics/replies/images có thể sai.
- Cần chạy debug scripts để inspect DOM mới.

Các script hỗ trợ:

```bash
npx tsx scripts/test-fetch-threads.ts "keyword"
npx tsx scripts/debug-threads.ts "https://www.threads.com/search?q=keyword"
npx tsx scripts/debug-post-containers.ts "https://www.threads.com/search?q=keyword"
```

## 18. Expected product target

Target sản phẩm quan trọng nhất là chuyển dự án từ MVP nghiên cứu local thành một tool automation kiếm tiền affiliate. "Thụ động" ở đây được hiểu theo hướng hệ thống tự động hóa phần lớn việc tìm cơ hội, tạo ý tưởng, dựng bản nháp và học từ dữ liệu kết quả; người dùng vẫn cần kiểm duyệt, chọn sản phẩm thật, đăng nội dung đúng luật nền tảng và tối ưu chiến lược.

### 18.1. MVP target hiện tại

MVP nên được đánh giá là đạt nếu:

- Người dùng scan được một nhóm keyword.
- App trả về shortlist ít nhiễu hơn việc đọc Threads thủ công.
- Mỗi item shortlist có pain point, sản phẩm gợi ý, hook và CTA đủ cụ thể.
- Người dùng tạo được brief/video draft để chỉnh tiếp thủ công.
- Người dùng ghi được performance sau khi đăng.
- Lần phân tích sau có thể học từ video thắng.
- Người dùng nhìn thấy rõ dự án đã đi tới một quy trình kiếm tiền affiliate gần khép kín, dù vẫn còn các bước cần thao tác thủ công.

### 18.2. Target chất lượng ngắn hạn

Trước khi mở rộng automation, cần ưu tiên:

1. Scraper lấy đúng bài, đúng metric, đúng permalink.
2. Scoring/shortlist không bị ngập trong bài viral nhưng không bán được gì.
3. AI output đủ cụ thể để tìm sản phẩm thật trên marketplace.
4. Video draft giảm thời gian dựng, dù vẫn cần review thủ công.
5. User kiểm soát được chi phí OpenAI.

### 18.3. Target dài hạn

Nếu phát triển tiếp, app có thể trở thành:

- Affiliate automation engine hướng tới doanh thu thụ động/bán thụ động.
- Affiliate opportunity research cockpit.
- Keyword intelligence system cho thị trường Việt Nam.
- Content brief generator dựa trên social pain points.
- Local video draft factory.
- Performance feedback loop cho từng kênh TikTok/Reels.
- Một hệ thống tối ưu vòng lặp nội dung: tìm insight, tạo video, đo kết quả, nhân rộng pattern thắng.

Nhưng vẫn nên giữ boundary an toàn: manual review/manual upload/manual product linking.

## 19. Roadmap đề xuất

### P0: Độ tin cậy dữ liệu Threads

- Thêm scraper health check.
- Ghi fetch log ra UI rõ hơn.
- Phân biệt:
  - post mới lần đầu thấy
  - post đã thấy nhưng được refresh
  - post đang tăng nhanh
- Test lại timestamp Việt Nam.
- Test carousel/media.
- Tách avatar khỏi post media chắc hơn.
- Thêm regression fixtures cho DOM Threads.
- Cảnh báo khi selector trả bất thường.

### P1: Shortlist chính xác hơn

- Đồng bộ AI affiliate fit vào ranking hoặc tạo `ai_opportunity_score` riêng.
- Filter theo verdict/confidence/product fit/video potential.
- Hiển thị reason ngắn ngay trên feed.
- Cho chọn số bài AI analyze mỗi scan.
- Thêm cost estimate cho scan.
- Thêm regenerate riêng cho:
  - hooks
  - solution script
  - product keywords
  - video script

### P2: Video draft usable hơn

- In-app video preview.
- Render history.
- Chọn voice/speed trong UI.
- Dynamic card scaling cho post dài.
- Per-scene preview.
- Template style cho card/video.
- Product clip trim/crop.
- Transition sound thật sự được burn vào video nếu setting bật.
- Re-render nhanh từ output cũ.

### P3: Production readiness

- Chuẩn hóa UTF-8 cho docs/source copy.
- Update README theo trạng thái mới.
- Đồng bộ `docs/database-schema.sql` từ runtime schema.
- Thêm unit tests cho scoring/db mappers.
- Thêm integration tests mock scraper/OpenAI.
- Thêm smoke test build Electron.
- SQLite backup/restore/reset UI.
- Installer build.
- Error boundary UI.
- Local logs dễ gửi khi debug.

## 20. Rủi ro chính

### 20.1. Rủi ro platform

Threads có thể đổi DOM, login flow, rate limit hoặc domain behavior. Scraper không có hợp đồng API ổn định.

### 20.2. Rủi ro dữ liệu

Nếu metrics/replies/timestamp sai, local scoring và AI triage phía sau cũng sai.

### 20.3. Rủi ro AI hallucination

AI có thể gợi ý sản phẩm không thật, claim quá mức hoặc keyword marketplace không chuẩn. Prompt đã cố giảm rủi ro, nhưng vẫn cần review thủ công.

### 20.4. Rủi ro compliance

Auto-post/fake engagement không được implement. Nếu sau này thêm automation, cần xét kỹ Terms of Service, platform limits và policy.

### 20.5. Rủi ro chi phí

Scan có thể gọi AI tối đa 8 bài/lần. Video render gọi TTS nhiều segment. Chưa có cost estimate/quota guard.

## 21. Checklist review dự án

Dùng checklist này để đánh giá phiên bản tiếp theo:

- [ ] Fetch keyword có trả đúng post public Threads không?
- [ ] Permalink có mở được đúng bài gốc không?
- [ ] Metrics likes/replies/reposts có hợp lý không?
- [ ] Top replies có phải reply thật và có nội dung hữu ích không?
- [ ] Opportunity score có ưu tiên pain point bán được không?
- [ ] Home shortlist có ít nhiễu hơn feed thô không?
- [ ] AI có gợi ý sản phẩm cụ thể, dễ tìm, dễ demo không?
- [ ] Hook/solution/CTA nghe tự nhiên với thị trường Việt Nam không?
- [ ] Video draft có dùng đúng background/product clip không?
- [ ] Output video, metadata, checklist, thumbnails có được tạo đủ không?
- [ ] Upload log có ảnh hưởng tới AI context lần sau không?
- [ ] Auto scan có chạy đúng khi app mở và dừng khi app đóng không?
- [ ] Khi thiếu login/API key/FFmpeg, message có dễ hiểu không?
- [ ] Có kiểm soát được chi phí AI/TTS không?

## 22. Kết luận

Code hiện tại đã vượt qua mức prototype UI đơn giản. Dự án có một workflow local khá đầy đủ từ discovery đến brief, video draft và performance feedback. Phần giá trị nhất hiện nằm ở vòng lặp:

```text
Threads pain point
  -> local + AI filtering
  -> affiliate content idea
  -> video draft
  -> real performance result
  -> improved future recommendation
```

Việc nên làm tiếp không phải là thêm auto-post ngay, mà là làm chắc dữ liệu đầu vào, làm shortlist đáng tin hơn và làm video draft đủ tiện để tiết kiệm thời gian dựng thật. Khi ba phần đó ổn, automation phía sau mới có nền móng rõ ràng.
