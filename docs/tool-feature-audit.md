# Threads Trend Finder - Audit tính năng hiện tại

Ngày rà soát: 31/05/2026

## 1. Mục tiêu sản phẩm

Threads Trend Finder là desktop app chạy local dành cho affiliate marketer tại Việt Nam. Tool không chỉ thay thế thao tác search Threads thủ công, mà hướng tới workflow:

1. Quét bài viết Threads theo từ khóa.
2. Lưu dữ liệu và lịch sử tương tác vào SQLite local.
3. Chấm điểm khả năng viral và mức độ phù hợp để làm affiliate.
4. Dùng AI shortlist bài đáng khai thác.
5. Gợi ý sản phẩm affiliate, hook, CTA và kịch bản TikTok.
6. Tạo video nháp từ bài viết, giọng đọc AI và footage do người dùng chọn.

Tool chỉ phục vụ nghiên cứu nội dung. Hiện tại không có auto-post, tạo tương tác giả hoặc spam.

---

## 2. Workflow chính đã hoạt động

### Bước 1: Đăng nhập Threads

- Mở Chromium qua Playwright để người dùng đăng nhập Threads.
- Lưu persistent browser profile tại `data/threads-browser-profile`.
- Lưu session snapshot tại `data/threads-session.json`.
- Tái sử dụng session khi khởi động app hoặc build lại.
- Hiển thị username Threads đang đăng nhập trong Settings.

### Bước 2: Quản lý từ khóa

Tại tab **Từ khóa**, người dùng có thể:

- Thêm từ khóa mới.
- Sửa từ khóa.
- Xóa từ khóa.
- Bật hoặc tắt từ khóa.
- Fetch thủ công từng từ khóa.
- Bật quét nền khi app đang chạy.

Ví dụ từ khóa phù hợp thị trường Việt Nam:

- `da dầu`
- `kem chống nắng`
- `thời trang công sở`
- `kính tụt`
- `mất ngủ`
- `makeup`

### Bước 3: Quét bài viết mới

Tại **Trang chủ**, nút **Quét bài viết mới** sẽ:

1. Lấy tối đa 12 từ khóa đang bật.
2. Fetch tối đa 14 bài cho mỗi từ khóa.
3. Nghỉ khoảng 900 ms giữa các từ khóa để hạn chế scrape quá mức.
4. Lưu bài viết và snapshot tương tác vào database.
5. Chấm điểm local.
6. Chạy AI cho tối đa 3 bài tiềm năng chưa được phân tích.
7. Trả về danh sách **Bài vừa quét** và cập nhật feed.

Lưu ý: **Bài vừa quét** nghĩa là bài được tìm thấy trong lần quét gần nhất. Danh sách này có thể chứa bài đã từng thấy trước đó, không hoàn toàn đồng nghĩa với bài mới xuất hiện lần đầu.

### Bước 4: Review feed

Tại **Bài đang hot**, người dùng có thể:

- Xem toàn bộ bài đã thu thập.
- Sắp xếp theo điểm cơ hội affiliate.
- Search trong dữ liệu đã fetch.
- Fetch trực tiếp theo keyword, hashtag, profile hoặc feed.
- Mở permalink Threads gốc.
- Phân tích AI.
- Lưu bài.
- Copy nội dung kèm link nguồn.
- Tạo ý tưởng TikTok.

### Bước 5: Tạo video nháp

Sau khi chọn **Tạo ý tưởng TikTok**, tool mở brief affiliate và cho phép tạo video nháp:

1. Chọn MP4 retention footage.
2. Chọn MP4 demo sản phẩm.
3. Sinh voiceover AI đọc toàn bộ bài Threads.
4. Hiển thị card mô phỏng bài Threads trên footage.
5. Sinh đoạn giải pháp theo tone Gen Z.
6. Chuyển sang demo sản phẩm.
7. Render MP4 bằng FFmpeg.
8. Hiển thị progress bar và nút mở nhanh thư mục output.

Output được lưu tại:

```text
data/video-exports/<uuid>/affiliate-video-draft.mp4
```

---

## 3. Kiến trúc hiện tại

```text
src/
  app/page.tsx
  components/
    analysis/
      analysis-panel.tsx
      tiktok-brief-modal.tsx
    feed/
      feed-card.tsx
    layout/
      sidebar.tsx
  electron/
    main.ts
    preload.ts
  lib/
    default-keywords.ts
    i18n.ts
    openai-models.ts
    types.ts
  server/
    ai/
      affiliateAnalysisService.ts
    db/
      client.ts
      schema.ts
    scoring/
      trendingScore.ts
    scraper/
      threadsScraper.ts
    services/
      exportService.ts
      fetchService.ts
      opportunityScanService.ts
    video/
      videoDraftService.ts
```

Stack:

- Electron
- Next.js
- React
- TypeScript
- TailwindCSS
- SQLite
- Playwright
- OpenAI API
- FFmpeg

---

## 4. Scraper Threads

### Dữ liệu đang thu thập

Mỗi bài Threads hiện có:

- Nội dung text.
- Author và handle.
- Likes.
- Replies.
- Reposts.
- Timestamp.
- Image URLs.
- Permalink.
- Keyword nguồn.

### Chế độ fetch

- Home feed.
- Keyword.
- Hashtag.
- Profile.
- Trending giả lập.

### Giới hạn cần lưu ý

1. Threads không cung cấp API public ổn định cho toàn bộ use case này. Scraper đang dựa vào DOM selector nên có thể hỏng khi Threads thay đổi UI.
2. Chế độ `trending` hiện không phải bảng trending chính thức của Threads. Nó dùng query tìm kiếm cố định.
3. Chưa scrape sâu replies để tạo content từ chuỗi comment thực tế.
4. Image extraction có thể bỏ sót carousel hoặc lấy nhầm avatar.
5. Timestamp theo locale Việt Nam cần rà soát kỹ hơn với format `dd/mm`.
6. Chưa có test selector định kỳ hoặc màn hình cảnh báo chi tiết khi Threads thay đổi DOM.

---

## 5. Trending Score và Affiliate Opportunity Score

Tool đang có hai lớp chấm điểm local.

### Viral score

Ước tính khả năng viral dựa trên:

- Likes velocity.
- Replies.
- Reposts.
- Emotional wording.
- Controversial wording.
- Relatability.

### Affiliate fit score

Ước tính mức độ phù hợp để làm affiliate dựa trên:

- Pain point rõ ràng.
- Có thể giải quyết bằng sản phẩm.
- Có khả năng demo trực quan.
- Audience rõ ràng.
- Có buying intent.

### Công thức xếp hạng feed

```text
opportunityScore = viralScore * 0.25 + affiliateFitScore * 0.75
```

Điểm affiliate được ưu tiên cao hơn viral vì mục tiêu không phải tìm bài nổi tiếng đơn thuần, mà là tìm bài có thể chuyển đổi thành video gắn sản phẩm.

### Ví dụ phù hợp

Post:

```text
Mũi thấp, đeo kính cứ tụt xuống, đẩy lên nhiều thì ngại bị soi.
```

Affiliate fit cao vì:

- Pain point cụ thể.
- Audience cụ thể.
- Có cảm xúc và tính relatable.
- Giải pháp sản phẩm nhỏ, dễ demo: gài kính silicone, nose pad.

---

## 6. AI Affiliate Analysis

Tool dùng OpenAI API với model người dùng chọn trong Settings. Model mặc định để test chi phí thấp là `gpt-4.1-nano`.

### Input

- Nội dung post.
- Chỉ số tương tác.
- Dữ liệu score local.
- Context thị trường Việt Nam.

### Output AI

- Verdict: làm ngay, theo dõi hoặc bỏ qua.
- Confidence score.
- Emotional trigger.
- Pain point.
- Buying intent.
- Affiliate fit score.
- Persona.
- Tình huống sử dụng.
- Nhóm sản phẩm.
- Tên sản phẩm affiliate gợi ý.
- Search keyword để tự tìm sản phẩm.
- Content angle.
- Demo angle.
- Content format.
- Hook.
- CTA.
- Script outline.
- Solution script.
- Relatability score.
- Controversy score.
- Reject reason.

### Tone giải pháp hiện tại

`solutionScript` đã được prompt theo hướng:

- Tiếng Việt tự nhiên.
- Tone Gen Z.
- Trẻ trung, có cảm thán vừa phải.
- Nói đúng tên sản phẩm và cách dùng.
- Nghe như chia sẻ mẹo hữu ích.
- Tránh giọng quảng cáo đọc kịch bản.
- Không claim quá mức.

### Giới hạn hiện tại

1. AI analysis chỉ chạy tự động tối đa 3 bài trong mỗi lần quét để tiết kiệm chi phí.
2. Feed vẫn sort chủ yếu theo score local. Score AI chưa cập nhật ngược lại đầy đủ vào ranking của post.
3. Bài đã phân tích trước khi có `solutionScript` có thể dùng fallback cũ cho tới khi phân tích lại.
4. Chưa có nút regenerate riêng cho solution script.
5. Chưa hiển thị cost estimate trước khi phân tích hàng loạt.

---

## 7. Các màn hình hiện tại

### Trang chủ

Vai trò: dashboard nhanh để biết hôm nay có gì đáng chú ý.

Hiển thị:

- Tổng số bài đã thu thập.
- Số bài đã phân tích.
- Số idea đã lưu.
- Số từ khóa đang bật.
- Nút **Quét bài viết mới**.
- Danh sách **Bài vừa quét**.
- Danh sách **Bài viết nổi bật**.

### Bài đang hot

Vai trò: feed nghiên cứu chính.

Hiển thị:

- Toàn bộ bài đã fetch.
- Score viral.
- Score fit affiliate.
- Score cơ hội.
- Trạng thái AI.
- Action buttons.

### Từ khóa

Vai trò: quản lý nguồn quét.

Hỗ trợ:

- CRUD từ khóa.
- Toggle bật/tắt.
- Fetch thủ công.
- Export.

### Bài đã lưu

Vai trò: shortlist bài người dùng muốn nghiên cứu tiếp.

Hỗ trợ:

- Lưu hoặc bỏ lưu.
- Filter bài đã bookmark.
- Chuẩn bị dữ liệu để export idea.

### Gợi ý sản phẩm

Vai trò: xem các bài đã có AI analysis và tên sản phẩm affiliate phù hợp.

Tool chỉ gợi ý tên sản phẩm. Việc tìm sản phẩm cụ thể và gắn link affiliate vẫn do người dùng thực hiện.

### Cài đặt

Hỗ trợ:

- Lưu OpenAI API key local.
- Mask key dạng `sk-proj...`.
- Verify API key khi Save.
- Chọn OpenAI model.
- Threads login.
- Kiểm tra session và account.
- Chuyển ngôn ngữ Việt / Anh.
- Cấu hình auto scan.
- Chọn khoảng thời gian scan.
- Scan khi mở app.

---

## 8. TikTok Affiliate Brief

Modal ý tưởng TikTok cung cấp:

- Post nguồn.
- Emotional trigger.
- Pain point.
- Tên sản phẩm affiliate.
- Persona.
- Keyword tìm sản phẩm.
- Hook.
- Script outline.
- Demo angle.
- CTA.
- Copy brief.
- Tạo video nháp.
- Progress render.
- Mở thư mục output.

Mục tiêu của brief là giảm thời gian chuyển từ post Threads sang một concept video affiliate có thể triển khai.

---

## 9. Video Draft Renderer

### Luồng render

Renderer hiện sử dụng:

- OpenAI TTS model `gpt-4o-mini-tts`.
- Voice mặc định `onyx`.
- Tốc độ đọc `1.28`.
- FFmpeg để render video.

### Cấu trúc video

1. Đọc nguyên văn toàn bộ bài Threads.
2. Hiển thị một card hoàn chỉnh của bài Threads trên retention footage.
3. Chuyển sang product demo footage.
4. Đọc đoạn solution script ngắn theo tone Gen Z.
5. Hiển thị CTA.

### Điều chưa làm

- Chưa tự lấy video sản phẩm.
- Chưa tự tìm sản phẩm trên marketplace.
- Chưa có timeline editor.
- Chưa preview video ngay trong app.
- Chưa cho đổi voice trực tiếp khi render.
- Chưa có slider chỉnh tốc độ đọc.
- Chưa có asset library.
- Chưa có lịch sử render.
- Chưa dùng screenshot comment Threads thật.
- Chưa render stack replies như video mẫu.
- Không auto-post TikTok.

---

## 10. Local Database

SQLite đang lưu:

```text
threads_posts
ai_analysis
engagement_snapshots
saved_posts
keywords
fetch_logs
app_settings
```

### Ý nghĩa

- `threads_posts`: dữ liệu bài viết.
- `ai_analysis`: kết quả phân tích AI.
- `engagement_snapshots`: lịch sử tương tác để tính velocity.
- `saved_posts`: bookmark.
- `keywords`: từ khóa.
- `fetch_logs`: lịch sử fetch.
- `app_settings`: cài đặt local.

---

## 11. Security và privacy

### Đã làm

- Dữ liệu lưu local.
- Threads profile local.
- API key được mã hóa bằng Electron `safeStorage` khi hệ điều hành hỗ trợ.
- Không tự gửi nội dung lên dịch vụ ngoài trừ khi gọi OpenAI để phân tích hoặc tạo TTS.

### Cần cải thiện

1. Hiện có fallback lưu secret plaintext nếu `safeStorage` không khả dụng.
2. Production build nên từ chối lưu plaintext hoặc cảnh báo rõ.
3. IPC mở folder nên giới hạn chặt vào `data/video-exports`.
4. Nên có trang quản lý dữ liệu local: backup, reset, export, xóa session.

---

## 12. Những gì tool chưa phải

Tool hiện chưa phải:

- Threads analytics platform đầy đủ.
- Official Threads API client.
- Marketplace affiliate product crawler.
- TikTok auto-post bot.
- Video editor hoàn chỉnh.
- Hệ thống cloud chạy scheduler 24/7.
- Multi-account platform.

Auto scan chỉ chạy khi app local đang mở. Nếu máy tắt hoặc app đóng, tool không thể tự fetch.

---

## 13. Vấn đề cần ưu tiên cải thiện

### P0 - Chất lượng dữ liệu Threads

Đây là nền móng của toàn bộ tool. Nếu scraper lấy thiếu hoặc sai dữ liệu, AI và video phía sau cũng giảm giá trị.

- Phân biệt rõ `mới tìm thấy`, `đã thấy trước đó`, `tăng trưởng mạnh`.
- Hiển thị fetch log trong UI.
- Fix locale timestamp Việt Nam.
- Scrape carousel chính xác.
- Tách avatar khỏi post media.
- Scrape replies có tương tác cao.
- Thêm selector health check.
- Thêm retry và thông báo lỗi chi tiết.
- Thêm regression test cho scraper.

### P1 - Shortlist thực sự giúp tiết kiệm thời gian

Đây là lợi thế chính so với việc vào Threads search thủ công.

- Dùng AI score để cập nhật ranking.
- Cho chọn số bài auto-analyze trong mỗi scan.
- Filter theo verdict: `Làm ngay`, `Theo dõi`, `Bỏ qua`.
- Filter theo từ khóa, score và thời gian.
- Hiển thị lý do vì sao bài được đề xuất.
- Hiển thị sản phẩm ngay trên dashboard shortlist.
- Có nút regenerate solution script.
- Thêm cost estimate và quota để kiểm soát chi phí.

### P2 - Video draft usable hơn

- Cho sửa hook, script và CTA trước khi render.
- Preview video trong app.
- Chọn voice.
- Slider tốc độ đọc.
- Re-select footage.
- Asset library local.
- Render history.
- Re-render nhanh.
- Hỗ trợ screenshot post thật.
- Hỗ trợ stack replies thật cho dạng video đọc comment.
- Dynamic scale card cho post dài.

### P3 - Production readiness

- Cập nhật README.
- Đồng bộ tài liệu architecture.
- Build installer.
- Logging rõ ràng.
- Retry và timeout.
- Backup và restore SQLite.
- Quy tắc mã hóa secret bắt buộc.
- Error boundary UI.
- Telemetry local cho lỗi scraper.

---

## 14. Các điểm kỹ thuật cần rà soát cụ thể

1. `Trending` đang dùng query cố định, chưa phải trending feed thật.
2. `latestScanPosts` chỉ tồn tại trong renderer state và mất khi restart.
3. Danh sách **Bài vừa quét** chưa phân biệt bài mới và bài cũ vừa xuất hiện lại.
4. Thông báo số bài AI analyzed sau scan có thể gây hiểu nhầm giữa bài mới phân tích và tổng bài đã có analysis.
5. Ranking feed chưa phản ánh đầy đủ AI affiliate fit score.
6. `solutionScript` chưa được hiển thị rõ trong panel và chưa được đưa vào file export.
7. Render progress hiện dùng chuỗi tiếng Việt cố định, chưa theo language setting.
8. Nếu người dùng cancel file picker, progress bar cần reset rõ ràng.
9. Chưa có estimate chi phí TTS trước khi render.
10. Card post dài cần scale động để tránh tràn khung hình.

---

## 15. Đánh giá tổng thể

App đã có MVP end-to-end:

```text
Threads session
  -> fetch từ khóa
  -> local scoring
  -> AI affiliate analysis
  -> shortlist
  -> TikTok brief
  -> local video draft
```

Giá trị hiện tại không còn chỉ là một UI search Threads. Tool đã bắt đầu tự động hóa phần nghiên cứu affiliate và biến nội dung thành video nháp.

Tuy nhiên, trước khi mở rộng video automation, phần đáng đầu tư nhất vẫn là:

1. Độ tin cậy của dữ liệu Threads.
2. Khả năng tìm đúng bài có pain point và sản phẩm giải quyết được.
3. Shortlist giúp người dùng bỏ qua phần lớn bài không có giá trị affiliate.

Khi ba điểm này đủ tốt, video generator mới thực sự tạo ra lợi thế workflow rõ ràng.

---

## 16. Checklist review sản phẩm

Khi review phiên bản tiếp theo, có thể dùng checklist:

- [ ] Tool có tìm được bài mới mà tôi không cần search thủ công không?
- [ ] Tôi có biết bài nào mới xuất hiện, bài nào đang tăng nhanh không?
- [ ] Top shortlist có thực sự phù hợp để gắn sản phẩm không?
- [ ] AI có đưa ra tên sản phẩm đủ cụ thể để tôi tìm hàng không?
- [ ] AI solution script có nghe tự nhiên và đúng insight Việt Nam không?
- [ ] Tôi có lọc được bài `Làm ngay` trong vài giây không?
- [ ] Link nguồn, ảnh và metrics có chính xác không?
- [ ] Video nháp có đủ tốt để chỉnh sửa nhanh thay vì dựng lại từ đầu không?
- [ ] Chi phí OpenAI có dễ kiểm soát không?
- [ ] Khi scraper lỗi, tôi có biết nguyên nhân và cách xử lý không?
