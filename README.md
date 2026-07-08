# Ghi Chú Chuẩn — App Desktop Lịch & Công việc (Tauri)

Ứng dụng **desktop Windows** (Tauri + React) lập lịch & nhắc việc văn phòng, có **AI OpenRouter**
đọc công văn (Vision OCR → lấy nội dung giao việc) và **Widget desktop** nổi trên màn hình.

Nhẹ, mở nhanh như app native (dùng WebView2 sẵn của Windows).

## Cách lấy bản cài (.exe)

App được **build tự động trên GitHub Actions** (không cần cài Rust ở máy):

- Đẩy 1 tag `v*` (vd `v1.0.0`) → Actions build ra bộ cài NSIS và tạo **GitHub Release** kèm `.exe`.
- Hoặc vào tab **Actions → Build Windows App → Run workflow** để build thủ công (tải ở mục *Artifacts*).

Khóa AI (`OPENROUTER_API_KEY`) được nhúng lúc build từ **repo Secret** cùng tên; model mặc định
`google/gemini-3-flash-preview` (đặt trong workflow).

## Phát triển tại máy (tùy chọn — cần Rust)

```powershell
npm install
npm run dev:vite      # chỉ frontend (web) ở cổng 1420
npm run tauri:dev     # chạy full app desktop (cần Rust + VS C++ Build Tools)
npm run tauri:build   # build .exe tại máy
```

Khóa AI khi build local đọc từ `.env.local` (không commit).

## Tính năng
- Lịch + danh sách công việc, lưu bằng `localStorage`.
- **Trợ lý lập lịch** (chat) và **Nhập công văn**: OCR ảnh/PDF → lấy nội dung giao việc → sửa text → AI xếp thành sự kiện + việc chuẩn bị → sửa/xóa từng việc → lưu.
- **Widget desktop**: bật/tắt từ khay hệ thống (tray), cửa sổ nổi trong suốt, luôn trên cùng.

## Kiến trúc
- `src/` — giao diện React (Calendar + Task widget, WidgetView).
- `src/aiClient.ts` — gọi lệnh AI qua Tauri `invoke` (fallback web fetch).
- `src-tauri/` — backend Rust: `ai.rs` (gọi OpenRouter), `config.rs` (key/model),
  `tray.rs` (khay hệ thống), `lib.rs` (cửa sổ chính + widget).
- `.github/workflows/build.yml` — build Tauri trên cloud → Release `.exe`.
