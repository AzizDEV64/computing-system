/* Ders 2 etkileşimli araçları */
(function () {
  'use strict';
  const { $, esc, B, prettyExpr, onEnter, literalCount, bindTruthTool, bindCircuit } = window.UI;
  const L = window.Logic;
  const M = e => `<span class="m">${prettyExpr(e)}</span>`;

  /* ================= Devreler ================= */
  function initCircuits() {
    // Örnek 1: F = (A'+B)' ⊙ A
    bindCircuit($('c1'), ['A', 'B'], env => {
      const nA = env.A ^ 1;
      const or1 = nA | env.B;
      const inv = or1 ^ 1;
      const F = inv === env.A ? 1 : 0;
      const ok = (env.A & env.B) ^ 1;          // A' + B'
      const hoca = env.A & (env.B ^ 1);         // AB'
      return { nA, or1, F, ok, hoca, hocaNote: hoca === F ? '' : '(uyuşmuyor)' };
    });
    // Örnek 2: F = ([(A'B) ⊕ C] B')'
    bindCircuit($('c2'), ['A', 'B', 'C'], env => {
      const nA = env.A ^ 1;
      const and1 = nA & env.B;
      const xr = and1 ^ env.C;
      const nB = env.B ^ 1;
      const F = (xr & nB) ^ 1;
      const simp = env.B | (env.C ^ 1);
      return { nA, and1, xr, nB, F, simp, simpNote: simp === F ? '✓ aynı' : '✗' };
    });
  }

  /* ================= Test ================= */
  const rnd = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
  const pick = arr => arr[rnd(0, arr.length - 1)];

  const SIMPLIFY = [
    { q: 'A+AB', a: 'A', why: '{A+AB} = {A(1+B)} = {A·1} = {A}' },
    { q: 'A(A+B)', a: 'A', why: '{AA+AB} = {A+AB} = {A(1+B)} = {A·1} = {A}' },
    { q: "A+A'B", a: 'A+B', why: "Dağılma 2: {A+A'B} = {(A+A')(A+B)} = {1·(A+B)} = {A+B}" },
    { q: "AB+AB'", a: 'A', why: "{A(B+B')} = {A·1} = {A}" },
    { q: "(A+B)(A+B')", a: 'A', why: "Dağılma 2: {(A+B)(A+B')} = {A+BB'} = {A+0} = {A}" },
    { q: "A'B'+A'B+AB", a: "A'+B", why: "{A'(B'+B)+AB} = {A'+AB} = {(A'+A)(A'+B)} = {1·(A'+B)} = {A'+B}" },
    { q: "ABC+ABC'+AB'C", a: 'AB+AC', why: "{ABC} terimini iki kez kullan ({X+X=X}): {ABC+ABC'} = {AB(C+C')} = {AB}, {ABC+AB'C} = {AC(B+B')} = {AC}. Sonuç {AB+AC}" },
    { q: "A(A'+B)", a: 'AB', why: "{AA'+AB} = {0+AB} = {AB}" },
    { q: "(A+B')'+A'B'", a: "A'", why: "De Morgan: {A'B+A'B'} = {A'(B+B')} = {A'·1} = {A'}" },
    { q: "(AB)'+A", a: '1', why: "De Morgan: {A'+B'+A} = {(A+A')+B'} = {1+B'} = {1}" },
    { q: "ABC'+A'BC'", a: "BC'", why: "{BC'(A+A')} = {BC'·1} = {BC'}" },
    { q: '(A+B)(A+C)', a: 'A+BC', why: 'Dağılmanın ikinci hali: {(A+B)(A+C)} = {A+BC}' },
    { q: "(A'B')'", a: 'A+B', why: "De Morgan: {A''+B''} = {A+B}" },
    { q: "AB'+ABC", a: "AB'+AC", why: "{A(B'+BC)} = {A(B'+B)(B'+C)} = {A·1·(B'+C)} = {AB'+AC} (dağılma 2)" },
    { q: "(AB')'+B", a: "A'+B", why: "De Morgan: {A'+B''+B} = {A'+B+B} = {A'+B}" },
    { q: "((AB)'+C)'", a: "ABC'", why: "De Morgan: {(AB)''C'} = {ABC'}" },
    { q: "A'BC+AB'C+ABC'+ABC", a: 'AB+AC+BC', why: "{ABC} terimini üç kez kullan ({X+X=X}): {(A'BC+ABC)+(AB'C+ABC)+(ABC'+ABC)} = {BC(A'+A)+AC(B'+B)+AB(C'+C)} = {BC+AC+AB}" },
    { q: '(A+B)^A', a: "A'B", why: "x = {A+B} de: {xA'+x'A} = {(A+B)A'+A'B'A} = {AA'+A'B+0} = {A'B}" }
  ];
  const THEOREMS = [
    { e: 'A+B = B+A', t: 'Değişme' }, { e: 'AB = BA', t: 'Değişme' },
    { e: 'A+(B+C) = (A+B)+C', t: 'Birleşme' }, { e: 'A(BC) = (AB)C', t: 'Birleşme' },
    { e: 'A(B+C) = AB+AC', t: 'Dağılma' }, { e: 'A+BC = (A+B)(A+C)', t: 'Dağılma' },
    { e: 'A+A = A', t: 'Tekrar (idempotent)' }, { e: 'AA = A', t: 'Tekrar (idempotent)' },
    { e: "(A+B)' = A'B'", t: 'De Morgan' }, { e: "(AB)' = A'+B'", t: 'De Morgan' },
    { e: 'A+AB = A', t: 'Yutma' }, { e: 'A(A+B) = A', t: 'Yutma' }, { e: "A+A'B = A+B", t: 'Yutma' },
    { e: "A+A' = 1", t: 'Aksiyom' }, { e: 'A·0 = 0', t: 'Aksiyom' }, { e: "(A')' = A", t: 'Aksiyom' }
  ];
  const THEOREM_NAMES = ['Değişme', 'Birleşme', 'Dağılma', 'Tekrar (idempotent)', 'De Morgan', 'Yutma', 'Aksiyom'];
  const DEMORGAN = ["(A+B)'", "(AB)'", "(AB+C)'", "(A+BC)'", "(A'B)'", "(A+B'+C)'", "((A+B)C)'", "(A'+B')'", "(AB'C)'"];
  const VALUE_POOL = ['A+BC', "(A'+B)'⊙A", "(((A'B)^C)B')'", "A'B+AB'", "(A+B)(A'+C)", "((AB)'+C)'", 'A^B^C', "(AB)'+A'C", "A+B'C"];

  let current = null, score = 0, total = 0, answered = false;

  /* Açıklama metni: {…} içindekiler üstü çizgili formül, gerisi düz yazı */
  const fmtWhy = t => t.split(/({[^}]*})/).map(p => p[0] === '{' ? `<span class="m">${prettyExpr(p.slice(1, -1))}</span>` : esc(p)).join('');

  function prettyIdentity(e) {
    return e.split('=').map(s => prettyExpr(s.trim())).join(' = ');
  }

  function makeTextQuestion(q) {
    $('quiz-input').innerHTML = `<div class="controls"><div class="field"><label for="quiz-ans">Cevabın</label><input id="quiz-ans" type="text" class="wide" autocomplete="off" spellcheck="false"></div><button class="btn" type="button" id="quiz-check">Kontrol et</button></div>
      <p class="hint">Yazım: A' (DEĞİL), AB (VE), A+B (VEYA), (…)' üstü çizgili grup.</p>`;
    $('quiz-check').addEventListener('click', () => grade($('quiz-ans').value));
    onEnter(['quiz-ans'], () => grade($('quiz-ans').value));
    $('quiz-ans').focus({ preventScroll: true });
  }
  function makeChoiceQuestion(options) {
    $('quiz-input').innerHTML = `<div class="mcq">${options.map(o => `<button type="button" data-o="${esc(o)}">${esc(o)}</button>`).join('')}</div>`;
    $('quiz-input').querySelectorAll('button').forEach(b => b.addEventListener('click', () => grade(b.dataset.o, b)));
  }

  const GEN = {
    simplify() {
      const p = pick(SIMPLIFY);
      return {
        q: `Sadeleştir: ${M(p.q)}`, type: 'text',
        check: a => {
          const e = L.equivalent(p.q, a);
          if (!e.same) return { ok: false, msg: 'Bu ifade orijinalle aynı fonksiyonu vermiyor.' };
          if (literalCount(a) > literalCount(p.a)) return { ok: false, msg: 'Fonksiyon doğru ama daha da sadeleşir.' };
          return { ok: true };
        },
        ans: M(p.a), why: p.why
      };
    },
    theorem() {
      const p = pick(THEOREMS);
      return { q: `<span class="m">${prettyIdentity(p.e)}</span> hangi kurala örnektir?`, type: 'choice', options: THEOREM_NAMES,
        check: a => ({ ok: a === p.t }), ans: esc(p.t), why: '' };
    },
    demorgan() {
      const p = pick(DEMORGAN);
      return {
        q: `Uzun çizgi kalmayacak şekilde yaz (çizgi sadece tek harflerin üstünde olsun): ${M(p)}`, type: 'text',
        check: a => {
          if (/\)\s*['’′]/.test(a)) return { ok: false, msg: 'Hâlâ bir grubun üstünde çizgi var. De Morgan ile kır.' };
          return L.equivalent(p, a).same ? { ok: true } : { ok: false, msg: 'Bu ifade aynı fonksiyonu vermiyor. Çizgiyi kırınca işareti değiştirdin mi?' };
        },
        ans: M(simplestDeMorgan(p)),
        why: 'Çizgiyi en dıştaki işaretten kır ve işareti değiştir. Çift çizgileri sil.'
      };
    },
    value() {
      const e = pick(VALUE_POOL);
      const tree = L.parse(e); const vars = [...L.variables(tree)].sort();
      const env = {}; vars.forEach(v => { env[v] = Math.random() < 0.5; });
      const f = L.evaluate(tree, env) ? '1' : '0';
      return { q: `${M(e)} için ${vars.map(v => `${v} = ${env[v] ? 1 : 0}`).join(', ')} iken sonuç kaçtır?`, type: 'choice', options: ['0', '1'],
        check: a => ({ ok: a === f }), ans: f, why: 'Değerleri yerine koy. Önce parantez ve çizgiler, sonra AND, en son OR.' };
    }
  };

  /* De Morgan sorularının örnek cevapları (elle doğrulandı) */
  const DM_ANS = {
    "(A+B)'": "A'B'", "(AB)'": "A'+B'", "(AB+C)'": "A'C'+B'C'", "(A+BC)'": "A'B'+A'C'", "(A'B)'": "A+B'",
    "(A+B'+C)'": "A'BC'", "((A+B)C)'": "A'B'+C'", "(A'+B')'": 'AB', "(AB'C)'": "A'+B+C'"
  };
  function simplestDeMorgan(p) { return DM_ANS[p]; }

  function newQuestion() {
    const topic = $('quiz-topic').value;
    const k = topic === 'all' ? pick(Object.keys(GEN)) : topic;
    current = GEN[k]();
    answered = false;
    $('quiz-q').innerHTML = current.q;
    $('quiz-fb').innerHTML = '';
    if (current.type === 'text') makeTextQuestion(); else makeChoiceQuestion(current.options);
  }
  function grade(a, btn) {
    if (!current) return;
    if (!String(a).trim()) { $('quiz-fb').innerHTML = `<div class="feedback no">Önce bir cevap yaz.</div>`; return; }
    let r;
    try { r = current.check(String(a).trim()); }
    catch (ex) { $('quiz-fb').innerHTML = `<div class="feedback no">İfade okunamadı: ${esc(ex.message)}</div>`; return; }
    if (!answered) { total++; if (r.ok) score++; answered = true; }
    $('quiz-score').textContent = `${score} / ${total} doğru`;
    if (btn) {
      $('quiz-input').querySelectorAll('button').forEach(b => {
        b.classList.toggle('right', b.dataset.o === (current.ansPlain || stripTags(current.ans)));
        b.classList.toggle('picked-wrong', b === btn && !r.ok);
      });
    }
    const why = current.why ? `<div class="why">${fmtWhy(current.why)}</div>` : '';
    $('quiz-fb').innerHTML = r.ok
      ? `<div class="feedback ok"><b>Doğru!</b>${current.type === 'text' ? ` Örnek cevap: ${current.ans}` : ''}</div>`
      : `<div class="feedback no"><b>Olmadı.</b> ${r.msg ? esc(r.msg) + ' ' : ''}Doğru cevap: ${current.ans}${why}</div>`;
  }
  function stripTags(h) { const d = document.createElement('div'); d.innerHTML = h; return d.textContent; }

  document.addEventListener('DOMContentLoaded', () => {
    bindTruthTool('tt');
    initCircuits();
    $('quiz-new').addEventListener('click', newQuestion);
    $('quiz-topic').addEventListener('change', newQuestion);
    newQuestion();
  });
})();
