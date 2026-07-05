# Brief để xin AI khác advise: thiếu gì để biến tool này thành money-making video automation engine?

Tôi đang có một dự án tên Threads Affiliate Trend Finder. Đây là desktop app local-first cho affiliate automation. Dự án đã develop tới mức MVP end-to-end, nhưng tôi có cảm giác vẫn còn thiếu một số mảnh ghép quan trọng để thật sự build được video kiếm tiền đều. Tôi muốn bạn review hướng sản phẩm và advise tiếp.

## 1. Dự án hiện đã làm được gì

Hiện app đã có workflow:

```text
Threads keywords/audience
  -> scrape public Threads posts
  -> lưu SQLite local
  -> chấm điểm viral/affiliate/video potential
  -> AI phân tích pain point và sản phẩm affiliate
  -> shortlist Make Now / Watch / Skip
  -> tạo TikTok/Reels brief
  -> render video draft 9:16 local
  -> ghi kết quả views/clicks/orders/commission
  -> dùng kết quả thắng làm context cho AI lần sau
```

Stack chính:

- Electron + Next.js + React + TypeScript.
- SQLite local.
- Playwright để login/scrape Threads.
- OpenAI để phân tích affiliate, keyword discovery và TTS.
- FFmpeg để render video draft.

Các màn hình đã có:

- Home Opportunity Inbox.
- Explore Posts / Trending Feed.
- Keyword Manager + AI keyword discovery.
- Saved Posts.
- Asset Library cho background/product clips.
- TikTok/Reels brief modal.
- Results / Upload Log.
- Settings cho OpenAI, Threads session, language, auto scan.

## 2. Mục tiêu chính

Mục tiêu không chỉ là làm research tool. Mục tiêu chính là phát triển nó thành một affiliate automation tool hỗ trợ kiếm tiền thụ động hoặc bán thụ động.

Ý tưởng là hệ thống tự động hóa càng nhiều càng tốt các bước:

- Tìm pain point có nhu cầu thật.
- Tìm/cụ thể hóa sản phẩm có thể bán.
- Tạo angle/hook/script.
- Dựng video draft.
- Theo dõi video thắng/thua.
- Tự học từ dữ liệu kết quả để tạo vòng sau tốt hơn.

Tôi hiểu rằng vẫn cần human review, chọn sản phẩm thật, kiểm tra policy và upload thủ công. Tôi không cần lời hứa "passive income chắc chắn"; tôi cần lời khuyên thực tế để biến tool này thành engine có xác suất tạo doanh thu affiliate cao hơn.

## 3. Vấn đề tôi cảm thấy hiện tại

Dù đã có pipeline, tôi vẫn thấy nó "thiếu gì đó". Cụ thể:

- Có thể tìm được post và pain point, nhưng chưa chắc tìm đúng offer kiếm tiền.
- Có thể AI gợi ý sản phẩm, nhưng chưa validate sản phẩm thật trên marketplace.
- Có thể render video draft, nhưng chưa chắc video đủ retention/conversion để thắng.
- Có upload log, nhưng chưa đủ để biết chính xác vì sao video thắng/thua.
- Có keyword discovery, nhưng chưa chắc keyword dẫn tới buyer intent thật.
- Có hook/script, nhưng chưa có creative testing framework rõ ràng.

Nói ngắn gọn: app đã có "automation để tạo draft", nhưng chưa chắc đã có "system để tạo video kiếm tiền".

## 4. Tôi muốn bạn advise những gì

Hãy review dự án này như một product strategist + affiliate growth operator + automation architect.

Tôi muốn bạn trả lời thật cụ thể:

1. Theo bạn, mảnh ghép lớn nhất còn thiếu là gì để biến dự án thành tool kiếm tiền affiliate thực tế?
2. Nên thêm module nào tiếp theo: product/offer validation, marketplace scraper, creative pattern engine, video quality analyzer, A/B testing system, analytics attribution, hay module khác?
3. Nếu chỉ có 2 tuần development tiếp theo, nên ưu tiên làm gì để tăng khả năng tạo doanh thu nhanh nhất?
4. Nếu muốn đạt automation bán thụ động trong 2-3 tháng, roadmap nên như thế nào?
5. Các metric nào cần tracking để biết video có khả năng kiếm tiền, không chỉ có view?
6. Prompt/AI workflow hiện nên đổi thế nào để output gần với video kiếm tiền hơn?
7. Video draft hiện cần có những tiêu chuẩn nào để đủ cạnh tranh trên TikTok/Reels?
8. Làm sao nối pain point từ Threads với sản phẩm marketplace cụ thể một cách an toàn, không hallucinate?
9. Có nên ưu tiên TikTok Shop, Shopee, Amazon, ClickBank, hay một affiliate network khác?
10. Tôi nên tránh xây tính năng nào vì nghe hay nhưng không giúp kiếm tiền?

## 5. Các giả định hiện tại

- Người dùng ở Việt Nam hoặc target thị trường Việt Nam trước.
- Nguồn insight chính là Threads.
- Kênh phân phối chính là TikTok/Reels/short-form video.
- Sản phẩm ưu tiên là sản phẩm vật lý dễ demo, giá dễ mua, pain point rõ.
- App không auto-post ở giai đoạn này để tránh rủi ro platform.
- Mục tiêu là giảm thời gian nghiên cứu và sản xuất, rồi dần tự động hóa vòng lặp tối ưu.

## 6. Output mong muốn từ bạn

Hãy đưa ra:

- Diagnosis: vì sao hiện tại chưa đủ để tạo video kiếm tiền đều.
- Missing modules: các module còn thiếu, xếp theo priority.
- Roadmap 2 tuần, 1 tháng, 3 tháng.
- Data model cần thêm nếu có.
- AI prompts/workflows nên thay đổi.
- Các quyết định product/strategy nên làm ngay.
- Những thứ nên bỏ qua để không lãng phí thời gian.

Hãy trả lời trực diện, thực dụng, ưu tiên khả năng kiếm tiền hơn là làm tool đẹp.
