/* Boole ifadesi çözümleyici ve doğruluk tablosu üreteci.
   Öncelik (yüksekten düşüğe): NOT  >  AND  >  XOR / XNOR  >  OR
   Yazım: A' veya !A veya ~A (DEĞİL), AB veya A·B veya A*B veya A&B (VE),
          A+B veya A|B (VEYA), A^B veya A⊕B (XOR), A⊙B (XNOR), 0 ve 1 sabitleri. */
(function (root) {
  'use strict';

  function tokenize(src) {
    const tokens = [];
    const s = src.replace(/\s+/g, '');
    for (let i = 0; i < s.length; i++) {
      const c = s[i];
      if (/[A-Za-z]/.test(c)) tokens.push({ t: 'var', v: c.toUpperCase() });
      else if (c === '0' || c === '1') tokens.push({ t: 'const', v: c === '1' });
      else if (c === "'" || c === '’' || c === '′') tokens.push({ t: 'post' });
      else if (c === '!' || c === '~' || c === '¬') tokens.push({ t: 'not' });
      else if (c === '+' || c === '|') tokens.push({ t: 'or' });
      else if (c === '·' || c === '*' || c === '&' || c === '.' || c === '•') tokens.push({ t: 'and' });
      else if (c === '^' || c === '⊕') tokens.push({ t: 'xor' });
      else if (c === '⊙') tokens.push({ t: 'xnor' });
      else if (c === '(' || c === '[') tokens.push({ t: '(' });
      else if (c === ')' || c === ']') tokens.push({ t: ')' });
      else throw new Error(`Tanınmayan karakter: "${c}"`);
    }
    return tokens;
  }

  function parse(src) {
    const tokens = tokenize(src);
    if (!tokens.length) throw new Error('Bir ifade yaz.');
    let pos = 0;
    const peek = () => tokens[pos];
    const eat = t => {
      if (!tokens[pos] || tokens[pos].t !== t) throw new Error(t === ')' ? 'Kapanmayan parantez var.' : 'İfade eksik ya da hatalı.');
      return tokens[pos++];
    };

    function parseOr() {
      let node = parseXor();
      while (peek() && peek().t === 'or') { pos++; node = { op: 'or', a: node, b: parseXor() }; }
      return node;
    }
    function parseXor() {
      let node = parseAnd();
      while (peek() && (peek().t === 'xor' || peek().t === 'xnor')) {
        const op = tokens[pos++].t;
        node = { op, a: node, b: parseAnd() };
      }
      return node;
    }
    function startsFactor(tok) {
      return tok && (tok.t === 'var' || tok.t === 'const' || tok.t === '(' || tok.t === 'not');
    }
    function parseAnd() {
      let node = parseUnary();
      while (peek() && (peek().t === 'and' || startsFactor(peek()))) {
        if (peek().t === 'and') pos++;
        node = { op: 'and', a: node, b: parseUnary() };
      }
      return node;
    }
    function parseUnary() {
      if (peek() && peek().t === 'not') { pos++; return { op: 'not', a: parseUnary() }; }
      let node = parsePrimary();
      while (peek() && peek().t === 'post') { pos++; node = { op: 'not', a: node }; }
      return node;
    }
    function parsePrimary() {
      const tok = peek();
      if (!tok) throw new Error('İfade yarım kaldı.');
      if (tok.t === 'var') { pos++; return { op: 'var', v: tok.v }; }
      if (tok.t === 'const') { pos++; return { op: 'const', v: tok.v }; }
      if (tok.t === '(') { pos++; const n = parseOr(); eat(')'); return n; }
      throw new Error('Beklenmeyen işaret: bir değişken ya da "(" bekleniyordu.');
    }

    const tree = parseOr();
    if (pos < tokens.length) throw new Error(tokens[pos].t === ')' ? 'Fazladan ")" var.' : 'İfade hatalı.');
    return tree;
  }

  function evaluate(node, env) {
    switch (node.op) {
      case 'var': return env[node.v];
      case 'const': return node.v;
      case 'not': return !evaluate(node.a, env);
      case 'and': return evaluate(node.a, env) && evaluate(node.b, env);
      case 'or': return evaluate(node.a, env) || evaluate(node.b, env);
      case 'xor': return evaluate(node.a, env) !== evaluate(node.b, env);
      case 'xnor': return evaluate(node.a, env) === evaluate(node.b, env);
    }
    throw new Error('Bilinmeyen düğüm');
  }

  function variables(node, set = new Set()) {
    if (node.op === 'var') set.add(node.v);
    if (node.a) variables(node.a, set);
    if (node.b) variables(node.b, set);
    return set;
  }

  /* Doğruluk tablosu: satırlar ikili sırada (000, 001, ...). */
  function truthTable(src, forcedVars) {
    const tree = parse(src);
    const vars = forcedVars || [...variables(tree)].sort();
    if (vars.length > 6) throw new Error('En fazla 6 değişken kullan.');
    const rows = [];
    const n = vars.length;
    for (let m = 0; m < (1 << n); m++) {
      const env = {};
      const bits = [];
      for (let i = 0; i < n; i++) {
        const b = ((m >> (n - 1 - i)) & 1) === 1;
        env[vars[i]] = b; bits.push(b ? 1 : 0);
      }
      rows.push({ m, bits, f: evaluate(tree, env) ? 1 : 0 });
    }
    return { vars, rows, tree };
  }

  /* İki ifade aynı fonksiyon mu? */
  function equivalent(srcA, srcB) {
    const ta = parse(srcA), tb = parse(srcB);
    const vars = [...new Set([...variables(ta), ...variables(tb)])].sort();
    const A = truthTable(srcA, vars), B = truthTable(srcB, vars);
    const diff = A.rows.filter((r, i) => r.f !== B.rows[i].f).map(r => r.m);
    return { vars, A, B, same: diff.length === 0, diff };
  }

  /* Minterm listesinden kanonik çarpımlar toplamı (SOP) metni. */
  function canonicalSOP(table) {
    const terms = table.rows.filter(r => r.f === 1).map(r =>
      r.bits.map((b, i) => (b ? table.vars[i] : table.vars[i] + "'")).join('')
    );
    return terms.length ? terms.join(' + ') : '0';
  }

  /* Maxterm listesinden kanonik toplamlar çarpımı (POS) metni. Bit 1 ise değişken tümlenir. */
  function canonicalPOS(table) {
    const terms = table.rows.filter(r => r.f === 0).map(r =>
      '(' + r.bits.map((b, i) => (b ? table.vars[i] + "'" : table.vars[i])).join('+') + ')'
    );
    return terms.length ? terms.join('') : '1';
  }

  /* m indeksinden minterm / maxterm metni */
  function mintermText(index, vars) {
    const n = vars.length;
    return vars.map((v, i) => (((index >> (n - 1 - i)) & 1) ? v : v + "'")).join('');
  }
  function maxtermText(index, vars) {
    const n = vars.length;
    return vars.map((v, i) => (((index >> (n - 1 - i)) & 1) ? v + "'" : v)).join('+');
  }

  const api = { tokenize, parse, evaluate, variables, truthTable, equivalent, canonicalSOP, canonicalPOS, mintermText, maxtermText };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Logic = api;
})(typeof window !== 'undefined' ? window : globalThis);
