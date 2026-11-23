/* DHbox website: interactive MacBook showroom for the newer features.
   Every scene can be driven by a scripted cursor (like the app's "Xem nhanh") or by the visitor.
   Copyright (c) 2026 Công ty TNHH Phát triển công nghệ Devhouse Software. */
(function () {
  'use strict';
  const root = document.getElementById('showroom');
  if (!root) return;
  const $ = (s, r) => (r || root).querySelector(s);
  const $$ = (s, r) => Array.from((r || root).querySelectorAll(s));
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const ic = (n) => `<svg class="ico i"><use href="#i-${n}"/></svg>`;
  const vn = (n, d = 1) => n.toFixed(d).replace('.', ',');
  const screen = $('.sr-screen'), stage = $('.sr-stage'), island = $('.island'), content = $('.island__content');
  const cur = $('.sr-cursor'), ring = $('.sr-ring'), appName = $('[data-sr-app]');
  const capTitle = $('[data-sr-title]'), capDesc = $('[data-sr-desc]'), capTag = $('[data-sr-tag]'), capHint = $('[data-sr-hint]');
  let visible = false, currentId = null, timers = [], raf = 0;

  // ---------- helpers ----------
  const every = (fn, ms) => { timers.push(setInterval(() => { if (visible && !document.hidden) fn(); }, ms)); };
  const clearScene = () => { timers.forEach(clearInterval); timers = []; cancelAnimationFrame(raf); };
  const toastEl = document.createElement('div');
  toastEl.className = 'sr-toast';
  screen.appendChild(toastEl);
  let toastT;
  function toast(html, act, fn) {
    toastEl.innerHTML = html + (act ? `<button type="button">${act}</button>` : '');
    const b = toastEl.querySelector('button');
    if (b) b.onclick = () => { fn(); toastEl.classList.remove('on'); };
    toastEl.classList.add('on');
    clearTimeout(toastT);
    toastT = setTimeout(() => toastEl.classList.remove('on'), act ? 5200 : 2800);
  }
  const okToast = (t, a, f) => toast(ic('check') + `<span>${t}</span>`, a, f);

  // Decorative QR-like pattern (illustration only, it does not encode anything)
  function drawQR(canvas, seed) {
    const n = 29, c = canvas.getContext('2d'), px = canvas.width / n; let s = seed || 7;
    const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647;
    c.fillStyle = '#fff'; c.fillRect(0, 0, canvas.width, canvas.height); c.fillStyle = '#0e1424';
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
      const f = (x < 8 && y < 8) || (x > n - 9 && y < 8) || (x < 8 && y > n - 9);
      if (!f && rnd() > .52) c.fillRect(x * px, y * px, px + .4, px + .4);
    }
    [[0, 0], [n - 7, 0], [0, n - 7]].forEach(([x, y]) => {
      c.fillStyle = '#0e1424'; c.fillRect(x * px, y * px, 7 * px, 7 * px);
      c.fillStyle = '#fff'; c.fillRect((x + 1) * px, (y + 1) * px, 5 * px, 5 * px);
      c.fillStyle = '#0e1424'; c.fillRect((x + 2) * px, (y + 2) * px, 3 * px, 3 * px);
    });
  }

  // ---------- scripted cursor ----------
  let token = 0;
  class Abort extends Error {}
  function makeCtx(t) {
    const guard = () => { if (t !== token) throw new Abort(); };
    const stageBox = () => stage.getBoundingClientRect(), screenBox = () => screen.getBoundingClientRect();
    const P = (target, ox = .5, oy = .5) => {            // stage coordinates of an element (or pass [x, y])
      if (Array.isArray(target)) return target;
      const r = target.getBoundingClientRect(), s = stageBox();
      return [r.left - s.left + r.width * ox, r.top - s.top + r.height * oy];
    };
    const curStage = () => { const r = cur.getBoundingClientRect(), s = stageBox(); return [r.left - s.left, r.top - s.top]; };
    const ctx = {
      guard, P, curStage,
      wait: async (ms) => { await sleep(reduce ? 15 : ms); guard(); },
      mv: async (target, ms = 700, ox, oy, onFrame) => {
        const [x, y] = P(target, ox, oy), sb = stageBox(), sc = screenBox();
        cur.style.setProperty('--d', (reduce ? 0 : ms) + 'ms');
        cur.style.transform = `translate(${x + sb.left - sc.left}px,${y + sb.top - sc.top}px)`;
        cur.classList.add('on');
        const t0 = performance.now();
        if (onFrame) await new Promise((res) => {
          const loop = () => { if (t !== token) return res(); onFrame(...curStage()); if (performance.now() - t0 < ms + 30) requestAnimationFrame(loop); else res(); };
          loop();
        });
        else await sleep(reduce ? 15 : ms);
        guard();
      },
      ping: (target, ox, oy) => {
        const [x, y] = P(target, ox, oy), sb = stageBox(), sc = screenBox();
        ring.style.transform = `translate(${x + sb.left - sc.left}px,${y + sb.top - sc.top}px)`;
        ring.classList.remove('go'); void ring.offsetWidth; ring.classList.add('go');
      },
      fire: (target, type, ox = .5, oy = .5) => {
        const r = target.getBoundingClientRect();
        target.dispatchEvent(new MouseEvent(type, { bubbles: true, cancelable: true, clientX: r.left + r.width * ox, clientY: r.top + r.height * oy, button: type === 'contextmenu' ? 2 : 0 }));
      },
      click: async (target, ox, oy) => { await ctx.mv(target, 640, ox, oy); ctx.ping(target, ox, oy); ctx.fire(target, 'click', ox ?? .5, oy ?? .5); await ctx.wait(300); },
      rclick: async (target, ox, oy) => { await ctx.mv(target, 640, ox, oy); ctx.ping(target, ox, oy); ctx.fire(target, 'contextmenu', ox ?? .5, oy ?? .5); await ctx.wait(420); },
      type: async (input, text, per = 75) => {
        input.focus({ preventScroll: true });
        for (const ch of text) { input.value += ch; input.dispatchEvent(new Event('input', { bubbles: true })); await ctx.wait(per); }
      },
    };
    return ctx;
  }
  function cancelAuto() { token++; cur.classList.remove('on'); capHint.classList.add('seen'); }
  screen.addEventListener('pointerdown', (e) => { if (e.isTrusted) cancelAuto(); }, true);
  screen.addEventListener('keydown', (e) => { if (e.isTrusted) cancelAuto(); }, true);
  screen.addEventListener('pointerdown', (e) => { const m = $('.ctxm', stage); if (m && !e.target.closest('.ctxm, [data-dh]')) m.hidden = true; });

  // ---------- Soft Notch pages ----------
  const TABS = [['home', 'house', null], ['music', 'music', null], ['timer', 'clock', 'workmode'], ['clipboard', 'clip', 'clipboard'], ['notes', 'note', 'notes'], ['devices', 'wifi', 'connect'], ['agents', 'terminal', 'agents'], ['fan', 'fan', 'fan']];
  function openNotch(page, w, h) {
    island.style.setProperty('--w', w + '%'); island.style.setProperty('--h', h + 'em');
    island.dataset.state = 'open';
    content.innerHTML = `<div class="nt-tabs">${TABS.map(([p, i, go]) => `<button type="button" class="nt-tab${go === page ? ' is-on' : ''}" ${go ? `data-go="${go}"` : 'disabled'} aria-label="${p}">${ic(i)}</button>`).join('')}</div><div class="nt-page"></div>`;
    $$('.nt-tab[data-go]', content).forEach((b) => b.addEventListener('click', () => { if (b.dataset.go !== currentId) select(b.dataset.go); }));
    return $('.nt-page', content);
  }
  function closeNotch() { island.dataset.state = 'closed'; island.style.removeProperty('--w'); island.style.removeProperty('--h'); }

  // ---------- Finder-style window helper ----------
  const FOLDER = '<svg viewBox="0 0 24 24"><path d="M3 7.5A2.5 2.5 0 0 1 5.5 5h3.6l2 2.2h7.4A2.5 2.5 0 0 1 21 9.7v7.8a2.5 2.5 0 0 1-2.5 2.5h-13A2.5 2.5 0 0 1 3 17.5z"/></svg>';
  function showMenu(menu, x, y) {
    menu.hidden = false;
    const w = stage.clientWidth, h = stage.clientHeight;
    menu.style.left = Math.max(6, Math.min(x, w - menu.offsetWidth - 6)) + 'px';
    menu.style.top = Math.max(6, Math.min(y, h - menu.offsetHeight - 80)) + 'px';
  }
  const relPos = (e) => { const r = stage.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };

  // =====================================================================
  // SCENES
  // =====================================================================
  const SCENES = {};

  // ---------- Space Lens ----------
  SCENES.spacelens = {
    label: 'Space Lens', icon: 'bubbles', tag: 'Từ 1.5, làm lại ở 1.7', app: 'Space Lens',
    title: 'Space Lens: thấy ngay cái gì đang chiếm ổ đĩa',
    desc: 'Bản đồ bong bóng theo dung lượng. Bấm một bong bóng để đi sâu vào thư mục, tick những thứ muốn dọn rồi chuyển vào Thùng rác. Luôn hoàn tác được.',
    hint: 'Bấm bong bóng “Thư viện”, tick vài mục rồi bấm Dọn. Hoàn tác ở thông báo bên dưới.',
    mount() {
      const T = {
        root: [
          { id: 'lib', n: 'Thư viện', gb: 41.2, h: 212, c: [25, 31], kids: 'lib' }, { id: 'pic', n: 'Ảnh', gb: 28.5, h: 330, c: [58, 27], kids: 'pic' },
          { id: 'mov', n: 'Phim', gb: 17.9, h: 8, c: [84, 34], kids: 'mov' }, { id: 'dl', n: 'Tải về', gb: 9.6, h: 28, c: [50, 52], kids: 'dl' },
          { id: 'doc', n: 'Tài liệu', gb: 6.8, h: 150, c: [74, 9] }, { id: 'sm', n: 'Tệp nhỏ', gb: 3.1, h: 260, c: [93, 12] }],
        lib: [{ id: 'dk', n: 'Docker', gb: 14.3, h: 205, c: [24, 30] }, { id: 'ca', n: 'Caches', gb: 12.6, h: 280, c: [53, 28] }, { id: 'xc', n: 'Xcode DerivedData', gb: 9.8, h: 170, c: [80, 32] },
          { id: 'lg', n: 'Logs', gb: 2.4, h: 40, c: [40, 53] }, { id: 'ml', n: 'Mail', gb: 2.1, h: 340, c: [62, 52] }],
        pic: [{ id: 'pl', n: 'Photos Library', gb: 24.1, h: 190, c: [35, 30] }, { id: 'px', n: 'Ảnh xuất', gb: 4.4, h: 25, c: [68, 32] }],
        mov: [{ id: 'sr', n: 'Quay màn hình', gb: 11.0, h: 350, c: [35, 30] }, { id: 'pj', n: 'Dự án phim', gb: 6.9, h: 150, c: [65, 32] }],
        dl: [{ id: 'dm', n: 'Tệp .dmg cũ', gb: 5.3, h: 10, c: [35, 30] }, { id: 'zp', n: 'Tệp .zip', gb: 4.3, h: 40, c: [65, 30] }],
      };
      const crumbs = { root: [], lib: ['Thư viện'], pic: ['Ảnh'], mov: ['Phim'], dl: ['Tải về'] };
      let level = 'root', marked = new Set(), gone = new Set(), free = 112.4, undoInfo = null;
      stage.innerHTML = `<div class="sw sl"><div class="sw__bar"><i></i><i></i><i></i><span>Space Lens · Macintosh HD</span><div class="sw__tools"><span class="sr-chipb sl__free">Trống <b data-free>${vn(free)}</b> GB</span></div></div>
        <div class="sw__body"><div class="sl__side" data-list></div><div class="sl__map"><div class="sl__crumb" data-crumb></div><div class="sl__field" data-field></div>
        <div class="sl__foot"><span class="grow" data-sel>Chưa chọn mục nào</span><button class="sr-btn ghost" type="button" data-clear>Bỏ chọn</button><button class="sr-btn" type="button" data-clean disabled>${ic('trash')}Dọn vào Thùng rác</button></div></div></div></div>`;
      const list = $('[data-list]', stage), field = $('[data-field]', stage), crumb = $('[data-crumb]', stage), selTxt = $('[data-sel]', stage), cleanBtn = $('[data-clean]', stage), freeEl = $('[data-free]', stage);
      const items = () => T[level].filter((i) => !gone.has(i.id));
      const hsl = (h) => `linear-gradient(145deg,hsl(${h} 70% 62%),hsl(${(h + 28) % 360} 62% 46%))`;
      function render(first) {
        const max = Math.max(...T[level].map((i) => i.gb)), top = level === 'root' ? 30 : 29;
        field.innerHTML = T[level].map((i) => {
          const d = Math.max(8, top * Math.sqrt(i.gb / max) * (level === 'root' ? 1 : 1)), [cx, cy] = i.c;
          return `<button type="button" class="sl__b${first ? ' pre' : ''}${marked.has(i.id) ? ' mk' : ''}${gone.has(i.id) ? ' gone' : ''}" data-id="${i.id}" style="left:${cx - d / 2}%;top:${(cy - d / 2) / 60 * 100}%;width:${d}%;aspect-ratio:1;background:${hsl(i.h)}"><b>${d > 11 ? i.n : ''}</b><small>${vn(i.gb)} GB</small></button>`;
        }).join('');
        if (first) requestAnimationFrame(() => requestAnimationFrame(() => $$('.sl__b', field).forEach((b, k) => setTimeout(() => b.classList.remove('pre'), k * 70))));
        list.innerHTML = `<h4>${level === 'root' ? 'Thư mục của bạn' : crumbs[level][0]}</h4>` + T[level].map((i) =>
          `<button type="button" class="sl__row${marked.has(i.id) ? ' mk' : ''}${gone.has(i.id) ? ' gone' : ''}" data-id="${i.id}"><span class="cb">${ic('check')}</span><span class="dotc" style="background:${hsl(i.h)}"></span><b>${i.n}</b><span>${vn(i.gb)} GB</span></button>`).join('');
        crumb.innerHTML = `<span>Macintosh HD</span>›<span>minh</span>` + (level === 'root' ? '' : `›<b>${crumbs[level][0]}</b><button type="button" data-up>Lên một cấp</button>`);
        sum();
      }
      function sum() {
        const all = Object.values(T).flat(), m = [...marked].filter((id) => !gone.has(id)), gb = m.reduce((a, id) => a + all.find((i) => i.id === id).gb, 0);
        selTxt.innerHTML = m.length ? `Đã chọn <b>${m.length}</b> mục · <b>${vn(gb)} GB</b>` : 'Chưa chọn mục nào';
        cleanBtn.disabled = !m.length; cleanBtn.lastChild.textContent = m.length ? `Dọn vào Thùng rác (${vn(gb)} GB)` : 'Dọn vào Thùng rác';
        freeEl.textContent = vn(free);
      }
      function mark(id) { marked.has(id) ? marked.delete(id) : marked.add(id); $$(`[data-id="${id}"]`, stage).forEach((e) => e.classList.toggle('mk', marked.has(id))); sum(); }
      function go(l) { level = l; marked = new Set([...marked].filter((id) => gone.has(id))); render(true); }
      field.addEventListener('click', (e) => { const b = e.target.closest('.sl__b'); if (!b) return; const it = T[level].find((i) => i.id === b.dataset.id); if (it.kids && level === 'root') go(it.kids); else mark(it.id); });
      field.addEventListener('mouseover', (e) => { const b = e.target.closest('.sl__b'); $$('.sl__row', list).forEach((r) => r.classList.toggle('hot', !!b && r.dataset.id === b.dataset.id)); });
      list.addEventListener('click', (e) => { const r = e.target.closest('.sl__row'); if (r) mark(r.dataset.id); });
      crumb.addEventListener('click', (e) => { if (e.target.closest('[data-up]')) go('root'); });
      $('[data-clear]', stage).addEventListener('click', () => { marked.forEach((id) => $$(`[data-id="${id}"]`, stage).forEach((e) => e.classList.remove('mk'))); marked.clear(); sum(); });
      cleanBtn.addEventListener('click', () => {
        const all = Object.values(T).flat(), ids = [...marked].filter((id) => !gone.has(id)), gb = ids.reduce((a, id) => a + all.find((i) => i.id === id).gb, 0);
        if (!ids.length) return;
        ids.forEach((id) => { gone.add(id); marked.delete(id); $$(`[data-id="${id}"]`, stage).forEach((e) => { e.classList.remove('mk'); e.classList.add('gone'); }); });
        free += gb; undoInfo = { ids, gb }; sum();
        okToast(`Đã chuyển ${ids.length} mục (${vn(gb)} GB) vào Thùng rác`, 'Hoàn tác', () => { ids.forEach((id) => { gone.delete(id); $$(`[data-id="${id}"]`, stage).forEach((e) => e.classList.remove('gone')); }); free -= gb; sum(); });
      });
      render(true);
    },
    async auto(c) {
      const q = (s) => $(s, stage);
      await c.wait(900); await c.mv(q('[data-id="lib"].sl__b'), 800); await c.click(q('[data-id="lib"].sl__b')); await c.wait(1100);
      await c.click(q('[data-id="xc"].sl__b')); await c.wait(350); await c.click(q('[data-id="ca"].sl__row')); await c.wait(500);
      await c.click(q('[data-clean]')); await c.wait(2200); await c.click($('.sr-toast button')); await c.wait(1200);
      await c.click(q('[data-up]')); await c.wait(900); await c.mv([c.P(stage, .5, .9)[0], c.P(stage, .5, .9)[1]], 600);
    },
  };

  // ---------- Screenshot + colour picker ----------
  SCENES.capture = {
    label: 'Chụp & chọn màu', icon: 'cam', tag: 'Chụp màn hình từ 1.5, chọn màu từ 2.6', app: 'Chụp màn hình',
    title: 'Chụp màn hình có chú thích, chọn màu ngay trên màn hình',
    desc: '⌘⇧2 kéo chọn vùng rồi vẽ mũi tên, khung, chữ, sao chép hoặc lưu. ⌃⌥P chọn màu bất kỳ trên màn hình: HEX, RGB, HSL và độ tương phản WCAG.',
    hint: 'Bấm “Chụp vùng”, kéo một vùng trên poster rồi chọn công cụ. Hoặc bấm “Chọn màu” và rê chuột.',
    mount() {
      stage.innerHTML = `<div class="sw cp"><div class="sw__bar"><i></i><i></i><i></i><span>poster-khuyen-mai.png</span></div><div class="sw__body"><canvas class="cp__poster" width="900" height="600"></canvas></div></div>
        <div class="cp__over" data-over><div class="cp__line" data-lh style="left:0;right:0;height:1px"></div><div class="cp__line" data-lv style="top:0;bottom:0;width:1px"></div><div class="cp__sel" data-sel hidden><span class="cp__dim" data-dim></span><svg class="cp__svg" data-svg><defs><marker id="arrowhead" markerWidth="8" markerHeight="8" refX="6" refY="4" orient="auto"><path d="M0 0L8 4L0 8z" fill="#ef4444"/></marker></defs></svg></div></div>
        <div class="cp__tools" data-tools><button class="cp__tool is-on" data-t="arrow" type="button" aria-label="Mũi tên">${ic('arrowup')}</button><button class="cp__tool" data-t="pen" type="button" aria-label="Bút">${ic('pen')}</button><button class="cp__tool" data-t="box" type="button" aria-label="Khung">${ic('frame')}</button><button class="cp__col" type="button" aria-label="Màu"></button><button class="sr-btn" data-copy type="button">Sao chép</button><button class="sr-btn ghost" data-save type="button" style="background:rgba(255,255,255,.14);color:#fff">Lưu</button></div>
        <div class="cp__loupe" data-loupe><canvas width="11" height="11"></canvas></div><div class="cp__info" data-info></div>
        <div class="cp__mode"><button type="button" data-m="shot" class="is-on">${ic('cam')}Chụp vùng <span class="sr-key">⌘⇧2</span></button><button type="button" data-m="color">${ic('dropper')}Chọn màu <span class="sr-key">⌃⌥P</span></button></div>`;
      const poster = $('.cp__poster', stage), over = $('[data-over]', stage), sel = $('[data-sel]', stage), dim = $('[data-dim]', stage), svg = $('[data-svg]', stage), tools = $('[data-tools]', stage);
      const lh = $('[data-lh]', stage), lv = $('[data-lv]', stage), loupe = $('[data-loupe]', stage), info = $('[data-info]', stage), lcv = $('canvas', loupe);
      // poster drawing
      const g = poster.getContext('2d'), W = poster.width, H = poster.height;
      const gr = g.createLinearGradient(0, 0, W, H); gr.addColorStop(0, '#ffe5b4'); gr.addColorStop(.5, '#ff8fab'); gr.addColorStop(1, '#5b4fd6'); g.fillStyle = gr; g.fillRect(0, 0, W, H);
      g.fillStyle = 'rgba(255,255,255,.2)'; g.beginPath(); g.arc(730, 150, 170, 0, 7); g.fill(); g.fillStyle = '#1f6f87'; g.beginPath(); g.arc(700, 420, 95, 0, 7); g.fill(); g.fillStyle = '#f0b43c'; g.beginPath(); g.arc(560, 260, 54, 0, 7); g.fill();
      g.fillStyle = '#fff'; g.font = '800 88px -apple-system, Helvetica, Arial'; g.fillText('SUMMER', 56, 190); g.fillText('SALE -30%', 56, 285);
      g.fillStyle = '#0e1424'; g.beginPath(); g.roundRect(56, 330, 230, 70, 35); g.fill(); g.fillStyle = '#fff'; g.font = '700 30px -apple-system, Helvetica, Arial'; g.fillText('Mua ngay', 100, 376);
      ['#3a6fb5', '#5fb0c6', '#f0b43c', '#3cc796', '#0e1424'].forEach((c, i) => { g.fillStyle = c; g.fillRect(56 + i * 70, 452, 60, 60); });
      let mode = 'shot', phase = 'idle', tool = 'arrow', drag = null, drawing = null, rect = null;
      const SB = () => stage.getBoundingClientRect();
      const stagePt = (e) => { const r = SB(); return [e.clientX - r.left, e.clientY - r.top]; };
      function reset() { over.classList.remove('on'); sel.hidden = true; tools.classList.remove('on'); loupe.style.display = 'none'; info.style.display = 'none'; $$('[data-svg] > *:not(defs)', stage).forEach((n) => n.remove()); phase = 'idle'; drag = null; rect = null; }
      function startShot() { reset(); mode = 'shot'; phase = 'select'; over.classList.add('on'); $$('.cp__mode button', stage).forEach((b) => b.classList.toggle('is-on', b.dataset.m === 'shot')); crosshair(stage.clientWidth / 2, stage.clientHeight / 2); }
      function startColor() { reset(); mode = 'color'; phase = 'pick'; over.classList.add('on'); $$('.cp__mode button', stage).forEach((b) => b.classList.toggle('is-on', b.dataset.m === 'color')); }
      function crosshair(x, y) { lh.style.top = y + 'px'; lv.style.left = x + 'px'; lh.hidden = lv.hidden = phase !== 'select'; }
      function dragTo(x, y) {
        if (!drag) return; const x0 = Math.min(drag[0], x), y0 = Math.min(drag[1], y), w = Math.abs(x - drag[0]), h = Math.abs(y - drag[1]);
        rect = { x: x0, y: y0, w, h }; sel.hidden = false; Object.assign(sel.style, { left: x0 + 'px', top: y0 + 'px', width: w + 'px', height: h + 'px' }); dim.textContent = `${Math.round(w * 1.6)} × ${Math.round(h * 1.6)}`;
      }
      function endDrag() {
        if (!drag) return; drag = null;
        if (!rect || rect.w < 30 || rect.h < 24) { sel.hidden = true; return; }
        phase = 'annotate'; lh.hidden = lv.hidden = true; tools.classList.add('on');
        tools.style.left = Math.max(6, Math.min(rect.x, stage.clientWidth - tools.offsetWidth - 6)) + 'px'; tools.style.top = Math.min(stage.clientHeight - 90, rect.y + rect.h + 12) + 'px';
      }
      const svgPt = (x, y) => [x - rect.x, y - rect.y];
      function drawBegin(x, y) { if (!rect || x < rect.x || x > rect.x + rect.w || y < rect.y || y > rect.y + rect.h) return; const [a, b] = svgPt(x, y), ns = 'http://www.w3.org/2000/svg';
        const el = document.createElementNS(ns, tool === 'box' ? 'rect' : tool === 'pen' ? 'polyline' : 'line');
        el.setAttribute('stroke', '#ef4444'); el.setAttribute('stroke-width', '4'); el.setAttribute('fill', 'none'); el.setAttribute('stroke-linecap', 'round'); el.setAttribute('stroke-linejoin', 'round');
        if (tool === 'arrow') { el.setAttribute('x1', a); el.setAttribute('y1', b); el.setAttribute('x2', a); el.setAttribute('y2', b); el.setAttribute('marker-end', 'url(#arrowhead)'); }
        if (tool === 'pen') el.setAttribute('points', `${a},${b}`);
        svg.appendChild(el); drawing = { el, a, b }; }
      function drawMove(x, y) { if (!drawing) return; const [a, b] = svgPt(x, y), { el } = drawing;
        if (tool === 'arrow') { el.setAttribute('x2', a); el.setAttribute('y2', b); } else if (tool === 'pen') el.setAttribute('points', el.getAttribute('points') + ` ${a},${b}`);
        else { el.setAttribute('x', Math.min(a, drawing.a)); el.setAttribute('y', Math.min(b, drawing.b)); el.setAttribute('width', Math.abs(a - drawing.a)); el.setAttribute('height', Math.abs(b - drawing.b)); } }
      function pick(x, y) {
        const r = poster.getBoundingClientRect(), s = SB(), u = (x + s.left - r.left) / r.width, v = (y + s.top - r.top) / r.height;
        if (u < 0 || u > 1 || v < 0 || v > 1) { loupe.style.display = info.style.display = 'none'; return; }
        const px = Math.floor(u * W), py = Math.floor(v * H), d = g.getImageData(px, py, 1, 1).data, [R, G, B] = d;
        const hex = '#' + [R, G, B].map((n) => n.toString(16).padStart(2, '0')).join('').toUpperCase();
        const mx = Math.max(R, G, B) / 255, mn = Math.min(R, G, B) / 255, l = (mx + mn) / 2, dl = mx - mn; let h = 0, sat = 0;
        if (dl) { sat = dl / (1 - Math.abs(2 * l - 1)); const r1 = R / 255, g1 = G / 255, b1 = B / 255; h = mx === r1 ? ((g1 - b1) / dl) % 6 : mx === g1 ? (b1 - r1) / dl + 2 : (r1 - g1) / dl + 4; h = Math.round(((h * 60) + 360) % 360); }
        const lin = (n) => { n /= 255; return n <= .03928 ? n / 12.92 : Math.pow((n + .055) / 1.055, 2.4); }, L = .2126 * lin(R) + .7152 * lin(G) + .0722 * lin(B);
        const cw = 1.05 / (L + .05), cb = (L + .05) / .05, best = cw >= cb ? ['trắng', cw] : ['đen', cb], grade = best[1] >= 7 ? 'AAA' : best[1] >= 4.5 ? 'AA' : best[1] >= 3 ? 'AA chữ lớn' : 'chưa đạt';
        const lc = lcv.getContext('2d'); lc.imageSmoothingEnabled = false; lc.clearRect(0, 0, 11, 11);
        const sx = Math.max(0, Math.min(W - 11, px - 5)), sy = Math.max(0, Math.min(H - 11, py - 5)); lc.drawImage(poster, sx, sy, 11, 11, 0, 0, 11, 11);
        loupe.style.display = 'block'; loupe.style.left = x + 'px'; loupe.style.top = y - 56 + 'px';
        info.style.display = 'block'; info.style.left = Math.max(8, Math.min(x + 70, stage.clientWidth - 250)) + 'px'; info.style.top = Math.max(8, Math.min(y - 60, stage.clientHeight - 230)) + 'px';
        info.innerHTML = `<div class="row"><span class="sw2" style="background:${hex}"></span><div><b class="n-mono">${hex}</b><small>rgb(${R}, ${G}, ${B})<br>hsl(${h}, ${Math.round(sat * 100)}%, ${Math.round(l * 100)}%)</small></div></div><div class="wc"><small>Chữ ${best[0]} trên màu này: <b class="${best[1] >= 4.5 ? 'ok' : 'bad'}">${vn(best[1])}:1</b> · ${grade}</small></div>`;
        lastHex = hex;
      }
      let lastHex = '#FFFFFF';
      // real pointer
      over.addEventListener('pointermove', (e) => { const [x, y] = stagePt(e); if (phase === 'select') { crosshair(x, y); dragTo(x, y); } else if (phase === 'annotate') drawMove(x, y); else if (phase === 'pick') pick(x, y); });
      over.addEventListener('pointerdown', (e) => { const [x, y] = stagePt(e); over.setPointerCapture(e.pointerId);
        if (phase === 'select') { drag = [x, y]; dragTo(x, y); } else if (phase === 'annotate') drawBegin(x, y); else if (phase === 'pick') { navigator.clipboard?.writeText?.(lastHex).catch(() => {}); okToast(`Đã chép ${lastHex} vào clipboard`); reset(); } });
      over.addEventListener('pointerup', () => { if (phase === 'select') endDrag(); else if (phase === 'annotate') drawing = null; });
      tools.addEventListener('click', (e) => {
        const t = e.target.closest('[data-t]'); if (t) { tool = t.dataset.t; $$('[data-t]', tools).forEach((b) => b.classList.toggle('is-on', b === t)); }
        if (e.target.closest('[data-copy]')) { reset(); okToast('Đã sao chép ảnh vào clipboard'); }
        if (e.target.closest('[data-save]')) { reset(); okToast('Đã lưu ảnh vào Desktop'); }
      });
      $$('.cp__mode button', stage).forEach((b) => b.addEventListener('click', () => (b.dataset.m === 'shot' ? startShot() : startColor())));
      window.__cap = { startShot, startColor, crosshair, dragBegin: (x, y) => { drag = [x, y]; }, dragTo, endDrag, drawBegin, drawMove, drawEnd: () => { drawing = null; }, pick, setTool: (t) => { tool = t; $$('[data-t]', tools).forEach((b) => b.classList.toggle('is-on', b.dataset.t === t)); }, reset, phase: () => phase };
    },
    async auto(c) {
      const A = window.__cap, q = (s) => $(s, stage), SW = stage.clientWidth, SH = stage.clientHeight;
      await c.wait(800); await c.click(q('[data-m="shot"]')); await c.wait(500);
      const x0 = SW * .24, y0 = SH * .2, x1 = SW * .72, y1 = SH * .62;
      await c.mv([x0, y0], 750, 0, 0, (x, y) => A.crosshair(x, y)); A.dragBegin(x0, y0); cur.classList.add('down');
      await c.mv([x1, y1], 1000, 0, 0, (x, y) => { A.crosshair(x, y); A.dragTo(x, y); }); cur.classList.remove('down'); A.endDrag(); await c.wait(500);
      A.setTool('arrow'); await c.mv([SW * .44, SH * .53], 650); A.drawBegin(SW * .44, SH * .53);
      await c.mv([SW * .6, SH * .41], 700, 0, 0, (x, y) => A.drawMove(x, y)); A.drawEnd(); await c.wait(400);
      await c.click(q('[data-t="box"]')); await c.mv([SW * .27, SH * .46], 600); A.drawBegin(SW * .27, SH * .46);
      await c.mv([SW * .4, SH * .57], 650, 0, 0, (x, y) => A.drawMove(x, y)); A.drawEnd(); await c.wait(500);
      await c.click(q('[data-copy]')); await c.wait(1800);
      await c.click(q('[data-m="color"]')); await c.wait(400);
      for (const [fx, fy] of [[.32, .3], [.62, .28], [.5, .72], [.2, .75], [.7, .44]]) await c.mv([SW * fx, SH * fy], 800, 0, 0, (x, y) => A.pick(x, y));
      await c.wait(700); c.ping([SW * .7, SH * .44]); A.reset(); okToast('Đã chép màu vào clipboard'); await c.wait(600);
    },
  };

  // ---------- Notes ----------
  SCENES.notes = {
    label: 'Ghi chú', icon: 'note', tag: 'Từ 1.6, định dạng 2.5, khóa Touch ID 2.6', app: 'DHbox',
    title: 'Ghi chú trên notch, như Ghi chú của Apple',
    desc: 'Nhiều ghi chú có màu và mức quan trọng, chữ đậm nghiêng, danh sách việc có ô tick, dán ảnh. Khóa ghi chú bằng Touch ID, ghi chú đã xóa giữ 30 ngày.',
    hint: 'Bấm các ô tick, gõ thêm việc rồi Enter, thử nút Aa, hoặc mở ghi chú “Mật khẩu Wi-Fi khách” có khóa.',
    mount() {
      const p = openNotch('notes', 56, 25.4);
      const todos = [['Chốt bảng giá Q4', true], ['Gửi báo giá chị Lan', false], ['Cập nhật trang web', false], ['Gọi kế toán', false]];
      const notes = [{ id: 'a', t: 'Việc hôm nay', c: '#5fb0c6' }, { id: 'b', t: 'Ý tưởng bản 3.0', c: '#f0b43c' }, { id: 'c', t: 'Mật khẩu Wi-Fi khách', c: '#ef7a72', lock: true }];
      let sel = 'a', unlocked = false, fmt = false;
      const body = () => {
        if (sel === 'a') return `<div class="nn__title">Việc hôm nay</div>${todos.map(([t, d], i) => `<div class="nn__todo${d ? ' done' : ''}" data-todo="${i}"><span class="nn__box">${ic('check')}</span><span>${t}</span></div>`).join('')}<div class="nn__add"><input data-add type="text" placeholder="Thêm việc, nhấn Enter" autocomplete="off"></div>`;
        if (sel === 'b') return `<div class="nn__title">Ý tưởng bản 3.0</div><div class="nn__line"><b>Mục tiêu:</b> <i>tối giản</i></div><div class="nn__line">• Ghim clipboard theo dự án</div><div class="nn__line">• Kệ tạm chia sẻ qua AirDrop</div><div class="nn__line n-muted">Ảnh phác thảo: <span class="n-card" style="display:inline-block;padding:.1em .7em">${ic('image')} wireframe.png</span></div>`;
        return unlocked ? `<div class="nn__title">Mật khẩu Wi-Fi khách</div><div class="nn__line">Mạng: DevHouse-Guest</div><div class="nn__line n-mono">Mật khẩu: kh@ch-2026</div>` : '';
      };
      function render() {
        p.innerHTML = `<div class="nn"><div class="nn__list">${notes.map((n) => `<button type="button" class="nn__item${n.id === sel ? ' is-on' : ''}" data-note="${n.id}"><span class="nn__dot" style="background:${n.c}"></span><span>${n.t}</span>${n.lock && !unlocked ? ic('lock') : '<span></span>'}</button>`).join('')}</div>
          <div class="nn__ed"><div class="nn__tools"><button class="nn__tool${fmt ? ' is-on' : ''}" type="button" data-aa>Aa</button><button class="nn__tool" type="button"><b>B</b></button><button class="nn__tool" type="button"><i>I</i></button><button class="nn__tool" type="button" data-add-todo>${ic('check')}</button><button class="nn__tool" type="button">${ic('image')}</button><button class="nn__tool" type="button" data-lock>${ic('lock')}</button></div>
          <div class="nn__fmt${fmt ? ' on' : ''}"><button type="button">Tiêu đề</button><button type="button">Đề mục</button><button type="button">Đề mục phụ</button><button type="button">Kiểu đơn cách</button><button type="button">• Danh sách dấu chấm</button><button type="button">1. Danh sách đánh số</button></div>
          ${body()}${sel === 'c' && !unlocked ? `<div class="nn__lock"><span class="nn__fp" data-fp>${ic('finger')}</span><b>Ghi chú đã khóa</b><button type="button" class="n-btn pri" data-touch>Mở bằng Touch ID</button></div>` : ''}</div></div>`;
      }
      render();
      p.addEventListener('click', (e) => {
        const n = e.target.closest('[data-note]'); if (n) { sel = n.dataset.note; fmt = false; render(); return; }
        const t = e.target.closest('[data-todo]'); if (t) { const i = +t.dataset.todo; todos[i][1] = !todos[i][1]; t.classList.toggle('done', todos[i][1]); return; }
        if (e.target.closest('[data-aa]')) { fmt = !fmt; $('.nn__fmt', p).classList.toggle('on', fmt); $('[data-aa]', p).classList.toggle('is-on', fmt); return; }
        if (e.target.closest('.nn__fmt button')) { fmt = false; render(); return; }
        if (e.target.closest('[data-add-todo]')) { const i = $('[data-add]', p); if (i) i.focus(); return; }
        if (e.target.closest('[data-lock]')) { if (sel === 'c') { unlocked = false; render(); } else okToast('Chọn ghi chú rồi bấm khóa để đặt Touch ID'); return; }
        if (e.target.closest('[data-touch]')) { const fp = $('[data-fp]', p); fp.classList.add('scan'); setTimeout(() => { unlocked = true; render(); }, reduce ? 0 : 1500); }
      });
      p.addEventListener('keydown', (e) => { if (e.key === 'Enter' && e.target.matches('[data-add]') && e.target.value.trim()) { todos.push([e.target.value.trim(), false]); render(); $('[data-add]', p).focus(); } });
      stage.innerHTML = '';
    },
    async auto(c) {
      const p = $('.nt-page', content), q = (s) => $(s, p);
      await c.wait(900); await c.click(q('[data-todo="1"]')); await c.wait(500); await c.click(q('[data-todo="2"]')); await c.wait(500);
      await c.click(q('[data-add]')); await c.type(q('[data-add]'), 'Đặt lịch họp khách', 65); await c.wait(300);
      q('[data-add]').dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })); await c.wait(900);
      await c.click(q('[data-aa]')); await c.wait(1200); await c.click(q('[data-aa]')); await c.wait(300);
      await c.click(q('[data-note="c"]')); await c.wait(500); await c.click(q('[data-touch]')); await c.wait(2200);
      await c.click(q('[data-note="a"]'));
    },
  };

  // ---------- Clipboard + shelf ----------
  SCENES.clipboard = {
    label: 'Clipboard & kệ', icon: 'clip', tag: 'Từ 2.6', app: 'DHbox',
    title: 'Clipboard thông minh: ghim, dán lần lượt, dịch tại chỗ',
    desc: 'Ghim mục để không bị đẩy khỏi lịch sử, dán lần lượt nhiều mục đã chép, dịch chữ ngay trên máy (macOS 15 trở lên). Kệ tạm có thanh thao tác: nén, đổi định dạng, nhận dạng chữ.',
    hint: 'Bấm ghim, bấm “Dịch”, bật “Dán lần lượt” rồi chọn vài mục, hoặc thử các nút ở kệ tạm.',
    mount() {
      const p = openNotch('clipboard', 56, 25.4);
      const items = [{ id: 1, t: 'npm run dev -- --port 3000', s: '2 phút', mono: true }, { id: 2, t: 'Hello, how are you today?', s: '5 phút', tr: 'Xin chào, hôm nay bạn thế nào?' }, { id: 3, t: 'Gửi chị Lan bản báo giá mới nhé', s: '8 phút' }];
      let pinned = new Set(), shown = new Set(), queue = [], qmode = false, pasted = [];
      function render() {
        const order = [...items].sort((a, b) => (pinned.has(b.id) ? 1 : 0) - (pinned.has(a.id) ? 1 : 0));
        p.innerHTML = `<div class="ncl"><div><div class="n-row" style="justify-content:space-between;margin-bottom:.5em"><b class="n-muted" style="font-size:.85em">Lịch sử · 30 phút</b><label class="n-row" style="font-size:.85em;gap:.5em">Dán lần lượt <button type="button" class="sr-sw${qmode ? ' on' : ''}" data-q aria-label="Dán lần lượt"></button></label></div>
          ${order.map((i) => `<div class="ncl__item${pinned.has(i.id) ? ' pinned' : ''}" data-row="${i.id}"><div><span class="${i.mono ? 'n-mono' : ''}">${i.t}</span><small>${i.s}</small>${shown.has(i.id) ? `<small class="tr">${ic('check')} ${i.tr} · dịch trên máy</small>` : ''}</div>
            ${i.tr ? `<button class="ncl__icon" type="button" data-tr="${i.id}" title="Dịch">${ic('translate')}</button>` : (qmode && queue.includes(i.id) ? `<span class="ncl__q">${queue.indexOf(i.id) + 1}</span>` : '<span></span>')}
            <button class="ncl__icon${pinned.has(i.id) ? ' on' : ''}" type="button" data-pin="${i.id}" title="Ghim">${ic('pushpin')}</button></div>`).join('')}</div>
          <div class="ncl__shelf"><b class="n-muted" style="font-size:.85em">Kệ tạm</b><div class="ncl__file">${ic('doc')}<div><b>bao-gia-Q4.pdf</b><div class="n-muted" style="font-size:.85em">4,2 MB</div></div></div>
          <div class="ncl__acts"><button class="n-btn" type="button" data-act="zip">Nén</button><button class="n-btn" type="button" data-act="conv">Đổi định dạng</button><button class="n-btn" type="button" data-act="ocr">Nhận dạng chữ</button></div><div class="ncl__out" data-out></div>
          ${qmode ? `<button class="n-btn pri" type="button" data-paste>⌘V · dán mục kế tiếp (${queue.length})</button>` : ''}</div></div>`;
        const lines = pasted.map((t) => `<div style="padding:.25em 0;border-bottom:1px solid var(--stroke)">${t}</div>`).join('') || '<span style="color:var(--text-3)">Con trỏ đang ở đây. Dán để thấy từng mục lần lượt.</span>';
        const note = $('.sw.qn .qn__body', stage); if (note) note.innerHTML = lines;
      }
      stage.innerHTML = `<div class="sw qn" style="left:6%;top:56%;width:38%;height:30%"><div class="sw__bar"><i></i><i></i><i></i><span>Ghi chú nhanh</span></div><div class="sw__body qn__body" style="padding:1em;font-size:.95em"></div></div>`;
      render();
      p.addEventListener('click', (e) => {
        const pin = e.target.closest('[data-pin]'); if (pin) { const id = +pin.dataset.pin; pinned.has(id) ? pinned.delete(id) : pinned.add(id); render(); return; }
        const tr = e.target.closest('[data-tr]'); if (tr) { shown.add(+tr.dataset.tr); render(); return; }
        if (e.target.closest('[data-q]')) { qmode = !qmode; queue = []; render(); return; }
        const act = e.target.closest('[data-act]'); if (act) { $('[data-out]', p).innerHTML = { zip: ic('check') + ' Đã nén: 4,2 MB còn 1,1 MB', conv: ic('check') + ' Đã đổi sang DOCX, giữ bản gốc', ocr: ic('check') + ' Nhận dạng: “Báo giá Q4 · Gói Pro 990.000đ…”' }[act.dataset.act]; return; }
        if (e.target.closest('[data-paste]')) { if (queue.length) { const id = queue.shift(); pasted.push(items.find((i) => i.id === id).t); render(); } else okToast('Hết hàng đợi'); return; }
        const row = e.target.closest('[data-row]'); if (row && qmode) { const id = +row.dataset.row; if (!queue.includes(id)) queue.push(id); render(); }
      });
    },
    async auto(c) {
      const p = $('.nt-page', content), q = (s) => $(s, p);
      await c.wait(900); await c.click(q('[data-pin="3"]')); await c.wait(700); await c.click(q('[data-tr="2"]')); await c.wait(1200);
      await c.click(q('[data-q]')); await c.wait(400);
      for (const id of [3, 1, 2]) { await c.click(q(`[data-row="${id}"]`), .25); await c.wait(250); }
      for (let i = 0; i < 3; i++) { await c.click(q('[data-paste]')); await c.wait(450); }
      await c.click(q('[data-act="zip"]')); await c.wait(900);
    },
  };

  // ---------- Connections ----------
  SCENES.connect = {
    label: 'Kết nối', icon: 'wifi', tag: 'Từ 2.5, mở rộng ở 2.6', app: 'DHbox',
    title: 'Bluetooth, Wi-Fi và AirDrop trên một trang',
    desc: 'Pin của AirPods, chuột, bàn phím. Danh sách Wi-Fi bấm để vào mạng, chia sẻ Wi-Fi bằng mã QR cho khách. Kéo tệp thả vào ô AirDrop để gửi ngay.',
    hint: 'Bấm một mạng Wi-Fi để vào, bấm “Chia sẻ Wi-Fi bằng QR”, hoặc kéo tệp vào ô AirDrop.',
    mount() {
      const p = openNotch('connect', 58, 25.4);
      const nets = [['DevHouse-5G', 4], ['Cafe_Highlands', 3], ['FPT-Telecom_88', 2], ['Nha-Hang-Bep', 1]];
      let cur2 = 0, joining = -1, sent = false;
      p.innerHTML = `<div class="nc"><div><h4>Bluetooth</h4>
        <div class="nc__dev">${ic('speaker')}<div>AirPods Pro</div><div class="nc__bat"><i style="--p:82"></i>82%</div></div>
        <div class="nc__dev">${ic('cube')}<div>Magic Mouse</div><div class="nc__bat"><i class="low" style="--p:18"></i>18%</div></div>
        <div class="nc__dev">${ic('terminal')}<div>Magic Keyboard</div><div class="nc__bat"><i style="--p:91"></i>91%</div></div></div>
        <div><h4>Wi-Fi</h4><div data-nets></div><button class="n-btn" type="button" data-qr style="margin-top:.5em;width:100%">${ic('qr')} Chia sẻ Wi-Fi bằng QR</button></div>
        <div class="nc__air" data-air>${ic('airdrop')}<b>AirDrop</b><span class="n-muted" style="font-size:.85em" data-airt>Thả tệp vào đây</span></div>
        <button class="nc__file" type="button" data-file style="left:.2em;top:13.2em">${ic('doc')}bao-gia-Q4.pdf</button><div class="nc__qr" data-qrv hidden><canvas width="145" height="145"></canvas><b>DevHouse-5G</b><span class="n-muted" style="font-size:.85em">Khách quét để vào mạng</span><button class="n-btn" type="button" data-qrx>Đóng</button></div></div>`;
      const netsEl = $('[data-nets]', p), air = $('[data-air]', p), file = $('[data-file]', p), airt = $('[data-airt]', p);
      drawQR($('canvas', p), 11);
      const bars = (n) => `<svg class="ico i" viewBox="0 0 24 24"><path d="M3 9.5a14 14 0 0 1 18 0" opacity="${n > 3 ? 1 : .3}"/><path d="M6 13a9.500 9.500 0 0 1 12 0" opacity="${n > 2 ? 1 : .3}"/><path d="M9 16.300a5 5 0 0 1 6 0" opacity="${n > 1 ? 1 : .3}"/><path d="M12 19.500h.01" opacity="${n > 0 ? 1 : .3}"/></svg>`;
      function drawNets() { netsEl.innerHTML = nets.map(([n, b], i) => `<button type="button" class="nc__wifi${i === cur2 ? ' cur' : ''}" data-net="${i}">${bars(b)}<span>${n}</span>${joining === i ? '<span class="nc__spin"></span>' : i === cur2 ? ic('check') : '<span></span>'}</button>`).join(''); }
      drawNets();
      netsEl.addEventListener('click', (e) => { const b = e.target.closest('[data-net]'); if (!b) return; const i = +b.dataset.net; if (i === cur2 || joining >= 0) return; joining = i; drawNets(); setTimeout(() => { cur2 = i; joining = -1; drawNets(); okToast('Đã vào mạng ' + nets[i][0]); }, reduce ? 0 : 1100); });
      $('[data-qr]', p).addEventListener('click', () => { $('[data-qrv]', p).hidden = false; });
      $('[data-qrx]', p).addEventListener('click', () => { $('[data-qrv]', p).hidden = true; });
      function send() { if (sent) return; sent = true; file.style.display = 'none'; air.classList.remove('over'); air.classList.add('sent'); airt.textContent = 'Đã gửi cho iPhone của Minh'; okToast('AirDrop: đã gửi bao-gia-Q4.pdf'); }
      // drag the file onto the AirDrop tile (real pointer)
      let dr = null;
      file.addEventListener('pointerdown', (e) => { const r = file.getBoundingClientRect(); dr = { dx: e.clientX - r.left, dy: e.clientY - r.top }; file.setPointerCapture(e.pointerId); });
      file.addEventListener('pointermove', (e) => { if (!dr) return; const pr = p.getBoundingClientRect(); file.style.left = e.clientX - pr.left - dr.dx + 'px'; file.style.top = e.clientY - pr.top - dr.dy + 'px';
        const a = air.getBoundingClientRect(); air.classList.toggle('over', e.clientX > a.left && e.clientX < a.right && e.clientY > a.top && e.clientY < a.bottom); });
      file.addEventListener('pointerup', (e) => { if (!dr) return; dr = null; const a = air.getBoundingClientRect(); if (e.clientX > a.left && e.clientX < a.right && e.clientY > a.top && e.clientY < a.bottom) send(); else air.classList.remove('over'); });
      file.addEventListener('click', (e) => { if (e.isTrusted) return; send(); });
      window.__conn = { air, file, over: (v) => air.classList.toggle('over', v), send };
    },
    async auto(c) {
      const p = $('.nt-page', content), q = (s) => $(s, p);
      await c.wait(900); await c.click(q('[data-net="1"]')); await c.wait(1700); await c.click(q('[data-qr]')); await c.wait(1800); await c.click(q('[data-qrx]')); await c.wait(400);
      const file = q('[data-file]'), air = q('[data-air]'), fr = file.getBoundingClientRect(), ar = air.getBoundingClientRect();
      await c.mv(file, 700); const dx = ar.left + ar.width / 2 - fr.left - fr.width / 2, dy = ar.top + ar.height / 2 - fr.top - fr.height / 2;
      cur.classList.add('down'); const t0 = performance.now();
      await c.mv(air, 900, .5, .5, () => { const k = Math.min(1, (performance.now() - t0) / 900); file.style.transform = `translate(${dx * k}px,${dy * k}px)`; window.__conn.over(k > .8); }); cur.classList.remove('down');
      window.__conn.send(); await c.wait(1500);
    },
  };

  // ---------- Fan ----------
  SCENES.fan = {
    label: 'Quạt', icon: 'fan', tag: 'Mới ở 2.9', app: 'DHbox',
    title: 'Điều khiển quạt ngay trên notch và menu bar',
    desc: 'Xem tốc độ từng quạt, nhiệt độ CPU và GPU. Mỗi quạt có 3 chế độ: Hệ thống, Cố định hoặc Theo nhiệt độ (Êm, Cân bằng, Mát). Máy quá nóng thì quạt tự trả về cho hệ thống.',
    hint: 'Đổi chế độ từng quạt, kéo thanh tốc độ, rồi bấm “Thử nóng quá” để xem cơ chế an toàn. Số liệu trong cảnh này là mô phỏng.',
    mount() {
      const p = openNotch('fan', 56, 25.4);
      const F = [{ n: 'Quạt trái', mode: 'sys', rpm: 1750, fixed: 3200, prof: 'bal' }, { n: 'Quạt phải', mode: 'sys', rpm: 1720, fixed: 3200, prof: 'bal' }];
      let cpu = 66, gpu = 61, warnUntil = 0;
      const MODES = [['sys', 'Hệ thống'], ['fix', 'Cố định'], ['temp', 'Theo nhiệt độ']], PROFS = [['quiet', 'Êm'], ['bal', 'Cân bằng'], ['cool', 'Mát']];
      p.innerHTML = `<div class="nf" style="position:relative">${F.map((f, i) => `<div class="nf__fan n-card" data-fan="${i}"><b class="n-muted" style="font-size:.85em">${f.n}</b><div class="nf__ring"><svg viewBox="0 0 100 100"><circle class="bg" cx="50" cy="50" r="40"/><circle class="fg" cx="50" cy="50" r="40" stroke-dasharray="251" stroke-dashoffset="251"/></svg><span class="nf__blades">${ic('fan')}</span></div><div class="nf__rpm"><span data-rpm>0</span> <small class="n-muted" style="font-size:.6em;font-weight:500">vòng/phút</small></div>
          <div class="nf__seg">${MODES.map(([m, l]) => `<button type="button" data-mode="${m}">${l}</button>`).join('')}</div><div class="nf__ctl" data-ctl></div></div>`).join('')}
        <div class="nf__temps"><div class="nf__t"><span class="n-muted">CPU</span><b data-cpu>66 °C</b><i><u data-cpub></u></i></div><div class="nf__t"><span class="n-muted">GPU</span><b data-gpu>61 °C</b><i><u data-gpub></u></i></div>
          <button class="n-btn red" type="button" data-hot>Thử nóng quá</button><span class="n-muted" style="font-size:.78em">Từ 92 °C quạt tự trả về cho hệ thống.</span></div><div class="nf__warn" data-warn>Máy nóng 92 °C: DHbox trả quạt về cho hệ thống.</div></div>`;
      const els = $$('[data-fan]', p);
      function ctl(i) {
        const f = F[i], el = els[i], c = $('[data-ctl]', el);
        $$('[data-mode]', el).forEach((b) => b.classList.toggle('is-on', b.dataset.mode === f.mode));
        c.innerHTML = f.mode === 'fix' ? `<input type="range" min="1200" max="6000" step="100" value="${f.fixed}" data-fixed aria-label="Vòng/phút">` : f.mode === 'temp' ? `<div class="nf__seg">${PROFS.map(([k, l]) => `<button type="button" data-prof="${k}" class="${f.prof === k ? 'is-on' : ''}">${l}</button>`).join('')}</div>` : '<span class="n-muted" style="font-size:.82em">DHbox không can thiệp</span>';
      }
      els.forEach((el, i) => { ctl(i);
        el.addEventListener('click', (e) => { const m = e.target.closest('[data-mode]'), pr = e.target.closest('[data-prof]'); if (m) { F[i].mode = m.dataset.mode; ctl(i); } if (pr) { F[i].prof = pr.dataset.prof; ctl(i); } });
        el.addEventListener('input', (e) => { if (e.target.matches('[data-fixed]')) F[i].fixed = +e.target.value; }); });
      $('[data-hot]', p).addEventListener('click', () => { cpu = 93; gpu = 89; warnUntil = performance.now() + 4200; $('[data-warn]', p).classList.add('on'); F.forEach((f, i) => { f.mode = 'sys'; ctl(i); }); });
      const target = (f) => { const t = cpu; return f.mode === 'fix' ? f.fixed : f.mode === 'temp' ? ({ quiet: 1500 + Math.max(0, t - 60) * 60, bal: 1800 + Math.max(0, t - 55) * 100, cool: 2600 + Math.max(0, t - 48) * 110 })[f.prof] : 1700 + Math.max(0, t - 55) * 90; };
      function tick() {
        F.forEach((f, i) => { f.rpm += (Math.min(6200, target(f)) - f.rpm) * .35; const el = els[i];
          $('[data-rpm]', el).textContent = Math.round(f.rpm).toLocaleString('vi-VN'); $('.fg', el).style.strokeDashoffset = 251 * (1 - Math.min(1, f.rpm / 6500)); $('.nf__blades', el).style.setProperty('--spin', Math.max(.12, 1100 / f.rpm) + 's'); });
        const avg = (F[0].rpm + F[1].rpm) / 2, eq = 74 - (avg - 1200) * .0055; cpu += (eq - cpu) * .12; gpu += (eq - 4.5 - gpu) * .12;
        $('[data-cpu]', p).textContent = Math.round(cpu) + ' °C'; $('[data-gpu]', p).textContent = Math.round(gpu) + ' °C';
        $('[data-cpub]', p).style.width = Math.min(100, (cpu - 30) / 70 * 100) + '%'; $('[data-gpub]', p).style.width = Math.min(100, (gpu - 30) / 70 * 100) + '%';
        if (warnUntil && performance.now() > warnUntil) { warnUntil = 0; $('[data-warn]', p).classList.remove('on'); }
      }
      tick(); every(tick, 450);
    },
    async auto(c) {
      const p = $('.nt-page', content), q = (s, e) => $(s, e || p), f0 = q('[data-fan="0"]'), f1 = q('[data-fan="1"]');
      await c.wait(1100); await c.click(q('[data-mode="fix"]', f0)); await c.wait(400);
      const r = q('[data-fixed]', f0), rr = r.getBoundingClientRect(); await c.mv(r, 700, .2, .5);
      await c.mv(r, 1000, .88, .5, () => { const k = Math.max(0, Math.min(1, (cur.getBoundingClientRect().left - rr.left) / rr.width)); r.value = String(Math.round((1200 + k * 4800) / 100) * 100); r.dispatchEvent(new Event('input', { bubbles: true })); }); await c.wait(1600);
      await c.click(q('[data-mode="temp"]', f1)); await c.wait(400); await c.click(q('[data-prof="cool"]', f1)); await c.wait(2200);
      await c.click(q('[data-hot]')); await c.wait(3600);
    },
  };

  // ---------- Work mode ----------
  SCENES.workmode = {
    label: 'Chế độ làm việc', icon: 'focus', tag: 'Từ 2.6', app: 'DHbox',
    title: 'Chế độ làm việc: một công tắc để tập trung',
    desc: 'Đóng băng các app gây xao nhãng, lọc thông báo và chạy hẹn giờ cùng lúc. Có thống kê thời gian dùng từng app, chỉ lưu trên máy.',
    hint: 'Bật công tắc “Chế độ làm việc” rồi xem các app bị đóng băng và thông báo bị lọc.',
    mount() {
      const p = openNotch('workmode', 50, 25.4);
      const apps = [['Messenger', 212], ['Zalo', 190], ['Slack', 28]];
      let on = false, left = 1500, filtered = 0;
      p.innerHTML = `<div class="nw"><div><div class="nw__ring"><svg viewBox="0 0 100 100"><circle class="bg" cx="50" cy="50" r="42"/><circle class="fg" cx="50" cy="50" r="42" stroke-dasharray="264" stroke-dashoffset="0" data-prog/></svg><div class="nw__time"><span data-time>25:00</span><small>Hẹn giờ</small></div></div></div>
        <div><div class="n-row" style="justify-content:space-between;margin-bottom:.6em"><b>Chế độ làm việc</b><button type="button" class="sr-sw" data-wm aria-label="Chế độ làm việc"></button></div>
        ${apps.map(([n, h], i) => `<div class="nw__app" data-app="${i}"><em style="background:linear-gradient(145deg,hsl(${h} 70% 60%),hsl(${h + 30} 60% 44%))"></em><span>${n}</span><span class="n-muted" data-st style="font-size:.85em">Đang chạy</span></div>`).join('')}
        <div class="n-card n-row" style="justify-content:space-between"><span>Thông báo đã lọc</span><b data-flt>0</b></div></div></div>`;
      stage.innerHTML = `<div class="sw" style="left:27%;top:50%;width:46%;height:35%"><div class="sw__bar"><i></i><i></i><i></i><span>Cài đặt · Tập trung · Thời gian dùng app hôm nay</span></div><div class="sw__body" style="padding:.9em 1.2em" data-use></div></div>`;
      const use = [['Xcode', 192, '#3a6fb5'], ['Chrome', 125, '#f0b43c'], ['Figma', 88, '#a78bfa'], ['Slack', 41, '#3cc796'], ['Messenger', 33, '#ef7a72']];
      $('[data-use]', stage).innerHTML = use.map(([n, m, c], i) => `<div class="nw__row"><span>${n}</span><i><u style="width:0;background:${c}" data-bar="${i}"></u></i><b>${Math.floor(m / 60)} g ${String(m % 60).padStart(2, '0')} p</b></div>`).join('');
      setTimeout(() => use.forEach(([, m], i) => { const b = $(`[data-bar="${i}"]`, stage); if (b) b.style.width = m / 192 * 100 + '%'; }), 200);
      const sw = $('[data-wm]', p), prog = $('[data-prog]', p);
      function setOn(v) {
        on = v; sw.classList.toggle('on', on);
        $$('.nw__app', p).forEach((a, i) => setTimeout(() => { a.classList.toggle('frozen', on); $('[data-st]', a).innerHTML = on ? ic('snow') + ' Đã đóng băng' : 'Đang chạy'; }, on ? i * 260 : 0));
        if (!on) { left = 1500; filtered = 0; $('[data-flt]', p).textContent = 0; $('[data-time]', p).textContent = '25:00'; prog.style.strokeDashoffset = 0; }
      }
      sw.addEventListener('click', () => setOn(!on));
      every(() => { if (!on) return; left = Math.max(0, left - 1); $('[data-time]', p).textContent = String(Math.floor(left / 60)).padStart(2, '0') + ':' + String(left % 60).padStart(2, '0'); prog.style.strokeDashoffset = 264 * (1 - left / 1500); if (left % 3 === 0) { filtered++; $('[data-flt]', p).textContent = filtered; } }, 1000);
    },
    async auto(c) {
      const p = $('.nt-page', content);
      await c.wait(1000); await c.click($('[data-wm]', p)); await c.wait(5000);
    },
  };

  // ---------- AI agents ----------
  SCENES.agents = {
    label: 'AI Agent', icon: 'terminal', tag: 'Thử nghiệm · từ 1.5', app: 'DHbox',
    title: 'Theo dõi Claude Code ngay trên notch',
    desc: 'Xem các phiên đang chạy, duyệt hoặc từ chối quyền mà không rời cửa sổ đang làm, nhảy về đúng terminal, xem hạn mức. “Đánh thức Claude” gửi một tin nhắn nhỏ để mở chu kỳ 5 giờ đúng lúc bạn muốn. Cần bấm Nối với Claude Code để bật.',
    hint: 'Bấm Duyệt hoặc Từ chối ở yêu cầu quyền, hoặc bấm “Ping ngay”. Dữ liệu trong cảnh này là mô phỏng.',
    mount() {
      const p = openNotch('agents', 56, 25.4);
      let asked = true, ok = null;
      function render() {
        p.innerHTML = `<div class="na"><div><b class="n-muted" style="font-size:.85em;display:block;margin-bottom:.45em">Phiên đang chạy</b>
          <div class="na__sess"><span class="dot dot--ok"></span><span><b>web-shop</b><br><span class="n-muted" style="font-size:.85em">${ok === true ? 'Đang chạy npm test…' : ok === false ? 'Đã từ chối, đang chờ lệnh' : 'Chờ bạn duyệt quyền'}</span></span><button class="n-btn" type="button" data-term>Mở terminal</button></div>
          <div class="na__sess"><span class="dot" style="background:#8d94a5;box-shadow:none"></span><span><b>api-server</b><br><span class="n-muted" style="font-size:.85em">Nhàn rỗi · 4 phút trước</span></span><span></span></div>
          ${asked && ok === null ? `<div class="na__ask"><b>Claude muốn chạy lệnh</b><code>npm test -- --watch=false</code><div class="n-row"><button class="n-btn pri" type="button" data-yes>Duyệt</button><button class="n-btn red" type="button" data-no>Từ chối</button></div></div>` : ''}</div>
          <div class="n-card" style="display:grid;gap:.55em;align-content:start"><b style="font-size:.9em">Hạn mức Claude <span class="sr-chipb warn" style="font-size:.75em">thử nghiệm</span></b><div class="n-muted" style="font-size:.82em">Chu kỳ 5 giờ</div><div class="na__bar"><u style="width:38%"></u></div>
          <b style="font-size:.9em;margin-top:.3em">Đánh thức Claude</b><div class="na__time n-muted" style="font-size:.82em">Bắt đầu làm lúc <input value="08:00" aria-label="Giờ bắt đầu"></div><div class="na__time n-muted" style="font-size:.82em">làm khoảng <input value="9" aria-label="Số giờ"> giờ</div><button class="n-btn pri" type="button" data-ping>Ping ngay</button><span class="n-muted" data-pout style="font-size:.8em"></span></div></div>`;
      }
      render();
      p.addEventListener('click', (e) => {
        if (e.target.closest('[data-yes]')) { ok = true; render(); }
        else if (e.target.closest('[data-no]')) { ok = false; render(); }
        else if (e.target.closest('[data-term]')) okToast('Đã nhảy về terminal của phiên web-shop');
        else if (e.target.closest('[data-ping]')) { const o = $('[data-pout]', p); o.textContent = 'Đang gửi…'; setTimeout(() => { o.innerHTML = ic('check') + ' Đã gửi, chu kỳ 5 giờ bắt đầu'; }, reduce ? 0 : 900); }
      });
      stage.innerHTML = '';
    },
    async auto(c) {
      const p = $('.nt-page', content);
      await c.wait(1000); await c.click($('[data-yes]', p)); await c.wait(1600); await c.click($('[data-ping]', p)); await c.wait(1800);
    },
  };

  // ---------- Right-click on an app: clean removal ----------
  SCENES.appremove = {
    label: 'Gỡ app sạch', icon: 'trash', tag: 'Từ 1.8', app: 'Finder',
    title: 'Gỡ cài đặt hoàn toàn, xóa cache ứng dụng',
    desc: 'Chuột phải vào một ứng dụng: xem trước mọi dấu vết nó để lại cùng dung lượng, rồi chuyển vào Thùng rác. Các mục cần quyền quản trị chỉ được liệt kê, không tự xóa. Có Hoàn tác.',
    hint: 'Bấm chuột phải vào một ứng dụng (hoặc chọn rồi bấm “DHbox”), rồi chọn Gỡ cài đặt hoàn toàn.',
    mount() {
      const apps = [['Photo Studio', 212, 'image'], ['Video Cutter', 8, 'play'], ['Note Pad', 42, 'note']];
      const ROWS = { all: [['Ứng dụng', '/Applications', '412 MB', 0], ['Caches', '~/Library/Caches', '186 MB', 0], ['Application Support', '~/Library', '94 MB', 0], ['Logs', '~/Library/Logs', '8 MB', 0], ['Saved State', '~/Library', '2 MB', 0], ['Tùy chọn (Preferences)', '~/Library', '12 KB', 0], ['LaunchDaemon', '/Library · cần quyền quản trị', 'chỉ liệt kê', 1]],
        cache: [['Caches', '~/Library/Caches', '186 MB', 0], ['Logs', '~/Library/Logs', '8 MB', 0]] };
      let target = 0, gone = new Set();
      stage.innerHTML = `<div class="sw fw"><div class="sw__bar"><i></i><i></i><i></i><span>Ứng dụng</span><div class="sw__tools"><button class="sr-btn ghost" type="button" data-dh>DHbox ${ic('chevron')}</button></div></div>
        <div class="sw__body"><div class="fw__side"><span>Gần đây</span><span>Desktop</span><span class="on">Ứng dụng</span><span>Tải về</span></div><div class="fw__grid" data-grid>${apps.map(([n, h, i], k) => `<div class="fw__it" data-app="${k}"><span class="fw__app" style="background:linear-gradient(145deg,hsl(${h} 70% 62%),hsl(${h + 30} 62% 46%))">${ic(i)}</span><span>${n}.app</span></div>`).join('')}</div><div class="fw__status"><span data-stat>Chọn một ứng dụng</span></div></div></div>
        <div class="ctxm" data-menu hidden><div>Mở</div><div>Chép tên</div><hr><div class="hd">DHbox</div><button type="button" data-do="cache">${ic('cube')}Xóa cache ứng dụng</button><button type="button" data-do="all">${ic('trash')}Gỡ cài đặt hoàn toàn</button></div><div class="sheet" data-sheet hidden></div>`;
      const grid = $('[data-grid]', stage), menu = $('[data-menu]', stage), sheet = $('[data-sheet]', stage), stat = $('[data-stat]', stage);
      const selApp = (k) => { target = k; $$('.fw__it', grid).forEach((e, i) => e.classList.toggle('sel', i === k)); stat.textContent = apps[k][0] + '.app · 412 MB'; };
      grid.addEventListener('click', (e) => { const a = e.target.closest('.fw__it'); if (a) selApp(+a.dataset.app); menu.hidden = true; });
      grid.addEventListener('contextmenu', (e) => { const a = e.target.closest('.fw__it'); if (!a) return; e.preventDefault(); selApp(+a.dataset.app); const [x, y] = relPos(e); showMenu(menu, x, y); });
      $('[data-dh]', stage).addEventListener('click', (e) => { const r = e.currentTarget.getBoundingClientRect(), s = stage.getBoundingClientRect(); selApp(target); showMenu(menu, r.left - s.left - 60, r.bottom - s.top + 4); });
      menu.addEventListener('click', (e) => { const b = e.target.closest('[data-do]'); if (!b) return; menu.hidden = true; preview(b.dataset.do); });
      function preview(kind) {
        const rows = ROWS[kind], name = apps[target][0], tot = kind === 'all' ? '702 MB' : '194 MB';
        sheet.hidden = false;
        sheet.innerHTML = `<div class="sheet__box"><h5>${kind === 'all' ? 'Gỡ cài đặt hoàn toàn' : 'Xóa cache ứng dụng'} “${name}”</h5><p>Xem trước những gì sẽ vào Thùng rác.</p><div class="rm__list">${rows.map(([n, path, sz, dis]) => `<div class="rm__row${dis ? ' dis' : ''}"><span class="cb">${dis ? '' : ic('check')}</span><span>${n}<small>${path}</small></span><span>${sz}</span></div>`).join('')}</div><div class="tot"><span>Tổng</span><span>${tot}</span></div><div class="sheet__acts"><button class="sr-btn ghost" type="button" data-cancel>Hủy</button><button class="sr-btn danger" type="button" data-ok>${ic('trash')}Chuyển vào Thùng rác</button></div></div>`;
        $('[data-cancel]', sheet).onclick = () => { sheet.hidden = true; };
        $('[data-ok]', sheet).onclick = () => {
          sheet.hidden = true; const k = target;
          if (kind === 'all') { const el = $(`.fw__it[data-app="${k}"]`, grid); el.style.transition = 'opacity .5s, transform .5s'; el.style.opacity = 0; el.style.transform = 'scale(.6)'; gone.add(k); }
          okToast(kind === 'all' ? `Đã chuyển ${rows.length - 1} mục (${tot}) vào Thùng rác` : `Đã dọn cache của ${name} (${tot})`, 'Hoàn tác', () => { const el = $(`.fw__it[data-app="${k}"]`, grid); el.style.opacity = 1; el.style.transform = ''; gone.delete(k); });
        };
      }
    },
    async auto(c) {
      const q = (s) => $(s, stage), it = q('.fw__it[data-app="0"]');
      await c.wait(900); await c.click(it); await c.wait(300); await c.rclick(it); await c.wait(500);
      await c.click(q('[data-do="all"]')); await c.wait(2400); await c.click(q('[data-ok]')); await c.wait(2300); await c.click($('.sr-toast button')); await c.wait(900);
    },
  };

  // ---------- Locked folders ----------
  SCENES.lockfolder = {
    label: 'Thư mục khóa', icon: 'lock', tag: 'Từ 1.5', app: 'Finder',
    title: 'Khóa thư mục bằng Touch ID, mã hóa AES-256',
    desc: 'Khóa thư mục nhạy cảm từ chuột phải trong Finder. Nội dung được mã hóa AES-256, mở bằng Touch ID hoặc mật khẩu riêng và tự khóa lại khi máy ngủ. Bản gốc được chuyển vào Thùng rác sau khi kiểm tra bản mã hóa.',
    hint: 'Chuột phải “Hợp đồng” rồi chọn Khóa thư mục, bấm đúp để mở khóa, rồi thử “Cho máy ngủ”.',
    mount() {
      const items = [['Hợp đồng', 'plain'], ['Ảnh sản phẩm', 'plain'], ['Báo cáo 2026', 'plain'], ['Khách hàng', 'plain']];
      let sel = 0, pending = null;
      stage.innerHTML = `<div class="sw fw"><div class="sw__bar"><i></i><i></i><i></i><span>Tài liệu</span><div class="sw__tools"><button class="sr-btn ghost" type="button" data-sleep>${ic('moon')}Cho máy ngủ</button><button class="sr-btn ghost" type="button" data-dh>DHbox ${ic('chevron')}</button></div></div>
        <div class="sw__body"><div class="fw__side"><span>Gần đây</span><span>Desktop</span><span class="on">Tài liệu</span><span>Tải về</span></div><div class="fw__grid" data-grid></div><div class="fw__status"><span data-stat>4 mục</span></div></div></div>
        <div class="ctxm" data-menu hidden><div>Mở</div><div>Chép tên</div><hr><div class="hd">DHbox</div><button type="button" data-do="lock"></button><button type="button" disabled style="opacity:.5">${ic('cube')}Xem dung lượng</button></div><div class="sheet" data-sheet hidden></div><div class="sr-sleep" data-dark style="position:absolute;inset:-3em 0 0;background:#000;opacity:0;pointer-events:none;z-index:50;transition:opacity .9s"></div>`;
      const grid = $('[data-grid]', stage), menu = $('[data-menu]', stage), sheet = $('[data-sheet]', stage), stat = $('[data-stat]', stage), dark = $('[data-dark]', stage);
      function draw() {
        if (!grid.isConnected) return;
        grid.innerHTML = items.map(([n, s], i) => `<div class="fw__it${i === sel ? ' sel' : ''}${s === 'locked' ? ' locked' : ''}" data-i="${i}"><span class="ficon${s === 'locked' ? ' lock' : ''}">${FOLDER}<span class="badge" style="${s === 'open' ? 'display:grid;background:#3cc796;color:#06301f' : ''}">${ic(s === 'open' ? 'key' : 'lock')}</span></span><span>${n}</span><small>${s === 'locked' ? 'Đã khóa · AES-256' : s === 'open' ? 'Đang mở khóa' : ''}</small></div>`).join('');
        const t = items[sel]; $('[data-do]', stage).innerHTML = ic('lock') + (t[1] === 'locked' ? 'Mở khóa thư mục' : t[1] === 'open' ? 'Khóa lại thư mục' : 'Khóa thư mục');
      }
      draw();
      function touch(kind, i) {
        const n = items[i][0]; sheet.hidden = false;
        sheet.innerHTML = `<div class="sheet__box"><h5>${kind === 'lock' ? 'Khóa' : 'Mở khóa'} “${n}”</h5><p>${kind === 'lock' ? 'Nội dung sẽ được mã hóa AES-256. Dùng Touch ID để xác nhận.' : 'Chạm Touch ID để mở thư mục.'}</p><span class="nn__fp" data-fp>${ic('finger')}</span><div class="sheet__acts"><button class="sr-btn ghost" type="button" data-cancel>Hủy</button><button class="sr-btn" type="button" data-go>Dùng Touch ID</button></div></div>`;
        $('[data-cancel]', sheet).onclick = () => { sheet.hidden = true; };
        $('[data-go]', sheet).onclick = () => { $('[data-fp]', sheet).classList.add('scan'); setTimeout(() => { sheet.hidden = true;
          if (kind === 'lock') { items[i][1] = 'locked'; draw(); okToast(`Đã khóa “${n}”. Bản gốc ở Thùng rác, nhớ dọn Thùng rác`); } else { items[i][1] = 'open'; draw(); okToast(`Đã mở khóa “${n}”`); } }, reduce ? 0 : 1300); };
      }
      const act = (i) => touch(items[i][1] === 'locked' ? 'unlock' : 'lock', i);
      grid.addEventListener('click', (e) => { const a = e.target.closest('.fw__it'); if (a) { sel = +a.dataset.i; draw(); } menu.hidden = true; });
      grid.addEventListener('dblclick', (e) => { const a = e.target.closest('.fw__it'); if (a && items[+a.dataset.i][1] === 'locked') touch('unlock', +a.dataset.i); });
      grid.addEventListener('contextmenu', (e) => { const a = e.target.closest('.fw__it'); if (!a) return; e.preventDefault(); sel = +a.dataset.i; draw(); const [x, y] = relPos(e); showMenu(menu, x, y); });
      $('[data-dh]', stage).addEventListener('click', (e) => { const r = e.currentTarget.getBoundingClientRect(), s = stage.getBoundingClientRect(); showMenu(menu, r.left - s.left - 60, r.bottom - s.top + 4); });
      menu.addEventListener('click', (e) => { if (!e.target.closest('[data-do]')) return; menu.hidden = true; if (items[sel][1] === 'open') { items[sel][1] = 'locked'; draw(); okToast(`Đã khóa lại “${items[sel][0]}”`); } else act(sel); });
      $('[data-sleep]', stage).addEventListener('click', () => { dark.style.opacity = 1; setTimeout(() => { let n = 0; items.forEach((it) => { if (it[1] === 'open') { it[1] = 'locked'; n++; } }); draw(); dark.style.opacity = 0; if (n) okToast('Máy ngủ: đã tự khóa lại ' + n + ' thư mục'); }, reduce ? 0 : 1500); });
    },
    async auto(c) {
      const q = (s) => $(s, stage), it = () => q('.fw__it[data-i="0"]');
      await c.wait(900); await c.click(it()); await c.rclick(it()); await c.wait(400); await c.click(q('[data-do]')); await c.wait(900);
      await c.click(q('[data-go]')); await c.wait(2800);
      await c.mv(it(), 700); c.ping(it()); c.fire(it(), 'dblclick'); await c.wait(900); await c.click(q('[data-go]')); await c.wait(2300);
      await c.click(q('[data-sleep]')); await c.wait(3300);
    },
  };

  // ---------- iPhone mirror ----------
  SCENES.mirror = {
    label: 'iPhone Mirror', icon: 'iphone', tag: 'Mới ở 2.8 · mặc định tắt', app: 'DHbox Mirror',
    title: 'DHbox Mirror: màn hình iPhone trong một cửa sổ trên Mac',
    desc: 'Ghép đôi một lần bằng mã QR, Mac luôn hỏi trước khi cho một iPhone kết nối. Hình ảnh mã hóa đầu cuối, chỉ trong mạng nhà, không lưu lại. Cần app DHbox Mirror trên iPhone (iOS 18 trở lên), hiện cài bằng Xcode với Apple ID miễn phí.',
    hint: 'Bật DHbox Mirror, bấm “Ghép đôi iPhone mới”, bấm vào mã QR để mô phỏng iPhone quét, rồi chọn Cho phép.',
    mount() {
      let st = 0, snd = 'iphone', land = false;
      stage.innerHTML = `<div class="sw mr"><div class="sw__bar"><i></i><i></i><i></i><span>DHbox Mirror</span></div><div class="sw__body"><div class="mr__side"><h5>DHbox Mirror</h5><p>Chiếu màn hình iPhone qua Wi-Fi. Mặc định tắt: khi tắt, Mac không mở cổng mạng nào.</p>
        <div class="mr__row"><span>Bật DHbox Mirror</span><button type="button" class="sr-sw" data-on aria-label="Bật DHbox Mirror"></button></div><button class="sr-btn" type="button" data-pair hidden>${ic('qr')}Ghép đôi iPhone mới</button>
        <div class="mr__steps" data-steps></div><div class="mr__row" data-snd hidden><span>Âm thanh phát ở</span><span class="sw__tools" style="display:flex;gap:.3em"><button class="sr-chipb" type="button" data-s="iphone">iPhone</button><button class="sr-chipb" type="button" data-s="mac">Mac</button></span></div></div>
        <div class="mr__view"><div class="mr__qr" data-qr><canvas width="160" height="160" data-qrc></canvas><b>Quét bằng DHbox Mirror trên iPhone</b><span style="color:var(--text-2);font-size:.9em">Mã hết hạn sau 2 phút</span></div>
        <div class="mr__ask" data-ask><b>“iPhone của Minh” muốn chia sẻ màn hình</b><span style="color:var(--text-2)">Chỉ cho phép thiết bị bạn tin tưởng.</span><div style="display:flex;gap:.6em;justify-content:flex-end"><button class="sr-btn ghost" type="button" data-deny>Từ chối</button><button class="sr-btn" type="button" data-allow>Cho phép</button></div></div>
        <div class="mr__phone" data-phone><div class="mr__scr"><span class="mr__island"></span><div class="mr__home"></div><div class="mr__notif" data-notif><b>Zalo</b> · Chị Lan: Báo giá xong chưa em?</div><div class="mr__bar"><u></u></div></div></div>
        <div class="mr__tools" data-tools><button class="mr__ic is-on" type="button" data-spk aria-label="Âm thanh">${ic('speaker')}</button><button class="mr__ic" type="button" data-rot aria-label="Xoay">${ic('rotate')}</button></div></div></div></div>`;
      drawQR($('[data-qrc]', stage), 23);
      $('.mr__home', stage).innerHTML = Array.from({ length: 16 }, (_, i) => `<i style="--h:${(i * 47) % 360}"></i>`).join('');
      const q = (s) => $(s, stage);
      function steps() {
        const S = [['Bật DHbox Mirror', 1], ['Ghép đôi bằng mã QR', 2], ['Cho phép iPhone', 3], ['Đang chiếu màn hình', 4]];
        q('[data-steps]').innerHTML = S.map(([t, n]) => `<div class="${st >= n ? 'ok' : st === n - 1 ? 'cur' : ''}"><b>${st >= n ? ic('check') : n}</b>${t}</div>`).join('');
        q('[data-pair]').hidden = st !== 1; q('[data-qr]').classList.toggle('on', st === 2); q('[data-ask]').classList.toggle('on', st === 3);
        q('[data-phone]').classList.toggle('on', st === 4); q('[data-tools]').classList.toggle('on', st === 4); q('[data-snd]').hidden = st !== 4; q('[data-notif]').classList.toggle('on', st === 4);
        $$('[data-s]', stage).forEach((b) => b.classList.toggle('ok', b.dataset.s === snd));
      }
      steps();
      q('[data-on]').addEventListener('click', () => { st = st === 0 ? 1 : 0; q('[data-on]').classList.toggle('on', st > 0); steps(); });
      q('[data-pair]').addEventListener('click', () => { st = 2; steps(); });
      q('[data-qr]').addEventListener('click', () => { st = 3; steps(); });
      q('[data-deny]').addEventListener('click', () => { st = 1; steps(); okToast('Đã từ chối iPhone này'); });
      q('[data-allow]').addEventListener('click', () => { st = 4; steps(); });
      $$('[data-s]', stage).forEach((b) => b.addEventListener('click', () => { snd = b.dataset.s; steps(); okToast(snd === 'mac' ? 'Âm thanh phát trên Mac. Hãy vặn nhỏ loa iPhone' : 'Âm thanh phát trên iPhone'); }));
      q('[data-spk]').addEventListener('click', () => { snd = snd === 'mac' ? 'iphone' : 'mac'; steps(); okToast(snd === 'mac' ? 'Âm thanh phát trên Mac' : 'Âm thanh phát trên iPhone'); });
      q('[data-rot]').addEventListener('click', () => { land = !land; q('[data-phone]').classList.toggle('land', land); });
    },
    async auto(c) {
      const q = (s) => $(s, stage);
      await c.wait(900); await c.click(q('[data-on]')); await c.wait(500); await c.click(q('[data-pair]')); await c.wait(1400);
      await c.click(q('[data-qr]')); await c.wait(900); await c.click(q('[data-allow]')); await c.wait(1800);
      await c.click(q('[data-spk]')); await c.wait(1300); await c.click(q('[data-rot]')); await c.wait(1500); await c.click(q('[data-rot]')); await c.wait(900);
    },
  };

  // =====================================================================
  // Engine: chips, selection, autoplay
  // =====================================================================
  const ORDER = ['spacelens', 'capture', 'notes', 'clipboard', 'connect', 'workmode', 'fan', 'appremove', 'lockfolder', 'agents', 'mirror'];
  const chips = $('[data-sr-chips]');
  chips.innerHTML = ORDER.map((id) => `<button type="button" class="sr-chip" data-id="${id}">${ic(SCENES[id].icon)}${SCENES[id].label}</button>`).join('');
  chips.addEventListener('click', (e) => { const b = e.target.closest('.sr-chip'); if (b) select(b.dataset.id); });
  $('[data-sr-replay]').addEventListener('click', () => select(currentId));

  async function startAuto(id) {
    const t = ++token, sc = SCENES[id];
    if (!sc.auto) return;
    try { await sleep(700); if (t !== token) return; await sc.auto(makeCtx(t)); }
    catch (e) { if (!(e instanceof Abort)) console.error(e); }
    finally { if (t === token) cur.classList.remove('on'); }
  }
  function select(id) {
    cancelAuto(); clearScene(); toastEl.classList.remove('on'); cur.classList.remove('on', 'down');
    currentId = id; const sc = SCENES[id];
    stage.innerHTML = ''; stage.scrollTop = 0;
    if (!['notes', 'clipboard', 'connect', 'fan', 'workmode', 'agents'].includes(id)) { content.innerHTML = ''; closeNotch(); }
    appName.textContent = sc.app || 'Finder';
    capTitle.firstChild.textContent = sc.title; capDesc.textContent = sc.desc; capTag.textContent = sc.tag; capHint.firstChild.textContent = sc.hint + ' ';
    capTag.classList.toggle('sr-tag--exp', /nghiệm/.test(sc.tag));
    capHint.classList.remove('seen');
    $$('.sr-chip', chips).forEach((b) => b.classList.toggle('is-on', b.dataset.id === id));
    sc.mount();
    if (!reduce) startAuto(id);
  }
  if ('IntersectionObserver' in window) {
    let started = false;
    new IntersectionObserver((e) => { visible = e[0].isIntersecting; if (visible && !started) { started = true; select('spacelens'); } }, { threshold: .25 }).observe(root);
  } else { visible = true; select('spacelens'); }
  window.DHboxShowroom = { select };
})();
