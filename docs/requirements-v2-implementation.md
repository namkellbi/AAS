# Threads to TikTok Affiliate Automation - Implementation Notes

Ngày cập nhật: 31/05/2026

## Đã triển khai

- Scrape top replies cho các post có ít nhất 10 replies, giới hạn tối đa 10 reply mỗi bài.
- Lưu `top_replies`, `trend_state`, `likes_per_hour`, `replies_per_hour`.
- Tính lifecycle: `EMERGING`, `GROWING`, `PEAK`, `DECLINING`, `DEAD`.
- Xếp hạng mới: Affiliate Fit 40%, Video Potential 30%, Trend Velocity 20%, Viral Score 10%.
- AI analysis một lần gọi: classify replies, chọn 2-6 replies, video potential, caption, hashtag, marketplace keyword và video script.
- Feed filters: replies >= 10, trend đang tăng, video potential >= 70.
- Drawer xem replies trên feed.
- Asset Library local cho background và product clip.
- Pre-render preview: sửa post text, xóa hoặc reorder replies, sửa transition, CTA, chọn asset.
- Video renderer theo segment: post, replies, transition, product optional, CTA outro.
- Product clip optional: thiếu clip thì skip segment, không crash.
- Output:

```text
data/video-exports/<post_id>/
  affiliate-video-final.mp4
  tiktok-metadata.json
  upload-checklist.txt
  thumbnails/
```

- Upload Log local để ghi TikTok URL, sản phẩm, views và orders.
- Settings mới: TikTok channel watermark, voice, speed, post age.
- API key chỉ được lưu nếu Electron `safeStorage` khả dụng.
- Retry tối đa 3 lần cho Threads fetch, OpenAI và FFmpeg.

## Quyết định kỹ thuật

Requirement đề xuất `node-canvas`. Repo hiện đã có Playwright và đang render PNG ổn định trên Windows, nên card renderer tiếp tục dùng Playwright screenshot. Output và pipeline FFmpeg vẫn giữ đúng hành vi yêu cầu, đồng thời tránh thêm native dependency `canvas`.

## Cần test bằng dữ liệu Threads thực tế

- Selector lấy replies phụ thuộc DOM Threads và cần test lại sau mỗi thay đổi UI của Threads.
- Một số bài Threads có layout carousel hoặc reply thread đặc biệt có thể cần selector bổ sung.
- Trend lifecycle cần ít nhất hai lần scan cách nhau một khoảng thời gian để có snapshot so sánh.
- Asset clip và FFmpeg cần test trên bộ MP4 thật của người dùng.

## Chưa triển khai đầy đủ

- Drag and drop asset upload. Hiện Asset Library dùng file picker.
- Preview clip khi hover. Hiện hiển thị metadata clip.
- Transition sound file. Setting đã có nhưng chưa burn sound vào video.
- Chỉnh sửa đầy đủ từng field Upload Log sau khi tạo. Hiện hỗ trợ thêm và xóa log.
- SQLite backup tự động.
- Full video editor, auto-post TikTok, scrape marketplace và tạo affiliate link: giữ ngoài phạm vi.
