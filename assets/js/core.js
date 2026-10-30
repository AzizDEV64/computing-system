/* Ortak davranışlar: tema, içindekiler vurgusu, ana sayfa register'ı. */
(function () {
  'use strict';

  const store = {
    get(key, fallback) {
      try { const v = localStorage.getItem(key); return v === null ? fallback : JSON.parse(v); }
      catch (e) { return fallback; }
    },
    set(key, value) {
      try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) { /* depolama kapalı olabilir */ }
    }
  };
  window.CSStore = store;

  /* ---------- Tema ---------- */
  const root = document.documentElement;
  const savedTheme = store.get('cs-theme', null);
  if (savedTheme) root.setAttribute('data-theme', savedTheme);

  function currentTheme() {
    const attr = root.getAttribute('data-theme');
    if (attr) return attr;
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  const ICON = {
    sun: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>',
    moon: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z"/></svg>',
    home: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 11l9-7 9 7"/><path d="M5 10v10h5v-6h4v6h5V10"/></svg>',
    left: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 6l-6 6 6 6"/></svg>',
    right: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 6l6 6-6 6"/></svg>',
    down: '<svg class="tn-caret" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg>'
  };
  function paintThemeButton(btn) {
    const dark = currentTheme() === 'dark';
    const label = dark ? 'Açık temaya geç' : 'Koyu temaya geç';
    btn.className = 'theme-btn';
    btn.innerHTML = dark ? ICON.sun : ICON.moon;
    btn.setAttribute('aria-label', label);
    btn.title = label;
  }

  document.addEventListener('DOMContentLoaded', () => {
    const themeBtn = document.querySelector('[data-theme-toggle]');
    if (themeBtn) {
      paintThemeButton(themeBtn);
      themeBtn.addEventListener('click', () => {
        const next = currentTheme() === 'dark' ? 'light' : 'dark';
        root.setAttribute('data-theme', next);
        store.set('cs-theme', next);
        paintThemeButton(themeBtn);
      });
    }

    initTopNav();
    initToc();
    initRegister();
    // Ders JS'leri kendi içeriklerini ürettikten sonra çalışsın
    setTimeout(polishContent, 0);
    initGroupHover();
  });

  /* ---------- K-map grup listesi: bir gruba gelince haritada o grubu vurgula ---------- */
  function initGroupHover() {
    const findMap = ul => {
      for (let el = ul.parentElement; el && el !== document.body; el = el.parentElement) {
        const maps = [...el.querySelectorAll('.kmap-wrap')];
        if (!maps.length) continue;
        const before = maps.filter(m => m.compareDocumentPosition(ul) & Node.DOCUMENT_POSITION_FOLLOWING);
        return before.length ? before[before.length - 1] : maps[0];
      }
      return null;
    };
    const clear = () => {
      document.querySelectorAll('.kmap-wrap.dim').forEach(w => w.classList.remove('dim'));
      document.querySelectorAll('.kmap-group.on, .group-list li.on').forEach(el => el.classList.remove('on'));
    };
    const show = li => {
      const ul = li.parentElement, map = findMap(ul);
      if (!map) return;
      const i = [...ul.children].indexOf(li);
      const boxes = map.querySelectorAll(`.kmap-group[data-g="${i}"]`);
      if (!boxes.length) return;
      clear();
      map.classList.add('dim');
      boxes.forEach(b => b.classList.add('on'));
      li.classList.add('on');
    };
    const liOf = e => e.target.closest && e.target.closest('.group-list li');
    document.addEventListener('pointerover', e => { const li = liOf(e); if (li && e.pointerType === 'mouse') show(li); });
    document.addEventListener('pointerout', e => { const li = liOf(e); if (li && e.pointerType === 'mouse' && !li.contains(e.relatedTarget)) clear(); });
    document.addEventListener('click', e => {
      const li = liOf(e);
      if (li) { li.classList.contains('on') ? clear() : show(li); }
      else if (!e.target.closest('.kmap-wrap')) clear();
    });
  }

  /* ---------- Üst menü: ana sayfa, önceki/sonraki ders, ders listesi ---------- */
  const LESSONS = [
    ['01-sayi-sistemleri.html', 'Number Systems'],
    ['02-boole-cebiri.html', 'Boolean Algebra'],
    ['03-mantik-tasarimi.html', 'Logic Design'],
    ['04-karnaugh.html', 'Karnaugh Maps'],
    ['05-dont-care.html', "K-Maps with Don't Care"],
    ['06-kombinasyonel-1.html', 'Combinational Circuits 1'],
    ['07-kombinasyonel-2.html', 'Combinational Circuits 2']
  ];
  function initTopNav() {
    const bar = document.querySelector('.topbar-inner');
    if (!bar) return;
    const lessonId = document.body.dataset.lesson;            // "01"…"07" ya da yok (ana sayfa)
    const cur = lessonId ? parseInt(lessonId, 10) - 1 : -1;
    const inLessons = cur >= 0;
    const home = inLessons ? '../index.html' : 'index.html';
    const href = i => (inLessons ? '' : 'lessons/') + LESSONS[i][0];
    const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

    const nav = document.createElement('nav');
    nav.className = 'topnav';
    nav.setAttribute('aria-label', 'Dersler arası gezinme');
    const num = i => String(i + 1).padStart(2, '0');
    let h = '<div class="tn-group">';
    if (inLessons) {
      h += `<a class="tn-item tn-home" href="${home}" title="Ana sayfa">${ICON.home}<span>Ana sayfa</span></a>`;
      h += cur > 0
        ? `<a class="tn-item tn-arrow" href="${href(cur - 1)}" aria-label="Önceki ders: ${esc(LESSONS[cur - 1][1])}" title="Önceki: ${esc(LESSONS[cur - 1][1])}">${ICON.left}</a>`
        : `<span class="tn-item tn-arrow" aria-disabled="true">${ICON.left}</span>`;
    }
    const label = inLessons
      ? `<span class="tn-num">${num(cur)}</span><span class="tn-of">/07</span><span class="tn-title">${esc(LESSONS[cur][1])}</span>`
      : `<span>Dersler</span>`;
    h += `<details class="tn-menu"><summary class="tn-item" aria-label="Ders listesi">${label}${ICON.down}</summary>`;
    h += `<div class="tn-panel"><div class="tn-panel-head"><span>Dersler</span><span>7 ders</span></div><ol>`;
    LESSONS.forEach(([, title], i) => {
      h += `<li><a href="${href(i)}"${i === cur ? ' aria-current="page"' : ''}><span class="tn-num">${num(i)}</span>${esc(title)}</a></li>`;
    });
    h += `</ol></div></details>`;
    if (inLessons) {
      h += cur < LESSONS.length - 1
        ? `<a class="tn-item tn-arrow" href="${href(cur + 1)}" aria-label="Sonraki ders: ${esc(LESSONS[cur + 1][1])}" title="Sonraki: ${esc(LESSONS[cur + 1][1])}">${ICON.right}</a>`
        : `<span class="tn-item tn-arrow" aria-disabled="true">${ICON.right}</span>`;
    }
    h += '</div>';
    nav.innerHTML = h;
    const crumb = bar.querySelector('.crumb');
    const spacer = bar.querySelector('.spacer');
    if (crumb) crumb.remove();
    if (spacer) spacer.after(nav); else bar.appendChild(nav);

    // Menü dışına tıklayınca ya da Esc'e basınca kapat
    const det = nav.querySelector('.tn-menu');
    document.addEventListener('click', e => { if (det.open && !det.contains(e.target)) det.open = false; });
    document.addEventListener('keydown', e => { if (e.key === 'Escape' && det.open) { det.open = false; det.querySelector('summary').focus(); } });
  }

  /* ---------- Görsel düzeltmeler: formül terimleri, tablo yazı tipi, geniş şemalar ---------- */
  // Bir formülde boşluk içermeyen her parçayı (ör. S₁S̄₀I) bölünmez bir kutuya alır.
  function protectTerms(el) {
    if (el.dataset.nw) return;
    el.dataset.nw = '1';
    const tokens = [];
    [...el.childNodes].forEach(node => {
      if (node.nodeType === 3) node.textContent.split(/(\s+)/).forEach(t => { if (t) tokens.push(t); });
      else tokens.push(node);
    });
    el.textContent = '';
    let group = null;
    tokens.forEach(t => {
      const isSpace = typeof t === 'string' && /^\s+$/.test(t);
      if (isSpace) { group = null; el.appendChild(document.createTextNode(t)); return; }
      if (!group) { group = document.createElement('span'); group.className = 'nw'; el.appendChild(group); }
      group.appendChild(typeof t === 'string' ? document.createTextNode(t) : t);
    });
  }
  // Unicode üst simge rakamlarını (2⁴, 10⁻¹) gerçek <sup>'a çevirir: her yazı tipinde düzgün görünür
  const SUP_MAP = { '⁰': '0', '¹': '1', '²': '2', '³': '3', '⁴': '4', '⁵': '5', '⁶': '6', '⁷': '7', '⁸': '8', '⁹': '9', '⁻': '−', 'ⁿ': 'n' };
  function fixSuperscripts(root) {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode: n => (/[⁰¹²³⁴⁵⁶⁷⁸⁹ⁿ]/.test(n.nodeValue) && !n.parentElement.closest('svg, code, script, option, select, textarea, .topnav')) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT
    });
    const nodes = []; while (walker.nextNode()) nodes.push(walker.currentNode);
    nodes.forEach(node => {
      const frag = document.createDocumentFragment();
      node.nodeValue.split(/([⁰¹²³⁴⁵⁶⁷⁸⁹⁻ⁿ]+)/).forEach(part => {
        if (!part) return;
        if (/^[⁰¹²³⁴⁵⁶⁷⁸⁹⁻ⁿ]+$/.test(part) && /[⁰¹²³⁴⁵⁶⁷⁸⁹ⁿ]/.test(part)) {
          const sup = document.createElement('sup'); sup.textContent = [...part].map(c => SUP_MAP[c]).join(''); frag.appendChild(sup);
        } else frag.appendChild(document.createTextNode(part));
      });
      node.replaceWith(frag);
    });
  }
  function polishContent() {
    const content = document.querySelector('.content') || document.querySelector('main');
    if (content) fixSuperscripts(content);
    // Uzun bit dizileri boşluklardan bölünebilsin (telefonda taşmasın)
    document.querySelectorAll('.content .b').forEach(b => { if (b.textContent.length > 16 && /\s/.test(b.textContent)) b.classList.add('list'); });
    // Geniş tablolar: yana kaydığını belirt
    document.querySelectorAll('.content .table-wrap').forEach(w => {
      if (w.closest('.widget, .wout, .quiz, [id$="-out"]')) return;
      const hint = document.createElement('p'); hint.className = 'table-hint'; hint.textContent = 'Tablo yana kayıyor, tamamını görmek için kaydır.';
      w.before(hint);
      const check = () => hint.classList.toggle('on', w.scrollWidth > w.clientWidth + 2);
      check(); window.addEventListener('resize', check);
    });
    // Devrelerde renk açıklaması
    document.querySelectorAll('.circuit').forEach(c => {
      if (c.querySelector('.wire-legend') || !c.querySelector('[data-n]')) return;
      const p = document.createElement('p'); p.className = 'wire-legend';
      p.innerHTML = '<b>Bakır</b> kablo = 1, gri kablo = 0. Girişlere basarak değiştir.';
      (c.querySelector('.circuit-foot') || c).appendChild(p);
    });
    document.querySelectorAll('.content .m').forEach(m => { if (!m.parentElement.closest('.m')) protectTerms(m); });
    document.querySelectorAll('.tt td').forEach(td => { if (/[A-Za-zÇĞİÖŞÜçğıöşü]/.test(td.textContent)) td.classList.add('txt'); });
    document.querySelectorAll('.circuit-svg svg').forEach(svg => {
      const vb = (svg.getAttribute('viewBox') || '').split(/\s+/).map(Number);
      if (vb[2] > 520) {
        svg.classList.add('wide');
        const circuit = svg.closest('.circuit');
        if (circuit && !circuit.querySelector('.scroll-hint')) {
          const hint = document.createElement('p');
          hint.className = 'scroll-hint';
          hint.textContent = 'Şemanın tamamını görmek için yana kaydır.';
          svg.parentElement.before(hint);
          const check = () => circuit.classList.toggle('can-scroll', svg.parentElement.scrollWidth > svg.parentElement.clientWidth + 2);
          check(); window.addEventListener('resize', check);
        }
      }
    });
  }

  /* ---------- İçindekiler: okunan bölümü vurgula ---------- */
  function initToc() {
    const links = [...document.querySelectorAll('.toc a[href^="#"]')];
    if (!links.length || !('IntersectionObserver' in window)) return;
    const map = new Map(links.map(a => [a.getAttribute('href').slice(1), a]));
    const sections = [...map.keys()].map(id => document.getElementById(id)).filter(Boolean);
    const visible = new Set();
    const obs = new IntersectionObserver(entries => {
      entries.forEach(e => { if (e.isIntersecting) visible.add(e.target.id); else visible.delete(e.target.id); });
      const first = sections.find(s => visible.has(s.id));
      if (first) links.forEach(a => a.classList.toggle('active', a === map.get(first.id)));
    }, { rootMargin: '-15% 0px -70% 0px' });
    sections.forEach(s => obs.observe(s));

    // Mobilde bir bağlantıya basınca listeyi kapat
    const det = document.querySelector('.toc details');
    if (det) links.forEach(a => a.addEventListener('click', () => {
      if (window.matchMedia('(max-width: 63.99rem)').matches) det.open = false;
    }));
    if (det && window.matchMedia('(min-width: 64rem)').matches) det.open = true;
  }

  /* ---------- 8 bitlik register ---------- */
  function initRegister() {
    const reg = document.querySelector('[data-register]');
    if (!reg) return;
    // Telefonda oyuncak ders listesinin altına iner, geniş ekranda hero'da kalır
    const home = reg.parentNode, slot = document.querySelector('[data-register-slot]');
    if (slot) {
      const wide = window.matchMedia('(min-width: 62rem)');
      const place = () => { const dest = wide.matches ? home : slot; if (reg.parentNode !== dest) dest.appendChild(reg); slot.hidden = wide.matches; };
      place();
      wide.addEventListener('change', place);
    }
    const wrap = reg.querySelector('.switches');
    const bits = [0, 0, 1, 0, 1, 1, 0, 1]; // 45
    const weights = [128, 64, 32, 16, 8, 4, 2, 1];
    const buttons = weights.map((w, i) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'switch';
      b.innerHTML = `<span class="led" aria-hidden="true"></span><span class="bit"></span><span class="w">${w}</span>`;
      b.addEventListener('click', () => { bits[i] ^= 1; render(); });
      wrap.appendChild(b);
      return b;
    });
    const out = name => reg.querySelector(`[data-out="${name}"]`);

    function render() {
      const s = bits.join('');
      const u = parseInt(s, 2);
      buttons.forEach((b, i) => {
        b.setAttribute('aria-pressed', bits[i] ? 'true' : 'false');
        b.setAttribute('aria-label', `Bit ağırlığı ${weights[i]}: şu an ${bits[i]}`);
        b.querySelector('.bit').textContent = bits[i];
      });
      const ones = s.split('').map(c => (c === '0' ? '1' : '0')).join('');
      const twos = ((256 - u) % 256).toString(2).padStart(8, '0');
      const gray = (u ^ (u >> 1)).toString(2).padStart(8, '0');
      out('dec').textContent = u;
      out('signed').textContent = u >= 128 ? u - 256 : u;
      out('hex').textContent = u.toString(16).toUpperCase().padStart(2, '0');
      out('oct').textContent = u.toString(8);
      out('ones').textContent = ones;
      out('twos').textContent = twos;
      out('gray').textContent = gray;
      out('bcd').textContent = String(u).split('').map(d => (+d).toString(2).padStart(4, '0')).join(' ');
      out('sum').textContent = weights.filter((w, i) => bits[i]).join(' + ') || '0';
    }
    reg.querySelector('[data-reg="clear"]').addEventListener('click', () => { bits.fill(0); render(); });
    reg.querySelector('[data-reg="invert"]').addEventListener('click', () => { for (let i = 0; i < 8; i++) bits[i] ^= 1; render(); });
    reg.querySelector('[data-reg="random"]').addEventListener('click', () => {
      for (let i = 0; i < 8; i++) bits[i] = Math.random() < 0.5 ? 0 : 1; render();
    });
    render();
  }
})();
