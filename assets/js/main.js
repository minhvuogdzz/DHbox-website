/* DHbox website. Copyright (c) 2026 Công ty TNHH Phát triển công nghệ Devhouse Software. */
(function () {
  'use strict';

  // ---------- Settings ----------
  var RELEASES_REPO = 'minhvuogdzz/DHbox-releases';
  var RELEASES_API = 'https://api.github.com/repos/' + RELEASES_REPO + '/releases?per_page=15';
  var RELEASES_PAGE = 'https://github.com/' + RELEASES_REPO + '/releases/latest';
  // Used only when the GitHub API cannot be reached. Update now and then.
  var FALLBACK_RELEASE = {
    version: '1.4.0',
    url: 'https://github.com/minhvuogdzz/DHbox-releases/releases/download/v1.4.0/DHbox-1.4.0.dmg',
    name: 'DHbox-1.4.0.dmg',
    size: 18226907,
    date: '2026-11-11T08:27:08Z'
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
  var media = window.matchMedia ? window.matchMedia('(prefers-color-scheme: light)') : null;
  function effectiveTheme() {
    if (root.dataset.theme) return root.dataset.theme;
    return media && media.matches ? 'light' : 'dark';
  }
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
    { id: 'menubar', name: 'Thanh menu', icon: 'menubar' }
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
    ['ai', 'Nhớ màn hình', 'Ghi lại chữ đã thấy trên màn hình để tìm lại, mặc định tắt, có loại trừ app.', true],
    ['ai', 'Trợ lý thao tác', 'Ra lệnh bằng lời, xem trước từng bước, mọi việc có tác dụng phụ đều hỏi trước.', true],
    ['menubar', 'Bảng tổng quan', 'CPU từng nhân, bộ nhớ, áp lực bộ nhớ, bộ nhớ hoán đổi.'],
    ['menubar', 'Giữ máy thức', 'Theo giờ, đến khi tắt, hoặc cả khi gập máy.'],
    ['menubar', 'Âm lượng từng app', 'Chỉnh to nhỏ và chọn đầu ra riêng cho từng app.'],
    ['menubar', 'Mạng', 'Tốc độ hiện tại, IP nội bộ, đo tốc độ internet bằng công cụ của macOS.'],
    ['menubar', 'Ổ đĩa', 'Dung lượng, tổng đã đọc và ghi, tháo ổ ngoài nhanh.'],
    ['menubar', 'Pin', 'Sức khỏe, số lần sạc, nhiệt độ pin, app dùng nhiều năng lượng.'],
    ['menubar', 'Công tắc dừng khẩn cấp', 'Tắt toàn bộ tính năng chỉ với một cú bấm.'],
    ['menubar', 'Cập nhật trong app', 'Tự kiểm tra mỗi ngày, bản mới được kiểm tra chữ ký số trước khi cài.']
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
    var all = [{ id: 'all', name: 'Tất cả' }].concat(GROUPS);
    all.forEach(function (g) {
      var b = el('button', g.id === currentGroup ? 'is-on' : '');
      b.type = 'button';
      b.dataset.group = g.id;
      b.setAttribute('aria-pressed', String(g.id === currentGroup));
      b.appendChild(document.createTextNode(g.name));
      var count = g.id === 'all' ? FEATURES.length : FEATURES.filter(function (f) { return f[0] === g.id; }).length;
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
      if (currentGroup !== 'all' && f[0] !== currentGroup) return;
      var hay = foldSearch(f[1] + ' ' + f[2] + ' ' + groupById[f[0]].name);
      for (var w = 0; w < words.length; w++) if (hay.indexOf(words[w]) === -1) return;
      matched++;
      if (shown >= limit) return;
      var card = el('article', 'fitem');
      card.style.animationDelay = Math.min(shown, 12) * 25 + 'ms';
      if (currentGroup === 'all') card.appendChild(el('span', 'grp', groupById[f[0]].name));
      var h = el('h3', null, f[1]);
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
  var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var secretCount = $('#secret-count');
  if (secretCount && !reduceMotion) {
    var n = 30;
    setInterval(function () {
      if (document.hidden) return;
      n = n <= 1 ? 30 : n - 1;
      secretCount.textContent = String(n);
    }, 1000);
  }

  var typed = $('.typed');
  if (typed && !reduceMotion) {
    var phrases = typed.dataset.typed.split('|');
    var p = 0, c = phrases[0].length, deleting = true;
    var tick = function () {
      var word = phrases[p];
      if (deleting) {
        c--;
        if (c <= 0) { deleting = false; p = (p + 1) % phrases.length; }
      } else {
        c++;
        if (c >= phrases[p].length) { deleting = true; typed.textContent = phrases[p]; return setTimeout(tick, 1800); }
      }
      typed.textContent = (deleting ? word : phrases[p]).slice(0, Math.max(c, 0));
      setTimeout(tick, deleting ? 45 : 85);
    };
    setTimeout(tick, 2200);
  }

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
