/* Ders 6: Toplayıcı/çıkarıcı, MUX, DEMUX */
(function () {
  'use strict';
  const { $, esc, B, prettyExpr, onEnter, bindCircuit } = window.UI;
  const K = window.KMap;
  const COLORS = K.GROUP_COLORS;
  const popcount = x => { let c = 0; while (x) { c += x & 1; x >>= 1; } return c; };

  /* ================= Özel adlı küçük haritalar ================= */
  function renderMaps() {
    document.querySelectorAll('.kmap6').forEach(el => {
      const n = +(el.dataset.n || 3);
      const names = el.dataset.names.split(',');
      const rename = html => html.replace(/[ABC]/g, ch => names['ABC'.indexOf(ch)]);
      const ones = el.dataset.ones.split(',').map(Number);
      const groups = el.dataset.groups.split('|').map((s, i) => ({ t: K.parseTerm(s, n), color: COLORS[i], s }));
      const holder = document.createElement('div');
      if (el.dataset.title) { const t = document.createElement('div'); t.className = 'kmap-cap'; t.textContent = el.dataset.title; el.appendChild(t); }
      el.appendChild(holder);
      const values = new Map(ones.map(x => [x, 1]));
      K.renderKMap(holder, { n, values, groups, rowLabel: el.dataset.row, colLabel: el.dataset.col });
      const ul = document.createElement('div');
      ul.innerHTML = '<ul class="group-list">' + groups.map(g => `<li style="--gc:${g.color}"><span class="m">${rename(prettyExpr(g.s))}</span> <span class="why">${1 << popcount(g.t.m)} hücre</span></li>`).join('') + '</ul>';
      el.appendChild(ul);
    });
  }

  /* ================= Toplayıcı/çıkarıcı hesabı ================= */
  // 1's complement, end-around carry: Cin0 = op · Cout2
  function addSub(a, b, op) {
    const bx = op ? (~b & 7) : b;
    const ripple = cin => {
      let c = cin; const s = [], carries = [];
      for (let i = 0; i < 3; i++) {
        const ai = (a >> i) & 1, bi = (bx >> i) & 1;
        s[i] = ai ^ bi ^ c;
        c = (ai & bi) | (c & (ai ^ bi));
        carries[i] = c;
      }
      return { s, carries, cout: c };
    };
    let r = ripple(0), cin = 0;
    if (op && r.cout) { cin = 1; r = ripple(1); }
    const sum = r.s[2] * 4 + r.s[1] * 2 + r.s[0];
    let value;
    if (!op) value = r.cout * 8 + sum;
    else value = r.cout ? sum : -((~sum) & 7);
    return { bx, cin, s: r.s, carries: r.carries, F3: r.cout, sum, value };
  }

  function initAddSub() {
    bindCircuit($('c-addsub'), ['op', 'A2', 'A1', 'A0', 'B2', 'B1', 'B0'], env => {
      const a = env.A2 * 4 + env.A1 * 2 + env.A0, b = env.B2 * 4 + env.B1 * 2 + env.B0;
      const r = addSub(a, b, env.op);
      const bits = `${r.F3}${r.s[2]}${r.s[1]}${r.s[0]}`;
      let expl;
      if (!env.op) expl = `${a} + ${b} = ${a + b} → F₃F₂F₁F₀ = ${bits}`;
      else if (r.F3) expl = `${a} − ${b}: elde taştı, AND kapısı 1 verir (Cᵢₙ₀ = 1), sonuç pozitif: F₂F₁F₀ = ${bits.slice(1)} = +${r.sum}`;
      else expl = `${a} − ${b}: elde yok, sonuç negatif. F₂F₁F₀ = ${bits.slice(1)}, tersi ${((~r.sum) & 7).toString(2).padStart(3, '0')} → ${r.value === 0 ? '−0' : r.value}`;
      return {
        x0: (r.bx >> 0) & 1, x1: (r.bx >> 1) & 1, x2: (r.bx >> 2) & 1,
        c0: r.carries[0], c1: r.carries[1], c2: r.F3, cin: r.cin,
        s0: r.s[0], s1: r.s[1], s2: r.s[2],
        mode: env.op ? 'Op = 1: çıkarma (B ters çevriliyor)' : 'Op = 0: toplama',
        expl: expl + `. Kontrol: ${env.op ? a - b : a + b}`
      };
    });
  }

  /* ================= MUX / DEMUX ================= */
  function initMuxDemux() {
    bindCircuit($('c-mux2'), ['I0', 'I1', 'S'], env => {
      const nS = env.S ^ 1, a0 = env.I0 & nS, a1 = env.I1 & env.S, F = a0 | a1;
      return { nS, a0, a1, F, note: `S = ${env.S} → I${env.S ? '₁' : '₀'} seçildi, F = I${env.S ? '₁' : '₀'} = ${F}` };
    });
    const root4 = $('c-mux4');
    bindCircuit(root4, ['I0', 'I1', 'I2', 'I3', 'S1', 'S0'], env => {
      const k = env.S1 * 2 + env.S0, F = env['I' + k];
      root4.querySelectorAll('.route').forEach(p => p.classList.toggle('on', +p.dataset.route === k));
      return { F, note: `S₁S₀ = ${env.S1}${env.S0} = ${k} → I${'₀₁₂₃'[k]} seçildi, F = ${F}` };
    });
    bindCircuit($('c-demux2'), ['I', 'S'], env => {
      const nS = env.S ^ 1;
      return { nS, F0: env.I & nS, F1: env.I & env.S };
    });
    const rootD = $('c-demux4');
    bindCircuit(rootD, ['I', 'S1', 'S0'], env => {
      const k = env.S1 * 2 + env.S0, out = {};
      for (let i = 0; i < 4; i++) out['F' + i] = i === k ? env.I : 0;
      rootD.querySelectorAll('.route').forEach(p => p.classList.toggle('on', +p.dataset.route === k));
      out.note = `S₁S₀ = ${env.S1}${env.S0} = ${k} → I, F${'₀₁₂₃'[k]}'e gidiyor. Diğer çıkışlar 0.`;
      return out;
    });
  }

  /* ================= Test ================= */
  const rnd = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
  const pick = arr => arr[rnd(0, arr.length - 1)];
  const b3 = x => x.toString(2).padStart(3, '0');
  const GEN = {
    mux() {
      const n = pick([1, 2, 3]); const N = 1 << n;
      const I = Array.from({ length: N }, () => rnd(0, 1)); const k = rnd(0, N - 1);
      const sBits = k.toString(2).padStart(n, '0');
      const sName = n === 1 ? 'S' : 'S' + [...Array(n).keys()].reverse().map(i => '₀₁₂'[i]).join('S');
      return {
        q: `${N}×1 MUX'ta veri girişleri I₀…I${'₀₁₂₃₄₅₆₇'[N - 1]} = ${I.join(', ')} ve ${sName} = ${sBits}. F kaçtır?`, type: 'choice', options: ['0', '1'],
        check: a => ({ ok: a === String(I[k]) }), ans: String(I[k]), why: `${sBits} = ${k} → I${'₀₁₂₃₄₅₆₇'[k]} seçilir, değeri ${I[k]}.`
      };
    },
    demux() {
      const k = rnd(0, 3), I = rnd(0, 1);
      const outs = [0, 0, 0, 0]; outs[k] = I;
      return {
        q: `1×4 DEMUX'ta I = ${I}, S₁S₀ = ${b3(k).slice(1)}. F₀F₁F₂F₃ çıkışlarını sırayla yaz (ör. 0100).`, type: 'text',
        check: a => ({ ok: a.replace(/\s+/g, '') === outs.join('') }), ans: outs.join(''),
        why: `S₁S₀ = ${k} → I, F${'₀₁₂₃'[k]}'e gider (değeri ${I}). Diğer çıkışlar 0.`
      };
    },
    addsub() {
      const a = rnd(0, 7), b = rnd(0, 7), op = rnd(0, 1);
      if (op && a === b) return GEN.addsub();
      const r = addSub(a, b, op); const bits = `${r.F3}${r.s[2]}${r.s[1]}${r.s[0]}`;
      return {
        q: `Toplayıcı/çıkarıcıda (1's complement) A = ${B(b3(a))}, B = ${B(b3(b))}, Op = ${op}. Çıkış F₃F₂F₁F₀ nedir?`, type: 'text',
        check: x => ({ ok: x.replace(/\s+/g, '') === bits }), ans: bits,
        why: op ? `B ters: ${b3(r.bx)}. ${b3(a)} + ${b3(r.bx)}${r.cin ? ' → elde taştı, C_in0 = 1 eklendi' : ' → elde yok, C_in0 = 0'}. F₃ = ${r.F3} (${r.F3 ? 'pozitif' : 'negatif'}).` : `${a} + ${b} = ${a + b}.`
      };
    },
    select() {
      const kind = pick(['MUX', 'DEMUX']); const n = rnd(1, 5); const N = 1 << n;
      return {
        q: kind === 'MUX' ? `${N}×1 MUX'ta kaç seçme girişi vardır?` : `1×${N} DEMUX'ta kaç seçme girişi vardır?`, type: 'text',
        check: x => ({ ok: x.trim() === String(n) }), ans: String(n), why: `${N} = 2^${n}, n seçme biti 2ⁿ seçenek verir.`
      };
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
    renderMaps();
    initAddSub();
    initMuxDemux();
    $('quiz-new').addEventListener('click', newQuestion);
    $('quiz-topic').addEventListener('change', newQuestion);
    newQuestion();
  });
})();
