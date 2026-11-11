# Website DHbox

Trang chính thức của DHbox, app tiện ích chạy trên thanh menu macOS. Trang tĩnh thuần HTML, CSS và JavaScript, không cần build.

Bản quyền thuộc Công ty TNHH Phát triển công nghệ Devhouse Software. Xem `LICENSE`.

## Cấu trúc

```
index.html                 Trang chủ: giới thiệu, tính năng, giá, hỏi đáp, tải về
dieu-khoan.html            Điều khoản sử dụng
chinh-sach-bao-mat.html    Chính sách quyền riêng tư
assets/css/style.css       Giao diện (theme tối và sáng)
assets/js/main.js          Tải về, danh sách tính năng, hỏi đáp, theme
assets/img/                Icon app và ảnh chia sẻ
```

## Xem trên máy

```bash
python3 -m http.server 8080
```

Rồi mở http://localhost:8080.

## Nút tải về

Mọi nút có thuộc tính `data-download` đều tải bản mới nhất mà không rời trang:

1. Gọi GitHub API `repos/minhvuogdzz/DHbox-releases/releases`, chọn bản phát hành mới nhất (không phải nháp, không phải pre-release) có tệp `.dmg`. Kết quả lưu trong phiên 10 phút.
2. Nút hiện trạng thái đang chuẩn bị, rồi điều hướng ngầm tới tệp `.dmg`. GitHub trả tệp kèm `Content-Disposition: attachment`, nên trình duyệt tải xuống ngay và trang vẫn đứng yên. Không dùng `iframe` ẩn vì bước chuyển hướng của GitHub có `X-Frame-Options: deny`.
3. Sau đó hiện hướng dẫn cài đặt.

Nếu GitHub API lỗi (ví dụ hết lượt gọi), trang dùng bản dự phòng ghi ở `FALLBACK_RELEASE` trong `assets/js/main.js`. Khi phát hành bản mới thì không cần sửa gì; chỉ nên cập nhật bản dự phòng thỉnh thoảng.

Thêm `?dryrun` vào địa chỉ để thử luồng tải mà không tải tệp thật (đường dẫn được in ra console).

## Giá

Giá, số ngày dùng thử và số máy đặt ở đầu `assets/js/main.js` (`PRICING`) và trong phần Giá của `index.html`. Máy chủ bản quyền (`/api/config`) chưa bật CORS nên trang chưa đọc giá trực tiếp; đổi giá trong trang quản trị thì sửa cả ở đây.

## Triển khai (DevOps)

Trang chạy tại **dhbox.devhouse.vn**. Image là nginx phục vụ tệp tĩnh, không có bước build mã nguồn.

```bash
docker compose up -d --build
```

- Container `dhbox-website` mở cổng `127.0.0.1:3120` (đổi bằng biến `HOST_PORT`), chỉ nghe trên loopback.
- Đặt nginx hoặc Caddy của máy chủ phía trước để lấy HTTPS: mẫu ở `deploy/nginx-host.conf`, sau đó `certbot --nginx -d dhbox.devhouse.vn`.
- DNS: bản ghi A (hoặc CNAME) của `dhbox.devhouse.vn` trỏ về máy chủ.
- Kiểm tra sống: `GET /healthz` trả `ok` (healthcheck của container dùng đường này).
- Không có secret hay biến môi trường bắt buộc. Trang chỉ gọi GitHub API từ trình duyệt của khách để lấy bản `.dmg` mới nhất.
- Cập nhật nội dung: `git pull && docker compose up -d --build`.

Lưu ý: Dockerfile, nginx.conf và compose chưa được build thử trên máy viết (không có Docker), nên lần build đầu cần để ý lỗi nhỏ.
