/* DHbox website: interactive mockups.
   Copyright (c) 2026 Công ty TNHH Phát triển công nghệ Devhouse Software. */
(function () {
  'use strict';

  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const canHover = window.matchMedia('(hover: hover)').matches;
  const fold = (t) => String(t).normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase();
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  // Runs `fn` while `el` is on screen and the tab is visible; `fn` gets called every `ms`.
  function whileVisible(el, ms, fn) {
    let onScreen = false;
    const io = new IntersectionObserver((e) => { onScreen = e[0].isIntersecting; }, { threshold: 0.15 });
    io.observe(el);
    return setInterval(() => { if (onScreen && !document.hidden) fn(); }, ms);
  }
  function onceVisible(el, fn) {
    const io = new IntersectionObserver((e) => {
      if (e[0].isIntersecting) { io.disconnect(); fn(); }
    }, { threshold: 0.3 });
    io.observe(el);
  }
  function setIcon(el, name) { const u = el && $('use', el); if (u) u.setAttribute('href', '#i-' + name); }
  function retrigger(el, cls) { el.classList.remove(cls); void el.offsetWidth; el.classList.add(cls); }

  // Copy of an element shrunk into a preview box (window previews in the Dock and Command Tab).
  function shot(source, box) {
    const clone = source.cloneNode(true);
    clone.removeAttribute('data-win');
    clone.removeAttribute('data-mw');
    clone.classList.remove('is-min', 'is-front', 'is-jump');
    clone.setAttribute('aria-hidden', 'true');
    $$('[tabindex], button, input', clone).forEach((n) => n.setAttribute('tabindex', '-1'));
    const width = source.offsetWidth || 300;
    clone.style.width = width + 'px';
    clone.style.transform = 'scale(' + (box.clientWidth / width) + ')';
    box.appendChild(clone);
  }

  // ---------- Range sliders ----------
  function paintRange(r) {
    const p = ((r.value - r.min) / (r.max - r.min)) * 100;
    r.style.setProperty('--p', p + '%');
    if (r.hasAttribute('data-vol')) {
      const out = r.parentElement.querySelector('b');
      if (out) out.textContent = Number(r.value) === 0 ? 'Tắt' : r.value;
    }
  }
  $$('.range').forEach((r) => { paintRange(r); r.addEventListener('input', () => paintRange(r)); });

  // =====================================================================
  // Hero desktop: Soft Notch, windows, Dock previews, tray overview
  // =====================================================================
  function initDesktop() {
    const root = $('#demo-screen');
    if (!root) return;
    const display = $('[data-display]', root);
    const island = $('[data-island]', root);
    const hint = $('[data-hint]', root);
    const frontName = $('[data-front-name]', root);
    let touched = false;
    const touch = () => { if (!touched) { touched = true; if (hint) hint.classList.add('is-gone'); } };
    ['pointerdown', 'mouseover'].forEach((ev) => display.addEventListener(ev, (e) => {
      if (e.type === 'mouseover' && !e.target.closest('.island, .dock, .tray, .mbar__tray')) return;
      touch();
    }));

    // --- Soft Notch ---
    let awake = false, openTimer, closeTimer;
    const setIsland = (state) => {
      island.dataset.state = state;
      island.setAttribute('aria-expanded', String(state === 'open'));
    };
    const rest = () => (awake ? 'live' : 'closed');
    const open = () => { clearTimeout(closeTimer); setIsland('open'); };
    const close = () => { clearTimeout(openTimer); setIsland(rest()); };
    island.addEventListener('mouseenter', () => {
      if (!canHover) return;
      clearTimeout(closeTimer);
      openTimer = setTimeout(open, 180); // hover intent, like the app
    });
    island.addEventListener('mouseleave', () => {
      clearTimeout(openTimer);
      if (canHover) closeTimer = setTimeout(close, 450);
    });
    island.addEventListener('click', (e) => {
      if (e.target.closest('button')) return;
      island.dataset.state === 'open' ? close() : open();
    });
    island.addEventListener('keydown', (e) => {
      if (e.target !== island) return;
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); island.dataset.state === 'open' ? close() : open(); }
      if (e.key === 'Escape') close();
    });
    onceVisible(root, () => setTimeout(() => { if (island.dataset.state !== 'open') open(); }, reduceMotion ? 0 : 1100));

    const play = $('[data-play]', island);
    const wave = $('.wave', island);
    play.addEventListener('click', () => {
      const paused = wave.classList.toggle('is-paused');
      setIcon(play, paused ? 'play' : 'pause');
      play.setAttribute('aria-label', paused ? 'Phát nhạc' : 'Tạm dừng nhạc');
    });

    const freezeRow = $('[data-freeze-row]', island);
    const freezeBtn = $('[data-freeze]', island);
    freezeBtn.addEventListener('click', () => {
      const done = freezeRow.classList.toggle('is-done');
      $('[data-freeze-title]', island).textContent = done ? 'Đã đóng băng Chrome Helper' : 'Chrome Helper dùng 41% CPU';
      $('[data-freeze-sub]', island).textContent = done ? 'CPU về 0%. Mở lại là chạy tiếp.' : 'Không mở trong 25 phút';
      freezeBtn.textContent = done ? 'Rã đông' : 'Đóng băng';
    });

    // --- Tray overview ---
    const tray = $('[data-tray]', root);
    const trayBtn = $('[data-tray-toggle]', root);
    const setTray = (on) => {
      tray.classList.toggle('is-closed', !on);
      trayBtn.classList.toggle('is-on', on);
      trayBtn.setAttribute('aria-expanded', String(on));
    };
    trayBtn.addEventListener('click', () => setTray(tray.classList.contains('is-closed')));
    $$('[data-tray-tab]', tray).forEach((tab) => tab.addEventListener('click', () => {
      $$('[data-tray-tab]', tray).forEach((t) => t.classList.toggle('is-on', t === tab));
      $$('[data-tray-pane]', tray).forEach((p) => { p.hidden = p.dataset.trayPane !== tab.dataset.trayTab; });
    }));

    const awakeSwitch = $('[data-awake]', tray);
    const awakeIcon = $('[data-awake-icon]', root);
    const awakeTime = $('[data-awake-time]', island);
    let awakeLeft = 3599, awakeTimer = null;
    const fmt = (s) => String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0');
    awakeSwitch.addEventListener('click', () => {
      awake = !awake;
      awakeSwitch.classList.toggle('is-on', awake);
      awakeSwitch.setAttribute('aria-checked', String(awake));
      awakeIcon.hidden = !awake;
      if (island.dataset.state !== 'open') setIsland(rest());
      clearInterval(awakeTimer);
      if (awake) {
        awakeLeft = 3599;
        awakeTime.textContent = fmt(awakeLeft);
        awakeTimer = setInterval(() => { awakeLeft = Math.max(0, awakeLeft - 1); awakeTime.textContent = fmt(awakeLeft); }, 1000);
      }
    });

    const cpu = $('[data-cpu]', tray), cpuBar = $('[data-cpu-bar]', tray);
    const mem = $('[data-mem]', tray), memBar = $('[data-mem-bar]', tray);
    const netMini = $('[data-net-mini]', tray), self = $('[data-self-cpu]', tray);
    if (!reduceMotion) whileVisible(root, 1600, () => {
      const c = 7 + Math.round(Math.random() * 12);
      cpu.textContent = c + '%'; cpuBar.style.setProperty('--v', c / 100);
      const m = 14 + Math.random() * 0.6;
      mem.textContent = m.toFixed(1).replace('.', ',') + ' GB'; memBar.style.setProperty('--v', m / 24);
      netMini.textContent = '↓ ' + (30 + Math.round(Math.random() * 40)) + ' ↑ ' + (3 + Math.round(Math.random() * 6)) + ' Mb/s';
      self.textContent = (0.1 + Math.random() * 0.2).toFixed(1).replace('.', ',') + '%';
    });

    const speedBtn = $('[data-speedtest]', tray);
    speedBtn.addEventListener('click', async () => {
      speedBtn.disabled = true;
      speedBtn.textContent = 'Đang đo, khoảng 15 giây…';
      const down = $('[data-speed-down]', tray), up = $('[data-speed-up]', tray);
      const goalD = 380 + Math.round(Math.random() * 120), goalU = 32 + Math.round(Math.random() * 18);
      for (let i = 1; i <= 24; i++) {
        const k = i / 24;
        down.textContent = Math.round(goalD * k * (0.85 + Math.random() * 0.15)) + ' Mb/s';
        up.textContent = Math.round(goalU * k * (0.85 + Math.random() * 0.15)) + ' Mb/s';
        await sleep(reduceMotion ? 0 : 90);
      }
      down.textContent = goalD + ' Mb/s'; up.textContent = goalU + ' Mb/s';
      speedBtn.disabled = false;
      speedBtn.textContent = 'Đo lại';
    });

    // --- Windows ---
    const wins = $$('.win', display);
    const dock = $('[data-dock]', root);
    const peek = $('[data-peek]', root);
    const names = { finder: 'Finder', notes: 'Ghi chú', web: 'Trình duyệt' };
    let zTop = 10;
    const iconOf = (app) => $('[data-dock-app="' + app + '"]', dock);
    const frontmost = () => wins.filter((w) => !w.classList.contains('is-min'))
      .sort((a, b) => Number(b.style.getPropertyValue('--z')) - Number(a.style.getPropertyValue('--z')))[0];

    function aimAtDock(win) {
      const icon = iconOf(win.dataset.app);
      if (!icon) return;
      const d = display.getBoundingClientRect(), i = icon.getBoundingClientRect();
      const left = win.offsetLeft + win.offsetWidth / 2, top = win.offsetTop + win.offsetHeight / 2;
      win.style.setProperty('--tx', (i.left + i.width / 2 - d.left - left) + 'px');
      win.style.setProperty('--ty', (i.top + i.height / 2 - d.top - top) + 'px');
    }
    function bringFront(win, jump) {
      const wasMin = win.classList.contains('is-min');
      win.classList.remove('is-min');
      win.style.setProperty('--z', ++zTop);
      wins.forEach((w) => w.classList.toggle('is-front', w === win));
      frontName.textContent = names[win.dataset.app] || 'Finder';
      if (jump && !wasMin && !reduceMotion) retrigger(win, 'is-jump');
    }
    function minimize(win) {
      aimAtDock(win);
      win.classList.remove('is-jump', 'is-front');
      win.classList.add('is-min');
      const next = frontmost();
      if (next) bringFront(next, false); else frontName.textContent = 'Finder';
    }
    wins.forEach((w) => {
      w.addEventListener('pointerdown', () => { if (w !== frontmost()) bringFront(w, false); });
      if (w.classList.contains('is-min')) requestAnimationFrame(() => aimAtDock(w));
    });
    bringFront($('[data-win="finder"]', display), false);

    // --- Dock and previews ---
    let peekApp = null, peekShowTimer, peekHideTimer;
    function hidePeek() { peek.hidden = true; peekApp = null; $$('.dock__app', dock).forEach((b) => b.classList.remove('is-hot')); }
    function showPeek(app) {
      const appWins = wins.filter((w) => w.dataset.app === app);
      const icon = iconOf(app);
      if (!appWins.length || !icon) { hidePeek(); return; }
      peekApp = app;
      peek.textContent = '';
      peek.hidden = false;
      $$('.dock__app', dock).forEach((b) => b.classList.toggle('is-hot', b === icon));
      peek.style.setProperty('--px', (icon.offsetLeft + icon.offsetWidth / 2) + 'px');
      appWins.forEach((w) => {
        const item = document.createElement('button');
        item.type = 'button';
        item.className = 'peek__item';
        const box = document.createElement('span');
        box.className = 'peek__shot';
        const label = document.createElement('span');
        label.className = 'peek__label';
        label.textContent = w.dataset.title;
        if (w.classList.contains('is-min')) {
          const small = document.createElement('small');
          small.textContent = 'Đã thu nhỏ';
          label.appendChild(small);
        }
        item.append(box, label);
        item.addEventListener('click', () => { bringFront(w, true); hidePeek(); });
        peek.appendChild(item);
        shot(w, box);
      });
    }
    $$('.dock__app', dock).forEach((btn) => {
      const app = btn.dataset.dockApp;
      btn.addEventListener('mouseenter', () => {
        if (!canHover) return;
        clearTimeout(peekHideTimer);
        clearTimeout(peekShowTimer);
        peekShowTimer = setTimeout(() => showPeek(app), peekApp ? 0 : 160);
      });
      btn.addEventListener('click', () => {
        touch();
        const appWins = wins.filter((w) => w.dataset.app === app);
        if (!appWins.length) {
          if (!reduceMotion) retrigger(btn, 'is-bounce');
          if (app === 'dhbox') setTray(true);
          if (app === 'music') open();
          return;
        }
        if (!canHover && peekApp !== app) { showPeek(app); return; }
        hidePeek();
        const visible = appWins.filter((w) => !w.classList.contains('is-min'));
        const top = frontmost();
        if (visible.length && top && top.dataset.app === app) visible.forEach(minimize); // click Dock to minimize
        else if (visible.length) bringFront(visible[visible.length - 1], true);
        else bringFront(appWins[0], true);
      });
    });
    dock.addEventListener('mouseleave', () => {
      clearTimeout(peekShowTimer);
      peekHideTimer = setTimeout(hidePeek, 260);
    });
    dock.addEventListener('mouseenter', () => clearTimeout(peekHideTimer));
    document.addEventListener('pointerdown', (e) => { if (!e.target.closest('.dock')) hidePeek(); });
    window.addEventListener('resize', () => { hidePeek(); wins.forEach((w) => { if (w.classList.contains('is-min')) aimAtDock(w); }); });
  }

  // =====================================================================
  // Soft Notch section: command box and clipboard
  // =====================================================================
  const COMMANDS = [
    { t: 'Giữ máy thức 1 giờ', i: 'cup', r: 'Đã bật giữ máy thức trong 1 giờ.' },
    { t: 'Giữ máy thức đến khi tắt', i: 'cup', r: 'Máy sẽ thức cho đến khi bạn tắt.' },
    { t: 'Hẹn giờ 25 phút', i: 'clock', r: 'Đã hẹn giờ 25 phút, đếm ngược trên Soft Notch.' },
    { t: 'Đóng băng app nền', i: 'bolt', r: 'Đã đóng băng 3 app không dùng trong 20 phút.' },
    { t: 'Rã đông tất cả', i: 'bolt', r: 'Đã rã đông mọi app.' },
    { t: 'Bỏ dấu đoạn đã chọn', i: 'doc', r: 'Đã bỏ dấu và chép vào clipboard.' },
    { t: 'Xem cổng 3000', i: 'terminal', r: 'Cổng 3000: node, PID 4821, thư mục web-shop.' },
    { t: 'Dọn rác dev', i: 'cube', r: 'Có 6,4 GB dọn được. Mở danh sách để xem trước.' },
    { t: 'Mở Hộp đen', i: 'gauge', r: 'Đang mở Hộp đen, 2 giờ gần nhất.' },
    { t: 'Tìm tệp theo tên', i: 'search', r: 'Đang mở DHbox Search.' },
    { t: 'Chụp cấu hình máy', i: 'rewind', r: 'Đã chụp cấu hình máy: 214 mục.' },
    { t: 'Dừng khẩn cấp', i: 'x', r: 'Đã tắt toàn bộ tính năng. Bật lại trong Cài đặt.' }
  ];
  const DEFAULTS = [0, 2, 3, 6];

  function initPalette() {
    const box = $('[data-palette]');
    if (!box) return;
    const input = $('[data-palette-input]', box);
    const list = $('[data-palette-list]', box);
    const done = $('[data-palette-done]', box);
    let results = [], sel = 0, human = false, busy = false;

    function render() {
      const q = fold(input.value.trim());
      const words = q ? q.split(/\s+/) : [];
      results = words.length
        ? COMMANDS.filter((c) => words.every((w) => fold(c.t).includes(w))).slice(0, 4)
        : DEFAULTS.map((i) => COMMANDS[i]);
      sel = Math.min(sel, Math.max(0, results.length - 1));
      list.textContent = '';
      if (!results.length) {
        const p = document.createElement('p');
        p.className = 'palette__empty';
        p.textContent = 'Không có lệnh nào khớp.';
        list.appendChild(p);
        return;
      }
      results.forEach((c, i) => {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'palette__item' + (i === sel ? ' is-on' : '');
        b.setAttribute('role', 'option');
        b.setAttribute('aria-selected', String(i === sel));
        b.innerHTML = '<svg class="ico"><use href="#i-' + c.i + '"/></svg><span></span>' + (i === sel ? '<kbd>↩</kbd>' : '');
        b.querySelector('span').textContent = c.t;
        b.addEventListener('mouseenter', () => { sel = i; render(); });
        b.addEventListener('click', () => { human = true; sel = i; run(); });
        list.appendChild(b);
      });
    }
    async function run() {
      const c = results[sel];
      if (!c || busy) return;
      busy = true;
      list.hidden = true;
      done.hidden = false;
      $('span', done).textContent = c.r;
      await sleep(2200);
      done.hidden = true;
      list.hidden = false;
      input.value = '';
      sel = 0;
      render();
      busy = false;
    }
    input.addEventListener('input', () => { human = true; sel = 0; render(); });
    input.addEventListener('focus', () => { human = true; });
    input.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowDown') { e.preventDefault(); sel = (sel + 1) % Math.max(1, results.length); render(); }
      if (e.key === 'ArrowUp') { e.preventDefault(); sel = (sel - 1 + results.length) % Math.max(1, results.length); render(); }
      if (e.key === 'Enter') { e.preventDefault(); run(); }
      if (e.key === 'Escape') { input.value = ''; render(); }
    });
    render();

    // Self-typing demo until the visitor takes over.
    if (!reduceMotion) onceVisible(box, async () => {
      const phrases = ['giu may', 'dong bang', 'cong 3000', 'don rac'];
      await sleep(900);
      for (let n = 0; !human; n++) {
        const p = phrases[n % phrases.length];
        for (let i = 1; i <= p.length && !human; i++) { input.value = p.slice(0, i); sel = 0; render(); await sleep(110); }
        if (human) break;
        await sleep(900);
        if (human) break;
        await run();
        await sleep(700);
      }
    });

    // Clipboard row holding a secret clears itself.
    const secret = $('[data-clip-secret]');
    const count = $('[data-clip-count]');
    if (secret && count && !reduceMotion) {
      let left = 12;
      whileVisible(secret, 1000, () => {
        left -= 1;
        if (left > 0) { count.textContent = left; return; }
        if (left === 0) secret.classList.add('is-gone');
        if (left <= -3) { left = 12; count.textContent = left; secret.classList.remove('is-gone'); }
      });
    }
  }

  // =====================================================================
  // Command Tab with previews
  // =====================================================================
  function initCommandTab() {
    const art = $('[data-cmdtab]');
    if (!art) return;
    const mws = $$('.mini-win', art);
    const listEl = $('[data-switcher-list]', art);
    const title = $('[data-switcher-title]', art);
    let sel = 1, z = 5, human = false;

    function build() {
      listEl.textContent = '';
      mws.forEach((mw, i) => {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'sw-item' + (i === sel ? ' is-on' : '');
        b.setAttribute('aria-label', mw.dataset.title);
        b.addEventListener('click', () => { human = true; select(i, true); });
        listEl.appendChild(b);
        shot(mw, b);
      });
    }
    function select(i, jump) {
      sel = i;
      $$('.sw-item', listEl).forEach((b, k) => b.classList.toggle('is-on', k === i));
      title.textContent = mws[i].dataset.title;
      mws[i].style.zIndex = ++z;
      mws.forEach((m, k) => m.classList.toggle('is-front', k === i));
      if (jump && !reduceMotion) retrigger(mws[i], 'is-jump');
    }
    $('[data-cmdtab-next]', art).addEventListener('click', () => { human = true; select((sel + 1) % mws.length, true); });
    art.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
        e.preventDefault();
        human = true;
        select((sel + (e.key === 'ArrowRight' ? 1 : -1) + mws.length) % mws.length, true);
      }
    });
    build();
    select(sel, false);
    let t;
    window.addEventListener('resize', () => { clearTimeout(t); t = setTimeout(build, 200); });
    if (!reduceMotion) whileVisible(art, 2800, () => { if (!human) select((sel + 1) % mws.length, true); });
  }

  // =====================================================================
  // Black box chart
  // =====================================================================
  function initChart() {
    const wrap = $('[data-chart]');
    if (!wrap) return;
    const cross = $('[data-chart-cross]', wrap), tip = $('[data-chart-tip]', wrap);
    const pts = [[0, 98], [20, 95], [40, 97], [60, 92], [80, 94], [100, 90], [120, 88], [135, 40], [150, 28], [165, 34], [180, 30], [195, 46], [210, 86], [230, 90], [250, 92], [270, 89], [290, 93], [320, 95]];
    const yAt = (x) => {
      for (let i = 1; i < pts.length; i++) {
        if (x <= pts[i][0]) {
          const [x0, y0] = pts[i - 1], [x1, y1] = pts[i];
          return y0 + ((x - x0) / (x1 - x0)) * (y1 - y0);
        }
      }
      return pts[pts.length - 1][1];
    };
    function move(e) {
      const r = wrap.getBoundingClientRect();
      const k = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width));
      const x = k * 320;
      const cpu = Math.max(4, Math.round((100 - yAt(x)) * 2.6));
      const min = Math.round(k * 60);
      const time = min === 60 ? '15:00' : '14:' + String(min).padStart(2, '0');
      cross.hidden = tip.hidden = false;
      cross.style.left = k * 100 + '%';
      tip.style.left = Math.min(88, Math.max(12, k * 100)) + '%';
      tip.textContent = time + ' · CPU ' + cpu + '%' + (x >= 128 && x <= 198 ? ' · Docker' : '');
    }
    wrap.addEventListener('pointermove', move);
    wrap.addEventListener('pointerdown', move);
    wrap.addEventListener('pointerleave', () => { cross.hidden = tip.hidden = true; });

    const thaw = $('[data-thaw]');
    if (thaw) thaw.addEventListener('click', () => {
      const frozen = thaw.textContent === 'Đã đóng băng';
      thaw.textContent = frozen ? 'Đang chạy, bấm để đóng băng' : 'Đã đóng băng';
      thaw.classList.toggle('chip--ok', frozen);
    });
  }

  // =====================================================================
  // File versions
  // =====================================================================
  function initVersions() {
    const card = $('[data-versions]');
    if (!card) return;
    const rows = $$('[data-ver]', card);
    const diff = $('[data-diff]', card);
    const btn = $('[data-restore]', card);
    const status = $('[data-ver-status]', card);
    const label = $('.btn__label', btn);
    const DIFFS = [
      [['same', 'Gói Cơ bản · 490.000đ'], ['same', 'Gói Pro · 990.000đ'], ['same', 'Gói Doanh nghiệp · Liên hệ']],
      [['same', 'Gói Cơ bản · 490.000đ'], ['del', 'Gói Pro · 990.000đ'], ['add', 'Gói Pro · 1.200.000đ'], ['add', 'Ghi chú: áp dụng từ 01/11']],
      [['del', 'Gói Cơ bản · 490.000đ'], ['add', 'Gói Cơ bản · 450.000đ'], ['del', 'Gói Pro · 990.000đ'], ['add', 'Gói Pro · 1.150.000đ']],
      [['del', 'Gói Pro · 990.000đ'], ['add', 'Gói Pro · 1.100.000đ'], ['del', 'Gói Doanh nghiệp · Liên hệ']]
    ];
    let sel = 1, restored = null;
    function show(i) {
      sel = i;
      rows.forEach((r, k) => r.classList.toggle('is-sel', k === i));
      diff.textContent = '';
      DIFFS[i].forEach(([kind, text]) => {
        const d = document.createElement('div');
        d.className = 'diff__row diff__row--' + kind;
        d.textContent = (kind === 'del' ? '- ' : kind === 'add' ? '+ ' : '  ') + text;
        diff.appendChild(d);
      });
      if (restored === null) {
        btn.disabled = i === 0;
        status.textContent = i === 0 ? 'Đây là bản đang dùng.' : 'Xem trước thay đổi rồi mới khôi phục.';
      }
    }
    rows.forEach((r, k) => r.addEventListener('click', () => { if (restored === null) show(k); }));
    btn.addEventListener('click', async () => {
      if (restored === null) {
        btn.classList.add('is-busy');
        await sleep(650);
        btn.classList.remove('is-busy');
        restored = sel;
        rows.forEach((r, k) => r.classList.toggle('is-current', k === sel));
        const t = $('.mono', rows[sel]).textContent;
        status.textContent = 'Đã khôi phục bản ' + t + '. Bản 10:42 vẫn được giữ lại.';
        label.textContent = 'Hoàn tác';
        setIcon(btn, 'undo');
      } else {
        rows.forEach((r, k) => r.classList.toggle('is-current', k === 0));
        restored = null;
        label.textContent = 'Khôi phục bản này';
        setIcon(btn, 'rewind');
        show(sel);
        status.textContent = 'Đã hoàn tác, tệp trở lại bản 10:42.';
      }
    });
    show(sel);
  }

  // =====================================================================
  // Secret guard
  // =====================================================================
  function initSecret() {
    const toast = $('[data-secret]');
    if (!toast) return;
    const title = $('[data-secret-title]', toast), sub = $('[data-secret-sub]', toast), actions = $('[data-secret-actions]', toast);
    const ORIGINAL = sub.innerHTML;
    let left = 30, paused = false;
    function settle(t, s) {
      paused = true;
      toast.classList.add('is-cleared');
      title.textContent = t;
      sub.textContent = s;
      actions.hidden = true;
      setTimeout(() => {
        toast.classList.remove('is-cleared');
        title.textContent = 'Clipboard có khóa API';
        sub.innerHTML = ORIGINAL;
        actions.hidden = false;
        left = 30;
        paused = false;
      }, 3800);
    }
    $('[data-secret-clear]', toast).addEventListener('click', () => settle('Đã xóa clipboard', 'Khóa API không còn trong clipboard.'));
    $('[data-secret-safe]', toast).addEventListener('click', () => settle('Đã đánh dấu an toàn', 'DHbox sẽ không cảnh báo lại chuỗi này.'));
    if (!reduceMotion) whileVisible(toast, 1000, () => {
      if (paused) return;
      left -= 1;
      const c = $('[data-secret-count]', toast);
      if (c) c.textContent = left;
      if (left <= 0) settle('Đã tự xóa clipboard', 'Hết 30 giây, khóa API đã được xóa.');
    });
    $$('[data-reveal]').forEach((m) => {
      const hidden = m.textContent;
      m.addEventListener('click', () => {
        const openNow = m.classList.toggle('is-open');
        m.textContent = openNow ? m.dataset.reveal : hidden;
      });
    });
  }

  // =====================================================================
  // Finder context menu
  // =====================================================================
  function initFinder() {
    const fwin = $('[data-finder]');
    if (!fwin) return;
    const files = $('[data-finder-files]', fwin);
    const ctx = $('[data-ctx]', fwin);
    const body = $('.fwin__body', fwin);
    const status = $('[data-finder-status]', fwin);
    const selected = () => $$('.ftile.is-on', files).filter((t) => t.dataset.file);
    const countText = () => {
      const n = $$('.ftile.is-on', files).length;
      return n ? n + ' mục được chọn. Bấm chuột phải để mở menu.' : 'Chọn tệp, rồi bấm chuột phải.';
    };

    files.addEventListener('click', (e) => {
      const tile = e.target.closest('.ftile');
      ctx.hidden = true;
      if (!tile) { $$('.ftile', files).forEach((t) => t.classList.remove('is-on')); status.textContent = countText(); return; }
      if (e.metaKey || e.shiftKey) tile.classList.toggle('is-on');
      else $$('.ftile', files).forEach((t) => t.classList.toggle('is-on', t === tile));
      status.textContent = countText();
    });
    files.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      const tile = e.target.closest('.ftile');
      if (tile && !tile.classList.contains('is-on')) {
        $$('.ftile', files).forEach((t) => t.classList.toggle('is-on', t === tile));
        status.textContent = countText();
      }
      const r = body.getBoundingClientRect();
      ctx.hidden = false;
      const x = Math.min(e.clientX - r.left, r.width - ctx.offsetWidth - 6);
      const y = Math.min(e.clientY - r.top, r.height - ctx.offsetHeight - 6);
      ctx.style.left = Math.max(6, x) + 'px';
      ctx.style.top = Math.max(6, y) + 'px';
      ctx.style.right = 'auto';
    });
    // The menu starts open to show what it offers; clicks elsewhere close it only after the visitor used the window.
    let used = false;
    fwin.addEventListener('pointerdown', () => { used = true; });
    document.addEventListener('pointerdown', (e) => { if (used && !e.target.closest('[data-ctx], [data-finder-files]')) ctx.hidden = true; });

    function addTiles(names, icon) {
      $$('.ftile.is-new', files).forEach((t) => t.remove());
      names.forEach((n) => {
        const t = document.createElement('span');
        t.className = 'ftile is-new';
        t.innerHTML = '<svg class="ico"><use href="#i-' + icon + '"/></svg>';
        t.appendChild(document.createTextNode(n));
        files.appendChild(t);
      });
    }
    const ACTIONS = {
      jpeg: (sel) => {
        const out = sel.map((t) => t.dataset.file.replace(/\.\w+$/, '.jpg'));
        addTiles(out, 'image');
        return 'Đã tạo ' + out.length + ' tệp JPEG, giữ màu Display P3. Tệp gốc không đổi.';
      },
      compress: (sel) => {
        const out = sel.map((t) => t.dataset.file.replace(/(\.\w+)$/, '-nen$1'));
        addTiles(out, 'cube');
        return 'Đã nén ' + out.length + ' ảnh: ' + (4.2 * out.length).toFixed(1).replace('.', ',') + ' MB còn ' + (1.1 * out.length).toFixed(1).replace('.', ',') + ' MB.';
      },
      ocr: (sel) => 'Đã chép chữ trong ' + sel.length + ' ảnh vào clipboard: “Áo thun cotton, size M đến XL…”',
      redact: (sel) => {
        const out = sel.map((t) => t.dataset.file.replace(/(\.\w+)$/, '-da-che$1'));
        addTiles(out, 'lock');
        return 'Đã che số điện thoại trong ' + out.length + ' ảnh, xuất ra tệp mới.';
      }
    };
    $$('[data-finder-act]', ctx).forEach((b) => b.addEventListener('click', () => {
      const sel = selected();
      ctx.hidden = true;
      status.textContent = sel.length ? ACTIONS[b.dataset.finderAct](sel) : 'Chọn ít nhất một ảnh trước.';
    }));
  }

  // =====================================================================
  // File plan from a sentence
  // =====================================================================
  function initPlan() {
    const card = $('[data-plan]');
    if (!card) return;
    const rows = $$('[data-plan-row]', card);
    const btn = $('[data-plan-run]', card);
    const label = $('.btn__label', btn);
    const bar = $('[data-plan-bar]', card);
    const head = $('[data-plan-label]', card);
    const note = $('[data-plan-note]', card);
    let state = 'idle';
    btn.addEventListener('click', async () => {
      if (state === 'running') return;
      if (state === 'idle') {
        state = 'running';
        btn.classList.add('is-busy');
        label.textContent = 'Đang chạy…';
        bar.hidden = false;
        for (let i = 0; i < rows.length; i++) {
          await sleep(reduceMotion ? 0 : 380);
          rows[i].classList.add('is-done');
          setIcon(rows[i], 'check');
          const p = Math.round(((i + 1) / rows.length) * 100);
          bar.style.setProperty('--p', p + '%');
          head.textContent = 'Đang xử lý ' + Math.round((128 * (i + 1)) / rows.length) + ' trên 128 tệp…';
        }
        await sleep(250);
        btn.classList.remove('is-busy');
        head.textContent = 'Đã đổi tên và chuyển 128 tệp vào 2 thư mục.';
        label.textContent = 'Hoàn tác';
        setIcon(btn, 'undo');
        note.textContent = 'Nhật ký hoàn tác đã lưu';
        state = 'done';
      } else {
        rows.slice().reverse().forEach((r) => { r.classList.remove('is-done'); setIcon(r, 'arrow'); });
        bar.hidden = true;
        bar.style.setProperty('--p', '0%');
        head.textContent = 'Đã hoàn tác. Xem trước, 4 trên 128 tệp';
        label.textContent = 'Chạy';
        setIcon(btn, 'play');
        note.textContent = 'Hoàn tác được';
        state = 'idle';
      }
    });
  }

  initDesktop();
  initPalette();
  initCommandTab();
  initChart();
  initVersions();
  initSecret();
  initFinder();
  initPlan();
})();
