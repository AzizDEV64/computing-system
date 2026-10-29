/* Karnaugh haritası motoru ve çizimi.
   minimize(): Quine–McCluskey ile asal çarpanları bulur, en az terim / en az değişkenle örten seçimi yapar.
   renderKMap(): haritayı ve grupları (sarma kenarlar dahil) çizer. */
(function (root) {
  'use strict';

  const VARS = ['A', 'B', 'C', 'D', 'E'];
  const popcount = x => { let c = 0; while (x) { c += x & 1; x >>= 1; } return c; };

  /* Asal çarpanlar: {v: değer, m: maske (1 = değişken düşmüş)} */
  function primeImplicants(n, ones, dcs) {
    let current = [...new Set([...ones, ...dcs])].map(v => ({ v, m: 0 }));
    const primes = [];
    const key = t => t.v + ':' + t.m;
    while (current.length) {
      const used = new Set(), next = new Map();
      for (let i = 0; i < current.length; i++) {
        for (let j = i + 1; j < current.length; j++) {
          const a = current[i], b = current[j];
          if (a.m !== b.m) continue;
          const diff = a.v ^ b.v;
          if (popcount(diff) !== 1) continue;
          const t = { v: a.v & ~diff, m: a.m | diff };
          next.set(key(t), t);
          used.add(key(a)); used.add(key(b));
        }
      }
      current.forEach(t => { if (!used.has(key(t))) primes.push(t); });
      current = [...next.values()];
    }
    const seen = new Set();
    return primes.filter(p => { const k = key(p); if (seen.has(k)) return false; seen.add(k); return true; });
  }

  const covers = (t, x) => (x & ~t.m) === t.v;
  const literals = (t, n) => n - popcount(t.m);

  /* En iyi örtü: önce en az terim, sonra en az değişken */
  function minimize(n, ones, dcs = []) {
    ones = [...new Set(ones)].sort((a, b) => a - b);
    dcs = [...new Set(dcs)].filter(x => !ones.includes(x));
    const full = 1 << n;
    if (!ones.length) return { terms: [], constant: 0 };
    if (ones.length + dcs.length === full && ones.length) {
      // Hepsi 1 (ya da 1/X) ise sabit 1
      return { terms: [{ v: 0, m: full - 1 }], constant: 1 };
    }
    const primes = primeImplicants(n, ones, dcs).filter(p => ones.some(x => covers(p, x)));
    let best = null;
    const cost = sel => [sel.length, sel.reduce((s, t) => s + literals(t, n), 0)];
    const better = (a, b) => a[0] < b[0] || (a[0] === b[0] && a[1] < b[1]);
    function search(uncovered, chosen) {
      if (best && !better([chosen.length, 0], [best.cost[0] + 1, 0])) return; // budama
      if (!uncovered.length) {
        const c = cost(chosen);
        if (!best || better(c, best.cost)) best = { sel: chosen.slice(), cost: c };
        return;
      }
      // en az seçenekli 1'i seç
      let pick = null, opts = null;
      for (const x of uncovered) {
        const o = primes.filter(p => covers(p, x));
        if (!opts || o.length < opts.length) { pick = x; opts = o; }
      }
      opts.sort((a, b) => popcount(b.m) - popcount(a.m));
      for (const p of opts) {
        chosen.push(p);
        search(uncovered.filter(x => !covers(p, x)), chosen);
        chosen.pop();
      }
    }
    search(ones, []);
    const terms = best.sel.sort((a, b) => popcount(b.m) - popcount(a.m) || a.v - b.v);
    return { terms, constant: null, primes };
  }

  function termText(t, n) {
    if (t.m === (1 << n) - 1) return '1';
    let s = '';
    for (let i = 0; i < n; i++) {
      const bit = 1 << (n - 1 - i);
      if (t.m & bit) continue;
      s += VARS[i] + ((t.v & bit) ? '' : "'");
    }
    return s;
  }
  function sopText(res, n) {
    if (res.constant === 0) return '0';
    if (res.constant === 1) return '1';
    return res.terms.map(t => termText(t, n)).join(' + ');
  }

  /* 0'ların grubundan toplam terimi: sabit 0 → düz, sabit 1 → çizgili (maxterm kuralı) */
  function sumTermText(t, n) {
    const parts = [];
    for (let i = 0; i < n; i++) {
      const bit = 1 << (n - 1 - i);
      if (t.m & bit) continue;
      parts.push(VARS[i] + ((t.v & bit) ? "'" : ''));
    }
    return parts.length > 1 ? '(' + parts.join('+') + ')' : parts.join('');
  }
  /* res: 0'lar (ve X'ler) üzerinden minimize sonucu. F'nin POS hali. */
  function posText(res, n) {
    if (res.constant === 0) return '1';   // hiç 0 yok
    if (res.constant === 1) return '0';   // her yer 0
    return res.terms.map(t => sumTermText(t, n)).join('');
  }

  /* "A'C'D'" gibi bir terimi {v, m}'ye çevirir */
  function parseTerm(str, n) {
    let v = 0, m = (1 << n) - 1;
    const re = /([A-E])('?)/g; let x;
    while ((x = re.exec(str.replace(/\s+/g, '')))) {
      const i = VARS.indexOf(x[1]); if (i < 0 || i >= n) continue;
      const bit = 1 << (n - 1 - i);
      m &= ~bit; if (!x[2]) v |= bit;
    }
    return { v, m };
  }

  /* ---------- Harita düzeni ---------- */
  const GRAY = { 1: ['0', '1'], 2: ['00', '01', '11', '10'] };
  function layout(n) {
    // rowVars, colVars ve (5 değişkende) harita bölümü
    if (n === 2) return { rowBits: 1, colBits: 1, rowVars: 'A', colVars: 'B', maps: [''] };
    if (n === 3) return { rowBits: 1, colBits: 2, rowVars: 'A', colVars: 'BC', maps: [''] };
    if (n === 4) return { rowBits: 2, colBits: 2, rowVars: 'AB', colVars: 'CD', maps: [''] };
    return { rowBits: 2, colBits: 2, rowVars: 'BC', colVars: 'DE', maps: ['0', '1'] };
  }
  const cellIndex = (prefix, rb, cb) => parseInt(prefix + rb + cb, 2);

  const GROUP_COLORS = ['var(--g1)', 'var(--g2)', 'var(--g3)', 'var(--g4)', 'var(--g5)', 'var(--g6)'];

  /* Döngüsel bir indeks kümesini sürekli parçalara ayırır */
  function segments(set, L) {
    const s = [...set].sort((a, b) => a - b);
    if (s.length === L) return [[0, L - 1, false, false]];
    const runs = [];
    let start = s[0], prev = s[0];
    for (let i = 1; i < s.length; i++) {
      if (s[i] === prev + 1) { prev = s[i]; continue; }
      runs.push([start, prev]); start = prev = s[i];
    }
    runs.push([start, prev]);
    if (runs.length === 2 && runs[0][0] === 0 && runs[1][1] === L - 1) {
      // sarma: iki ucu açık parçalar
      return [[runs[1][0], runs[1][1], false, true], [runs[0][0], runs[0][1], true, false]];
    }
    return runs.map(r => [r[0], r[1], false, false]);
  }

  /* opts: {n, values: Map(minterm → 0|1|'X'), groups: [{t, color}], onCell(minterm), editable, showIndex} */
  function renderKMap(container, opts) {
    const { n } = opts;
    const L = layout(n);
    const rows = GRAY[L.rowBits], cols = GRAY[L.colBits];
    container.innerHTML = '';
    container.classList.add('kmap-wrap');
    L.maps.forEach(prefix => {
      const block = document.createElement('div');
      block.className = 'kmap-block';
      if (n === 5) {
        const cap = document.createElement('div');
        cap.className = 'kmap-cap'; cap.textContent = `A = ${prefix}`;
        block.appendChild(cap);
      }
      const grid = document.createElement('div');
      grid.className = 'kmap';
      grid.style.setProperty('--cols', cols.length);
      grid.style.setProperty('--rows', rows.length);
      // köşe etiketi
      const corner = document.createElement('div');
      corner.className = 'kmap-corner';
      corner.innerHTML = `<span class="cv">${opts.colLabel || L.colVars}</span><span class="rv">${opts.rowLabel || L.rowVars}</span>`;
      grid.appendChild(corner);
      cols.forEach(c => { const h = document.createElement('div'); h.className = 'kmap-h'; h.textContent = c; grid.appendChild(h); });
      const body = document.createElement('div');
      body.className = 'kmap-body';
      rows.forEach(r => {
        const h = document.createElement('div'); h.className = 'kmap-rh'; h.textContent = r; grid.appendChild(h);
      });
      rows.forEach((r, ri) => cols.forEach((c, ci) => {
        const idx = cellIndex(prefix, r, c);
        const val = opts.values.get(idx) ?? 0;
        const cell = document.createElement(opts.editable ? 'button' : 'div');
        if (opts.editable) { cell.type = 'button'; cell.setAttribute('aria-label', `m${idx}: ${val}. Değiştirmek için bas.`); }
        cell.className = 'kmap-cell' + (val === 1 ? ' one' : val === 'X' ? ' dc' : '');
        cell.style.gridRow = ri + 1; cell.style.gridColumn = ci + 1;
        cell.innerHTML = opts.cellLabel
          ? `<span class="kl">${opts.cellLabel(idx)}</span>`
          : `<span class="kv">${val}</span>${opts.showIndex !== false ? `<span class="ki">${idx}</span>` : ''}`;
        if (opts.editable) cell.addEventListener('click', () => opts.onCell(idx));
        body.appendChild(cell);
      }));
      // grupları çiz
      (opts.groups || []).forEach((g, gi) => {
        const rowSet = new Set(), colSet = new Set();
        rows.forEach((r, ri) => cols.forEach((c, ci) => {
          if (covers(g.t, cellIndex(prefix, r, c))) { rowSet.add(ri); colSet.add(ci); }
        }));
        if (!rowSet.size) return;
        const inset = 4 + (gi % 4) * 4;
        segments(rowSet, rows.length).forEach(([r0, r1, rOpenTop, rOpenBottom]) => {
          segments(colSet, cols.length).forEach(([c0, c1, cOpenLeft, cOpenRight]) => {
            const box = document.createElement('div');
            box.className = 'kmap-group';
            box.style.setProperty('--gc', g.color || GROUP_COLORS[gi % GROUP_COLORS.length]);
            box.style.left = `calc(${(c0 / cols.length) * 100}% + ${cOpenLeft ? -2 : inset}px)`;
            box.style.width = `calc(${((c1 - c0 + 1) / cols.length) * 100}% - ${(cOpenLeft ? -2 : inset) + (cOpenRight ? -2 : inset)}px)`;
            box.style.top = `calc(${(r0 / rows.length) * 100}% + ${rOpenTop ? -2 : inset}px)`;
            box.style.height = `calc(${((r1 - r0 + 1) / rows.length) * 100}% - ${(rOpenTop ? -2 : inset) + (rOpenBottom ? -2 : inset)}px)`;
            if (cOpenLeft) box.classList.add('open-l');
            if (cOpenRight) box.classList.add('open-r');
            if (rOpenTop) box.classList.add('open-t');
            if (rOpenBottom) box.classList.add('open-b');
            body.appendChild(box);
          });
        });
      });
      grid.appendChild(body);
      block.appendChild(grid);
      container.appendChild(block);
    });
  }

  /* "(A+C')" gibi bir toplam terimini 0-grubu {v, m}'ye çevirir */
  function parseSumTerm(str, n) {
    let v = 0, m = (1 << n) - 1;
    const re = /([A-E])('?)/g; let x;
    while ((x = re.exec(str.replace(/\s+/g, '')))) {
      const i = VARS.indexOf(x[1]); if (i < 0 || i >= n) continue;
      const bit = 1 << (n - 1 - i);
      m &= ~bit; if (x[2]) v |= bit;
    }
    return { v, m };
  }

  const api = { minimize, primeImplicants, termText, sopText, sumTermText, posText, parseSumTerm, parseTerm, renderKMap, layout, covers, literals, GROUP_COLORS, VARS };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.KMap = api;
})(typeof window !== 'undefined' ? window : globalThis);
