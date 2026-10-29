/* Ders 7: Encoder, decoder, karşılaştırıcı */
(function () {
  'use strict';
  const { $, esc, B, prettyExpr, onEnter, bindCircuit } = window.UI;
  const K = window.KMap;
  const COLORS = K.GROUP_COLORS;
  const popcount = x => { let c = 0; while (x) { c += x & 1; x >>= 1; } return c; };

  /* ================= SVG çizim yardımcısı ================= */
  function Sketch() {
    const parts = [], rails = [];
    const api = {
      rail(x, y0, y1, n) { rails.push({ x, y0, y1 }); parts.push(`<path class="w" ${n ? `data-n="${n}"` : ''} d="M${x} ${y0}V${y1}"/>`); },
      vline(x, y0, y1, n) { rails.push({ x, y0: Math.min(y0, y1), y1: Math.max(y0, y1) }); parts.push(`<path class="w" ${n ? `data-n="${n}"` : ''} d="M${x} ${y0}V${y1}"/>`); },
      // soldan sağa yatay kablo; yoluna çıkan dikey hatların üstünden köprüyle geçer
      hline(y, x0, x1, n, opts = {}) {
        const hops = rails.filter(r => r.x > x0 + 1 && r.x < x1 - 1 && y > r.y0 && y < r.y1 && !(opts.skip || []).includes(r.x)).map(r => r.x).sort((a, b) => a - b);
        let d = `M${x0} ${y}`;
        hops.forEach(x => { d += `H${x - 8}A8 8 0 0 1 ${x + 8} ${y}`; });
        d += `H${x1}`;
        parts.push(`<path class="w" ${n ? `data-n="${n}"` : ''} d="${d}"/>`);
      },
      path(d, n) { parts.push(`<path class="w" ${n ? `data-n="${n}"` : ''} d="${d}"/>`); },
      dot(x, y) { parts.push(`<circle class="dot" cx="${x}" cy="${y}" r="4"/>`); },
      and(x, cy, h = 36) { const r = h / 2; parts.push(`<path class="g" d="M${x} ${cy - r}H${x + 20}A${r} ${r} 0 0 1 ${x + 20} ${cy + r}H${x}Z"/>`); return x + 20 + r; },
      or(x, cy, h = 40, bubble = false) {
        const r = h / 2; parts.push(`<path class="g" d="M${x} ${cy - r}Q${x + 40} ${cy - r} ${x + 64} ${cy}Q${x + 40} ${cy + r} ${x} ${cy + r}Q${x + 14} ${cy} ${x} ${cy - r}Z"/>`);
        if (bubble) { parts.push(`<circle class="g" cx="${x + 69}" cy="${cy}" r="5"/>`); return x + 74; }
        return x + 64;
      },
      xnor(x, cy, h = 40) { const r = h / 2; parts.push(`<path class="g-line" d="M${x - 9} ${cy - r}Q${x + 5} ${cy} ${x - 9} ${cy + r}"/>`); return api.or(x, cy, h, true); },
      not(x, cy) { parts.push(`<path class="g" d="M${x} ${cy - 11}L${x + 26} ${cy}L${x} ${cy + 11}Z"/><circle class="g" cx="${x + 31}" cy="${cy}" r="5"/>`); return x + 36; },
      ground(x, y) { parts.push(`<path class="w" d="M${x} ${y}V${y + 10}M${x - 10} ${y + 10}H${x + 10}M${x - 6} ${y + 16}H${x + 6}M${x - 2} ${y + 22}H${x + 2}"/>`); },
      rect(x, y, w, h) { parts.push(`<rect class="g" x="${x}" y="${y}" width="${w}" height="${h}" rx="4"/>`); },
      text(x, y, t, cls = 'lbl', attrs = '') { parts.push(`<text class="${cls}" x="${x}" y="${y}" ${attrs}>${t}</text>`); },
      val(x, y, key) { parts.push(`<text class="val" x="${x}" y="${y}" data-v="${key}"></text>`); },
      html() { return parts.join(''); }
    };
    return api;
  }
  const SUBS = '₀₁₂₃₄₅₆₇';

  function drawPE(svg) {
    const s = Sketch();
    s.rail(60, 24, 100, 'I1'); s.rail(90, 24, 175, 'I2'); s.rail(120, 24, 195, 'I3');
    s.path('M30 24V44'); s.ground(30, 44);
    s.hline(60, 90, 150, 'I2'); s.dot(90, 60);
    const nOut = s.not(150, 60);
    s.path(`M${nOut} 60H200`, 'nI2'); s.vline(200, 60, 120, 'nI2'); s.path('M200 120H230', 'nI2');
    s.hline(100, 60, 230, 'I1'); s.dot(60, 100);
    const a1 = s.and(230, 110);
    s.path(`M${a1} 110H304`, 'and1');
    s.hline(135, 120, 304, 'I3'); s.dot(120, 135);
    const oB = s.or(300, 122);
    s.path(`M${oB} 122H410`, 'B');
    s.hline(175, 90, 304, 'I2'); s.dot(90, 175);
    s.path('M120 195H304', 'I3');
    const oA = s.or(300, 185);
    s.path(`M${oA} 185H410`, 'A');
    s.text(22, 18, 'I₀'); s.text(52, 18, 'I₁'); s.text(82, 18, 'I₂'); s.text(112, 18, 'I₃');
    s.text(414, 128, 'B'); s.text(414, 191, 'A');
    s.val(384, 113, 'B'); s.val(384, 176, 'A');
    s.text(236, 86, 'I₁<tspan style="text-decoration:overline">I₂</tspan>', 'tag');
    svg.setAttribute('viewBox', '0 0 440 215'); svg.innerHTML = s.html();
  }

  function drawDec(svg) {
    // Hocanın sırası: I₀ önce, I₁ sonra. NOT kapıları doğrudan ilgili AND'in girişinde.
    const s = Sketch();
    s.rail(50, 24, 235, 'I0'); s.rail(80, 24, 255, 'I1');
    // F0 = NOR(I0, I1)
    s.hline(40, 50, 304, 'I0'); s.dot(50, 40);
    s.path('M80 60H304', 'I1'); s.dot(80, 60);
    const f0 = s.or(300, 50, 40, true); s.path(`M${f0} 50H420`, 'F0');
    // F1 = Ī1 · I0
    s.hline(105, 50, 300, 'I0'); s.dot(50, 105);
    s.path('M80 125H170', 'I1'); s.dot(80, 125);
    let o = s.not(170, 125); s.path(`M${o} 125H300`, 'nI1');
    const f1 = s.and(300, 115); s.path(`M${f1} 115H420`, 'F1');
    // F2 = I1 · Ī0
    s.hline(170, 50, 170, 'I0'); s.dot(50, 170);
    o = s.not(170, 170); s.path(`M${o} 170H300`, 'nI0');
    s.path('M80 190H300', 'I1'); s.dot(80, 190);
    const f2 = s.and(300, 180); s.path(`M${f2} 180H420`, 'F2');
    // F3 = I1 · I0
    s.hline(235, 50, 300, 'I0');
    s.path('M80 255H300', 'I1');
    const f3 = s.and(300, 245); s.path(`M${f3} 245H420`, 'F3');
    s.text(42, 18, 'I₀'); s.text(72, 18, 'I₁');
    s.text(218, 120, '<tspan style="text-decoration:overline">I₁</tspan>', 'tag'); s.text(218, 165, '<tspan style="text-decoration:overline">I₀</tspan>', 'tag');
    s.text(316, 22, 'NOR', 'tag');
    [50, 115, 180, 245].forEach((y, i) => { s.text(426, y + 6, 'F' + SUBS[i]); s.val(396, y - 8, 'F' + i); });
    svg.setAttribute('viewBox', '0 0 460 270'); svg.innerHTML = s.html();
  }

  function drawFADec(svg) {
    const s = Sketch();
    const ys = k => 40 + 26 * k;                 // decoder çıkışlarının yüksekliği
    s.rect(90, 22, 110, 218);
    // hocanın çizimi gibi: I₀ üstte. I₀ = Cin (en düşük bit), I₁ = B, I₂ = A (en yüksek bit)
    [['Cin', 75, 'I₀'], ['B', 131, 'I₁'], ['A', 187, 'I₂']].forEach(([n, y, lab]) => { s.path(`M30 ${y}H90`, n); s.text(95, y + 4, lab, 'tag'); });
    s.text(2, 81, 'C<tspan font-size="10" dy="3">in</tspan>'); s.text(8, 137, 'B'); s.text(8, 193, 'A');
    s.text(142, 102, '3×8', 'lbl', 'text-anchor="middle"'); s.text(142, 120, 'Decoder', 'tag', 'text-anchor="middle"');
    for (let k = 0; k < 8; k++) s.text(190, ys(k) + 4, String(k), 'tag', 'text-anchor="end"');
    s.path(`M200 ${ys(0)}H226`, 'o0'); s.ground(226, ys(0));
    // OR girişleri: arka eğrinin üstünde bitsin
    const OX = 370, H = 96;
    const inX = (cy, y) => { const t = (y - (cy - H / 2)) / H; return OX + 28 * t * (1 - t); };
    const R_CY = 89, C_CY = 199;
    // çıkış → (dikey x) → OR girişi
    const plan = [[1, 316, R_CY, 50], [2, 316, R_CY, 76], [4, 316, R_CY, 102], [3, 292, C_CY, 160], [5, 268, C_CY, 186], [6, 244, C_CY, 212]];
    plan.forEach(([k, x, , ty]) => s.vline(x, ys(k), ty, 'o' + k));
    s.vline(342, 128, 238, 'o7');
    plan.forEach(([k, x, cy, ty]) => { s.hline(ys(k), 200, x, 'o' + k); s.hline(ty, x, inX(cy, ty), 'o' + k); });
    s.hline(ys(7), 200, 342, 'o7'); s.dot(342, ys(7));
    s.hline(128, 342, inX(R_CY, 128), 'o7'); s.hline(238, 342, inX(C_CY, 238), 'o7');
    const oR = s.or(OX, R_CY, H); s.path(`M${oR} ${R_CY}H510`, 'R');
    const oC = s.or(OX, C_CY, H); s.path(`M${oC} ${C_CY}H510`, 'Cout');
    s.text(516, R_CY + 6, 'R'); s.text(516, C_CY + 6, 'C<tspan font-size="10" dy="3">out</tspan>');
    s.val(482, R_CY - 8, 'R'); s.val(482, C_CY - 8, 'Cout');
    s.text(440, R_CY + 22, 'Σ(1, 2, 4, 7)', 'tag'); s.text(440, C_CY + 22, 'Σ(3, 5, 6, 7)', 'tag');
    svg.setAttribute('viewBox', '0 0 560 256'); svg.innerHTML = s.html();
  }

  function drawComp1(svg) {
    const s = Sketch();
    s.rail(50, 24, 190, 'A'); s.rail(80, 24, 160, 'B');
    s.hline(40, 50, 296, 'A'); s.dot(50, 40);
    s.hline(60, 80, 296, 'B'); s.dot(80, 60);
    const eq = s.xnor(300, 50); s.path(`M${eq} 50H400`, 'eq');
    s.hline(100, 50, 150, 'A'); s.dot(50, 100);
    let o = s.not(150, 100); s.path(`M${o} 100H300`, 'nA');
    s.hline(125, 80, 300, 'B'); s.dot(80, 125);
    const lt = s.and(300, 112); s.path(`M${lt} 112H400`, 'lt');
    s.hline(160, 80, 150, 'B'); s.dot(80, 160);
    o = s.not(150, 160); s.path(`M${o} 160H300`, 'nB');
    s.hline(190, 50, 300, 'A'); s.dot(50, 190);
    const gt = s.and(300, 175); s.path(`M${gt} 175H400`, 'gt');
    s.text(42, 18, 'A'); s.text(72, 18, 'B');
    const F = sub => `F<tspan font-size="11" dy="4">${sub}</tspan>`;
    s.text(406, 55, F('A=B')); s.text(406, 117, F('B&gt;A')); s.text(406, 180, F('A&gt;B'));
    s.val(384, 42, 'eq'); s.val(384, 104, 'lt'); s.val(384, 167, 'gt');
    svg.setAttribute('viewBox', '0 0 470 205'); svg.innerHTML = s.html();
  }

  /* ================= Tuş takımı ================= */
  const KEYS = [['!', '0', 'A', 'B', 'F'], ['1', '2', '3', 'C', '.'], ['4', '5', '6', 'D', ':'], ['7', '8', '9', 'E', ';']];
  const keyCode = k => /\d/.test(k) ? +k : /[A-F]/.test(k) ? 10 + 'ABCDEF'.indexOf(k) : 16 + '!.:;'.indexOf(k);
  function initKeypad() {
    const pad = $('keypad');
    pad.innerHTML = KEYS.flat().map(k => `<button type="button" data-k="${esc(k)}" aria-pressed="false">${esc(k)}</button>`).join('');
    const show = k => {
      pad.querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed', b.dataset.k === k ? 'true' : 'false'));
      const v = keyCode(k);
      $('keypad-out').innerHTML = `<p class="result">"${esc(k)}" tuşu → ${v} → ${B(v.toString(2).padStart(5, '0'))} (5 bit)</p><p>Hafızaya 8 bit olarak: ${B(v.toString(2).padStart(8, '0'))}</p>`;
    };
    pad.querySelectorAll('button').forEach(b => b.addEventListener('click', () => show(b.dataset.k)));
    show('3');
  }

  /* ================= Öncelikli encoder ================= */
  const peOut = m => { for (let i = 3; i >= 0; i--) if ((m >> i) & 1) return i; return -1; };
  function fillPE() {
    const tb = $('pe-table').querySelector('tbody'); let h = '';
    for (let m = 0; m < 16; m++) {
      const w = peOut(m), v = Math.max(w, 0);
      const bits = [3, 2, 1, 0].map(i => (m >> i) & 1);
      h += `<tr>${bits.map(b => `<td>${b}</td>`).join('')}<td class="out ${v >> 1 ? 'one' : ''}">${v >> 1}</td><td class="${v & 1 ? 'one' : ''}">${v & 1}</td><td class="help">${w < 0 ? 'hiçbiri' : 'I' + SUBS[w]}</td></tr>`;
    }
    tb.innerHTML = h;
  }
  function renderMaps() {
    const NAMES = { A: 'I₃', B: 'I₂', C: 'I₁', D: 'I₀' };
    document.querySelectorAll('.kmap7').forEach(el => {
      const ones = el.dataset.ones.split(',').map(Number);
      const groups = el.dataset.groups.split('|').map((s, i) => ({ t: K.parseTerm(s, 4), color: COLORS[i], s }));
      const cap = document.createElement('div'); cap.className = 'kmap-cap'; cap.textContent = el.dataset.title; el.appendChild(cap);
      const holder = document.createElement('div'); el.appendChild(holder);
      K.renderKMap(holder, { n: 4, values: new Map(ones.map(x => [x, 1])), groups, rowLabel: 'I₃I₂', colLabel: 'I₁I₀', showIndex: false });
      const ul = document.createElement('div');
      ul.innerHTML = '<ul class="group-list">' + groups.map(g => `<li style="--gc:${g.color}"><span class="m">${prettyExpr(g.s).replace(/[ABCD]/g, c => NAMES[c])}</span> <span class="why">${1 << popcount(g.t.m)} hücre</span></li>`).join('') + '</ul>';
      el.appendChild(ul);
    });
  }

  /* ================= Devreler ================= */
  function initCircuits() {
    document.querySelectorAll('svg[data-gen]').forEach(svg => ({ pe: drawPE, dec: drawDec, fadec: drawFADec, comp1: drawComp1 })[svg.dataset.gen](svg));
    bindCircuit($('c-pe'), ['I0', 'I1', 'I2', 'I3'], env => {
      const nI2 = env.I2 ^ 1, and1 = env.I1 & nI2, B_ = and1 | env.I3, A = env.I2 | env.I3;
      const m = env.I3 * 8 + env.I2 * 4 + env.I1 * 2 + env.I0, w = peOut(m);
      return { nI2, and1, B: B_, A, note: w < 0 ? 'Hiçbir giriş aktif değil → AB = 00' : `Aktif girişlerin en büyüğü I${SUBS[w]} → ${w} → AB = ${A}${B_}` };
    });
    bindCircuit($('c-dec'), ['I0', 'I1'], env => {
      const nI0 = env.I0 ^ 1, nI1 = env.I1 ^ 1;
      const F = [+!(env.I0 | env.I1), nI1 & env.I0, env.I1 & nI0, env.I1 & env.I0];
      const k = env.I1 * 2 + env.I0;
      return { nI0, nI1, F0: F[0], F1: F[1], F2: F[2], F3: F[3], note: `I₁I₀ = ${env.I1}${env.I0} = ${k} → sadece F${SUBS[k]} = 1` };
    });
    bindCircuit($('c-fadec'), ['A', 'B', 'Cin'], env => {
      const k = env.A * 4 + env.B * 2 + env.Cin, out = {};
      for (let i = 0; i < 8; i++) out['o' + i] = i === k ? 1 : 0;
      out.R = [1, 2, 4, 7].includes(k) ? 1 : 0; out.Cout = [3, 5, 6, 7].includes(k) ? 1 : 0;
      out.note = `ABCᵢₙ = ${env.A}${env.B}${env.Cin} = ${k} → decoder'ın ${k} numaralı çıkışı 1. Toplam ${env.A + env.B + env.Cin} = ${out.Cout}${out.R}₂ → R = ${out.R}, Cₒᵤₜ = ${out.Cout}`;
      return out;
    });
    bindCircuit($('c-comp1'), ['A', 'B'], env => {
      const nA = env.A ^ 1, nB = env.B ^ 1;
      return { nA, nB, eq: env.A === env.B ? 1 : 0, lt: nA & env.B, gt: env.A & nB };
    });
  }

  /* ================= 4 bitlik karşılaştırıcı ================= */
  const c4 = { A: [1, 0, 1, 0], B: [1, 0, 0, 1] }; // A3..A0
  function compare4(a, b) {
    const x = [0, 1, 2, 3].map(i => (a[i] === b[i] ? 1 : 0));
    let decided = -1;
    for (let i = 0; i < 4; i++) if (!x[i]) { decided = i; break; }
    const eq = x.every(Boolean) ? 1 : 0;
    const gt = decided >= 0 && a[decided] === 1 && b[decided] === 0 ? 1 : 0;
    const lt = decided >= 0 && a[decided] === 0 && b[decided] === 1 ? 1 : 0;
    return { x, decided, eq, gt, lt };
  }
  function renderComp4() {
    ['A', 'B'].forEach(k => {
      const box = $('c4-' + k.toLowerCase());
      box.innerHTML = c4[k].map((v, i) => `<button type="button" aria-pressed="${v ? 'true' : 'false'}" aria-label="${k}${3 - i}: ${v}" data-i="${i}">${v}</button>`).join('');
      box.querySelectorAll('button').forEach(b => b.addEventListener('click', () => { c4[k][+b.dataset.i] ^= 1; renderComp4(); }));
    });
    const r = compare4(c4.A, c4.B);
    const av = parseInt(c4.A.join(''), 2), bv = parseInt(c4.B.join(''), 2);
    let h = '<div class="table-wrap"><table class="tt"><thead><tr><th>Bit</th><th>A<sub>i</sub></th><th>B<sub>i</sub></th><th>x<sub>i</sub> (eşit mi)</th><th>Durum</th></tr></thead><tbody>';
    for (let i = 0; i < 4; i++) {
      const st = r.decided < 0 && i === 3 ? 'eşit, bütün bitler eşit → A = B' : i < r.decided || r.decided < 0 ? 'eşit, sonraki bite geç' : i === r.decided ? (c4.A[i] ? 'A₍ᵢ₎ = 1, B₍ᵢ₎ = 0 → A > B' : 'A₍ᵢ₎ = 0, B₍ᵢ₎ = 1 → A < B').replace(/₍ᵢ₎/g, SUBS[3 - i]) : 'bakmaya gerek yok';
      h += `<tr class="${i === r.decided ? 'hit' : ''}" ${i > r.decided && r.decided >= 0 ? 'style="opacity:.5"' : ''}><td>${3 - i}</td><td>${c4.A[i]}</td><td>${c4.B[i]}</td><td class="${r.x[i] ? 'one' : ''}">${r.x[i]}</td><td style="font-family:var(--font)">${st}</td></tr>`;
    }
    h += '</tbody></table></div>';
    h += `<p class="result">F<sub>A&gt;B</sub> = ${r.gt}, F<sub>A&lt;B</sub> = ${r.lt}, F<sub>A=B</sub> = ${r.eq}</p><p>A = ${c4.A.join('')} = ${av}, B = ${c4.B.join('')} = ${bv} → ${av > bv ? 'A > B' : av < bv ? 'A < B' : 'A = B'}</p>`;
    $('c4-out').innerHTML = h;
  }

  /* ================= Test ================= */
  const rnd = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
  const pick = arr => arr[rnd(0, arr.length - 1)];
  const GEN = {
    pe() {
      const m = rnd(1, 15), w = peOut(m);
      const bits = m.toString(2).padStart(4, '0'); const ans = w.toString(2).padStart(2, '0');
      return { q: `4×2 öncelikli encoder'da I₃I₂I₁I₀ = ${B(bits)}. Çıkış AB nedir?`, type: 'text',
        check: a => ({ ok: a.replace(/\s+/g, '') === ans }), ans, why: `Aktif girişlerin en büyüğü I${SUBS[w]} → ${w} → ${ans}.` };
    },
    dec() {
      const n = pick([2, 3]); const k = rnd(0, (1 << n) - 1); const bits = k.toString(2).padStart(n, '0');
      return { q: `${n}×${1 << n} decoder'a ${B(bits)} geliyor. Hangi numaralı çıkış 1 olur?`, type: 'text',
        check: a => ({ ok: a.trim().replace(/^F/i, '') === String(k) }), ans: String(k), why: `${bits} = ${k}. Sadece ${k} numaralı çıkış 1, diğerleri 0.` };
    },
    comp() {
      const a = rnd(0, 15), b = Math.random() < 0.2 ? a : rnd(0, 15);
      const A = a.toString(2).padStart(4, '0'), Bb = b.toString(2).padStart(4, '0');
      const ans = a > b ? 'A > B' : a < b ? 'A < B' : 'A = B';
      return { q: `4 bitlik karşılaştırıcıda A = ${B(A)}, B = ${B(Bb)}. Hangi çıkış 1 olur?`, type: 'choice', options: ['A > B', 'A < B', 'A = B'],
        check: x => ({ ok: x === ans }), ans, why: `En yüksek bitten başla, ilk farklı bit karar verir. A = ${a}, B = ${b}.` };
    },
    bits() {
      if (Math.random() < 0.5) {
        const M = rnd(3, 100); const n = Math.ceil(Math.log2(M));
        return { q: `${M} girişli (ör. ${M} tuşlu) bir encoder'ın en az kaç çıkışı olmalı?`, type: 'text', check: a => ({ ok: a.trim() === String(n) }), ans: String(n), why: `2^${n - 1} = ${1 << (n - 1)} < ${M} ≤ ${1 << n} = 2^${n}.` };
      }
      const n = rnd(2, 6);
      return { q: `${n} girişli bir decoder'ın kaç çıkışı vardır?`, type: 'text', check: a => ({ ok: a.trim() === String(1 << n) }), ans: String(1 << n), why: `N giriş → 2ᴺ çıkış: 2^${n} = ${1 << n}.` };
    }
  };
  let current = null, score = 0, total = 0, answered = false;
  function newQuestion() {
    const topic = $('quiz-topic').value;
    const k = topic === 'all' ? pick(Object.keys(GEN)) : topic;
    current = GEN[k](); answered = false;
    $('quiz-q').innerHTML = current.q; $('quiz-fb').innerHTML = '';
    if (current.type === 'text') {
      $('quiz-input').innerHTML = `<div class="controls"><div class="field"><label for="quiz-ans">Cevabın</label><input id="quiz-ans" type="text" class="wide" autocomplete="off" spellcheck="false"></div><button class="btn" type="button" id="quiz-check">Kontrol et</button></div>`;
      $('quiz-check').addEventListener('click', () => grade($('quiz-ans').value));
      onEnter(['quiz-ans'], () => grade($('quiz-ans').value));
    } else {
      $('quiz-input').innerHTML = `<div class="mcq">${current.options.map(o => `<button type="button" data-o="${esc(o)}">${esc(o)}</button>`).join('')}</div>`;
      $('quiz-input').querySelectorAll('button').forEach(b => b.addEventListener('click', () => grade(b.dataset.o, b)));
    }
  }
  function grade(a, btn) {
    if (!current) return;
    if (!String(a).trim()) { $('quiz-fb').innerHTML = `<div class="feedback no">Önce bir cevap yaz.</div>`; return; }
    const r = current.check(String(a).trim());
    if (!answered) { total++; if (r.ok) score++; answered = true; }
    $('quiz-score').textContent = `${score} / ${total} doğru`;
    if (btn) $('quiz-input').querySelectorAll('button').forEach(b => {
      b.classList.toggle('right', b.dataset.o === current.ans);
      b.classList.toggle('picked-wrong', b === btn && !r.ok);
    });
    $('quiz-fb').innerHTML = r.ok
      ? `<div class="feedback ok"><b>Doğru!</b> Cevap: ${B(current.ans)}</div>`
      : `<div class="feedback no"><b>Olmadı.</b> Doğru cevap: ${B(current.ans)}<div class="why">${esc(current.why)}</div></div>`;
  }

  document.addEventListener('DOMContentLoaded', () => {
    initKeypad();
    fillPE();
    renderMaps();
    initCircuits();
    renderComp4();
    $('quiz-new').addEventListener('click', newQuestion);
    $('quiz-topic').addEventListener('change', newQuestion);
    newQuestion();
  });
})();
