// node test/test-core.js  — hesap çekirdeğinin örnek proje sonuçlarını doğrular
const fs = require('fs'), path = require('path'), vm = require('vm');
const ctx = { module: { exports: {} }, console };
vm.createContext(ctx);
const src = ['cer-core.js', 'kroki-rapor.js'].map(f => fs.readFileSync(path.join(__dirname, '../src', f), 'utf8')).join('\n');
vm.runInContext(src, ctx);
const C = ctx.module.exports;
const assert = (c, m) => { if (!c) { console.error('HATA:', m); process.exitCode = 1; } else console.log('ok  ', m); };
const P = Object.assign({}, C.DEFAULTS, { bolge: 1 });
const rad = d => d * Math.PI / 180, a = rad(90 + 76);
const poles = [
  { x: 0, y: 0, mev: true, mevName: '9.30/8', mevCap: 800, ex: [{ x: 0, y: -20, c: '4R' }] },
  { x: 0, y: 20, ex: [] },
  { x: 25 * Math.cos(a), y: 20 + 25 * Math.sin(a), ex: [] },
  { x: 50 * Math.cos(a), y: 20 + 50 * Math.sin(a), ex: [] },
];
const R = C.computeAll(poles, P);
assert(C.parseCer('AER 3x25+35', P) === 420, 'ALPEK 3x25+35 cer = 420 kg');
assert(C.parseCer('4R', P) === 280, '4R (I. bölge) = 280 kg');
assert(C.parseCer('3P+R/I', Object.assign({}, P, { bolge: 2 })) === 640.5, '3P+R/I (II. bölge) = 640,5 kg');
assert(R[1].R === 517 && R[1].type === 'K1', 'D1 köşe 104°: R = 517 kg, K1');
assert(R[2].R === 0 && R[2].type === '8I', 'D2 düz: R = 0, 8I');
assert(R[3].R === 420 && R[3].type === '10I', 'D3 nihayet: R = 420 kg, 10I');
const k = C.kesitCheck({ kW: 15, cos: 0.8, tri: true, U3: 380, L: 150, kappa: 35, limit: 1, cond: 'AER 3x25+35' });
assert(k.best.n === 'AER 3x50+70', '15 kW / 150 m / %1 → ALPEK 3x50+70');
const dxf = C.toDXF(C.krokiPrims2({ poles, parcels: [] }, R, P, { h: 1, mpu: 1 }));
assert(dxf.includes('ENTITIES') && dxf.trim().endsWith('EOF'), 'kroki DXF üretildi');
