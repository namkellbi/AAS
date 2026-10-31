# Phase 3 — Automatic TTS normalization

Phase 1–2 giữ nguyên nguyên tắc: **mỗi Threads link tạo một video độc lập**.

## Đã có trong Phase 1–2

- Nhập nhiều link theo từng dòng hoặc từ file `.txt`.
- Chuẩn hóa URL, loại link trùng và báo dòng không hợp lệ.
- Fetch tối đa hai bài đồng thời trong cùng một Threads browser context.
- Quality Gate tùy chỉnh, mặc định cần ít nhất 3 comment có từ 20 likes.
- Dừng sớm trước bước chuẩn hóa/render đối với bài không đạt và report lý do.
- Bài đạt mở lại editor/brief hiện tại để duyệt trước khi render.

## Đã triển khai trong Phase 3

- Không điều khiển giao diện web ChatGPT. Tool ưu tiên `codex exec` đã đăng nhập bằng tài khoản ChatGPT; OpenAI API chỉ là phương án dự phòng.
- Đóng gói instruction AAS trong tool và dùng Structured Outputs để khóa `id`, số lượng và thứ tự segment.
- Tự động chuẩn hóa các bài đạt Quality Gate, tối đa 3 bài song song.
- Tiến trình Codex chạy trong thư mục tạm, sandbox chỉ đọc, không nhận `OPENAI_API_KEY` và không lưu session của từng lượt chuẩn hóa.
- Cache theo content hash, provider/model và phiên bản instruction; mở lại nội dung giống nhau không gọi model lần nữa.
- Khi Codex chưa đăng nhập, hết hạn mức hoặc lỗi, tool tự dùng `gpt-4o-mini` nếu đã cấu hình API key. API retry tối đa 2 lần; lỗi từng bài không làm dừng cả batch.
- Brief có nút **Chuẩn hóa tự động** và vẫn giữ Copy/Dán thủ công trong mục dự phòng.
- Nội dung AI trả về vẫn phải được người dùng duyệt trước khi render VieNeu Local.
- `speechTextsFinalized` chỉ bật sau khi AI, clipboard hoặc người dùng thật sự chỉnh transcript.

Tool không tự động render batch. Mỗi Threads link vẫn tạo một video độc lập và cần mở brief để duyệt.
