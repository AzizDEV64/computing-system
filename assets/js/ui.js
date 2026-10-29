/* Ders sayfalarının ortak arayüz yardımcıları (Ders 2 ve sonrası). */
(function () {
  'use strict';
  const $ = id => document.getElementById(id);
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const B = s => `<span class="b">${esc(s)}</span>`;
  const err = msg => `<p class="err">${esc(msg)}</p>`;

  /* "(A+B)'C ^ D" gibi bir ifadeyi üstü çizgili, okunaklı HTML'e çevirir. */
  function prettyExpr(e) {
    const OPEN = '\u0001', CLOSE = '\u0002';
    let s = String(e).replace(/\s+/g, '').replace(/[’′]/g, "'");
    const isOpen = c => c === '(' || c === OPEN;
    const isClose = c => c === ')' || c === CLOSE;
    // Her ' işaretini, hemen solundaki öğenin (harf, parantez grubu ya da çizgili grup) üstüne çizgiye çevir
    let p;
    while ((p = s.indexOf("'")) >= 0) {
      const prev = s[p - 1];
      if (prev === undefined) { s = s.slice(0, p) + s.slice(p + 1); continue; }
      if (isClose(prev)) {
        let depth = 0, q = p - 1;
        for (; q >= 0; q--) {
          if (isClose(s[q])) depth++;
          else if (isOpen(s[q])) { depth--; if (depth === 0) break; }
        }
        if (q < 0) { s = s.slice(0, p) + s.slice(p + 1); continue; }
        if (prev === ')') {
          // (…)' → parantezleri kaldır, grubu çiz
          s = s.slice(0, q) + OPEN + s.slice(q + 1, p - 1) + CLOSE + s.slice(p + 1);
        } else {
          // zaten çizgili grubun üstüne bir çizgi daha
          s = s.slice(0, q) + OPEN + s.slice(q, p) + CLOSE + s.slice(p + 1);
        }
      } else {
        s = s.slice(0, p - 1) + OPEN + prev + CLOSE + s.slice(p + 1);
      }
    }
    return esc(s)
      .replace(/\u0001/g, '<span class="ov">').replace(/\u0002/g, '</span>')
      .replace(/\^/g, ' ⊕ ').replace(/⊙/g, ' ⊙ ').replace(/\+/g, ' + ').replace(/\*/g, '·');
  }

  function ttTable(vars, outs, diff = []) {
    let h = '<div class="table-wrap"><table class="tt"><thead><tr>' + vars.map(v => `<th>${v}</th>`).join('') +
      outs.map((o, i) => `<th class="${i === 0 ? 'out' : ''}">${o.name}</th>`).join('') + '</tr></thead><tbody>';
    outs[0].rows.forEach((r, ri) => {
      h += `<tr${diff.includes(r.m) ? ' class="wrong"' : ''}>` + r.bits.map(x => `<td>${x}</td>`).join('') +
        outs.map((o, i) => `<td class="${i === 0 ? 'out ' : ''}${o.rows[ri].f ? 'one' : ''}">${o.rows[ri].f}</td>`).join('') + '</tr>';
    });
    return h + '</tbody></table></div>';
  }

  function seg(id, onChange) {
    const g = $(id); if (!g) return () => null;
    g.querySelectorAll('button').forEach(b => b.addEventListener('click', () => {
      g.querySelectorAll('button').forEach(x => x.setAttribute('aria-pressed', x === b ? 'true' : 'false'));
      if (onChange) onChange(b.dataset.v);
    }));
    return () => g.querySelector('[aria-pressed="true"]').dataset.v;
  }

  function onEnter(ids, fn) {
    ids.forEach(id => { const el = $(id); if (el) el.addEventListener('keydown', e => { if (e.key === 'Enter') fn(); }); });
  }

  /* İfadedeki değişken geçişi (literal) sayısı */
  const literalCount = e => (e.match(/[A-Za-z]/g) || []).length;

  /* Doğruluk tablosu + eşitlik aracı: id önekiyle bağlanır (ör. "tt" → tt-a, tt-b, tt-go, tt-out). */
  function bindTruthTool(prefix) {
    const L = window.Logic;
    const run = () => {
      const a = $(`${prefix}-a`).value.trim(), b = $(`${prefix}-b`).value.trim();
      const out = $(`${prefix}-out`);
      try {
        if (!b) {
          const t = L.truthTable(a);
          out.innerHTML = `<p>İfade: <span class="m">${prettyExpr(a)}</span></p>` + ttTable(t.vars, [{ name: 'F', rows: t.rows }]);
        } else {
          const e = L.equivalent(a, b);
          out.innerHTML = `<p>F₁ = <span class="m">${prettyExpr(a)}</span>, F₂ = <span class="m">${prettyExpr(b)}</span></p>` +
            ttTable(e.vars, [{ name: 'F₁', rows: e.A.rows }, { name: 'F₂', rows: e.B.rows }], e.diff) +
            (e.same
              ? `<p class="result" style="color:var(--ok)">İki ifade eşit: bütün satırlarda aynı çıkışı veriyorlar.</p>`
              : `<p class="result" style="color:var(--bad)">Eşit değil. Farklı satırlar kırmızıyla işaretli.</p>`);
        }
      } catch (ex) { out.innerHTML = err(ex.message); }
    };
    $(`${prefix}-go`).addEventListener('click', run);
    onEnter([`${prefix}-a`, `${prefix}-b`], run);
    run();
    return run;
  }

  /* Etkileşimli devre: svg içindeki [data-n] öğelerini hesaplanan değerlere göre boyar.
     inputs: ['A','B',...], compute(env) → {düğüm: 0/1}, onUpdate(values) isteğe bağlı */
  function bindCircuit(root, inputs, compute, onUpdate) {
    const env = {}; inputs.forEach(v => { env[v] = 0; });
    const pins = root.querySelector('.pins');
    const buttons = inputs.map(v => {
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'pin';
      b.addEventListener('click', () => { env[v] ^= 1; render(); });
      pins.appendChild(b);
      return [v, b];
    });
    function render() {
      const vals = Object.assign({}, env, compute(env));
      buttons.forEach(([v, b]) => {
        b.setAttribute('aria-pressed', env[v] ? 'true' : 'false');
        b.innerHTML = `<span class="pin-name">${v}</span><span class="pin-val">${env[v]}</span>`;
        b.setAttribute('aria-label', `${v} girişi: ${env[v]}. Değiştirmek için bas.`);
      });
      root.querySelectorAll('[data-n]').forEach(el => {
        const v = vals[el.dataset.n];
        el.classList.toggle('hi', v === 1);
      });
      root.querySelectorAll('[data-v]').forEach(el => { el.textContent = vals[el.dataset.v]; });
      if (onUpdate) onUpdate(vals);
    }
    render();
  }

  window.UI = { $, esc, B, err, prettyExpr, ttTable, seg, onEnter, literalCount, bindTruthTool, bindCircuit };
})();
