/* Ders 4: Karnaugh haritaları */
(function () {
  'use strict';
  const { $, esc, B, err, prettyExpr, seg, onEnter } = window.UI;
  const L = window.Logic, K = window.KMap;
  const M = e => `<span class="m">${prettyExpr(e)}</span>`;
  const SUB = n => String(n).split('').map(d => '₀₁₂₃₄₅₆₇₈₉'[+d]).join('');
  const COLORS = K.GROUP_COLORS;

  const valuesFrom = (ones, dcs = []) => {
    const m = new Map();
    ones.forEach(x => m.set(x, 1));
    dcs.forEach(x => m.set(x, 'X'));
    return m;
  };
  const groupListHTML = (groups, n) => '<ul class="group-list">' + groups.map((g, i) =>
    `<li style="--gc:${COLORS[i % COLORS.length]}">${M(K.termText(g, n))} <span class="why">${1 << popcount(g.m)} hücre</span></li>`).join('') + '</ul>';
  const popcount = x => { let c = 0; while (x) { c += x & 1; x >>= 1; } return c; };

  /* ================= Sabit haritalar (hocanın örnekleri) ================= */
  function renderStatics() {
    document.querySelectorAll('.kmap-static').forEach(el => {
      const n = +el.dataset.n;
      const ones = (el.dataset.ones || '').split(',').filter(Boolean).map(Number);
      const labels = el.dataset.labels;
      const groups = (el.dataset.groups || '').split('|').filter(Boolean).map((s, i) => ({ t: K.parseTerm(s, n), color: COLORS[i % COLORS.length], s }));
      const holder = document.createElement('div');
      el.appendChild(holder);
      const opts = { n, values: valuesFrom(ones), groups, showIndex: false };
      if (labels === 'terms') opts.cellLabel = idx => `<span class="m" style="font-size:.95rem">${prettyExpr(L.mintermText(idx, K.VARS.slice(0, n)))}</span>`;
      if (labels === 'index') opts.cellLabel = idx => `<span style="font-family:var(--font);font-size:.95rem">m${SUB(idx)}</span>`;
      K.renderKMap(holder, opts);
      if (groups.length) {
        const ul = document.createElement('div');
        ul.innerHTML = '<ul class="group-list">' + groups.map(g => `<li style="--gc:${g.color}">${M(g.s)} <span class="why">${1 << popcount(g.t.m)} hücre</span></li>`).join('') + '</ul>';
        el.appendChild(ul);
      }
    });
  }

  /* ================= Çözücü ================= */
  let svN = 4, svVals = new Map([[0, 1], [2, 1], [5, 1], [7, 1], [8, 1], [10, 1], [13, 1], [15, 1]]);
  const svGetN = seg('sv-n', v => { svN = +v; svVals = new Map(); renderSolver(); });
  function renderSolver() {
    const ones = [...svVals.entries()].filter(([, v]) => v === 1).map(([k]) => k).filter(k => k < (1 << svN));
    const res = K.minimize(svN, ones);
    const groups = res.constant === null ? res.terms.map((t, i) => ({ t, color: COLORS[i % COLORS.length] })) : [];
    K.renderKMap($('sv-map'), {
      n: svN, values: svVals, groups, editable: true,
      onCell: idx => { svVals.set(idx, svVals.get(idx) === 1 ? 0 : 1); renderSolver(); }
    });
    let h = `<p class="result">F = ${M(K.sopText(res, svN))}</p>`;
    h += `<p>Σ(${ones.sort((a, b) => a - b).join(', ') || '—'})</p>`;
    if (res.constant === null) {
      h += groupListHTML(res.terms, svN);
      h += '<ol class="steps">' + res.terms.map(t => explainGroup(t, svN)).join('') + '</ol>';
    } else if (res.constant === 1) h += '<p>Bütün hücreler 1: F = 1.</p>';
    else h += '<p>Hiç 1 yok: F = 0. Hücrelere tıklayarak 1 ekle.</p>';
    $('sv-out').innerHTML = h;
  }
  function explainGroup(t, n) {
    const cells = [];
    for (let x = 0; x < (1 << n); x++) if (K.covers(t, x)) cells.push(x);
    const parts = K.VARS.slice(0, n).map((v, i) => {
      const bit = 1 << (n - 1 - i);
      if (t.m & bit) return `${v} değişiyor`;
      return (t.v & bit) ? `${v} = 1` : `${v} = 0`;
    });
    return `<li>${M(K.termText(t, n))}: m${cells.map(SUB).join(', m')} hücreleri. ${parts.join(', ')}.</li>`;
  }

  /* ================= Test ================= */
  const rnd = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
  const pick = arr => arr[rnd(0, arr.length - 1)];
  const lits = e => (e.match(/[A-Za-z]/g) || []).length;

  function randomFunction(n) {
    let ones;
    do {
      ones = [];
      for (let x = 0; x < (1 << n); x++) if (Math.random() < 0.45) ones.push(x);
    } while (ones.length < 2 || ones.length > (1 << n) - 2);
    return ones;
  }

  const GEN = {
    solve(n) {
      const ones = randomFunction(n);
      const res = K.minimize(n, ones);
      const ans = K.sopText(res, n);
      return {
        q: `Bu haritanın en sade SOP ifadesini yaz.`, map: { n, ones }, type: 'text',
        check: a => {
          const vars = K.VARS.slice(0, n);
          const e = L.equivalent(ans.replace(/ /g, ''), a);
          if (!e.same) return { ok: false, msg: 'Bu ifade haritadaki fonksiyonu vermiyor.' };
          if (lits(a) > lits(ans)) return { ok: false, msg: 'Fonksiyon doğru ama daha büyük gruplar kullanılabilir.' };
          return { ok: true };
        },
        ans: M(ans), solution: { n, ones, groups: res.terms }
      };
    },
    solve3() { return GEN.solve(3); },
    solve4() { return GEN.solve(4); },
    read() {
      const n = pick([3, 4]);
      // rastgele bir grup (2 ya da 4 ya da 8 hücre)
      const k = n === 3 ? rnd(1, 2) : rnd(1, 3);
      let m = 0; const bits = [...Array(n).keys()].sort(() => Math.random() - .5).slice(0, k);
      bits.forEach(b => { m |= 1 << b; });
      const v = rnd(0, (1 << n) - 1) & ~m;
      const t = { v, m };
      const ones = []; for (let x = 0; x < (1 << n); x++) if (K.covers(t, x)) ones.push(x);
      const ans = K.termText(t, n);
      return {
        q: 'Haritada çizili grubun terimi nedir?', map: { n, ones, groups: [t] }, type: 'text',
        check: a => {
          const e = L.equivalent(ans, a);
          if (!e.same) return { ok: false, msg: 'Bu terim grubun hücreleriyle eşleşmiyor.' };
          if (/\+/.test(a)) return { ok: false, msg: 'Tek bir grup tek bir çarpım terimi verir.' };
          return { ok: true };
        },
        ans: M(ans), why: 'Grubun her yerinde aynı kalan değişkenleri yaz: 1 ise düz, 0 ise çizgili.'
      };
    },
    cell() {
      const n = pick([3, 4]);
      const x = rnd(0, (1 << n) - 1);
      const bits = x.toString(2).padStart(n, '0');
      const rowVars = n === 3 ? 'A' : 'AB', colVars = n === 3 ? 'BC' : 'CD';
      const rb = bits.slice(0, n === 3 ? 1 : 2), cb = bits.slice(n === 3 ? 1 : 2);
      return {
        q: `${n} değişkenli haritada ${rowVars} = ${rb} satırı ile ${colVars} = ${cb} sütunundaki hücre hangi mintermdir? Numarasını yaz.`, type: 'text',
        check: a => ({ ok: String(a).trim().replace(/^m/i, '') === String(x) }), ans: B(String(x)),
        why: `Satır ve sütun bitlerini yan yana yaz: ${rb}${cb} = ${x}.`
      };
    }
  };

  let current = null, score = 0, total = 0, answered = false;
  function newQuestion() {
    const topic = $('quiz-topic').value;
    const keys = ['solve3', 'solve4', 'read', 'cell'];
    const k = topic === 'all' ? pick(keys) : topic;
    current = GEN[k](); answered = false;
    $('quiz-q').innerHTML = current.q; $('quiz-fb').innerHTML = '';
    if (current.map) {
      const mp = current.map;
      K.renderKMap($('quiz-map'), { n: mp.n, values: valuesFrom(mp.ones), groups: (mp.groups || []).map((t, i) => ({ t, color: COLORS[i] })) });
    } else $('quiz-map').innerHTML = '';
    $('quiz-input').innerHTML = `<div class="controls"><div class="field"><label for="quiz-ans">Cevabın</label><input id="quiz-ans" type="text" class="wide" autocomplete="off" spellcheck="false"></div><button class="btn" type="button" id="quiz-check">Kontrol et</button></div>
      <p class="hint">Yazım: A' (DEĞİL), AB (VE), A+B (VEYA).</p>`;
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
    let extra = current.why ? `<div class="why">${esc(current.why)}</div>` : '';
    $('quiz-fb').innerHTML = r.ok
      ? `<div class="feedback ok"><b>Doğru!</b> Cevap: ${current.ans}</div>`
      : `<div class="feedback no"><b>Olmadı.</b> ${r.msg ? esc(r.msg) + ' ' : ''}En sade cevap: ${current.ans}${extra}<div class="why" id="quiz-sol"></div></div>`;
    if (!r.ok && current.solution) {
      const s = current.solution; const box = $('quiz-sol');
      box.innerHTML = '<p>Doğru gruplama:</p><div></div>' + groupListHTML(s.groups, s.n);
      K.renderKMap(box.querySelector('div'), { n: s.n, values: valuesFrom(s.ones), groups: s.groups.map((t, i) => ({ t, color: COLORS[i % COLORS.length] })) });
    }
  }

  /* ================= Başlat ================= */
  document.addEventListener('DOMContentLoaded', () => {
    renderStatics();
    renderSolver();
    $('sv-fill').addEventListener('click', fillSigma); onEnter(['sv-sigma'], fillSigma);
    $('sv-clear').addEventListener('click', () => { svVals = new Map(); renderSolver(); });
    $('sv-random').addEventListener('click', () => { svVals = valuesFrom(randomFunction(svN)); renderSolver(); });
    $('quiz-new').addEventListener('click', newQuestion);
    $('quiz-topic').addEventListener('change', newQuestion);
    newQuestion();
  });
  function fillSigma() {
    const parts = $('sv-sigma').value.split(/[\s,;]+/).filter(Boolean);
    const max = (1 << svN) - 1;
    if (!parts.every(p => /^\d+$/.test(p) && +p <= max)) { $('sv-out').innerHTML = err(`0 ile ${max} arasında, virgülle ayrılmış numaralar yaz.`); return; }
    svVals = valuesFrom(parts.map(Number)); renderSolver();
  }
})();
