# Implementation Spec — Threads Affiliate Trend Finder

Tài liệu này tổng hợp toàn bộ các nâng cấp đã thống nhất, dùng làm brief cho Claude Code.
Repo: `AffiliateAutomationSystem` (Electron + Next.js 14 static export + SQLite + Playwright + OpenAI + FFmpeg).

## Nguyên tắc chung (áp dụng cho mọi phase)

- Giữ kiến trúc hiện tại: Renderer -> `window.desktopAPI` -> preload -> ipcMain -> server services. Không cho renderer truy cập Node trực tiếp.
- Không thêm auto-post TikTok, không fake engagement, không background worker khi app đóng.
- Mọi thay đổi schema phải đi qua migration trong `src/server/db/schema.ts` (source of truth), backward-compatible với DB hiện có.
- Người dùng đăng 1 video/ngày: tối ưu cho chất lượng từng video và thời gian review ngắn, không cần batch render lớn.
- Chạy `npm run typecheck` sau mỗi phase. Không phá vỡ luồng hiện có (fetch, scan, analyze, brief, render, upload log).
- Ngôn ngữ nội dung: tiếng Việt cho thị trường Việt Nam.

Thứ tự thực hiện: Phase A -> B -> C -> D -> E -> F. Mỗi phase độc lập, có thể ship riêng.

---

## Phase A — Nâng chất lượng giọng đọc (quick wins, làm trước)

### A1. Spoken rewrite cho script TTS

Vấn đề: bài Threads là văn viết, TTS đọc nguyên văn nghe cứng và "đậm chất AI".

- Vị trí: prompt sinh `video_script` trong `src/server/ai/affiliateAnalysisService.ts` (post read version, transition, solution, CTA).
- Thêm bước/quy tắc "spoken rewrite" tiếng Việt vào prompt:
  - Câu ngắn dưới 15 từ.
  - Thêm từ đệm khẩu ngữ tự nhiên: "thật sự là", "kiểu", "mọi người biết không", "nghe xong mà"...
  - Bỏ hashtag, emoji, viết tắt; đọc số thành chữ.
  - Ngắt ý bằng dấu chấm thay vì câu dài nhiều dấu phẩy.
  - Mở đầu xưng hô trực tiếp với người xem.
  - Kèm 2–3 ví dụ before/after trong prompt để model bắt đúng giọng nói.
- Không thay đổi shape output JSON hiện có (chỉ nâng chất lượng nội dung các field).

### A2. Dùng tham số `instructions` của TTS

- Vị trí: `src/server/video/videoDraftService.ts`, chỗ gọi OpenAI audio speech (`gpt-4o-mini-tts`).
- Truyền `instructions` theo loại segment:
  - Hook: đọc nhanh, punchy, gây tò mò.
  - Post/story: chậm rãi, tâm sự, như kể cho bạn thân.
  - Transition: chuyển tông nhẹ nhàng.
  - Solution/CTA: ấm, thuyết phục, không gào.
- Cho phép override instruction mặc định qua `app_settings` (key mới, ví dụ `tts_instructions_style`), có default hợp lý nếu chưa set.

### A3. Khoảng lặng giữa các segment

- Chèn 300–500ms im lặng giữa các segment audio khi render/concat bằng FFmpeg (silent padding hoặc `adelay`/`apad` tùy pipeline hiện tại).
- Configurable qua settings, default 400ms.

Definition of done Phase A: render một video mẫu, giọng đọc có ngắt nghỉ tự nhiên, script nghe như văn nói, không còn đọc hashtag/emoji.

---

## Phase B — Flow "Create from link" (paste link -> video)

Tận dụng code sẵn có: manual import (`importThreadsPost()` -> `fetchThreadsPostByUrl()` -> auto analyze) và TikTok brief modal + render đã hoạt động. Chỉ cần wiring.

- Thêm entry point rõ ràng trên UI (Home hoặc toolbar): ô paste link Threads + nút "Create from link".
- Chuỗi tự động: import post -> chạy AI analysis (nếu chưa có) -> mở thẳng TikTok brief modal đã điền sẵn.
- Auto-select background clip: chọn clip `background` trong Asset Library có `last_used_at` cũ nhất (giảm lặp giữa các video). Người dùng vẫn đổi được trong modal.
- Hiển thị progress từng bước (importing -> analyzing -> ready) qua IPC event, tái dùng pattern progress của opportunity scan.
- Validate link như hiện tại (`threads.com|threads.net/@account/post/...`), lỗi login/API key hiện message rõ ràng như expected behavior đã mô tả trong docs.

Definition of done: từ paste link đến brief modal mở sẵn dữ liệu chỉ 1 thao tác; tổng thời gian thao tác của người dùng trước khi bấm render dưới 2 phút.

---

## Phase C — Karaoke caption (nâng cấp lớn nhất về cảm giác video)

Vấn đề: card chữ tĩnh đứng yên nhiều giây, người xem đọc xong trước giọng đọc -> lộ video máy làm.

### C1. Word-level timestamps

- Sau khi tạo TTS cho từng segment, chạy transcription lấy word-level timestamps (OpenAI Whisper API với `timestamp_granularities: word`, hoặc whisper.cpp local nếu muốn offline — chọn phương án API trước cho đơn giản, trừu tượng hóa sau).
- Cache kết quả theo hash của audio file để re-render không tốn thêm phí.

### C2. Sinh phụ đề `.ass` và burn bằng libass

- Module mới: `src/server/video/subtitleService.ts`.
- Từ word timestamps, gom cụm 2–4 từ, sinh file `.ass` với style: chữ to, viền đậm, vị trí ~2/3 dưới màn hình, highlight cụm đang đọc (karaoke style phổ biến trên TikTok VN).
- Burn vào từng segment qua FFmpeg filter `subtitles=` (libass). Kiểm tra bundle FFmpeg có libass; nếu không, báo lỗi rõ ràng hướng dẫn cài bản FFmpeg đầy đủ.

### C3. Giảm chữ tĩnh trên màn hình

- Post card: giữ dạng screenshot Threads (authentic) nhưng thu nhỏ/đặt phần trên màn hình, để karaoke caption gánh phần chữ động.
- Hook mở đầu: một dòng chữ to kiểu text-tool native của TikTok thay vì card thiết kế chỉn chu.
- Thêm setting bật/tắt karaoke caption (default: bật).

Definition of done: video render ra có caption chạy sync theo giọng, cụm 2–4 từ, không lệch quá ~150ms.

---

## Phase D — Engagement mode (`content_goal`) cho phase nuôi kênh

Mục tiêu: sản xuất video tương tác (không gắn sản phẩm) để nuôi kênh trong đúng niche, trước khi bật flow affiliate.

### D1. Schema

- Thêm cột `content_goal` (`engagement` | `affiliate`, default `affiliate`) vào: `ai_analysis`, `upload_log`. Cân nhắc thêm vào `keywords` nếu muốn tag keyword theo mục tiêu.
- `upload_log` thêm metric phase nuôi kênh: `followers_gained`, `comments`, `saves`, `shares` (INTEGER, nullable).

### D2. Scoring profile thứ hai

- `src/server/scoring/trendingScore.ts`: thêm engagement profile — đặt nặng viral score, relatability, controversy, velocity; KHÔNG set điểm về 0 khi thiếu product solvability/buying intent (điều kiện đó chỉ áp cho affiliate profile).
- Opportunity scan nhận tham số goal; UI có toggle "Engagement / Affiliate" khi scan.

### D3. Prompt path riêng cho engagement

- `affiliateAnalysisService.ts`: khi `content_goal = engagement`, prompt đánh giá comment-bait potential (bài có khiến người xem muốn kể chuyện mình không), story quality, và sinh CTA dạng follow/đặt câu hỏi cuối video thay vì CTA mua hàng. Verdict vẫn `make_now/watch/skip` nhưng theo tiêu chí engagement.

### D4. Chống bị đánh giá unoriginal/spam

- Rotate template giữa các video: variation về màu card, voice/instruction, cấu trúc mở bài. Lưu template đã dùng gần nhất trong settings và tránh lặp liên tiếp.
- Không thêm bất kỳ tính năng đăng tự động nào.

### D5. Channel readiness widget

- Ở Results view: widget đọc từ `upload_log` — view trung bình 10 video gần nhất, engagement rate, số ngày đăng liên tục, tổng follower gained. Ngưỡng "sẵn sàng chuyển phase affiliate" configurable (người dùng tự check điều kiện Showcase TikTok Shop hiện hành).
- Lưu ý sản phẩm: `content_goal` là tỷ lệ trộn nội dung (ví dụ 3–4 engagement : 1 affiliate), không phải công tắc một lần.

---

## Phase E — Product Catalog (tầng Offer, trục kiếm tiền)

Đảo pipeline từ post-first sang offer-aware: mọi video affiliate gắn với sản phẩm thật đã được duyệt.

### E1. Schema `products`

Bảng mới:

- `id`, `name`, `affiliate_link`, `price`, `commission_percent`, `category`, `marketplace` (tiktok_shop/shopee/other), `status` (active/paused), `demo_asset_id` (FK mềm tới `asset_library`), `notes`, `created_at`, `updated_at`.

### E2. CRUD UI

- View mới "Products" trong sidebar: thêm/sửa/xóa/pause sản phẩm, gắn demo clip từ Asset Library. Nhập tay, không crawl marketplace.

### E3. Tích hợp vào scan + AI

- Opportunity scan (affiliate mode): match post với catalog (theo category/keyword đơn giản trước, sau đó để AI match trong prompt) -> boost opportunity score cho post khớp sản phẩm thật.
- `affiliateAnalysisService.ts`: đưa catalog (active products) vào prompt context; output thêm field `matched_product_id` (nullable) — AI chỉ được chọn từ catalog, không bịa sản phẩm.

### E4. Prefill khi render

- Nếu brief có `matched_product_id`: `tiktok-metadata.json` và `upload-checklist.txt` tự điền product name, affiliate link, nhắc disclosure affiliate; auto-select demo clip của sản phẩm nếu có.

### E5. Attribution

- `upload_log` thêm `product_id` (FK mềm). "Learned signals" và performance context cho AI group theo product thật thay vì text tự do.

---

## Phase F — Variant engine + cost tracking

### F1. Hook/CTA variants

- Trong brief modal: cho chọn render thêm 1–2 biến thể chỉ khác hook và CTA. Reuse toàn bộ segment giữa (chỉ TTS lại hook/CTA) để chi phí thấp.
- Output folder: `data/video-exports/<post_id>/variant-<n>/...`. Metadata ghi rõ hook/CTA của từng variant.
- `upload_log` thêm `variant_label` để attribution biết biến thể nào thắng.
- Lưu ý: người dùng đăng 1 video/ngày — variants dùng để chọn bản tốt nhất hoặc dải đăng nhiều ngày, không phải đăng dồn.

### F2. Cost tracking

- Ghi lại usage mỗi lần gọi OpenAI (tokens in/out cho analysis, ký tự TTS) vào bảng mới `api_usage_log` (`id`, `kind`, `model`, `input_units`, `output_units`, `estimated_cost_usd`, `related_post_id`, `created_at`). Bảng giá lưu trong settings để người dùng tự cập nhật.
- Results dashboard thêm: cost per draft, commission per video, tỷ lệ make_now -> đã đăng.
- Quota guard đơn giản: ngưỡng chi phí/ngày trong settings; vượt ngưỡng thì scan/analyze hỏi xác nhận thay vì chạy tiếp.

---

## Ngoài phạm vi (không làm)

- Auto-post TikTok/Reels, auto-comment/like/follow, fake engagement.
- Crawl TikTok Shop/Shopee, tự tạo affiliate link.
- Cloud sync, multi-account, background worker khi app đóng.

## Checklist nghiệm thu tổng

- [ ] `npm run typecheck` và `npm run build` pass sau mỗi phase.
- [ ] DB cũ mở lên migrate êm, không mất dữ liệu saved/analyzed/upload log.
- [ ] Video mẫu: giọng tự nhiên, có ngắt nghỉ, karaoke caption sync.
- [ ] Paste link -> brief modal mở sẵn trong 1 thao tác.
- [ ] Scan engagement mode trả shortlist không đòi hỏi product fit.
- [ ] Video affiliate có product thật + link trong metadata/checklist.
- [ ] Dashboard hiện cost per draft và commission per video.
