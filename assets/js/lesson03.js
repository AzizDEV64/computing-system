/* Ders 3 etkileşimli araçları */
(function () {
  'use strict';
  const { $, esc, B, err, prettyExpr, onEnter, bindCircuit } = window.UI;
  const L = window.Logic;
  const M = e => `<span class="m">${prettyExpr(e)}</span>`;
  const SUB = n => String(n).split('').map(d => '₀₁₂₃₄₅₆₇₈₉'[+d]).join('');

  /* ================= Minterm / maxterm tablosu ================= */
  function fillTermTable() {
    const tb = $('mm-table').querySelector('tbody');
    const vars = ['A', 'B', 'C'];
    tb.innerHTML = [...Array(8).keys()].map(i => {
      const bits = i.toString(2).padStart(3, '0').split('');
      return `<tr><td>${i}</td>${bits.map(b => `<td>${b}</td>`).join('')}<td class="out" style="font-family:var(--font)">m${SUB(i)} = ${M(L.mintermText(i, vars))}</td><td class="out" style="font-family:var(--font)">M${SUB(i)} = ${M(L.maxtermText(i, vars))}</td></tr>`;
    }).join('');
  }

  /* ================= Kanonik form aracı ================= */
  function runCanon() {
    const e = $('canon-in').value.trim();
    const out = $('canon-out');
    try {
      const tree = L.parse(e);
      const used = [...L.variables(tree)];
      let vars = $('canon-vars').value.toUpperCase().replace(/[^A-Z]/g, '').split('');
      vars = [...new Set(vars)];
      const missing = used.filter(v => !vars.includes(v));
      if (missing.length) { out.innerHTML = err(`İfadedeki ${missing.join(', ')} değişkeni "Değişkenler" kutusunda yok.`); return; }
      if (vars.length < 1 || vars.length > 4) { out.innerHTML = err('1 ile 4 arasında değişken kullan.'); return; }
      const t = L.truthTable(e, vars);
      const ones = t.rows.filter(r => r.f).map(r => r.m), zeros = t.rows.filter(r => !r.f).map(r => r.m);
      let h = '<div class="table-wrap"><table class="tt"><thead><tr><th>#</th>' + vars.map(v => `<th>${v}</th>`).join('') +
        '<th class="out">F</th><th>Minterm</th><th>Maxterm</th></tr></thead><tbody>';
      t.rows.forEach(r => {
        h += `<tr class="${r.f ? 'hit' : ''}"><td>${r.m}</td>${r.bits.map(b => `<td>${b}</td>`).join('')}<td class="out ${r.f ? 'one' : ''}">${r.f}</td>` +
          `<td style="font-family:var(--font)">${r.f ? 'm' + SUB(r.m) + ' = ' + M(L.mintermText(r.m, vars)) : ''}</td>` +
          `<td style="font-family:var(--font)">${r.f ? '' : 'M' + SUB(r.m) + ' = ' + M(L.maxtermText(r.m, vars))}</td></tr>`;
      });
      h += '</tbody></table></div>';
      h += `<p class="result">F = Σ(${ones.join(', ') || '—'}) = Π(${zeros.join(', ') || '—'})</p>`;
      h += `<p><b>Kanonik SOP:</b> <span class="m" style="white-space:normal">${ones.length ? prettyExpr(L.canonicalSOP(t)) : '0 (hiç 1 yok)'}</span></p>`;
      h += `<p><b>Kanonik POS:</b> <span class="m" style="white-space:normal">${zeros.length ? prettyExpr(L.canonicalPOS(t)) : '1 (hiç 0 yok)'}</span></p>`;
      out.innerHTML = h;
    } catch (ex) { out.innerHTML = err(ex.message); }
  }

  /* ================= Devreler ================= */
  function initCircuits() {
    bindCircuit($('c-alarm'), ['A', 'B', 'C'], env => {
      const or1 = env.A | env.B, or2 = env.B | env.C, F = or1 & or2;
      const min = env.B | (env.A & env.C);
      return { or1, or2, F, count: env.A + env.B + env.C, min, minNote: min === F ? '✓ aynı' : '✗' };
    });
    bindCircuit($('c-ha'), ['A', 'B'], env => {
      const S = env.A ^ env.B, Cout = env.A & env.B;
      return { S, Cout, dec: env.A + env.B, bin: `${Cout}${S}` };
    });
    bindCircuit($('c-fa'), ['A', 'B', 'Cin'], env => {
      const x2 = env.B ^ env.Cin, a3 = env.A & x2, a4 = env.B & env.Cin;
      const S = env.A ^ env.B ^ env.Cin, Cout = a3 | a4;
      return { x2, a3, a4, S, Cout, dec: env.A + env.B + env.Cin, bin: `${Cout}${S}` };
    });
    bindCircuit($('c-ripple'), ['A2', 'A1', 'A0', 'B2', 'B1', 'B0'], env => {
      const fa = (a, b, c) => ({ s: a ^ b ^ c, c: (a & b) | (c & (a ^ b)) });
      const f0 = fa(env.A0, env.B0, 0), f1 = fa(env.A1, env.B1, f0.c), f2 = fa(env.A2, env.B2, f1.c);
      const a = env.A2 * 4 + env.A1 * 2 + env.A0, b = env.B2 * 4 + env.B1 * 2 + env.B0;
      const sum = `${f2.c}${f2.s}${f1.s}${f0.s}`;
      return {
        s0: f0.s, s1: f1.s, s2: f2.s, c0: f0.c, c1: f1.c, c2: f2.c,
        aBin: `${env.A2}${env.A1}${env.A0}`, bBin: `${env.B2}${env.B1}${env.B0}`, aDec: a, bDec: b,
        sum, sumDec: parseInt(sum, 2), ofNote: f2.c ? '(OF = 1: 3 bite sığmadı)' : ''
      };
    });
  }

  /* ================= Test ================= */
  const rnd = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
  const pick = arr => arr[rnd(0, arr.length - 1)];
  const VARS3 = ['A', 'B', 'C'];
  const parseList = s => {
    const parts = String(s).split(/[\s,;]+/).filter(Boolean);
    if (!parts.every(p => /^\d+$/.test(p))) return null;
    return [...new Set(parts.map(Number))].sort((x, y) => x - y);
  };
  const sameList = (a, b) => a && a.length === b.length && a.every((x, i) => x === b[i]);
  const SIGMA_POOL = ["ABC'+A'B", "A+B'C", "AB+C", "A'B'+BC", "A^B", "(A+B)C'", "AB'+A'C", "B'", "A'BC+AB"];

  const GEN = {
    minterm() {
      const i = rnd(0, 7); const ans = L.mintermText(i, VARS3);
      return { q: `3 değişken (A, B, C) için m${SUB(i)} mintermini yaz.`, type: 'text',
        check: a => termCheck(a, ans, 'minterm'), ans: M(ans), why: `${i} = ${i.toString(2).padStart(3, '0')}. 0 olan değişken çizgili, 1 olan düz.` };
    },
    maxterm() {
      const i = rnd(0, 7); const ans = L.maxtermText(i, VARS3);
      return { q: `3 değişken (A, B, C) için M${SUB(i)} maxtermini yaz.`, type: 'text',
        check: a => termCheck(a, ans, 'maxterm'), ans: M(ans), why: `${i} = ${i.toString(2).padStart(3, '0')}. Maxtermde 1 olan değişken çizgili, 0 olan düz, aralarında +.` };
    },
    index() {
      const i = rnd(0, 7); const isMin = Math.random() < 0.6;
      const term = isMin ? L.mintermText(i, VARS3) : L.maxtermText(i, VARS3);
      return { q: `${M(term)} hangi ${isMin ? 'minterm' : 'maxterm'}? Numarasını yaz.`, type: 'text',
        check: a => ({ ok: String(a).trim().replace(/^[mM]/, '') === String(i) }), ans: String(i),
        why: isMin ? `Düz = 1, çizgili = 0: ${i.toString(2).padStart(3, '0')} = ${i}` : `Maxtermde çizgili = 1, düz = 0: ${i.toString(2).padStart(3, '0')} = ${i}` };
    },
    sigmapi() {
      const set = [...Array(8).keys()].filter(() => Math.random() < 0.45);
      if (set.length === 0 || set.length === 8) set.splice(0, set.length, 1, 4, 6);
      const rest = [...Array(8).keys()].filter(x => !set.includes(x));
      return { q: `F(A,B,C) = Σ(${set.join(', ')}). Π gösterimindeki numaraları yaz.`, type: 'text',
        check: a => ({ ok: sameList(parseList(a), rest) }), ans: rest.join(', '), why: '0–7 arasında Σ listesinde olmayan numaralar.' };
    },
    sigma() {
      const e = pick(SIGMA_POOL); const t = L.truthTable(e, VARS3);
      const ones = t.rows.filter(r => r.f).map(r => r.m);
      return { q: `F(A,B,C) = ${M(e)} fonksiyonunun Σ listesini yaz.`, type: 'text',
        check: a => ({ ok: sameList(parseList(a), ones) }), ans: ones.join(', '),
        why: 'Doğruluk tablosunu çıkar ya da eksik değişkenli terimleri (X + X\') ile genişlet. 1 olan satır numaraları Σ\'ya girer.' };
    },
    fa() {
      const a = rnd(0, 1), b = rnd(0, 1), c = rnd(0, 1); const s = a ^ b ^ c, co = (a + b + c) >> 1;
      const opts = ['S=0, Cout=0', 'S=1, Cout=0', 'S=0, Cout=1', 'S=1, Cout=1'];
      const right = `S=${s}, Cout=${co}`;
      return { q: `Tam toplayıcıda A = ${a}, B = ${b}, C<sub>in</sub> = ${c} iken çıkışlar nedir?`, type: 'choice', options: opts,
        check: x => ({ ok: x === right }), ans: right, ansPlain: right, why: `Toplam ${a + b + c} = ${co}${s}₂ → S sağdaki bit, Cout soldaki bit.` };
    },
    ripple() {
      const a = rnd(0, 7), b = rnd(0, 7); const sum = (a + b).toString(2).padStart(4, '0');
      const A = a.toString(2).padStart(3, '0'), Bb = b.toString(2).padStart(3, '0');
      return { q: `3 bitlik toplayıcıda A = ${B(A)}, B = ${B(Bb)}. Çıkış OF S₂S₁S₀ nedir? (4 bit yaz)`, type: 'text',
        check: x => { const v = String(x).replace(/\s+/g, ''); return { ok: /^[01]{1,4}$/.test(v) && v.padStart(4, '0') === sum }; },
        ans: sum, why: `${A} = ${a}, ${Bb} = ${b}, toplam ${a + b} = ${sum}. Sağdan sola sütun sütun topla, eldeyi sola taşı.` };
    }
  };

  /* Terimin doğru olması için: aynı fonksiyon + doğru biçim (minterm çarpım, maxterm toplam) */
  function termCheck(a, ans, kind) {
    const e = L.equivalent(ans, a);
    if (!e.same) return { ok: false, msg: 'Bu terim istenen satırla eşleşmiyor.' };
    if (kind === 'minterm' && /\+/.test(a)) return { ok: false, msg: 'Minterm bir çarpımdır, + içermez.' };
    if (kind === 'maxterm' && !/\+/.test(a)) return { ok: false, msg: 'Maxterm bir toplamdır, değişkenler + ile ayrılır.' };
    return { ok: true };
  }

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
    let r;
    try { r = current.check(String(a).trim()); }
    catch (ex) { $('quiz-fb').innerHTML = `<div class="feedback no">Cevap okunamadı: ${esc(ex.message)}</div>`; return; }
    if (!answered) { total++; if (r.ok) score++; answered = true; }
    $('quiz-score').textContent = `${score} / ${total} doğru`;
    if (btn) $('quiz-input').querySelectorAll('button').forEach(b => {
      b.classList.toggle('right', b.dataset.o === current.ansPlain);
      b.classList.toggle('picked-wrong', b === btn && !r.ok);
    });
    const ansHTML = current.type === 'text' && !/</.test(current.ans) ? B(current.ans) : current.ans;
    $('quiz-fb').innerHTML = r.ok
      ? `<div class="feedback ok"><b>Doğru!</b> Cevap: ${ansHTML}</div>`
      : `<div class="feedback no"><b>Olmadı.</b> ${r.msg ? esc(r.msg) + ' ' : ''}Doğru cevap: ${ansHTML}<div class="why">${esc(current.why)}</div></div>`;
  }

  document.addEventListener('DOMContentLoaded', () => {
    fillTermTable();
    $('canon-go').addEventListener('click', runCanon); onEnter(['canon-in', 'canon-vars'], runCanon); runCanon();
    initCircuits();
    $('quiz-new').addEventListener('click', newQuestion);
    $('quiz-topic').addEventListener('change', newQuestion);
    newQuestion();
  });
})();
