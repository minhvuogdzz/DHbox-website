/* DHbox website. Copyright (c) 2026 Công ty TNHH Phát triển công nghệ Devhouse Software. */
(function () {
  'use strict';

  // ---------- Settings ----------
  var RELEASES_REPO = 'minhvuogdzz/DHbox-releases';
  var RELEASES_API = 'https://api.github.com/repos/' + RELEASES_REPO + '/releases?per_page=15';
  var RELEASES_PAGE = 'https://github.com/' + RELEASES_REPO + '/releases/latest';
  // Used only when the GitHub API cannot be reached. Update now and then.
  var FALLBACK_RELEASE = {
    version: '2.9.1',
    url: 'https://github.com/minhvuogdzz/DHbox-releases/releases/download/v2.9.1/DHbox-2.9.1.dmg',
    name: 'DHbox-2.9.1.dmg',
    size: 34132480,
    date: '2026-11-23T14:05:52Z'
  };
  // Keep in sync with the license server admin page.
  var PRICING = { price: '249.000đ', trialDays: 7, devices: 2 };
  var CACHE_KEY = 'dhbox-release-v1';
  var CACHE_MS = 10 * 60 * 1000;
  var DRY_RUN = /[?&]dryrun\b/.test(location.search);

  document.documentElement.classList.remove('no-js');

  var $ = function (sel, root) { return (root || document).querySelector(sel); };
  var $$ = function (sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); };

  function store(kind) {
    try { return window[kind]; } catch (e) { return null; }
  }
  function storeGet(kind, key) {
    try { var s = store(kind); return s ? s.getItem(key) : null; } catch (e) { return null; }
  }
  function storeSet(kind, key, value) {
    try { var s = store(kind); if (s) s.setItem(key, value); } catch (e) { /* storage unavailable */ }
  }

  // Lowercase, no Vietnamese marks: the same matching the app uses for its palette.
  function fold(text) {
    return String(text).normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D');
  }
  function foldSearch(text) { return fold(text).toLowerCase(); }

  var yearEl = $('#year');
  if (yearEl) yearEl.textContent = String(new Date().getFullYear());

  // ---------- Theme ----------
  var root = document.documentElement;
  // Light is the default; dark only when the visitor picks it.
  function effectiveTheme() { return root.dataset.theme === 'dark' ? 'dark' : 'light'; }
  var themeBtn = $('#theme-toggle');
  if (themeBtn) {
    themeBtn.addEventListener('click', function () {
      var next = effectiveTheme() === 'dark' ? 'light' : 'dark';
      root.dataset.theme = next;
      storeSet('localStorage', 'dhbox-theme', next);
    });
  }

  // ---------- Nav ----------
  var nav = $('#nav');
  function onScroll() { if (nav) nav.classList.toggle('is-stuck', window.scrollY > 12); }
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  var burger = $('#nav-burger');
  var sheet = $('#nav-sheet');
  function closeSheet() { if (sheet) { sheet.hidden = true; burger.setAttribute('aria-expanded', 'false'); } }
  if (burger && sheet) {
    burger.addEventListener('click', function () {
      var open = sheet.hidden;
      sheet.hidden = !open;
      burger.setAttribute('aria-expanded', String(open));
    });
    $$('a', sheet).forEach(function (a) { a.addEventListener('click', closeSheet); });
  }

  // Highlight the section in view.
  var navLinks = $$('.nav__links a');
  if ('IntersectionObserver' in window && navLinks.length) {
    var spy = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        navLinks.forEach(function (a) { a.classList.toggle('is-active', a.getAttribute('href') === '#' + entry.target.id); });
      });
    }, { rootMargin: '-45% 0px -50% 0px' });
    navLinks.forEach(function (a) { var t = $(a.getAttribute('href')); if (t) spy.observe(t); });
    // Sections without a nav link clear the highlight when they reach the middle.
    ['#top', '#soft-notch', '#nhe', '#tai-ve'].forEach(function (id) { var t = $(id); if (t) spy.observe(t); });
  }

  // ---------- Reveal ----------
  var revealTargets = $$('.reveal, .art, .bento__item, .stat, .plan-card');
  revealTargets.forEach(function (el) { if (!el.classList.contains('reveal')) el.classList.add('reveal'); });
  if ('IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) { entry.target.classList.add('is-visible'); io.unobserve(entry.target); }
      });
    }, { threshold: 0.12 });
    revealTargets.forEach(function (el) { io.observe(el); });
  } else {
    revealTargets.forEach(function (el) { el.classList.add('is-visible'); });
  }

  // ---------- Feature catalogue ----------
  var GROUPS = [
    { id: 'notch', name: 'Soft Notch', icon: 'notch' },
    { id: 'windows', name: 'Cửa sổ và Dock', icon: 'window' },
    { id: 'smooth', name: 'Giữ máy mượt', icon: 'gauge' },
    { id: 'data', name: 'Dữ liệu', icon: 'rewind' },
    { id: 'security', name: 'Bảo mật', icon: 'shield' },
    { id: 'finder', name: 'Finder', icon: 'folder' },
    { id: 'actions', name: 'Hành động', icon: 'bolt' },
    { id: 'ai', name: 'AI và tự động', icon: 'chip' },
    { id: 'menubar', name: 'Thanh menu và Cài đặt', icon: 'menubar' },
    { id: 'focus', name: 'Tập trung và ghi chú', icon: 'note' },
    { id: 'devices', name: 'Thiết bị và kết nối', icon: 'wifi' }
  ];
  var FEATURES = [
    ['notch', 'Soft Notch', 'Phần mở rộng ngay dưới tai thỏ, mở khi rê chuột hoặc bấm, không cướp focus của app đang gõ.'],
    ['notch', 'Notch ảo', 'Máy không có tai thỏ hoặc màn hình ngoài vẫn có Soft Notch ở giữa mép trên.'],
    ['notch', 'Nhạc đang phát', 'Ảnh bìa, tên bài, phát, dừng và kéo để tua cho Music, Spotify và trình duyệt.'],
    ['notch', 'Kệ kéo thả', 'Giữ tệp tạm khi chuyển thư mục, xem nhanh bằng Space, chia sẻ ngay từ kệ.'],
    ['notch', 'Lịch sử clipboard', 'Những gì đã copy trong 30 phút gần nhất, secret được che.'],
    ['notch', 'Ô lệnh ⌃⌥N', 'Gõ tên lệnh bằng tiếng Việt, có dấu hay không dấu đều tìm được.'],
    ['notch', 'Hoạt động trực tiếp', 'Hẹn giờ, đổi âm lượng, cắm sạc, đổi tai nghe hiện ngay trên notch.'],
    ['notch', 'Tự ẩn khi cần', 'Ẩn khi xem toàn màn hình, trình chiếu; che chi tiết khi đang chia sẻ màn hình.'],
    ['windows', 'Xem trước cửa sổ trên Dock', 'Rê chuột lên icon Dock để thấy ảnh từng cửa sổ, bấm để mở đúng cửa sổ đó.'],
    ['windows', 'Command Tab theo cửa sổ', 'Danh sách từng cửa sổ có ảnh xem trước, bấm nhanh vẫn về cửa sổ trước.'],
    ['windows', 'Bấm Dock để thu nhỏ', 'Bấm lại icon của app đang mở để thu nhỏ cửa sổ của nó.'],
    ['windows', 'Tìm cửa sổ', 'Gõ tên để nhảy tới cửa sổ cần dùng, kể cả ở Space khác.'],
    ['windows', 'Phóng to cửa sổ', 'Đưa cửa sổ vừa khít màn hình mà không vào chế độ toàn màn hình.'],
    ['windows', 'Hồ sơ Dock', 'Bộ cài đặt Dock riêng cho code, họp, design, trình chiếu; khôi phục Dock như cũ bất cứ lúc nào.'],
    ['smooth', 'Hộp đen', 'Ghi CPU, bộ nhớ, áp lực bộ nhớ, nhiệt, pin, ổ đĩa và tiến trình nặng nhất theo thời gian.'],
    ['smooth', 'Chẩn đoán “vì sao”', 'Trả lời vì sao máy vừa chậm, nóng hay hao pin, kèm mốc thời gian làm bằng chứng.'],
    ['smooth', 'Cảnh báo sớm', 'Ví dụ ổ đĩa sẽ đầy trong khoảng mấy ngày nữa và thư mục nào là thủ phạm.'],
    ['smooth', 'Đóng băng app nền', 'App không dùng lâu được tạm dừng, về 0% CPU; mở lại là chạy tiếp.'],
    ['smooth', 'Hạ ưu tiên tiến trình nền', 'Tiến trình gây chậm được nhường chỗ để thao tác của bạn luôn mượt.'],
    ['smooth', 'Cổng và tiến trình', 'Xem tiến trình nào chiếm cổng, thoát lịch sự trước, buộc dừng là bước riêng có xác nhận.'],
    ['smooth', 'Tài nguyên của chính DHbox', 'CPU, bộ nhớ và số lần đánh thức của app hiển thị ngay trong Cài đặt.'],
    ['data', 'Tua lại tệp', 'Tệp bị sửa, ghi đè hay xóa trong thư mục bạn chọn đều có bản trước để khôi phục.'],
    ['data', 'Khôi phục tệp đã xóa', 'Lấy lại cả tệp đã xóa khỏi thư mục đang theo dõi, luôn xem trước khi khôi phục.'],
    ['data', 'Bản sao APFS', 'Phiên bản dùng bản sao copy-on-write nên gần như không tốn thêm dung lượng lúc chụp.'],
    ['data', 'Ảnh chụp cấu hình', 'Login Items, dotfiles, Homebrew, npm, pip, Xcode, hosts, cấu hình SSH (không lưu khóa riêng).'],
    ['data', 'So sánh trước và sau cập nhật', 'Xem cấu hình đổi gì sau khi cập nhật macOS, khôi phục từng mục.'],
    ['security', 'Bảo vệ secret', 'Nhận ra token, khóa API, khóa riêng trong clipboard, tệp .env, lịch sử shell và repo git.'],
    ['security', 'Tự xóa clipboard', 'Clipboard chứa secret được xóa sau vài giây, có nút đánh dấu an toàn.'],
    ['security', 'Không lưu nguyên văn', 'Chỉ lưu dấu vân tay để nhận ra lại, cảnh báo không hiện chính nội dung secret.'],
    ['security', 'Quick Look .env có che', 'Nhấn Space xem tệp .env, giá trị được che cho tới khi bạn bấm.'],
    ['security', 'Radar quyền riêng tư', 'App nào đang dùng camera, micro, tự thêm mục khởi động hay LaunchAgent.', true],
    ['security', 'Dữ liệu mã hóa', 'Dữ liệu nhạy cảm mã hóa trên máy, khóa trong Keychain, có nút xóa sạch.'],
    ['finder', 'Menu chuột phải DHbox', 'Hành động hợp với loại tệp đang chọn: ảnh, PDF, tài liệu, thư mục.'],
    ['finder', 'Cắt và dán tệp', 'Cắt bằng ⌘X, dán bằng ⌘V như trên Windows.'],
    ['finder', 'Phím kiểu Windows', 'Enter để mở, Delete để xóa vào Thùng rác, tùy chọn bật tắt.'],
    ['finder', 'DHbox Search', 'Tìm tệp và thư mục theo tên khắp máy, cả Google Drive, iCloud.'],
    ['finder', 'Chép tên tệp', 'Chép tên hoặc đường dẫn của nhiều tệp một lúc.'],
    ['finder', 'Tạo tệp mới', 'Tạo tệp văn bản, tài liệu, bảng tính ngay trong thư mục đang mở.'],
    ['finder', 'Quick Look cho dev', 'Xem .env, .log, JSON có tô màu chỉ bằng Space.'],
    ['finder', 'Nhận biết tệp chưa tải', 'Tệp iCloud hay ổ mạng chưa tải về được cảnh báo trước khi xử lý.'],
    ['actions', 'Giải mã JWT', 'Header, payload và hạn dùng dễ đọc.'],
    ['actions', 'JSON sang Swift Codable', 'Dán JSON, nhận struct đặt tên sẵn.'],
    ['actions', 'Định dạng JSON', 'Làm đẹp JSON, chỉ ra chỗ lỗi.'],
    ['actions', 'Base64 và URL', 'Mã hóa, giải mã hai chiều.'],
    ['actions', 'Đổi timestamp', 'Unix timestamp sang giờ UTC và giờ máy.'],
    ['actions', 'Bỏ dấu tiếng Việt', 'Chuyển câu có dấu thành không dấu.'],
    ['actions', 'Sửa lỗi gõ Telex', 'Sửa chữ bị gõ sai bộ gõ như “Vieejt Nam”.'],
    ['actions', 'Chuẩn hóa số điện thoại, ngày', 'Đưa danh sách lộn xộn về một định dạng thống nhất.'],
    ['actions', 'OCR ảnh và PDF', 'Lấy chữ, kể cả tiếng Việt, bằng Vision chạy trên máy.'],
    ['actions', 'Gộp, tách, xoay, nén PDF', 'Chọn trang, xoay trang, giảm dung lượng để gửi mail.'],
    ['actions', 'Bảng màu từ ảnh', 'Mã HEX và HSL của các màu chính.'],
    ['actions', 'Tương phản WCAG', 'Kiểm tra cặp chữ và nền đạt AA hay AAA.'],
    ['actions', 'Đổi định dạng ảnh', 'PNG, JPEG, HEIC, TIFF, giữ nguyên color profile.'],
    ['actions', 'Đổi kích thước theo mẫu', 'Các cỡ ảnh chia sẻ, icon app thường dùng.'],
    ['actions', 'Xóa nền ảnh', 'Tách chủ thể khỏi nền, chạy trên máy.'],
    ['actions', 'Che vùng nhạy cảm', 'Làm mờ thông tin trong ảnh trước khi gửi.'],
    ['actions', 'Tìm tệp trùng', 'Tìm tệp giống nhau, chuyển bản thừa vào Thùng rác.'],
    ['actions', 'Tệp to lâu không mở', 'Tìm tệp lớn đã lâu không dùng để dọn chỗ.'],
    ['actions', 'Dọn rác dev', 'DerivedData, cache simulator, Homebrew, pip, Yarn và node_modules cũ.'],
    ['ai', 'Tìm theo nội dung', 'Tìm tệp theo ý nghĩa và nội dung, không cần dấu, chỉ mục tạo trên máy.'],
    ['ai', 'Thao tác tệp bằng lời', 'Mô tả việc cần làm, xem trước từng tệp, chạy rồi hoàn tác được.'],
    ['ai', 'Diễn giải chẩn đoán', 'AI trên máy diễn đạt kết quả của Hộp đen, chỉ dựa trên số liệu đã đo.'],
    ['ai', 'Máy chủ AI cục bộ', 'Endpoint tương thích OpenAI cho công cụ dev, chỉ nghe 127.0.0.1, có token.'],
    ['ai', 'Quy tắc tự động', 'Sự kiện, Điều kiện, Hành động: cắm màn hình, đổi Wi-Fi, pin yếu, mở app, tệp mới.'],
    ['ai', 'Phím tắt và Spotlight', 'Mọi hành động có trong app Phím tắt và Spotlight qua App Intents.'],
    ['ai', 'Control Center', 'Công tắc đóng băng app, tạm dừng tua lại tệp, giữ máy thức.'],
    ['ai', 'Nhớ màn hình', 'Ghi lại chữ đã thấy trên màn hình để tìm lại, đọc tiếng Việt đúng dấu, mặc định tắt, có loại trừ app.', true],
    ['ai', 'Trợ lý thao tác', 'Ra lệnh bằng lời, xem trước từng bước, mọi việc có tác dụng phụ đều hỏi trước.', true],
    ['menubar', 'Bảng tổng quan', 'CPU từng nhân, bộ nhớ, áp lực bộ nhớ, bộ nhớ hoán đổi.'],
    ['menubar', 'Giữ máy thức', 'Theo giờ, đến khi tắt, hoặc cả khi gập máy.'],
    ['menubar', 'Âm lượng từng app', 'Chỉnh to nhỏ và chọn đầu ra riêng cho từng app.'],
    ['menubar', 'Mạng', 'Tốc độ hiện tại, IP nội bộ, đo tốc độ internet bằng công cụ của macOS.'],
    ['menubar', 'Ổ đĩa', 'Dung lượng, tổng đã đọc và ghi, tháo ổ ngoài nhanh.'],
    ['menubar', 'Pin', 'Sức khỏe, số lần sạc, nhiệt độ pin, app dùng nhiều năng lượng.'],
    ['menubar', 'Công tắc dừng khẩn cấp', 'Tắt toàn bộ tính năng chỉ với một cú bấm.'],
    ['menubar', 'Cập nhật trong app', 'Tự kiểm tra mỗi ngày, bản mới được kiểm tra chữ ký số trước khi cài.'],
    // ---- Added since 1.5 (last item flag: new) ----
    ['notch', 'Thông báo theo app', 'Chọn cho từng app: không hiện, hiện trên notch, hoặc hiện và bật chấm vàng. Chấm vàng chỉ dành cho cảnh báo của DHbox.', false, true],
    ['notch', 'Ghim clipboard', 'Ghim mục để không bị đẩy ra khỏi lịch sử.', false, true],
    ['notch', 'Dán lần lượt', 'Sao chép nhiều mục rồi dán từng cái theo thứ tự.', false, true],
    ['notch', 'Thanh thao tác trên kệ', 'Nén, đổi định dạng, nhận dạng chữ ngay trên tệp ở kệ tạm.', false, true],
    ['notch', 'Kéo tệp ra khỏi notch', 'Kéo ra chính tệp thật (bản sao, giữ tên gốc), bấm để chọn, nhấn Space để xem nhanh.', false, true],
    ['notch', 'Hiện notch khi quay màn hình', 'Tùy chọn, mặc định tắt. Khi bật, tên tệp và nội dung thông báo cũng có trong bản quay.', false, true],
    ['notch', 'Vuốt trên notch', 'Vuốt trên notch thu gọn để chỉnh âm lượng hoặc chuyển bài, mặc định tắt.', false, true],
    ['windows', 'Nhớ vị trí cửa sổ theo bộ màn hình', 'Cắm lại màn hình ngoài thì cửa sổ về chỗ cũ. Mặc định tắt.', false, true],
    ['windows', 'Hiệu ứng mở cửa sổ từ Dock', 'Bấm icon Dock để chuyển app, cửa sổ nổi lên và phóng mượt vào vị trí. Có công tắc để tắt.', false, true],
    ['smooth', 'Space Lens', 'Bản đồ bong bóng theo dung lượng: đi sâu vào thư mục, dọn vào Thùng rác, hoàn tác được. Mở từ chuột phải trong Finder.', false, true],
    ['smooth', 'DHbox nhẹ hơn', 'Cửa sổ Cài đặt chạy riêng và tự thoát khi đóng, ảnh trong clipboard và ảnh bìa nhạc chỉ giữ bản thu nhỏ. Khoảng 20 MB khi rảnh, theo ghi chú bản 2.5.0.', false, true],
    ['security', 'Thư mục khóa', 'Khóa thư mục nhạy cảm bằng Touch ID hoặc mật khẩu riêng, mã hóa AES-256, tự khóa khi máy ngủ.', false, true],
    ['finder', 'Gỡ cài đặt hoàn toàn', 'Chuột phải vào ứng dụng: xem trước mọi dấu vết và dung lượng, chuyển vào Thùng rác, có Hoàn tác. Mục cần quyền quản trị chỉ được liệt kê.', false, true],
    ['finder', 'Xóa cache ứng dụng', 'Dọn riêng cache của một app, có xem trước và hoàn tác.', false, true],
    ['finder', 'Xoay và lật hình', 'Xoay 90 độ, 180 độ, lật ngang, lật dọc, xem trước, lưu bản sao hoặc ghi đè, giữ color profile, hoàn tác bằng ⌘Z.', false, true],
    ['finder', 'Quick Look thư mục', 'Nhấn Space trên thư mục để duyệt bên trong: mở thư mục con, xem trước từng tệp, ảnh vẽ sắc nét.', false, true],
    ['finder', 'Shift Return để đổi tên', 'Đổi tên tệp bằng phím như quen tay trên Windows, tùy chọn trong Cài đặt.', false, true],
    ['finder', 'Gắn thẻ màu bằng phím', 'Command phải hoặc Option phải kèm 1 đến 8 để gắn thẻ màu, ấn lại để gỡ.', false, true],
    ['finder', 'Một mục DHbox duy nhất', 'Mọi thao tác gom vào một mục có menu con ở Finder và ở menu Dịch vụ, dùng được cả trong Google Drive, iCloud Drive và ổ ngoài.', false, true],
    ['actions', 'Chụp màn hình có chú thích', '⌘⇧1 chụp cả màn hình, ⌘⇧2 kéo chọn vùng. Vẽ bút, mũi tên, khung, thêm chữ, chọn màu rồi sao chép hoặc lưu.', false, true],
    ['actions', 'Chọn màu trên màn hình', '⌃⌥P lấy màu bất kỳ: HEX, HSL, RGB và độ tương phản WCAG.', false, true],
    ['actions', 'Dịch chữ đã sao chép', 'Dịch ngay trên máy, không gửi nội dung đi đâu. Cần macOS 15 trở lên.', false, true],
    ['actions', 'Lời nhắc bằng một câu', 'Gõ “nhắc tôi 3h chiều mai gọi khách” vào bảng lệnh để tạo lời nhắc trong app Lời nhắc.', false, true],
    ['ai', 'Theo dõi AI Agent trên notch', 'Xem các phiên Claude Code đang chạy, duyệt hoặc từ chối quyền ngay trên notch, nhảy về terminal, xem hạn mức. Cần bấm Nối với Claude Code để bật.', true, true],
    ['ai', 'Đánh thức Claude', 'Gửi một tin nhắn nhỏ qua Claude Code để mở chu kỳ 5 giờ đúng lúc bạn muốn, giữ máy thức tới lúc đó.', false, true],
    ['ai', 'Trợ lý trong cửa sổ nổi', 'Mở bằng ⌃⌥A hoặc từ bảng lệnh, có gợi ý bấm sẵn và câu mẫu khi trợ lý chưa hiểu yêu cầu.', true, true],
    ['ai', 'Liên kết hệ sinh thái DH', 'Chuột phải thư mục khách rồi chạy DH Studio Pro: Contact the Sheet để cập nhật Google Sheets hàng loạt. Mặc định tắt, cần DH Studio Pro 3.5.0 trở lên.', false, true],
    ['focus', 'Ghi chú trên notch', 'Nhiều ghi chú, gắn màu và mức quan trọng, mở ngay trên notch. Ghi chú cũ trở thành ghi chú đầu tiên.', false, true],
    ['focus', 'Định dạng như Ghi chú của Apple', 'Chữ đậm, nghiêng, gạch chân, tiêu đề, danh sách đánh số và dấu chấm, phím tắt ⌘B, ⌘I, ⌘U.', false, true],
    ['focus', 'Danh sách việc cần làm', 'Danh sách có ô tick: gõ [] rồi cách, hoặc ⇧⌘L.', false, true],
    ['focus', 'Ảnh trong ghi chú', 'Dán bằng ⌘V hoặc kéo thả, mỗi ảnh có nhãn riêng cho VoiceOver.', false, true],
    ['focus', 'Khóa ghi chú', 'Khóa bằng Touch ID hoặc mật khẩu máy. Ghi chú đã xóa giữ 30 ngày trong Đã xóa gần đây.', false, true],
    ['focus', 'Chế độ làm việc', 'Một công tắc đóng băng app gây xao nhãng, lọc thông báo và chạy hẹn giờ.', false, true],
    ['focus', 'Thời gian dùng từng app', 'Thống kê thời gian dùng app, chỉ lưu trên máy.', false, true],
    ['focus', 'Khóa bàn phím để lau', 'Chặn mọi phím trong 5 phút, chuột vẫn dùng được. Cần quyền Trợ năng.', false, true],
    ['devices', 'Bluetooth và pin thiết bị', 'Thiết bị đã ghép đôi, kết nối hoặc ngắt bằng một nút, pin AirPods, chuột, bàn phím khi đọc được.', false, true],
    ['devices', 'Danh sách Wi-Fi', 'Bật tắt, xem độ mạnh sóng, bấm một mạng để vào.', false, true],
    ['devices', 'Chia sẻ Wi-Fi bằng mã QR', 'Cho khách vào mạng không cần đọc mật khẩu.', false, true],
    ['devices', 'AirDrop thả tệp', 'Kéo tệp thả vào ô AirDrop để gửi ngay, xem ai đang thấy máy này.', false, true],
    ['devices', 'Điều khiển quạt', 'Tab Quạt trên notch và menu bar: tốc độ từng quạt, nhiệt độ CPU và GPU. Ba chế độ Hệ thống, Cố định, Theo nhiệt độ (Êm, Cân bằng, Mát).', false, true],
    ['devices', 'An toàn khi chỉnh quạt', 'Quạt tự trả về cho hệ thống khi DHbox thoát, máy từ 92 độ, mất cảm biến. Chỉnh quạt cần một thành phần quản trị cài một lần; Mac M3 trở lên chỉ xem được quạt.', false, true],
    ['devices', 'DHbox Mirror', 'Màn hình iPhone trong một cửa sổ trên Mac qua Wi-Fi, ghép đôi bằng mã QR, mã hóa đầu cuối, mặc định tắt. Cần app DHbox Mirror trên iPhone (iOS 18 trở lên).', false, true],
    ['devices', 'Cài đặt theo từng màn hình', 'Bật tắt notch, xem trước Dock, chụp màn hình và danh sách cửa sổ cho từng màn hình. Nhận diện màn hình, đặt làm màn hình chính.', false, true],
    ['devices', 'Tắt màn hình trong máy', 'Khi cắm màn hình ngoài, tắt màn hình của Mac mà luôn có đường khôi phục.', false, true],
    ['menubar', 'Cài đặt có ô Tìm', 'Gõ có dấu hay không dấu, tiếng Anh hay tên thường gọi (screenshot, touch id, claude) đều ra mục cần tìm.', false, true],
    ['menubar', 'Tiếng Việt và English', 'Chọn ngôn ngữ trong Cài đặt chung, hoặc theo hệ thống.', false, true],
    ['menubar', 'Xem nhanh bằng mô phỏng', 'Mục Cửa sổ và Soft Notch trong Cài đặt có màn hình giả chạy cảnh mô phỏng: con trỏ, phím, cửa sổ, notch.', false, true],
    ['menubar', 'Lịch sử phiên bản trong app', 'Mục Giới thiệu hiện năm bản mới nhất cùng ghi chú.', false, true],
    ['menubar', 'Cài lần đầu bằng một dòng lệnh', 'Tập lệnh kiểm SHA-256, chữ ký Ed25519 và chứng chỉ ký trước khi thay app. Không cần mật khẩu, không dùng sudo, macOS không chặn.', false, true]
  ];
  var groupById = {};
  GROUPS.forEach(function (g) { groupById[g.id] = g; });

  var list = $('#feature-list');
  var filters = $('#feature-filters');
  var search = $('#feature-search');
  var empty = $('#feature-empty');
  var currentGroup = 'all';
  var expanded = false;
  var COLLAPSED = 12;
  var moreBtn = $('#feature-more');
  if (moreBtn) moreBtn.addEventListener('click', function () { expanded = true; renderList(); });

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }
  function icon(name) {
    var ns = 'http://www.w3.org/2000/svg';
    var svg = document.createElementNS(ns, 'svg');
    svg.setAttribute('class', 'ico');
    svg.setAttribute('aria-hidden', 'true');
    var use = document.createElementNS(ns, 'use');
    use.setAttribute('href', '#i-' + name);
    svg.appendChild(use);
    return svg;
  }

  function renderFilters() {
    if (!filters) return;
    var all = [{ id: 'all', name: 'Tất cả' }, { id: 'new', name: 'Mới từ bản 1.5' }].concat(GROUPS);
    all.forEach(function (g) {
      var b = el('button', g.id === currentGroup ? 'is-on' : '');
      b.type = 'button';
      b.dataset.group = g.id;
      b.setAttribute('aria-pressed', String(g.id === currentGroup));
      b.appendChild(document.createTextNode(g.name));
      var count = g.id === 'all' ? FEATURES.length : g.id === 'new' ? FEATURES.filter(function (f) { return f[4]; }).length : FEATURES.filter(function (f) { return f[0] === g.id; }).length;
      b.appendChild(el('small', null, String(count)));
      b.addEventListener('click', function () {
        currentGroup = g.id;
        $$('button', filters).forEach(function (x) {
          var on = x.dataset.group === currentGroup;
          x.classList.toggle('is-on', on);
          x.setAttribute('aria-pressed', String(on));
        });
        renderList();
      });
      filters.appendChild(b);
    });
  }

  function renderList() {
    if (!list) return;
    var q = search ? foldSearch(search.value.trim()) : '';
    var words = q ? q.split(/\s+/) : [];
    list.textContent = '';
    var shown = 0, matched = 0;
    var limit = (!expanded && currentGroup === 'all' && !words.length) ? COLLAPSED : Infinity;
    FEATURES.forEach(function (f, i) {
      if (currentGroup === 'new' ? !f[4] : (currentGroup !== 'all' && f[0] !== currentGroup)) return;
      var hay = foldSearch(f[1] + ' ' + f[2] + ' ' + groupById[f[0]].name);
      for (var w = 0; w < words.length; w++) if (hay.indexOf(words[w]) === -1) return;
      matched++;
      if (shown >= limit) return;
      var card = el('article', 'fitem');
      card.style.animationDelay = Math.min(shown, 12) * 25 + 'ms';
      if (currentGroup === 'all') card.appendChild(el('span', 'grp', groupById[f[0]].name));
      var h = el('h3', null, f[1]);
      if (f[4]) h.appendChild(el('span', 'tag-new', 'Mới'));
      if (f[3]) h.appendChild(el('span', 'tag-exp', 'Thử nghiệm'));
      card.appendChild(h);
      card.appendChild(el('p', null, f[2]));
      list.appendChild(card);
      shown++;
    });
    if (empty) empty.hidden = shown !== 0;
    if (moreBtn) {
      moreBtn.hidden = matched <= shown;
      var label = $('.btn__label', moreBtn);
      if (label) label.textContent = 'Xem tất cả ' + FEATURES.length + ' tính năng';
    }
  }

  $$('[data-feature-count]').forEach(function (n) { n.textContent = String(FEATURES.length); });
  renderFilters();
  renderList();
  if (search) search.addEventListener('input', renderList);

  // Marquee: a selection of tool names, doubled for a seamless loop.
  var track = $('#marquee-track');
  if (track) {
    var picks = FEATURES.filter(function (_, i) { return i % 2 === 0; });
    var build = function () {
      picks.forEach(function (f) {
        var s = el('span');
        s.appendChild(icon(groupById[f[0]].icon));
        s.appendChild(document.createTextNode(f[1]));
        track.appendChild(s);
      });
    };
    build(); build();
    $$('span', track).slice(picks.length).forEach(function (s) { s.setAttribute('aria-hidden', 'true'); });
  }

  // ---------- Action tabs ----------
  var tabs = $$('.tab');
  tabs.forEach(function (tab) {
    tab.addEventListener('click', function () {
      tabs.forEach(function (t) {
        var on = t === tab;
        t.classList.toggle('is-on', on);
        t.setAttribute('aria-selected', String(on));
      });
      $$('.action-panel').forEach(function (p) {
        var on = p.dataset.panel === tab.dataset.tab;
        p.hidden = !on;
        p.classList.toggle('is-on', on);
      });
    });
  });

  // ---------- Remove-marks demo ----------
  var demoIn = $('#demo-in');
  var demoOut = $('#demo-out');
  if (demoIn && demoOut) {
    var update = function () { demoOut.textContent = fold(demoIn.value) || '…'; };
    demoIn.addEventListener('input', update);
    update();
  }

  // ---------- Small animations in the mockups ----------
  // ---------- Release info ----------
  function formatSize(bytes) {
    if (!bytes) return '';
    return (bytes / 1048576).toFixed(1).replace('.', ',') + ' MB';
  }
  function formatDate(iso) {
    if (!iso) return '';
    var d = new Date(iso);
    if (isNaN(d)) return '';
    return d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
  }

  function pickRelease(releases) {
    for (var i = 0; i < releases.length; i++) {
      var r = releases[i];
      if (r.draft || r.prerelease) continue;
      var assets = r.assets || [];
      for (var j = 0; j < assets.length; j++) {
        if (/\.dmg$/i.test(assets[j].name)) {
          return {
            version: String(r.tag_name || '').replace(/^v/, ''),
            url: assets[j].browser_download_url,
            name: assets[j].name,
            size: assets[j].size,
            date: r.published_at
          };
        }
      }
    }
    return null;
  }

  var releasePromise = null;
  function getRelease() {
    if (releasePromise) return releasePromise;
    var cached = storeGet('sessionStorage', CACHE_KEY);
    if (cached) {
      try {
        var obj = JSON.parse(cached);
        if (obj && obj.at && Date.now() - obj.at < CACHE_MS && obj.release && obj.release.url) {
          releasePromise = Promise.resolve(obj.release);
          return releasePromise;
        }
      } catch (e) { /* ignore bad cache */ }
    }
    var timeout = new Promise(function (_, reject) { setTimeout(function () { reject(new Error('timeout')); }, 6000); });
    var request = fetch(RELEASES_API, { headers: { Accept: 'application/vnd.github+json' } })
      .then(function (res) { if (!res.ok) throw new Error('HTTP ' + res.status); return res.json(); })
      .then(function (data) {
        var r = pickRelease(Array.isArray(data) ? data : []);
        if (!r) throw new Error('no dmg');
        storeSet('sessionStorage', CACHE_KEY, JSON.stringify({ at: Date.now(), release: r }));
        return r;
      });
    releasePromise = Promise.race([request, timeout]).catch(function () {
      releasePromise = null; // try the API again next time
      return FALLBACK_RELEASE;
    });
    return releasePromise;
  }

  function showRelease(r) {
    $$('[data-release-version]').forEach(function (n) { n.textContent = r.version; });
    $$('[data-release-size]').forEach(function (n) { n.textContent = formatSize(r.size); });
    $$('[data-release-date]').forEach(function (n) { n.textContent = formatDate(r.date); });
  }
  showRelease(FALLBACK_RELEASE);
  getRelease().then(showRelease);

  // ---------- Download without leaving the page ----------
  function startDownload(url) {
    if (DRY_RUN) { console.info('[DHbox] dry run, would download', url); return; }
    // GitHub answers release assets with Content-Disposition: attachment, so navigating
    // to the asset makes the browser save the file while this page stays as it is.
    // (A hidden iframe is not used: GitHub's redirect carries X-Frame-Options: deny.)
    var a = document.createElement('a');
    a.href = url;
    a.rel = 'noopener';
    a.setAttribute('download', '');
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    setTimeout(function () { if (a.parentNode) a.parentNode.removeChild(a); }, 0);
  }

  function setLabel(btn, text) {
    var label = $('.btn__label', btn);
    if (!label) return;
    if (!btn.dataset.label) btn.dataset.label = label.textContent;
    label.textContent = text;
  }
  function resetButton(btn) {
    btn.classList.remove('is-busy', 'is-done');
    btn.removeAttribute('aria-busy');
    if (btn.dataset.label) setLabel(btn, btn.dataset.label);
    var use = $('.btn__icon use', btn);
    if (use) use.setAttribute('href', '#i-download');
  }

  var lastRelease = null;
  var busy = false;
  function download(btn) {
    if (busy) return;
    busy = true;
    var compact = !$('.btn__label', btn) || getComputedStyle($('.btn__label', btn)).display === 'none';
    btn.classList.add('is-busy');
    btn.setAttribute('aria-busy', 'true');
    if (!compact) setLabel(btn, 'Đang chuẩn bị…');
    var minWait = new Promise(function (resolve) { setTimeout(resolve, 650); });

    Promise.all([getRelease(), minWait]).then(function (results) {
      var r = results[0];
      lastRelease = r;
      startDownload(r.url);
      btn.classList.remove('is-busy');
      btn.classList.add('is-done');
      var use = $('.btn__icon use', btn);
      if (use) use.setAttribute('href', '#i-check');
      if (!compact) setLabel(btn, 'Đang tải xuống');
      openSheet(r);
      setTimeout(function () { resetButton(btn); busy = false; }, 2600);
    });
  }

  $$('[data-download]').forEach(function (btn) {
    btn.addEventListener('click', function (e) {
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.button === 1) return; // let modified clicks behave normally
      e.preventDefault();
      closeSheet();
      download(btn);
    });
  });

  // Copy the one-line install command.
  $$('[data-copy-cmd]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var code = $('[data-install-cmd]', btn.parentNode);
      var text = code ? code.textContent : '';
      var done = function () { toast('Đã chép lệnh. Dán vào Terminal rồi bấm Return.'); };
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(done, done); else done();
    });
  });

  // Warm the cache once the page is idle so the click feels instant.
  (window.requestIdleCallback || function (fn) { setTimeout(fn, 1200); })(function () { getRelease(); });

  // ---------- Install sheet ----------
  var installSheet = $('#install-sheet');
  var lastFocus = null;
  function openSheet(r) {
    if (!installSheet) return;
    $('#sheet-file').textContent = r.name + (r.size ? ' · ' + formatSize(r.size) : '') + ' · phiên bản ' + r.version;
    $('#sheet-direct').href = RELEASES_PAGE;
    lastFocus = document.activeElement;
    installSheet.hidden = false;
    var closeBtn = $('.sheet__close', installSheet);
    if (closeBtn) closeBtn.focus();
  }
  function hideSheet() {
    if (!installSheet || installSheet.hidden) return;
    installSheet.hidden = true;
    if (lastFocus && lastFocus.focus) lastFocus.focus();
  }
  if (installSheet) {
    $$('[data-close]', installSheet).forEach(function (n) { n.addEventListener('click', hideSheet); });
    var retry = $('#sheet-retry');
    if (retry) retry.addEventListener('click', function (e) {
      e.preventDefault();
      if (lastRelease) { startDownload(lastRelease.url); toast('Đã gửi lại yêu cầu tải xuống.'); }
    });
  }
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') { hideSheet(); closeSheet(); }
  });

  var toastEl = $('#toast');
  var toastTimer = null;
  function toast(text) {
    if (!toastEl) return;
    toastEl.textContent = text;
    toastEl.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toastEl.hidden = true; }, 2600);
  }

  // Expose pricing for anyone inspecting the page; the HTML holds the same values.
  window.DHBOX_PRICING = PRICING;
})();
