// Küçük bir AutoLISP yorumlayıcısı: GERILIMDUSUMU.lsp dosyasını AutoCAD olmadan
// sırayla verilen cevaplarla çalıştırıp hataları yakalamak için.
// Gerçek AutoCAD'in yalnızca komutta kullanılan kısmını taklit eder.
'use strict';

class Sym { constructor(n) { this.n = n; } toString() { return this.n; } }
const syms = new Map();
const S = n => { n = n.toUpperCase(); if (!syms.has(n)) syms.set(n, new Sym(n)); return syms.get(n); };
const NIL = null, T = S('T');
class LispError extends Error {}
class Exit extends Error {}

// ---------------------------------------------------------------- okuyucu
function oku(metin) {
  let i = 0; const out = [];
  const bosluk = () => {
    for (;;) {
      while (i < metin.length && /\s/.test(metin[i])) i++;
      if (metin[i] === ';') { while (i < metin.length && metin[i] !== '\n') i++; continue; }
      break;
    }
  };
  function ifade() {
    bosluk();
    const c = metin[i];
    if (c === '(') {
      i++; const l = [];
      for (;;) {
        bosluk();
        if (metin[i] === ')') { i++; return l; }
        if (metin[i] === '.' && /\s/.test(metin[i + 1])) { i++; const cdr = ifade(); bosluk(); i++; return { dot: true, car: l, cdr }; }
        if (i >= metin.length) throw new Error('Kapanmamış parantez');
        l.push(ifade());
      }
    }
    if (c === "'") { i++; return [S('QUOTE'), ifade()]; }
    if (c === '"') {
      i++; let s = '';
      while (metin[i] !== '"') {
        if (metin[i] === '\\') { i++; const e = metin[i]; s += e === 'n' ? '\n' : e === 't' ? '\t' : e; }
        else s += metin[i];
        i++;
      }
      i++; return { str: s };
    }
    let j = i; while (j < metin.length && !/[\s()';"]/.test(metin[j])) j++;
    const tok = metin.slice(i, j); i = j;
    if (/^[+-]?\d+$/.test(tok)) return parseInt(tok, 10);
    if (/^[+-]?(\d+\.?\d*|\.\d+)(e[+-]?\d+)?$/i.test(tok)) return { real: parseFloat(tok) };
    return S(tok);
  }
  for (;;) { bosluk(); if (i >= metin.length) break; out.push(ifade()); }
  return out;
}

// Değer gösterimi: int → JS number (tam), real → {real}, str → {str}, list → JS array, nil → null
const isReal = v => v && typeof v === 'object' && 'real' in v;
const isStr = v => v && typeof v === 'object' && 'str' in v;
const num = v => { if (typeof v === 'number') return v; if (isReal(v)) return v.real; throw new LispError('bad argument type: numberp: ' + yaz(v)); };
const str = v => { if (isStr(v)) return v.str; throw new LispError('bad argument type: stringp ' + yaz(v)); };
const R = x => ({ real: x });
const sonuc = (args, x) => args.some(isReal) || !Number.isInteger(x) ? R(x) : x;
const lst = v => { if (v === NIL) return []; if (Array.isArray(v)) return v; if (v && v.dot) return v; throw new LispError('bad argument type: listp ' + yaz(v)); };
function yaz(v) {
  if (v === NIL) return 'nil';
  if (typeof v === 'number') return String(v);
  if (isReal(v)) return String(v.real);
  if (isStr(v)) return JSON.stringify(v.str);
  if (v instanceof Sym) return v.n;
  if (Array.isArray(v)) return '(' + v.map(yaz).join(' ') + ')';
  if (v && v.dot) return '(' + v.car.map(yaz).join(' ') + ' . ' + yaz(v.cdr) + ')';
  if (typeof v === 'function') return '<SUBR>';
  return String(v);
}
function esit(a, b) {
  if (a === b) return true;
  if ((typeof a === 'number' || isReal(a)) && (typeof b === 'number' || isReal(b))) return num(a) === num(b);
  if (isStr(a) && isStr(b)) return a.str === b.str;
  if (Array.isArray(a) && Array.isArray(b)) return a.length === b.length && a.every((x, i) => esit(x, b[i]));
  if (a && a.dot && b && b.dot) return esit(a.car, b.car) && esit(a.cdr, b.cdr);
  return false;
}
const car = v => { if (v === NIL) return NIL; if (v.dot) return v.car[0]; return lst(v)[0] ?? NIL; };
const cdr = v => {
  if (v === NIL) return NIL;
  if (v.dot) return v.car.length > 1 ? { dot: true, car: v.car.slice(1), cdr: v.cdr } : v.cdr;
  const a = lst(v); return a.length > 1 ? a.slice(1) : NIL;
};
const cons = (a, b) => b === NIL ? [a] : Array.isArray(b) ? [a, ...b] : b && b.dot ? { dot: true, car: [a, ...b.car], cdr: b.cdr } : { dot: true, car: [a], cdr: b };

// ---------------------------------------------------------------- ortam
const env = new Map();
const get = s => env.has(s) ? env.get(s) : NIL;
function bagla(isimler, degerler, fn) {
  const eski = isimler.map(s => [s, env.has(s), env.get(s)]);
  isimler.forEach((s, i) => env.set(s, degerler[i] ?? NIL));
  try { return fn(); }
  finally { for (const [s, var_, v] of eski) var_ ? env.set(s, v) : env.delete(s); }
}
function fonksiyon(params) {
  const p = params || [], i = p.findIndex(x => x === S('/'));
  return { args: i < 0 ? p : p.slice(0, i), yerel: i < 0 ? [] : p.slice(i + 1) };
}
function lambdaYap(params, govde) {
  const { args, yerel } = fonksiyon(params);
  const f = (...a) => bagla([...args, ...yerel], a, () => { let r = NIL; for (const g of govde) r = ev(g); return r; });
  f.lisp = true; return f;
}

const ozel = {
  QUOTE: a => a[0],
  SETQ: a => { let r = NIL; for (let i = 0; i < a.length; i += 2) { r = ev(a[i + 1]); env.set(a[i], r); } return r; },
  DEFUN: a => { env.set(a[0], lambdaYap(a[1], a.slice(2))); return a[0]; },
  LAMBDA: a => lambdaYap(a[0], a.slice(1)),
  FUNCTION: a => ev(a[0]),
  IF: a => ev(a[0]) !== NIL ? ev(a[1]) : (a.length > 2 ? ev(a[2]) : NIL),
  COND: a => { for (const k of a) { const t = ev(k[0]); if (t !== NIL) { let r = t; for (const g of k.slice(1)) r = ev(g); return r; } } return NIL; },
  PROGN: a => { let r = NIL; for (const g of a) r = ev(g); return r; },
  WHILE: a => { let r = NIL, say = 0; while (ev(a[0]) !== NIL) { if (++say > 100000) throw new LispError('sonsuz döngü'); for (const g of a.slice(1)) r = ev(g); } return r; },
  REPEAT: a => { let r = NIL; const n = num(ev(a[0])); for (let i = 0; i < n; i++) for (const g of a.slice(1)) r = ev(g); return r; },
  AND: a => { for (const g of a) if (ev(g) === NIL) return NIL; return T; },
  OR: a => { for (const g of a) if (ev(g) !== NIL) return T; return NIL; },
  FOREACH: a => { const [v, l, ...g] = a; let r = NIL; for (const x of lst(ev(l))) bagla([v], [x], () => { for (const k of g) r = ev(k); }); return r; },
};

function ev(x) {
  if (x === NIL || typeof x === 'number' || isReal(x) || isStr(x) || typeof x === 'function') return x;
  if (x instanceof Sym) return x === T ? T : get(x);
  if (Array.isArray(x)) {
    if (x.length === 0) return NIL;
    const bas = x[0];
    if (bas instanceof Sym && ozel[bas.n]) return ozel[bas.n](x.slice(1));
    const f = bas instanceof Sym ? get(bas) : ev(bas);
    if (typeof f !== 'function') throw new LispError('no function definition: ' + yaz(bas));
    return f(...x.slice(1).map(ev));
  }
  if (x.dot) return x;
  throw new LispError('ev: ' + yaz(x));
}

// ---------------------------------------------------------------- yerleşik işlevler
const B = (n, f) => env.set(S(n), f);
const bool = v => v ? T : NIL;
B('+', (...a) => sonuc(a, a.reduce((s, x) => s + num(x), 0)));
B('-', (...a) => a.length === 1 ? sonuc(a, -num(a[0])) : sonuc(a, a.slice(1).reduce((s, x) => s - num(x), num(a[0]))));
B('*', (...a) => sonuc(a, a.reduce((s, x) => s * num(x), 1)));
B('/', (...a) => {
  let r = num(a[0]);
  for (const x of a.slice(1)) { if (num(x) === 0) throw new LispError('divide by zero'); r = a.some(isReal) ? r / num(x) : Math.trunc(r / num(x)); }
  return a.some(isReal) ? R(r) : r;
});
B('1+', a => sonuc([a], num(a) + 1)); B('1-', a => sonuc([a], num(a) - 1));
const karsilastir = op => (...a) => { for (let i = 0; i + 1 < a.length; i++) { const x = a[i], y = a[i + 1]; const xs = isStr(x) ? x.str : num(x), ys = isStr(y) ? y.str : num(y); if (!op(xs, ys)) return NIL; } return T; };
B('=', karsilastir((a, b) => a === b)); B('/=', (a, b) => bool(!esit(a, b)));
B('<', karsilastir((a, b) => a < b)); B('>', karsilastir((a, b) => a > b));
B('<=', karsilastir((a, b) => a <= b)); B('>=', karsilastir((a, b) => a >= b));
B('MIN', (...a) => sonuc(a, Math.min(...a.map(num)))); B('MAX', (...a) => sonuc(a, Math.max(...a.map(num))));
B('SQRT', a => R(Math.sqrt(num(a)))); B('FLOAT', a => R(num(a))); B('FIX', a => Math.trunc(num(a)));
B('ABS', a => sonuc([a], Math.abs(num(a))));
B('ZEROP', a => bool(num(a) === 0)); B('MINUSP', a => bool(num(a) < 0));
B('NUMBERP', a => bool(typeof a === 'number' || isReal(a)));
B('ATOF', a => R(parseFloat(str(a)) || 0)); B('ATOI', a => parseInt(str(a), 10) || 0);
B('ITOA', a => { if (typeof a !== 'number') throw new LispError('bad argument type: fixnump: ' + yaz(a)); return { str: String(a) }; });
B('RTOS', (x, mod, hassas) => {
  if (!(typeof x === 'number' || isReal(x))) throw new LispError('bad argument type: numberp: ' + yaz(x));
  let s = num(x).toFixed(num(hassas ?? 4));
  const dz = num(get(S('*DIMZIN*')) ?? 0);
  if (dz & 8 && s.includes('.')) s = s.replace(/0+$/, '').replace(/\.$/, '');
  return { str: s };
});
B('STRCAT', (...a) => ({ str: a.map(str).join('') }));
B('STRLEN', (...a) => a.reduce((s, x) => s + [...str(x)].length, 0));
B('SUBSTR', (s, bas, n) => { const c = [...str(s)]; const b = num(bas) - 1; return { str: c.slice(b, n == null ? undefined : b + num(n)).join('') }; });
B('STRCASE', (s, kucuk) => ({ str: kucuk ? str(s).toLocaleLowerCase('en') : str(s).toLocaleUpperCase('en') }));
B('VL-STRING-SEARCH', (p, s, bas) => { const i = [...str(s)].join('').indexOf(str(p), num(bas ?? 0)); return i < 0 ? NIL : [...str(s).slice(0, i)].length; });
const kirp = (set, s, sol, sag) => { let c = [...str(s)]; const k = new Set([...str(set)]); if (sol) while (c.length && k.has(c[0])) c.shift(); if (sag) while (c.length && k.has(c[c.length - 1])) c.pop(); return { str: c.join('') }; };
B('VL-STRING-TRIM', (k, s) => kirp(k, s, true, true));
B('VL-STRING-RIGHT-TRIM', (k, s) => kirp(k, s, false, true));
B('VL-STRING-LEFT-TRIM', (k, s) => kirp(k, s, true, false));
B('WCMATCH', (s, p) => {
  const desen = str(p).split(',').map(x => new RegExp('^' + x.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/#/g, '\\d').replace(/@/g, '[A-Za-z]').replace(/\*/g, '.*').replace(/\?/g, '.') + '$'));
  return bool(desen.some(r => r.test(str(s))));
});
B('CAR', car); B('CDR', cdr);
B('CADR', v => car(cdr(v))); B('CDDR', v => cdr(cdr(v))); B('CADDR', v => car(cdr(cdr(v)))); B('CADDDR', v => car(cdr(cdr(cdr(v)))));
B('CAAR', v => car(car(v)));
B('CONS', cons); B('LIST', (...a) => a.length ? a : NIL);
B('APPEND', (...a) => { const r = a.flatMap(lst); return r.length ? r : NIL; });
B('LENGTH', v => lst(v).length);
B('NTH', (n, l) => { if (typeof n !== 'number') throw new LispError('bad argument type: fixnump: ' + yaz(n)); if (l === NIL) throw new LispError('bad argument type: consp nil'); return lst(l)[n] ?? NIL; });
B('LAST', l => { const a = lst(l); return a[a.length - 1] ?? NIL; });
B('LAST2', l => NIL);
B('REVERSE', l => { const a = [...lst(l)].reverse(); return a.length ? a : NIL; });
B('ASSOC', (k, l) => lst(l).find(x => x !== NIL && esit(car(x), k)) ?? NIL);
B('MEMBER', (k, l) => { const a = lst(l); const i = a.findIndex(x => esit(x, k)); return i < 0 ? NIL : a.slice(i); });
B('VL-POSITION', (k, l) => { const i = lst(l).findIndex(x => esit(x, k)); return i < 0 ? NIL : i; });
const fn = f => typeof f === 'function' ? f : f instanceof Sym ? get(f) : Array.isArray(f) && f[0] === S('LAMBDA') ? ev(f) : (() => { throw new LispError('bad function: ' + yaz(f)); })();
B('MAPCAR', (f, ...ls) => { f = fn(f); const a = ls.map(lst); const n = Math.min(...a.map(x => x.length)); const r = []; for (let i = 0; i < n; i++) r.push(f(...a.map(x => x[i]))); return r.length ? r : NIL; });
B('APPLY', (f, l) => fn(f)(...lst(l)));
B('NULL', v => bool(v === NIL)); B('NOT', v => bool(v === NIL));
B('EQ', (a, b) => bool(a === b || esit(a, b) && !(Array.isArray(a)))); B('EQUAL', (a, b) => bool(esit(a, b)));
B('LISTP', v => bool(v === NIL || Array.isArray(v) || (v && v.dot)));
B('TYPE', v => v === NIL ? NIL : typeof v === 'number' ? S('INT') : isReal(v) ? S('REAL') : isStr(v) ? S('STR') : Array.isArray(v) ? S('LIST') : S('SYM'));
B('VL-LOAD-COM', () => NIL);
B('EXIT', () => { throw new Exit('quit / exit abort'); });

// ---------------------------------------------------------------- AutoCAD taklidi
const durum = { cikti: '', girdiler: [], nesneler: [], vars: { DIMZIN: 8, CMDECHO: 1, TEXTSIZE: 2.5 }, envler: {}, stiller: new Set(['STANDARD']), katmanlar: { '0': { renk: 7, kalinlik: 25 } }, initget: null, komutlar: [] };
B('PRINC', v => { if (v !== NIL && v !== undefined) durum.cikti += isStr(v) ? v.str : yaz(v); return v ?? { str: '' }; });
B('PRINT', v => { durum.cikti += '\n' + yaz(v); return v; });
B('PROMPT', v => { durum.cikti += str(v); return NIL; });
B('GETVAR', n => { const v = durum.vars[str(n).toUpperCase()]; return v === undefined ? NIL : Number.isInteger(v) && str(n).toUpperCase() !== 'TEXTSIZE' ? v : R(v); });
B('SETVAR', (n, v) => { durum.vars[str(n).toUpperCase()] = num(v); if (str(n).toUpperCase() === 'DIMZIN') env.set(S('*DIMZIN*'), num(v)); return v; });
env.set(S('*DIMZIN*'), 8);
B('GETENV', n => durum.envler[str(n)] !== undefined ? { str: durum.envler[str(n)] } : NIL);
B('SETENV', (n, v) => { durum.envler[str(n)] = str(v); return v; });
B('INITGET', (...a) => { durum.initget = a; return NIL; });
function sonrakiGirdi(soru) {
  durum.cikti += soru;
  if (!durum.girdiler.length) throw new LispError('GİRDİ BİTTİ (soru: ' + soru.trim() + ')');
  const g = durum.girdiler.shift();
  durum.cikti += g + '\n';
  const ig = durum.initget; durum.initget = null;
  return { g, ig };
}
B('GETKWORD', soru => {
  const { g, ig } = sonrakiGirdi(str(soru));
  if (g === '') return NIL;
  const kws = ig ? (isStr(ig[0]) ? ig[0].str : isStr(ig[1]) ? ig[1].str : '').split(' ').filter(Boolean) : [];
  const k = kws.find(k => k.toUpperCase().startsWith(g.toUpperCase()));
  if (!k) throw new LispError('Geçersiz anahtar kelime: ' + g + ' (seçenekler: ' + kws.join('/') + ')');
  return { str: k };
});
B('GETREAL', soru => { const { g } = sonrakiGirdi(str(soru)); return g === '' ? NIL : R(parseFloat(g)); });
B('GETINT', soru => { const { g } = sonrakiGirdi(str(soru)); if (g === '') return NIL; if (!/^-?\d+$/.test(g)) throw new LispError('Tam sayı gerekli: ' + g); return parseInt(g, 10); });
B('GETSTRING', (a, b) => { const { g } = sonrakiGirdi(str(b ?? a)); return { str: g }; });
B('GETPOINT', (a, b) => { const { g } = sonrakiGirdi(str(isStr(a) ? a : b)); if (g === '') return NIL; return g.split(',').map(x => R(parseFloat(x))); });
B('TRANS', p => p);
B('TBLSEARCH', (t, n) => { const tip = str(t).toUpperCase(); if (tip === 'STYLE') return durum.stiller.has(str(n).toUpperCase()) ? [[0, { str: 'STYLE' }]] : NIL; if (tip === 'LAYER') return durum.katmanlar[str(n)] ? [[0, { str: 'LAYER' }]] : NIL; return NIL; });
const nesneYap = dxf => {
  const l = lst(dxf).filter(x => !((x.dot ? x.car[0] : x[0]) === 100));
  const tip = str(cdr(l[0]) ?? l[0].cdr);
  const grup = k => { const g = l.find(x => (x.dot ? x.car[0] : x[0]) === k); return g ? (g.dot ? g.cdr : g.slice(1)) : undefined; };
  if (tip === 'STYLE') { durum.stiller.add(str(grup(2)).toUpperCase()); return { str: 'stil' }; }
  if (tip === 'LAYER') { durum.katmanlar[str(grup(2))] = { renk: num(grup(62)), kalinlik: num(grup(370) ?? 25) }; return { str: 'katman' }; }
  const katman = grup(8) ? str(grup(8)) : '0'; const kat = durum.katmanlar[katman] || durum.katmanlar['0'];
  const ekle = o => durum.nesneler.push({ katman, kalinlik: kat.kalinlik, ...o, renk: grup(62) != null ? num(grup(62)) : kat.renk });
  if (tip === 'MTEXT') {
    const st = grup(7); if (st && !durum.stiller.has(str(st).toUpperCase())) return NIL;
    const p = grup(10); if (!Array.isArray(p) || p.length < 2) throw new LispError('MTEXT nokta hatalı: ' + yaz(p));
    ekle({ tip, x: num(p[0]), y: num(p[1]), h: num(grup(40)), hiza: num(grup(71) ?? 1), yazi: str(grup(1)) });
  } else if (tip === 'LINE') {
    const a = grup(10), b = grup(11);
    ekle({ tip, x1: num(a[0]), y1: num(a[1]), x2: num(b[0]), y2: num(b[1]) });
  } else if (tip === 'LWPOLYLINE') {
    const pts = l.filter(x => !x.dot && x[0] === 10).map(x => [num(x[1]), num(x[2])]);
    ekle({ tip, pts, genislik: grup(43) != null ? num(grup(43)) : null });
  } else if (tip === 'SOLID') {
    ekle({ tip, pts: [10, 11, 12, 13].map(k => grup(k)).map(p => [num(p[0]), num(p[1])]) });
  } else throw new LispError('entmake bilinmeyen tip ' + tip);
  return { str: 'ent' + durum.nesneler.length };
};
B('ENTMAKE', nesneYap); B('ENTMAKEX', nesneYap);
B('COMMAND', (...a) => { durum.komutlar.push(a.map(x => isStr(x) ? x.str : yaz(x)).join(' ')); return NIL; });
B('COMMAND-S', (...a) => { durum.komutlar.push('(s) ' + a.map(x => isStr(x) ? x.str : yaz(x)).join(' ')); return NIL; });

// ---------------------------------------------------------------- çalıştırma
function yukle(metin) { for (const f of oku(metin)) ev(f); }
function komut(ad, girdiler) {
  durum.cikti = ''; durum.nesneler = []; durum.komutlar = []; durum.girdiler = [...girdiler];
  const f = get(S('C:' + ad));
  try { ev([f]); return { tamam: true }; }
  catch (e) {
    if (e instanceof Exit || e instanceof LispError) {
      // AutoCAD gibi: *error* tanımlıysa onu çağır
      const h = get(S('*ERROR*'));
      if (typeof h === 'function') { try { h({ str: e.message }); } catch (_) {} }
      return { tamam: false, hata: e.message };
    }
    throw e;
  }
}
module.exports = { yukle, komut, durum, oku };
