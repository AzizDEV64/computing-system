/* Sayı sistemleri hesap motoru.
   Tüm hesaplar tam sayı/BigInt ile yapılır; kesirli kısımlarda kayan nokta hatası olmaz. */
(function (root) {
  'use strict';

  const DIGITS = '0123456789ABCDEF';

  function digitValue(ch) {
    return DIGITS.indexOf(ch.toUpperCase());
  }

  /* "1011.101" gibi bir metni doğrular ve parçalarına ayırır. */
  function parseNumber(text, base) {
    const s = String(text).trim().toUpperCase();
    if (!s) return { error: 'Bir sayı yaz.' };
    if (!/^[0-9A-F]*\.?[0-9A-F]*$/.test(s) || s === '.') return { error: 'Sadece rakam ve en fazla bir nokta kullan.' };
    const [intPart, fracPart = ''] = s.split('.');
    for (const ch of intPart + fracPart) {
      const v = digitValue(ch);
      if (v < 0 || v >= base) return { error: `"${ch}" rakamı ${base} tabanında geçerli değil (0–${DIGITS[base - 1]}).` };
    }
    return { intPart: intPart || '0', fracPart };
  }

  /* Herhangi bir tabandan onluğa: basamak × taban^konum açılımı. */
  function toDecimal(text, base) {
    const p = parseNumber(text, base);
    if (p.error) return p;
    const terms = [];
    const n = p.intPart.length;
    let intValue = 0n;
    for (let i = 0; i < n; i++) {
      const d = digitValue(p.intPart[i]);
      const pow = n - 1 - i;
      intValue += BigInt(d) * BigInt(base) ** BigInt(pow);
      terms.push({ digit: p.intPart[i], d, pow });
    }
    // Kesir: pay / payda olarak tut
    let num = 0n, den = 1n;
    for (let i = 0; i < p.fracPart.length; i++) {
      const d = digitValue(p.fracPart[i]);
      const pow = -(i + 1);
      den = BigInt(base) ** BigInt(i + 1);
      terms.push({ digit: p.fracPart[i], d, pow });
    }
    if (p.fracPart.length) {
      for (let i = 0; i < p.fracPart.length; i++) {
        num += BigInt(digitValue(p.fracPart[i])) * BigInt(base) ** BigInt(p.fracPart.length - 1 - i);
      }
    }
    return { intValue, fracNum: num, fracDen: den, terms, text: decimalString(intValue, num, den) };
  }

  /* pay/payda kesrini onluk yazıya çevirir (en fazla 12 hane). */
  function decimalString(intValue, num, den, maxDigits = 12) {
    if (num === 0n) return intValue.toString();
    let out = intValue.toString() + '.';
    let r = num;
    for (let i = 0; i < maxDigits && r !== 0n; i++) {
      r *= 10n;
      out += (r / den).toString();
      r %= den;
    }
    if (r !== 0n) out += '…';
    return out;
  }

  /* Onluktan herhangi bir tabana: tam kısım ardışık bölme, kesir kısım ardışık çarpma. */
  function fromDecimal(text, base, maxFrac = 10) {
    const p = parseNumber(text, 10);
    if (p.error) return p;
    let q = BigInt(p.intPart);
    const divSteps = [];
    if (q === 0n) divSteps.push({ q: 0n, quotient: 0n, rem: 0 });
    while (q > 0n) {
      const quotient = q / BigInt(base);
      const rem = Number(q % BigInt(base));
      divSteps.push({ q, quotient, rem });
      q = quotient;
    }
    const intDigits = divSteps.slice().reverse().map(s => DIGITS[s.rem]).join('');

    const mulSteps = [];
    let num = p.fracPart ? BigInt(p.fracPart) : 0n;
    const den = 10n ** BigInt(p.fracPart.length);
    let fracDigits = '';
    let exact = true;
    for (let i = 0; i < maxFrac && num !== 0n; i++) {
      const before = { num, den };
      const prod = num * BigInt(base);
      const digit = Number(prod / den);
      num = prod % den;
      mulSteps.push({ before, digit, after: { num, den } });
      fracDigits += DIGITS[digit];
    }
    if (num !== 0n) exact = false;
    return {
      intDigits, fracDigits, divSteps, mulSteps, exact,
      text: intDigits + (fracDigits ? '.' + fracDigits : '')
    };
  }

  /* Kesri "0.6875" gibi yazar. */
  function fracText(num, den) {
    return decimalString(0n, num, den, 12);
  }

  /* İkili ↔ sekizli/onaltılı gruplama. */
  function groupBinary(bits, size) {
    const [i, f = ''] = bits.split('.');
    const padI = i.padStart(Math.ceil(i.length / size) * size, '0');
    const padF = f ? f.padEnd(Math.ceil(f.length / size) * size, '0') : '';
    const gi = padI.match(new RegExp(`.{${size}}`, 'g')) || ['0'.repeat(size)];
    const gf = padF ? padF.match(new RegExp(`.{${size}}`, 'g')) : [];
    const conv = g => DIGITS[parseInt(g, 2)];
    return { intGroups: gi, fracGroups: gf, intOut: gi.map(conv).join(''), fracOut: gf.map(conv).join('') };
  }

  /* Genel dönüşüm: kaynak → onluk → hedef. */
  function convert(text, from, to) {
    const dec = toDecimal(text, from);
    if (dec.error) return dec;
    const decText = dec.fracNum === 0n ? dec.intValue.toString() : decimalString(dec.intValue, dec.fracNum, dec.fracDen, 30).replace('…', '');
    if (to === 10) return { result: dec.text, dec };
    const target = fromDecimalExact(dec.intValue, dec.fracNum, dec.fracDen, to);
    return { result: target.text, dec, target, decText };
  }

  /* Tam pay/payda ile çalışan fromDecimal (kaynak tabandan gelen kesirler için). */
  function fromDecimalExact(intValue, num, den, base, maxFrac = 10) {
    let q = intValue;
    const divSteps = [];
    if (q === 0n) divSteps.push({ q: 0n, quotient: 0n, rem: 0 });
    while (q > 0n) {
      const quotient = q / BigInt(base);
      const rem = Number(q % BigInt(base));
      divSteps.push({ q, quotient, rem });
      q = quotient;
    }
    const intDigits = divSteps.slice().reverse().map(s => DIGITS[s.rem]).join('');
    const mulSteps = [];
    let fracDigits = '';
    for (let i = 0; i < maxFrac && num !== 0n; i++) {
      const before = { num, den };
      const prod = num * BigInt(base);
      const digit = Number(prod / den);
      num = prod % den;
      mulSteps.push({ before, digit, after: { num, den } });
      fracDigits += DIGITS[digit];
    }
    return { intDigits, fracDigits, divSteps, mulSteps, exact: num === 0n, text: intDigits + (fracDigits ? '.' + fracDigits : '') };
  }

  /* ---------- Tümleyenler ---------- */

  /* (r−1)'e tümleyen: her basamak (r−1) − d */
  function diminishedComplement(digits, base) {
    return digits.toUpperCase().split('').map(ch => DIGITS[base - 1 - digitValue(ch)]).join('');
  }

  /* Aynı uzunluktaki iki basamak dizisini r tabanında toplar. */
  function addDigits(a, b, base) {
    const n = Math.max(a.length, b.length);
    a = a.padStart(n, '0'); b = b.padStart(n, '0');
    let carry = 0; let out = '';
    const carries = new Array(n + 1).fill(0);
    for (let i = n - 1; i >= 0; i--) {
      const s = digitValue(a[i]) + digitValue(b[i]) + carry;
      out = DIGITS[s % base] + out;
      carry = Math.floor(s / base);
      carries[i] = carry; // i. basamaktan sola çıkan elde
    }
    return { sum: out, carryOut: carry, carries };
  }

  /* r'ye tümleyen: (r−1)'e tümleyen + 1, n basamakta (taşan elde atılır). */
  function radixComplement(digits, base) {
    const dim = diminishedComplement(digits, base);
    const one = '1'.padStart(dim.length, '0');
    const r = addDigits(dim, one, base);
    return { dim, result: r.sum };
  }

  /* 2'ye tümleyen kısayolu: sağdan ilk 1'e kadar (dahil) aynen yaz, sonrasını ters çevir. */
  function twosShortcut(bits) {
    const idx = bits.lastIndexOf('1');
    if (idx < 0) return { keep: bits, flipPart: '', result: bits, idx };
    const left = bits.slice(0, idx);
    const keep = bits.slice(idx);
    const flipped = left.split('').map(b => (b === '0' ? '1' : '0')).join('');
    return { left, keep, flipped, result: flipped + keep, idx };
  }

  /* Tümleyen yöntemiyle çıkarma: M − N.
     method: 'r' (2'ye / 10'a tümleyen) veya 'r-1' (1'e / 9'a tümleyen) */
  function subtract(M, N, base, method) {
    M = String(M).trim().toUpperCase(); N = String(N).trim().toUpperCase();
    for (const [name, v] of [['M', M], ['N', N]]) {
      const p = parseNumber(v, base);
      if (p.error) return { error: `${name}: ${p.error}` };
      if (v.includes('.')) return { error: 'Bu araç tam sayılarla çalışır.' };
    }
    const n = Math.max(M.length, N.length);
    const Mp = M.padStart(n, '0'), Np = N.padStart(n, '0');
    let comp, compInfo;
    if (method === 'r') { compInfo = radixComplement(Np, base); comp = compInfo.result; }
    else { comp = diminishedComplement(Np, base); }
    const add = addDigits(Mp, comp, base);
    const steps = { n, Mp, Np, comp, compInfo, add, method, base };
    const mValue = parseInt(M, base), nValue = parseInt(N, base);
    if (method === 'r' && /^0+$/.test(Np)) {
      // 0'ın r'ye tümleyeni rⁿ'dir; elde tümleyen adımında taşar. Sonuç M'nin kendisi.
      steps.zeroN = true;
      steps.sign = '+';
      steps.result = Mp;
      steps.note = 'zero';
      steps.check = { mVal: mValue, nVal: nValue, diff: mValue - nValue };
      return steps;
    }
    if (add.carryOut === 1) {
      if (method === 'r') {
        steps.sign = '+';
        steps.result = add.sum;
        steps.note = 'discard';
      } else {
        const one = '1'.padStart(n, '0');
        const ea = addDigits(add.sum, one, base);
        steps.endAround = ea;
        steps.sign = '+';
        steps.result = ea.sum;
        steps.note = 'end-around';
      }
    } else {
      steps.sign = '−';
      steps.rawSum = add.sum;
      if (method === 'r') steps.result = radixComplement(add.sum, base).result;
      else steps.result = diminishedComplement(add.sum, base);
      steps.note = 'negative';
    }
    const mVal = parseInt(M, base), nVal = parseInt(N, base);
    steps.check = { mVal, nVal, diff: mVal - nVal };
    return steps;
  }

  /* ---------- Kodlar ---------- */

  const CODE_TABLES = {
    bcd: ['0000', '0001', '0010', '0011', '0100', '0101', '0110', '0111', '1000', '1001'],
    excess3: ['0011', '0100', '0101', '0110', '0111', '1000', '1001', '1010', '1011', '1100'],
    c2421: ['0000', '0001', '0010', '0011', '0100', '1011', '1100', '1101', '1110', '1111'],
    c84m2m1: ['0000', '0111', '0110', '0101', '0100', '1011', '1010', '1001', '1000', '1111']
  };

  function encodeDecimal(text, table) {
    const s = String(text).trim();
    if (!/^\d+$/.test(s)) return { error: 'Sadece onluk rakamlar (0–9) yaz.' };
    return { groups: s.split('').map(ch => ({ digit: ch, code: CODE_TABLES[table][+ch] })) };
  }

  /* Verilen ağırlıklarla (ör. [4,8,1,2]) bir rakamın kodunu bulur. */
  function weightedEncode(digit, weights) {
    const n = weights.length;
    for (let m = 0; m < (1 << n); m++) {
      let sum = 0; let bits = '';
      for (let i = 0; i < n; i++) {
        const b = (m >> (n - 1 - i)) & 1;
        bits += b; sum += b * weights[i];
      }
      if (sum === digit) return bits;
    }
    return null;
  }

  function binToGray(bits) {
    const steps = [];
    let g = bits[0];
    steps.push({ i: 0, text: `g₀ = b₀ = ${bits[0]}` });
    for (let i = 1; i < bits.length; i++) {
      const v = bits[i - 1] === bits[i] ? '0' : '1';
      g += v;
      steps.push({ i, a: bits[i - 1], b: bits[i], v });
    }
    return { result: g, steps };
  }

  function grayToBin(gray) {
    let b = gray[0];
    const steps = [{ i: 0, v: gray[0] }];
    for (let i = 1; i < gray.length; i++) {
      const v = b[i - 1] === gray[i] ? '0' : '1';
      b += v;
      steps.push({ i, a: b[i - 1], g: gray[i], v });
    }
    return { result: b, steps };
  }

  const api = {
    DIGITS, digitValue, parseNumber, toDecimal, fromDecimal, fromDecimalExact, convert, groupBinary,
    decimalString, fracText, diminishedComplement, radixComplement, twosShortcut, addDigits,
    subtract, CODE_TABLES, encodeDecimal, weightedEncode, binToGray, grayToBin
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.NumSys = api;
})(typeof window !== 'undefined' ? window : globalThis);
