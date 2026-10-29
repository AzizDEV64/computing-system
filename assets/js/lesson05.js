/* Ders 5: Don't care, POS, 7 segment */
(function () {
  'use strict';
  const { $, esc, B, err, prettyExpr, seg, onEnter, bindCircuit } = window.UI;
  const L = window.Logic, K = window.KMap;
  const COLORS = K.GROUP_COLORS;
  const popcount = x => { let c = 0; while (x) { c += x & 1; x >>= 1; } return c; };
  const D_NAMES = { A: 'D₃', B: 'D₂', C: 'D₁', D: 'D₀' };
  const toD = html => html.replace(/[ABCD]/g, ch => D_NAMES[ch]);
  const A_NAMES = { A: 'A₁', B: 'A₀' };
  const M = (e, dn) => `<span class="m">${dn === 'A' ? prettyExpr(e).replace(/[AB]/g, ch => A_NAMES[ch]) : dn ? toD(prettyExpr(e)) : prettyExpr(e)}</span>`;
  const list = s => (s || '').split(',').filter(Boolean).map(Number);
  const valuesFrom = (ones, dcs = []) => { const m = new Map(); ones.forEach(x => m.set(x, 1)); dcs.forEach(x => m.set(x, 'X')); return m; };
  const chips = (items) => '<ul class="group-list">' + items.map(it => `<li style="--gc:${it.color}">${it.html} <span class="why">${it.size} hücre</span></li>`).join('') + '</ul>';

  /* ================= Sabit haritalar ================= */
  function renderStaticMap(el, cfg) {
    const { n, ones, dcs, sop, pos, dn } = cfg;
    const groups = [];
    (sop || []).forEach((s, i) => groups.push({ t: K.parseTerm(s, n), color: COLORS[i % COLORS.length], html: M(s, dn) }));
    (pos || []).forEach((s, i) => groups.push({ t: K.parseSumTerm(s, n), color: COLORS[i % COLORS.length], html: M(s, dn) }));
    const holder = document.createElement('div');
    el.innerHTML = ''; el.appendChild(holder);
    const zeros = [];
    for (let x = 0; x < (1 << n); x++) if (!ones.includes(x) && !dcs.includes(x)) zeros.push(x);
    K.renderKMap(holder, {
      n, values: valuesFrom(ones, dcs), groups, showIndex: false,
      pos: !!(pos && pos.length) && !(sop && sop.length),
      rowLabel: dn === 'A' ? 'A₁' : dn ? 'D₃D₂' : undefined, colLabel: dn === 'A' ? 'A₀' : dn ? 'D₁D₀' : undefined
    });
    if (groups.length) {
      const g = document.createElement('div');
      g.innerHTML = chips(groups.map(x => ({ color: x.color, html: x.html, size: 1 << popcount(x.t.m) })));
      el.appendChild(g);
    }
  }
  function renderStatics() {
    document.querySelectorAll('.kmap5').forEach(el => {
      renderStaticMap(el, {
        n: +el.dataset.n, ones: list(el.dataset.ones), dcs: list(el.dataset.dcs),
        sop: el.dataset.groups ? el.dataset.groups.split('|') : null,
        pos: el.dataset.posGroups ? el.dataset.posGroups.split('|') : null,
        dn: el.dataset.vars === 'A' ? 'A' : el.dataset.vars === 'D'
      });
    });
  }

  /* ================= 7 segment ================= */
  const POS = {
    top: 'M22 14L28 8H92L98 14L92 20H28Z',
    mid: 'M22 100L28 94H92L98 100L92 106H28Z',
    bot: 'M22 186L28 180H92L98 186L92 192H28Z',
    ul: 'M16 18L22 24V90L16 96L10 90V24Z',
    ur: 'M104 18L110 24V90L104 96L98 90V24Z',
    ll: 'M16 104L22 110V176L16 182L10 176V110Z',
    lr: 'M104 104L110 110V176L104 182L98 176V110Z'
  };
  const LABEL_XY = { top: [60, 36], mid: [60, 122], bot: [60, 172], ul: [32, 62], ur: [88, 62], ll: [32, 148], lr: [88, 148] };
  const HOCA = { a: 'top', b: 'ul', f: 'ur', g: 'mid', c: 'll', e: 'lr', d: 'bot' };
  const STD = { a: 'top', b: 'ur', c: 'lr', d: 'bot', e: 'll', f: 'ul', g: 'mid' };
  const TABLE = { 0: '1111110', 1: '0000110', 2: '1011011', 3: '1001111', 4: '0100111', 5: '1101101', 6: '1111101', 7: '1000110', 8: '1111111', 9: '1101111' };
  const SEGS = 'abcdefg'.split('');

  function seg7SVG({ on = '', scheme = HOCA, labels = false, live = false, title = '' }) {
    const paths = SEGS.map(s => {
      const p = scheme[s];
      const cls = 'seg' + (!live && on.includes(s) ? ' hi' : '');
      return `<path class="${cls}" ${live ? `data-n="${s}"` : ''} d="${POS[p]}"/>`;
    }).join('');
    const lbl = labels ? SEGS.map(s => { const [x, y] = LABEL_XY[scheme[s]]; return `<text x="${x}" y="${y}" text-anchor="middle">${s}</text>`; }).join('') : '';
    return `<figure style="margin:0;text-align:center"><svg viewBox="0 0 120 200" role="img" aria-label="${esc(title || '7 segment')}">${paths}${lbl}</svg>${title ? `<figcaption style="font-size:.9rem;color:var(--muted)">${title}</figcaption>` : ''}</figure>`;
  }
  const segsOn = d => SEGS.filter((s, i) => TABLE[d][i] === '1').join('');

  // En sade segment formülleri (A=D3, B=D2, C=D1, D=D0), 10–15 X kabul edilerek bulundu
  const SEG_EQ = {};
  function computeSegEquations() {
    const dcs = [10, 11, 12, 13, 14, 15];
    SEGS.forEach((s, i) => {
      const ones = [...Array(10).keys()].filter(d => TABLE[d][i] === '1');
      const res = K.minimize(4, ones, dcs);
      SEG_EQ[s] = { ones, res, text: K.sopText(res, 4).replace(/ /g, '') };
    });
  }

  // Hocanın a segmentinde yaptığı gibi tümleyen çiftleri XNOR/XOR'a topla (0–9'da doğrulandı)
  const SEG_SHORT = { f: "B'+C⊙D", g: "A+B^C+CD'" };
  const SEG_NOTE = {
    f: 'Hocanın a segmentinde yaptığı gibi: <span class="m"><span class="ov">D₁</span><span class="ov">D₀</span> + D₁D₀ = D₁ ⊙ D₀</span>.',
    g: 'Hocanın a segmentinde yaptığı gibi: <span class="m"><span class="ov">D₂</span>D₁ + D₂<span class="ov">D₁</span> = D₂ ⊕ D₁</span>.'
  };
  function renderSegments() {
    $('seg-demo').innerHTML = seg7SVG({ on: 'abcdefg', title: '8: hepsi yanık' }) + seg7SVG({ on: segsOn(7), title: '7' }) +
      seg7SVG({ on: segsOn(3), title: '3' }) + seg7SVG({ on: segsOn(1), title: '1' });
    $('seg-names').innerHTML = seg7SVG({ on: '', labels: true, title: 'Hocanın adları' }) + seg7SVG({ on: '', scheme: STD, labels: true, title: 'Standart adlar' });
    $('seg-live').innerHTML = seg7SVG({ live: true, title: '' });
    // tablo
    const tb = $('seg-table').querySelector('tbody');
    let h = '';
    for (let x = 0; x < 16; x++) {
      const bits = x.toString(2).padStart(4, '0').split('');
      const out = x < 10 ? TABLE[x].split('') : Array(7).fill('X');
      h += `<tr${x >= 10 ? ' style="color:var(--muted)"' : ''}>${bits.map(b => `<td>${b}</td>`).join('')}${out.map((v, i) => `<td class="${i === 0 ? 'out ' : ''}${v === '1' ? 'one' : ''}">${v}</td>`).join('')}<td class="help">${x < 10 ? x : '—'}</td></tr>`;
    }
    tb.innerHTML = h;
    // kalan segmentler
    const rest = $('seg-rest');
    ['c', 'd', 'e', 'f', 'g'].forEach(s => {
      const eq = SEG_EQ[s];
      const box = document.createElement('div');
      box.className = 'example';
      const where = { c: 'sol alt', d: 'alt', e: 'sağ alt', f: 'sağ üst', g: 'orta' }[s];
      box.innerHTML = `<div class="example-head"><h4>${s} segmenti (${where})</h4><span class="src">Ek çözüm</span></div><div class="example-body"><p>${s} = 1 olan rakamlar: ${eq.ones.join(', ')}.</p><div class="kmap-figure"><div class="m-holder"></div></div><p class="answer">${s} = ${M(eq.text.split('+').join(' + '), true)}${SEG_SHORT[s] ? ` = ${M(SEG_SHORT[s], true)}` : ''}</p>${SEG_SHORT[s] ? `<p>${SEG_NOTE[s]}</p>` : ''}</div>`;
      rest.appendChild(box);
      renderStaticMap(box.querySelector('.m-holder'), { n: 4, ones: eq.ones, dcs: [10, 11, 12, 13, 14, 15], sop: eq.res.terms.map(t => K.termText(t, 4)), dn: true });
    });
    // canlı dönüştürücü
    const trees = {}; SEGS.forEach(s => { trees[s] = L.parse(SEG_EQ[s].text); });
    bindCircuit($('c-seg'), ['D3', 'D2', 'D1', 'D0'], env => {
      const x = env.D3 * 8 + env.D2 * 4 + env.D1 * 2 + env.D0;
      const vals = { dec: x };
      const e = { A: !!env.D3, B: !!env.D2, C: !!env.D1, D: !!env.D0 };
      SEGS.forEach(s => { vals[s] = x < 10 ? (L.evaluate(trees[s], e) ? 1 : 0) : 'X'; });
      vals.note = x < 10 ? '' : '(BCD dışı: don\'t care, gösterge kapalı)';
      if (x >= 10) SEGS.forEach(s => { vals[s + '_'] = 0; });
      return vals;
    });
  }

  /* ================= Kare devresi ================= */
  function initSquare() {
    bindCircuit($('c-square'), ['A1', 'A0'], env => {
      const F3 = env.A1 & env.A0, nA0 = env.A0 ^ 1, F2 = env.A1 & nA0, F0 = env.A0;
      const x = env.A1 * 2 + env.A0;
      return { nA0, F3, F2, F0, inDec: `${env.A1}${env.A0} = ${x}`, outBin: `${F3}${F2}0${F0}`, outDec: x * x };
    });
  }

  /* ================= Çözücü ================= */
  let svN = 4, svForm = 'sop', svVals = valuesFrom([0, 2, 3, 4, 9, 12], [5, 6, 7, 8, 13]);
  seg('sv-n', v => { svN = +v; svVals = new Map(); renderSolver(); });
  seg('sv-form', v => { svForm = v; renderSolver(); });
  function renderSolver() {
    const full = 1 << svN;
    const ones = [], dcs = [], zeros = [];
    for (let x = 0; x < full; x++) { const v = svVals.get(x); if (v === 1) ones.push(x); else if (v === 'X') dcs.push(x); else zeros.push(x); }
    const res = svForm === 'sop' ? K.minimize(svN, ones, dcs) : K.minimize(svN, zeros, dcs);
    const groups = res.constant === null ? res.terms.map((t, i) => ({ t, color: COLORS[i % COLORS.length] })) : [];
    K.renderKMap($('sv-map'), {
      n: svN, values: svVals, groups, editable: true, pos: svForm === 'pos',
      onCell: idx => { const v = svVals.get(idx); svVals.set(idx, v === 1 ? 'X' : v === 'X' ? 0 : 1); renderSolver(); }
    });
    const text = svForm === 'sop' ? K.sopText(res, svN) : K.posText(res, svN);
    let h = `<p class="result">F = ${M(text)}</p><p>Σm(${ones.join(', ') || '—'})${dcs.length ? ` + d(${dcs.join(', ')})` : ''}</p>`;
    if (res.constant === null) {
      h += chips(res.terms.map((t, i) => ({ color: COLORS[i % COLORS.length], html: M(svForm === 'sop' ? K.termText(t, svN) : K.sumTermText(t, svN)), size: 1 << popcount(t.m) })));
      const usedX = dcs.filter(x => res.terms.some(t => K.covers(t, x)));
      if (dcs.length) h += `<p class="hint">Gruplara katılan X'ler: ${usedX.length ? usedX.join(', ') : 'yok'} (bunlar ${svForm === 'sop' ? '1' : '0'} kabul edildi). Diğer X'ler dışarıda kaldı.</p>`;
    }
    $('sv-out').innerHTML = h;
  }
  function fillSolver() {
    const max = (1 << svN) - 1;
    const parse = s => s.split(/[\s,;]+/).filter(Boolean);
    const a = parse($('sv-sigma').value), d = parse($('sv-d').value);
    if (![...a, ...d].every(p => /^\d+$/.test(p) && +p <= max)) { $('sv-out').innerHTML = err(`0 ile ${max} arasında, virgülle ayrılmış numaralar yaz.`); return; }
    svVals = valuesFrom(a.map(Number), d.map(Number)); renderSolver();
  }

  /* ================= Test ================= */
  const rnd = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
  const pick = arr => arr[rnd(0, arr.length - 1)];
  const lits = e => (e.match(/[A-Za-z]/g) || []).length;
  function randomWithDC(n, pOne, pX) {
    let ones, dcs;
    do {
      ones = []; dcs = [];
      for (let x = 0; x < (1 << n); x++) { const r = Math.random(); if (r < pOne) ones.push(x); else if (r < pOne + pX) dcs.push(x); }
    } while (ones.length < 2 || ones.length + dcs.length > (1 << n) - 2);
    return { ones, dcs };
  }
  // X dışındaki satırlarda aynı mı?
  function matchesCare(expr, n, ones, dcs) {
    const t = L.truthTable(expr, K.VARS.slice(0, n));
    return t.rows.every(r => dcs.includes(r.m) || r.f === (ones.includes(r.m) ? 1 : 0));
  }
  const isPOSForm = e => /^(\([A-Z]'?(\+[A-Z]'?)*\)|[A-Z]'?)+$/.test(e.replace(/\s+/g, '').toUpperCase().replace(/[’′]/g, "'"));

  const GEN = {
    sopdc() {
      const n = 4; const { ones, dcs } = randomWithDC(n, 0.3, 0.2);
      const res = K.minimize(n, ones, dcs); const ans = K.sopText(res, n);
      return {
        q: 'X\'leri kullanarak en sade SOP ifadeyi yaz.', map: { n, ones, dcs }, type: 'text',
        check: a => {
          for (const ch of a.toUpperCase().match(/[A-Z]/g) || []) if (!K.VARS.slice(0, n).includes(ch)) return { ok: false, msg: `${ch} değişkeni bu haritada yok.` };
          if (!matchesCare(a, n, ones, dcs)) return { ok: false, msg: '1 ya da 0 olan bazı hücrelerde yanlış değer veriyor.' };
          if (lits(a) > lits(ans)) return { ok: false, msg: 'Doğru ama X\'lerle daha büyük gruplar yapılabilir.' };
          return { ok: true };
        },
        ans: M(ans), sol: { n, ones, dcs, groups: res.terms }
      };
    },
    pos() {
      const n = pick([3, 4]); const { ones, dcs } = randomWithDC(n, 0.45, n === 4 ? 0.12 : 0);
      const zeros = []; for (let x = 0; x < (1 << n); x++) if (!ones.includes(x) && !dcs.includes(x)) zeros.push(x);
      const res = K.minimize(n, zeros, dcs); const ans = K.posText(res, n);
      return {
        q: 'Bu haritanın en sade POS ifadesini yaz. Örnek yazım: (A+B\')(C+D)', map: { n, ones, dcs }, type: 'text',
        check: a => {
          if (!isPOSForm(a)) return { ok: false, msg: 'POS biçiminde değil. Parantez içinde toplamlar, parantezler yan yana (çarpım).' };
          for (const ch of a.toUpperCase().match(/[A-Z]/g) || []) if (!K.VARS.slice(0, n).includes(ch)) return { ok: false, msg: `${ch} değişkeni bu haritada yok.` };
          if (!matchesCare(a, n, ones, dcs)) return { ok: false, msg: 'Bazı hücrelerde yanlış değer veriyor. 0 → düz, 1 → çizgili kuralını kontrol et.' };
          if (lits(a) > lits(ans)) return { ok: false, msg: 'Doğru ama 0\'lar daha büyük gruplarla örtülebilir.' };
          return { ok: true };
        },
        ans: M(ans), sol: { n, ones, dcs, groups: res.terms, pos: true }
      };
    },
    seg() {
      const d = rnd(0, 9); const on = segsOn(d);
      return {
        q: `Hocanın segment düzeninde <b>${d}</b> rakamı için hangi segmentler yanar? Harfleri yaz (ör. abg).`, type: 'text',
        check: a => { const s = [...new Set(a.toLowerCase().replace(/[^a-g]/g, '').split(''))].sort().join(''); return { ok: s === on.split('').sort().join('') }; },
        ans: B(on), fig: d
      };
    }
  };

  let current = null, score = 0, total = 0, answered = false;
  function newQuestion() {
    const topic = $('quiz-topic').value;
    const k = topic === 'all' ? pick(['sopdc', 'pos', 'seg']) : topic;
    current = GEN[k](); answered = false;
    $('quiz-q').innerHTML = current.q; $('quiz-fb').innerHTML = '';
    if (current.map) K.renderKMap($('quiz-map'), { n: current.map.n, values: valuesFrom(current.map.ones, current.map.dcs) });
    else $('quiz-map').innerHTML = `<div class="seg7">${seg7SVG({ on: '', labels: true, title: 'Hocanın adları' })}</div>`;
    $('quiz-input').innerHTML = `<div class="controls"><div class="field"><label for="quiz-ans">Cevabın</label><input id="quiz-ans" type="text" class="wide" autocomplete="off" spellcheck="false"></div><button class="btn" type="button" id="quiz-check">Kontrol et</button></div>`;
    $('quiz-check').addEventListener('click', () => grade($('quiz-ans').value));
    onEnter(['quiz-ans'], () => grade($('quiz-ans').value));
  }
  function grade(a) {
    if (!current) return;
    if (!String(a).trim()) { $('quiz-fb').innerHTML = `<div class="feedback no">Önce bir cevap yaz.</div>`; return; }
    let r;
    try { r = current.check(String(a).trim()); }
    catch (ex) { $('quiz-fb').innerHTML = `<div class="feedback no">Cevap okunamadı: ${esc(ex.message)}</div>`; return; }
    if (!answered) { total++; if (r.ok) score++; answered = true; }
    $('quiz-score').textContent = `${score} / ${total} doğru`;
    $('quiz-fb').innerHTML = r.ok
      ? `<div class="feedback ok"><b>Doğru!</b> Cevap: ${current.ans}</div>`
      : `<div class="feedback no"><b>Olmadı.</b> ${r.msg ? esc(r.msg) + ' ' : ''}En sade cevap: ${current.ans}<div class="why" id="quiz-sol"></div></div>`;
    if (!r.ok) {
      const box = $('quiz-sol');
      if (current.sol) {
        const s = current.sol;
        box.innerHTML = '<p>Doğru gruplama:</p><div></div>';
        K.renderKMap(box.querySelector('div'), { n: s.n, values: valuesFrom(s.ones, s.dcs), groups: s.groups.map((t, i) => ({ t, color: COLORS[i % COLORS.length] })), pos: !!s.pos });
      } else if (current.fig !== undefined) {
        box.innerHTML = `<div class="seg7">${seg7SVG({ on: segsOn(current.fig), labels: true, title: String(current.fig) })}</div>`;
      }
    }
  }

  document.addEventListener('DOMContentLoaded', () => {
    computeSegEquations();
    renderStatics();
    renderSegments();
    initSquare();
    renderSolver();
    $('sv-fill').addEventListener('click', fillSolver); onEnter(['sv-sigma', 'sv-d'], fillSolver);
    $('sv-clear').addEventListener('click', () => { svVals = new Map(); renderSolver(); });
    $('quiz-new').addEventListener('click', newQuestion);
    $('quiz-topic').addEventListener('change', newQuestion);
    newQuestion();
  });
})();
