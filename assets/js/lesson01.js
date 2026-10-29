/* Ders 1 etkileşimli araçları */
(function () {
  'use strict';
  const N = window.NumSys, L = window.Logic;
  const $ = id => document.getElementById(id);
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const B = s => `<span class="b">${esc(s)}</span>`;
  const SUP = { '-': '⁻', '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴', '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹' };
  const sup = n => String(n).split('').map(c => SUP[c] || c).join('');

  /* Alt alta işlem bloğu. rows: [{l, v, c, cls}] ya da 'hr' */
  function calc(rows) {
    return '<div class="calc">' + rows.map(r => r === 'hr' ? '<hr>' :
      `<span class="l">${r.l || ''}</span><span class="v${r.cls ? ' ' + r.cls : ''}">${r.raw ? r.v : esc(r.v)}</span><span class="c">${r.c ? esc(r.c) : ''}</span>`
    ).join('') + '</div>';
  }
  const err = msg => `<p class="err">${esc(msg)}</p>`;

  /* Bölme merdiveni (elle yazılan biçim): her adımda bölüm bir sağ-alta iner, kalan altına yazılır.
     steps: [{q, quotient, rem}] (sayı ya da BigInt) */
  function ladder(steps, base) {
    const D = '0123456789ABCDEF';
    const cell = (row, col, cls, html) => `<span class="${cls}" style="grid-row:${row};grid-column:${col}">${html}</span>`;
    let h = cell(1, 1, 'ld-n', esc(String(steps[0].q)));
    steps.forEach((s, k) => {
      const used = BigInt(s.q) - BigInt(s.rem);
      h += cell(k + 1, k + 2, 'ld-dv', base);
      h += cell(k + 2, k + 1, 'ld-sub', '−' + used);
      h += cell(k + 2, k + 2, 'ld-n ld-qt', esc(String(s.quotient)));
      h += cell(k + 3, k + 1, 'ld-rem', D[s.rem] + (s.rem > 9 ? `<small>(${s.rem})</small>` : ''));
    });
    const digits = steps.slice().reverse().map(s => D[s.rem]).join('');
    return `<div class="ladder-wrap"><div class="ladder" role="img" aria-label="${esc(String(steps[0].q))} sayısının ${base}'ye ardışık bölünmesi, kalanlar sırayla ${steps.map(s => D[s.rem]).join(', ')}">${h}</div></div>`;
  }
  function ladderSteps(n, base) {
    const steps = []; let q = BigInt(n); const b = BigInt(base);
    if (q === 0n) return [{ q: 0n, quotient: 0n, rem: 0 }];
    while (q > 0n) { steps.push({ q, quotient: q / b, rem: Number(q % b) }); q = q / b; }
    return steps;
  }
  function renderLadders() {
    document.querySelectorAll('[data-ladder]').forEach(el => {
      const [n, base] = el.dataset.ladder.split('/').map(Number);
      el.innerHTML = ladder(ladderSteps(n, base), base);
    });
  }

  /* Segmentli düğme grupları */
  function seg(id, onChange) {
    const g = $(id); if (!g) return () => null;
    g.querySelectorAll('button').forEach(b => b.addEventListener('click', () => {
      g.querySelectorAll('button').forEach(x => x.setAttribute('aria-pressed', x === b ? 'true' : 'false'));
      if (onChange) onChange(b.dataset.v);
    }));
    return () => g.querySelector('[aria-pressed="true"]').dataset.v;
  }
  function onEnter(inputIds, fn) {
    inputIds.forEach(id => { const el = $(id); if (el) el.addEventListener('keydown', e => { if (e.key === 'Enter') fn(); }); });
  }

  /* ================= Taban dönüştürücü ================= */
  const BASE_NAME = { 2: 'ikili', 8: 'sekizli', 10: 'onluk', 16: 'onaltılı' };
  function runConv() {
    const text = $('conv-in').value.trim();
    const from = +$('conv-from').value, to = +$('conv-to').value;
    const out = $('conv-out');
    const r = N.convert(text, from, to);
    if (r.error) { out.innerHTML = err(r.error); return; }
    let h = '';
    if (from === to) { out.innerHTML = `<p>Kaynak ve hedef taban aynı. Sayı değişmez: ${B(text.toUpperCase())}</p>`; return; }

    // Gruplama kısayolu
    const groupSize = { 8: 3, 16: 4 };
    if (from === 2 && groupSize[to]) {
      const g = N.groupBinary(text.replace(/^0+(?=\d)/, '') || '0', groupSize[to]);
      h += `<h4>Kısayol: ${groupSize[to]}'erli gruplama</h4>
        <p>${B(g.intGroups.join(' ') + (g.fracGroups.length ? ' . ' + g.fracGroups.join(' ') : ''))} → ${B(g.intOut.split('').join(' ') + (g.fracOut ? ' . ' + g.fracOut.split('').join(' ') : ''))}</p>`;
    } else if (to === 2 && groupSize[from]) {
      const size = groupSize[from];
      const p = N.parseNumber(text, from);
      const open = s => s.split('').map(ch => N.digitValue(ch).toString(2).padStart(size, '0')).join(' ');
      h += `<h4>Kısayol: her rakamı ${size} bite aç</h4>
        <p>${B(p.intPart.split('').join(' ') + (p.fracPart ? ' . ' + p.fracPart.split('').join(' ') : ''))} → ${B(open(p.intPart) + (p.fracPart ? ' . ' + open(p.fracPart) : ''))}</p>
        <p class="hint">Baştaki ve sondaki gereksiz sıfırları atabilirsin.</p>`;
    }

    // Adım 1: onluğa açılım
    if (from !== 10) {
      const terms = r.dec.terms.filter(t => t.d !== 0);
      const shown = terms.length ? terms.map(t => `${t.d}×${from}${sup(t.pow)}`).join(' + ') : '0';
      h += `<h4>${to === 10 ? 'Onluğa çevir' : 'Adım 1: önce onluğa çevir'}</h4>
        <p>Sıfır olmayan her rakamı basamak ağırlığıyla çarp ve topla:</p>
        <p class="m" style="white-space:normal">${esc(shown)} = <b>${esc(r.dec.text)}</b></p>`;
    }
    if (to !== 10) {
      const t = r.target;
      const step = from !== 10 ? 'Adım 2: ' : '';
      h += `<h4>${step}Tam kısım: sürekli ${to}'ye böl</h4>
        ${t.divSteps.length <= 12 ? ladder(t.divSteps, to) : `<div class="table-wrap"><table class="data"><thead><tr><th>İşlem</th><th>Bölüm</th><th>Kalan</th></tr></thead><tbody>
        ${t.divSteps.map(s => `<tr><td>${s.q} ÷ ${to}</td><td>${s.quotient}</td><td class="b">${N.DIGITS[s.rem]}${s.rem > 9 ? ` <small>(${s.rem})</small>` : ''}</td></tr>`).join('')}
        </tbody></table></div>`}
        <p>Bölüm 0 olunca dur. Kalanları <b>sondan başa</b> (sağ alttan sol üste) oku: ${B(t.intDigits)}</p>`;
      if (t.mulSteps.length) {
        h += `<h4>Kesir kısım: sürekli ${to} ile çarp</h4>
          <div class="table-wrap"><table class="data"><thead><tr><th>İşlem</th><th>Sonuç</th><th>Basamak</th></tr></thead><tbody>
          ${t.mulSteps.map(s => {
            const before = N.fracText(s.before.num, s.before.den);
            const after = s.after.num === 0n ? '.0' : N.fracText(s.after.num, s.after.den).slice(1);
            return `<tr><td>${before} × ${to}</td><td>${s.digit}${after}</td><td class="b">${N.DIGITS[s.digit]}${s.digit > 9 ? ` <small>(${s.digit})</small>` : ''}</td></tr>`;
          }).join('')}
          </tbody></table></div>
          <p>Basamakları yukarıdan aşağı oku: ${B('.' + t.fracDigits)}</p>`;
        if (!t.exact) h += `<p class="hint">Kesir bitmiyor. İlk ${t.fracDigits.length} basamakta kestik.</p>`;
      }
    }
    h += `<p class="result">(${esc(text.toUpperCase())})<sub>${from}</sub> = ${B(r.result)}<sub>${to}</sub>${r.target && !r.target.exact ? ' …' : ''}</p>`;
    out.innerHTML = h;
  }

  /* ================= Tümleyen hesaplayıcı ================= */
  const compBase = () => '2'; // sadece ikili (hoca onluk tümleyen kullanmıyor)
  function runComp() {
    const base = +compBase();
    const s = $('comp-in').value.trim().toUpperCase();
    const out = $('comp-out');
    const re = base === 2 ? /^[01]+$/ : /^[0-9]+$/;
    if (!re.test(s)) { out.innerHTML = err(base === 2 ? 'Sadece 0 ve 1 yaz.' : 'Sadece 0–9 rakamları yaz.'); return; }
    const n = s.length;
    const dim = N.diminishedComplement(s, base);
    const rad = N.radixComplement(s, base);
    let h = '';
    if (base === 2) {
      const sc = N.twosShortcut(s);
      const val = parseInt(s, 2);
      const twosVal = parseInt(rad.result, 2);
      h += `<h4>1's complement</h4>` + calc([{ v: s, c: 'sayı' }, { v: dim, c: 'her bit ters çevrildi' }]);
      h += `<h4>2's complement (uzun yol)</h4>` + calc([{ v: dim, c: "1's complement" }, { l: '+', v: '1', c: '1 ekle' }, 'hr', { v: rad.result, c: "2's complement" }]);
      if (sc.idx >= 0) {
        h += `<h4>2's complement (kısayol)</h4>
          <p>Sağdan ilk 1'e kadar olan ${B(sc.keep)} aynen kalır.${sc.left ? ` Soldaki ${B(sc.left)} ters çevrilir ve ${B(sc.flipped)} olur.` : ' Solda ters çevrilecek bit kalmadı.'} Sonuç ${B(sc.result)}.</p>`;
      } else {
        h += `<p>Sayı sıfır. 2's complement'i de sıfırdır, taşan elde atılır.</p>`;
      }
      h += `<p class="hint">Kontrol (${n} bit): N = ${val}, 2${sup(n)} − N = ${2 ** n} − ${val} = ${(2 ** n - val) % (2 ** n)}, ve ${rad.result} = ${twosVal}.</p>`;
      h += `<p class="result">1's: ${B(dim)} &nbsp; 2's: ${B(rad.result)}</p>`;
    } else {
      h += `<h4>9's complement: her rakamı 9'dan çıkar</h4>
        <p>${s.split('').map(d => `9−${d}=${9 - d}`).join(', ')} → ${B(dim)}</p>`;
      h += `<h4>10's complement: 9's complement + 1</h4>` + calc([{ v: dim, c: "9's complement" }, { l: '+', v: '1' }, 'hr', { v: rad.result, c: "10's complement" }]);
      h += `<p class="hint">Kontrol (${n} basamak): 10${sup(n)} − ${s.replace(/^0+(?=\d)/, '')} = ${(10n ** BigInt(n) - BigInt(s)) % (10n ** BigInt(n))}</p>`;
      h += `<p class="result">9's: ${B(dim)} &nbsp; 10's: ${B(rad.result)}</p>`;
    }
    out.innerHTML = h;
  }

  /* ================= Toplayarak çıkarma ================= */
  const subBase = () => '2'; // sadece ikili
  const subMethod = seg('sub-method', () => runSub());
  function subStepsHTML(M, Nn, base, method) {
    const s = N.subtract(M, Nn, base, method);
    if (s.error) return err(s.error);
    const r = method === 'r' ? (base === 2 ? "2's" : "10's") : (base === 2 ? "1's" : "9's");
    if (s.zeroN) {
      return `<p>N = 0 özel bir durum. 0'ın ${r} complement'i hesaplanırken (${(base === 2 ? '1' : '9').repeat(s.n)} + 1) elde taşar ve atılır, tümleyen yine ${B(s.Np)} olur. Yani M'ye 0 eklenir: sonuç M'nin kendisi.</p>
        <p class="result">Sonuç: ${B('+' + s.result)}${base === 2 ? ` = ${parseInt(s.result, 2)}` : ''}</p>
        <p class="hint">Kontrol: ${s.check.mVal} − 0 = ${s.check.diff} ✓</p>`;
    }
    let h = '<ol class="steps">';
    if (M.length !== Nn.length) h += `<li>Basamak sayısını eşitle: M = ${B(s.Mp)}, N = ${B(s.Np)}.</li>`;
    else h += `<li>Basamak sayıları eşit (${s.n}).</li>`;
    if (method === 'r') h += `<li>N'nin ${r} complement'i: önce ${base === 2 ? 'bitleri ters çevir' : "her rakamı 9'dan çıkar"} → ${B(s.compInfo.dim)}, sonra +1 → ${B(s.comp)}.</li>`;
    else h += `<li>N'nin ${r} complement'i: ${base === 2 ? 'bitleri ters çevir' : "her rakamı 9'dan çıkar"} → ${B(s.comp)}.</li>`;
    h += `<li>M ile topla:</li></ol>`;
    const carryStr = s.add.carries.slice(0, s.n).map((c, i) => c ? '1' : ' ').join('') + ' ';
    const carryShown = base === 2 && /1/.test(carryStr);
    const rows = [];
    if (carryShown) rows.push({ v: carryStr.slice(1).replace(/1/g, 'c'), cls: 'carry', c: 'elde (c)' });
    rows.push({ v: s.Mp, c: 'M' }, { l: '+', v: s.comp, c: `N'nin ${r} complement'i` }, 'hr');
    if (s.add.carryOut) {
      if (method === 'r') {
        rows.push({ raw: true, v: `<span class="strike">1</span><span class="dbl">${esc(s.add.sum)}</span>`, c: "OF: taşan 1'i üstünü çizerek at" });
      } else {
        rows.push({ raw: true, v: `<span class="circ hl">1</span>${esc(s.add.sum)}`, c: 'OF (overflow bit)' });
        rows.push({ l: '+', v: '1', c: "Move: OF'u en sağa ekle (end-around carry)" }, 'hr', { raw: true, v: `<span class="dbl">${esc(s.result)}</span>`, c: 'sonuç' });
      }
    } else {
      rows.push({ v: s.add.sum, c: '' }, { v: '↑' + ' '.repeat(s.add.sum.length - 1), c: 'en solda elde taşmadı (OF yok)' });
    }
    h += calc(rows);
    h += '<ol class="steps" start="4">';
    if (s.add.carryOut) {
      h += `<li>Elde taştı, yani sonuç <b>pozitif</b>${method === 'r' ? ' ve taşan elde atılır' : ' ve elde en sağa eklenir'}.</li>`;
    } else {
      h += `<li>Elde taşmadı, yani sonuç <b>negatif</b>. Toplamın ${r} complement'ini al: ${B(s.rawSum)} → ${B(s.result)}. Başına eksi koy.</li>`;
    }
    h += '</ol>';
    const resultVal = (s.sign === '−' ? -1 : 1) * parseInt(s.result, base);
    h += `<p class="result">Sonuç: ${B((s.sign === '−' ? '−' : '+') + s.result)}${base === 2 ? ` = ${resultVal}` : ''}</p>`;
    h += `<p class="hint">Kontrol: ${s.check.mVal} − ${s.check.nVal} = ${s.check.diff}${s.check.diff === resultVal ? ' ✓' : ' ✗'}</p>`;
    return h;
  }
  function runSub() {
    const base = +subBase(), method = subMethod();
    const M = $('sub-m').value.trim().toUpperCase(), Nn = $('sub-n').value.trim().toUpperCase();
    const re = base === 2 ? /^[01]+$/ : /^[0-9]+$/;
    if (!re.test(M) || !re.test(Nn)) { $('sub-out').innerHTML = err(base === 2 ? 'M ve N sadece 0 ve 1 içermeli.' : 'M ve N sadece 0–9 rakamları içermeli.'); return; }
    $('sub-out').innerHTML = subStepsHTML(M, Nn, base, method);
  }

  /* ================= Kodlar ================= */
  function fillCodeTable() {
    const tb = $('code-table'); if (!tb) return;
    const T = N.CODE_TABLES;
    tb.innerHTML = [...Array(10).keys()].map(d =>
      `<tr><td>${d}</td><td class="b">${T.bcd[d]}</td><td class="b">${N.weightedEncode(d, [4, 8, 1, 2])}</td></tr>`
    ).join('');
  }
  function parseWeights(text) {
    const t = text.trim();
    if (!t) return null;
    let parts = /[\s,;]/.test(t) ? t.split(/[\s,;]+/) : (/^\d+$/.test(t) ? t.split('') : [t]);
    const w = parts.map(Number);
    if (w.some(x => !Number.isInteger(x)) || w.length < 2 || w.length > 6) return { error: 'Ağırlıkları boşlukla ayırarak yaz, ör. 4 8 1 2.' };
    return w;
  }
  function runCodes() {
    const s = $('codes-in').value.trim();
    const out = $('codes-out');
    if (!/^\d+$/.test(s)) { out.innerHTML = err('Sadece onluk rakamlar (0–9) yaz.'); return; }
    const w = parseWeights($('codes-w').value);
    if (w && w.error) { out.innerHTML = err(w.error); return; }
    const T = N.CODE_TABLES;
    const digits = s.split('').map(Number);
    const custom = w ? digits.map(d => N.weightedEncode(d, w)) : null;
    let h = `<div class="table-wrap"><table class="data"><thead><tr><th>Rakam</th><th>BCD</th>${w ? `<th>${esc(w.join(' '))}</th>` : ''}</tr></thead><tbody>`;
    digits.forEach((d, i) => {
      h += `<tr><td>${d}</td><td class="b">${T.bcd[d]}</td>${w ? `<td class="b">${custom[i] || '—'}</td>` : ''}</tr>`;
    });
    h += '</tbody></table></div>';
    h += `<p class="result">BCD: ${B(digits.map(d => T.bcd[d]).join(' '))}</p>`;
    if (w) {
      h += custom.every(Boolean)
        ? `<p>${esc(w.join(' '))} kodu: ${B(custom.join(' '))}</p>`
        : `<p class="err">Bazı rakamlar bu ağırlıklarla yazılamıyor (— ile gösterildi).</p>`;
      h += `<p class="hint">Bir rakam bu ağırlıklarla birden fazla şekilde yazılabiliyorsa ilk bulunan gösterilir.</p>`;
    }
    h += `<p>Karşılaştırma için sayının düz ikilisi: ${B(BigInt(s).toString(2))} (${BigInt(s).toString(2).length} bit), BCD ise ${digits.length * 4} bit.</p>`;
    out.innerHTML = h;
  }

  /* ================= Doğruluk tablosu ================= */
  function runTT() {
    const a = $('tt-a').value.trim(), b = $('tt-b').value.trim();
    const out = $('tt-out');
    try {
      if (!b) {
        const t = L.truthTable(a);
        out.innerHTML = ttTable(t.vars, [{ name: 'F', rows: t.rows }]) +
          `<p><b>Çarpımlar toplamı (1 olan satırlardan):</b> <span class="m" style="white-space:normal">${sopHTML(L.canonicalSOP(t))}</span></p>`;
      } else {
        const e = L.equivalent(a, b);
        out.innerHTML = ttTable(e.vars, [{ name: 'F₁', rows: e.A.rows }, { name: 'F₂', rows: e.B.rows }], e.diff) +
          (e.same
            ? `<p class="result" style="color:var(--ok)">İki ifade eşit: bütün satırlarda aynı çıkışı veriyorlar.</p>`
            : `<p class="result" style="color:var(--bad)">Eşit değil. Farklı satırlar kırmızıyla işaretli.</p>`);
      }
    } catch (ex) {
      out.innerHTML = err(ex.message);
    }
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
  /* "A'B + AB'" → üstü çizgili gösterim */
  function sopHTML(sop) {
    return esc(sop).replace(/([A-Z])'/g, '<span class="ov">$1</span>');
  }

  /* ================= Test ================= */
  const rnd = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
  const randBits = n => { let s = '1'; for (let i = 1; i < n; i++) s += rnd(0, 1); return s; };
  const randBitsAny = n => { let s = ''; for (let i = 0; i < n; i++) s += rnd(0, 1); return s; };
  const clean = s => String(s).trim().toUpperCase().replace(/\s+/g, '').replace(/[−–—]/g, '-');
  const binEq = (ans, expected, len) => {
    const a = clean(ans);
    if (!/^[01]+$/.test(a)) return false;
    if (len) return a.length <= len && a.padStart(len, '0') === expected;
    return parseInt(a, 2) === parseInt(expected, 2);
  };

  const LOGIC_POOL = ["A+BC", "(A'(B^C))'", "AB+A'B", "A'B+C", "(A+B)'", "(AB)'+C", "A^B^C", "(A+B)(A'+C)", "AB'+A'B", "(A+(BC)')'+(AC')'"];
  const prettyExpr = e => window.UI.prettyExpr(e);

  const GEN = {
    b2d() {
      const b = randBits(rnd(5, 8)); const v = parseInt(b, 2);
      return { q: `${B(b)}₂ sayısı onlukta kaçtır?`, check: a => clean(a) === String(v), ans: String(v),
        why: `1 olan bitlerin ağırlıkları: ${b.split('').map((c, i) => c === '1' ? 2 ** (b.length - 1 - i) : null).filter(x => x !== null).join(' + ')} = ${v}` };
    },
    d2b() {
      const v = rnd(10, 255); const b = v.toString(2);
      return { q: `${v} sayısını ikiliye çevir.`, check: a => binEq(a, b), ans: b, why: `Sürekli 2'ye böl, kalanları aşağıdan yukarı oku. Kontrol: ${b.split('').map((c, i) => c === '1' ? 2 ** (b.length - 1 - i) : null).filter(x => x !== null).join(' + ')} = ${v}` };
    },
    b2h() {
      const b = randBits(rnd(8, 12)); const v = parseInt(b, 2); const h = v.toString(16).toUpperCase();
      const g = N.groupBinary(b, 4);
      return { q: `${B(b)}₂ sayısını onaltılıya çevir.`, check: a => { const x = clean(a).replace(/^0X/, ''); return /^[0-9A-F]+$/.test(x) && parseInt(x, 16) === v; }, ans: h, why: `Sağdan 4'erli grupla: ${g.intGroups.join(' ')} → ${g.intOut}` };
    },
    ones() {
      const n = rnd(6, 8), b = randBitsAny(n), r = N.diminishedComplement(b, 2);
      return { q: `${n} bitlik ${B(b)} sayısının 1's complement'i nedir?`, check: a => binEq(a, r, n), ans: r, why: 'Her biti ters çevir.' };
    },
    twos() {
      let b; const n = rnd(6, 8); do { b = randBitsAny(n); } while (!/1/.test(b));
      const r = N.radixComplement(b, 2).result; const sc = N.twosShortcut(b);
      return { q: `${n} bitlik ${B(b)} sayısının 2's complement'i nedir?`, check: a => binEq(a, r, n), ans: r,
        why: `1's complement ${N.diminishedComplement(b, 2)}, +1 → ${r}. Kısayol: sağdaki ${sc.keep} aynen kalır, ${sc.left || '(boş)'} ters çevrilir.` };
    },
    sub(method) {
      const n = rnd(4, 6); let M, Nn;
      do { M = randBitsAny(n); Nn = randBitsAny(n); } while (M === Nn);
      const s = N.subtract(M, Nn, 2, method); const val = parseInt(M, 2) - parseInt(Nn, 2);
      const name = method === 'r' ? "2's" : "1's";
      return {
        q: `${B(M)} − ${B(Nn)} işlemini ${name} complement ile yap. Cevabı işaretli ikili olarak yaz (ör. −0101 ya da 0011).`,
        check: a => { const x = clean(a); const m = /^([+-]?)([01]+)$/.exec(x); if (!m) return false; return (m[1] === '-' ? -1 : 1) * parseInt(m[2], 2) === val; },
        ans: (s.sign === '−' ? '−' : '') + s.result, whyHTML: subStepsHTML(M, Nn, 2, method)
      };
    },
    sub2() { return GEN.sub('r'); },
    sub1() { return GEN.sub('r-1'); },
    bcd() {
      const v = rnd(10, 999); const code = String(v).split('').map(d => N.CODE_TABLES.bcd[+d]);
      return { q: `${v} sayısını BCD (8421) ile yaz. Her rakam 4 bit.`, check: a => clean(a) === code.join(''), ans: code.join(' '), why: String(v).split('').map((d, i) => `${d} → ${code[i]}`).join(', ') };
    },
    gray() {
      const n = rnd(2, 3), k = rnd(0, (1 << n) - 1);
      const list = [...Array(1 << n).keys()].map(x => N.binToGray(x.toString(2).padStart(n, '0')).result);
      return { q: `${n} bitlik Gray kodunda ${k} sayısının karşılığı nedir? (Yansıtma yöntemiyle listeyi yaz.)`, check: a => binEq(a, list[k], n), ans: list[k], why: `Yansıtma ile liste: ${list.join(', ')}. 0'dan saymaya başla, ${k}. sıradaki kod.` };
    },
    logic() {
      const e = LOGIC_POOL[rnd(0, LOGIC_POOL.length - 1)];
      const tree = L.parse(e); const vars = [...L.variables(tree)].sort();
      const env = {}; vars.forEach(v => { env[v] = Math.random() < 0.5; });
      const f = L.evaluate(tree, env) ? '1' : '0';
      return { q: `<span class="m">F = ${prettyExpr(e)}</span> için ${vars.map(v => `${v} = ${env[v] ? 1 : 0}`).join(', ')} iken F kaçtır?`,
        check: a => clean(a) === f, ans: f, why: 'Değerleri yerine koy. Önce parantez, sonra NOT, sonra AND, en son OR. Aracı kullanarak tablonun tamamını görebilirsin.' };
    }
  };

  let current = null, score = 0, total = 0, answered = false;
  function newQuestion() {
    const topic = $('quiz-topic').value;
    const keys = Object.keys(GEN).filter(k => k !== 'sub');
    const k = topic === 'all' ? keys[rnd(0, keys.length - 1)] : topic;
    current = GEN[k]();
    answered = false;
    $('quiz-q').innerHTML = current.q;
    $('quiz-ans').value = '';
    $('quiz-fb').innerHTML = '';
  }
  function checkAnswer() {
    if (!current) return;
    const a = $('quiz-ans').value;
    if (!a.trim()) { $('quiz-fb').innerHTML = `<div class="feedback no">Önce bir cevap yaz.</div>`; return; }
    const ok = current.check(a);
    if (!answered) { total++; if (ok) score++; answered = true; }
    $('quiz-score').textContent = `${score} / ${total} doğru`;
    const why = current.whyHTML ? current.whyHTML : `<p>${esc(current.why)}</p>`;
    $('quiz-fb').innerHTML = ok
      ? `<div class="feedback ok"><b>Doğru!</b> Cevap: ${B(current.ans)}</div>`
      : `<div class="feedback no"><b>Olmadı.</b> Doğru cevap: ${B(current.ans)}<div class="why">${why}</div></div>`;
  }

  /* ================= Başlat ================= */
  document.addEventListener('DOMContentLoaded', () => {
    renderLadders();
    fillCodeTable();
    $('conv-go').addEventListener('click', runConv); onEnter(['conv-in'], runConv);
    $('conv-from').addEventListener('change', runConv); $('conv-to').addEventListener('change', runConv);
    $('comp-go').addEventListener('click', runComp); onEnter(['comp-in'], runComp);
    $('sub-go').addEventListener('click', runSub); onEnter(['sub-m', 'sub-n'], runSub);
    $('codes-go').addEventListener('click', runCodes); onEnter(['codes-in', 'codes-w'], runCodes);
    $('tt-go').addEventListener('click', runTT); onEnter(['tt-a', 'tt-b'], runTT);
    $('quiz-new').addEventListener('click', newQuestion);
    $('quiz-topic').addEventListener('change', newQuestion);
    $('quiz-check').addEventListener('click', checkAnswer); onEnter(['quiz-ans'], checkAnswer);
    runConv(); runComp(); runSub(); runCodes(); runTT(); newQuestion();
  });
})();
