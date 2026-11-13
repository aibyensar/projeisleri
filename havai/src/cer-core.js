// ===== CER HESABI ÇEKİRDEK (saf fonksiyonlar) =====
const POLES = [
  // s: rüzgarsız güçlü eksen, w: zayıf eksen, r: rüzgarlı güçlü eksen (Konen/TEDAŞ AG demir direk tablosu, a=50 m)
  { n: '8I', s: 300, w: 90, r: 231 },
  { n: '10I', s: 500, w: 160, r: 443 },
  { n: '10U', s: 700, w: 170, r: 597 },
  { n: '12I', s: 900, w: 230, r: 786 },
  { n: 'K1', s: 1000, w: 1000, r: 871 },
  { n: '12U', s: 1200, w: 250, r: 1086 },
  { n: 'K2', s: 2000, w: 2000, r: 1848 },
  { n: 'K3', s: 3000, w: 3000, r: 2828 },
  { n: 'K4', s: 4000, w: 4000, r: 3817 },
  { n: 'K5', s: 5000, w: 5000, r: 4806 },
  { n: '6.5U', s: 200, w: 80, r: 143, noauto: true },
  { n: '8U', s: 400, w: 125, r: 343, noauto: true },
];
const AER_LIST = ['AER 3x16+25', 'AER 3x25+35', 'AER 3x35+50', 'AER 3x50+70', 'AER 3x70+95'];

const DEFAULTS = { sigma: 12, bolge: 1, wind: false, margin: 0, routeCond: 'AER 3x25+35', kKose: true, kBrans: true, kNih: false, straightAng: 175, firstMev: true };
// Buz yükü bölgelerine göre çıplak Al iletken müşterek hat çekme kuvvetleri Tmax (kg) — Konen teknik tablo
const BARE = {
  ROSE: [70, 100, 147, 148], LILY: [79, 110, 162, 161], IRIS: [92, 125, 189, 175], PANSY: [104.7, 138.5, 188, 189.7],
  POPPY: [120, 152, 211, 206], ASTER: [137, 170, 230, 224], PHLOX: [157, 194, 259, 244], OXLIP: [168.5, 217.5, 282, 265],
};
const BARE_ABBR = { R: 'ROSE', L: 'LILY', I: 'IRIS', P: 'PANSY', PO: 'POPPY', A: 'ASTER', PH: 'PHLOX', O: 'OXLIP' };
// TEDAŞ AG hat tertipleri (Al) + eski şebekelerde görülen çok iletkenli tertipler
const TERTIP = ['4R', '5R', '3L+R/L', '3I+R/L', '3P+R/I', '3Po+R/P', '3A+R/P', '3Ph+R/Po', '3O+R/A', '4P', '4P+R', '3A+P+R'];
// SBA beton direk: boy/tip, tepe kuvveti = tip × 100 kg (TEDAŞ: 600 kg'a kadar 100, sonra 200 kg aralık)
const SBA_BOY = ['9.30', '10', '11', '12', '13', '14'];
const SBA_TIP = [2, 3, 4, 5, 6, 8, 10, 12, 14, 16, 18, 20, 22, 24, 26, 28, 30, 33, 35];

// İletken metninden cer (kg): "AER 3x25+35" -> nötr kesit × σ ; "4R", "3A+P+R" -> çıplak iletken toplamı ; "416" -> sayı
function parseCer(txt, P) {
  if (txt == null) return 0;
  const t = String(txt).trim().toUpperCase().replace(/İ/g, 'I');
  if (/^\d+([.,]\d+)?$/.test(t)) return parseFloat(t.replace(',', '.'));
  const m = t.match(/3\s*X\s*(\d+)\s*\+\s*(?:1\s*X\s*16\s*\+\s*)?(\d+)/);
  if (m) return Math.round(parseFloat(m[2]) * P.sigma * 10) / 10;
  const b = Math.min(4, Math.max(1, +P.bolge || 2)) - 1;
  let sum = 0;
  for (const part of t.replace(/\s+/g, '').split(/[+\/]/)) {
    if (!part) continue;
    const m = part.match(/^(\d*)X?([A-Z]+)$/); if (!m) return NaN;
    const nm = BARE[m[2]] ? m[2] : BARE_ABBR[m[2]]; if (!nm) return NaN;
    sum += (m[1] ? parseInt(m[1]) : 1) * BARE[nm][b];
  }
  return Math.round(sum * 10) / 10;
}
// Yeni hattın çekmesi ve yazısı: BHP'den NYY + askı teli gelirse (P.hat) askı telinin verilen T'si, yoksa ALPEK askı teli × σ
function hatCer(P) { return P.hat && P.hat.T > 0 ? P.hat.T : parseCer(P.routeCond, P); }
function hatAd(P) { return P.hat ? P.hat.yazi : `${P.routeCond.replace(/^AER/, 'ALPEK')} mm²`; }
function fmt(v) { return (Math.round(v * 10) / 10).toString().replace('.', ','); }
function poleCap(pt, P) { const d = POLES.find(x => x.n === pt); return d ? (P.wind ? d.r : d.s) : 0; }

function poleNames(poles, P) {
  let d = 0, m = 0;
  const ad = P && P.mevAd ? String(P.mevAd) : 'MEVCUT';           // AGY: GDZ yazısındaki direk adı (ör. C-06)
  return poles.map(p => p.mev ? (++m === 1 ? ad : ad + '-' + m) : 'D' + (++d));
}

// Bir direğe bağlı hatlar: önce ek (mevcut) hatlar, sonra önceki ve sonraki açıklık
function poleLines(poles, i, P) {
  const p = poles[i], L = [];
  const rT = hatCer(P);
  (p.ex || []).forEach(e => L.push({ x: e.x, y: e.y, T: parseCer(e.c, P), lab: e.c, kind: 'ex' }));
  if (i > 0) L.push({ x: poles[i - 1].x, y: poles[i - 1].y, T: rT, lab: P.routeCond, kind: 'route' });
  if (i < poles.length - 1) L.push({ x: poles[i + 1].x, y: poles[i + 1].y, T: rT, lab: P.routeCond, kind: 'route' });
  L.forEach(l => { l.ang = Math.atan2(l.y - p.y, l.x - p.x) * 180 / Math.PI; });
  L.sort((a, b) => b.T - a.T);  // büyük cer sola (örnek projelerdeki gibi)
  return L;
}

function computePole(poles, i, P) {
  const p = poles[i], L = poleLines(poles, i, P);
  const res = { i, lines: L, kind: L.length === 0 ? 'none' : L.length === 1 ? 'end' : L.length === 2 ? 'two' : 'multi' };
  // kanonik açı: ilk hat sola (180°)
  let a = L.map(l => ((180 + l.ang - L[0].ang) % 360 + 360) % 360);
  if (L.length >= 2 && a[1] > 180 + 1e-9) a = a.map(v => (360 - v) % 360);
  if (L.length) a[0] = 180;
  res.can = a;
  if (res.kind === 'two') {
    const T1 = L[0].T, T2 = L[1].T, phi = a[1];
    res.measured = Math.round(180 - phi);
    const ph = p.angOv > 0 && p.angOv <= 180 ? Math.round(180 - p.angOv) : Math.round(phi);           // örnek projelerdeki gibi tam derece
    const s = Math.round(T2 * Math.sin(ph * Math.PI / 180));
    const c = Math.round(T2 * Math.cos(ph * Math.PI / 180));
    const rx = Math.round((T1 - c) * 10) / 10;
    res.T1 = T1; res.T2 = T2; res.phi = ph; res.interior = 180 - ph; res.s = s; res.c = c; res.rx = rx;
    res.R = Math.round(Math.hypot(rx, s));
    res.dir = [-rx, s];
  } else if (res.kind === 'end') {
    res.R = Math.round(L[0].T); res.dir = [-1, 0];
  } else if (res.kind === 'multi') {
    let X = 0, Y = 0; L.forEach((l, k) => { X += l.T * Math.cos(a[k] * Math.PI / 180); Y += l.T * Math.sin(a[k] * Math.PI / 180); });
    res.X = Math.round(X); res.Y = Math.round(Y); res.R = Math.round(Math.hypot(X, Y)); res.dir = [X, Y];
  } else { res.R = 0; res.dir = [0, 0]; }
  // direk tipi
  // direk görevi
  res.cat = res.kind === 'end' ? 'nihayet' : res.kind === 'multi' ? 'brans' : res.kind === 'two' ? (res.interior >= (P.straightAng || 175) ? 'duz' : 'kose') : '-';
  res.catName = { nihayet: 'Nihayet', brans: 'Branşman', duz: 'Taşıyıcı (düz)', kose: 'Köşe', '-': '—' }[res.cat];
  // dünya koordinatında bileşke yönü (sembol yönü için)
  let wx = 0, wy = 0; L.forEach(l => { const r = l.ang * Math.PI / 180; wx += l.T * Math.cos(r); wy += l.T * Math.sin(r); });
  res.wdir = Math.hypot(wx, wy) > 1 ? Math.atan2(wy, wx) * 180 / Math.PI : null;
  res.lineDir = L.length ? L.find(l => l.kind === 'route') ? L.find(l => l.kind === 'route').ang : L[0].ang : 0;
  const needK = (P.kKose && res.cat === 'kose') || (P.kBrans && res.cat === 'brans') || (P.kNih && res.cat === 'nihayet');
  res.needK = needK;
  const need = res.R * (1 + (P.margin || 0) / 100);
  if (p.mev) { res.type = p.mevName || 'MEVCUT'; res.cap = +p.mevCap || 0; res.auto = false; }
  else if (p.ov && p.ov !== 'auto') { res.type = p.ov; res.cap = poleCap(p.ov, P); res.auto = false; }
  else {
    const d = POLES.find(x => !x.noauto && (!needK || x.n[0] === 'K') && (P.wind ? x.r : x.s) >= need);
    res.type = d ? d.n : 'K5+'; res.cap = d ? (P.wind ? d.r : d.s) : 0; res.auto = true;
  }
  res.ok = res.R <= res.cap && res.cap > 0;
  res.isIU = /^[\d.]+[IU]$/.test(res.type);
  res.isK = /^K\d/.test(res.type);
  res.kViol = needK && !p.mev && !res.isK;
  return res;
}
function computeAll(poles, P) { const names = poleNames(poles, P); return poles.map((p, i) => Object.assign(computePole(poles, i, P), { name: names[i] })); }

// ===== Çizim primitifleri (birim: çizim birimi, y yukarı) =====
function sheetPrims(results, P) {
  const pr = [], RH = 6.8, W = 41;
  const n = results.length, top = n * RH + 2.2;
  const L = (x1, y1, x2, y2, o) => pr.push(Object.assign({ t: 'line', x1, y1, x2, y2 }, o || {}));
  const C = (x, y, r) => pr.push({ t: 'circle', x, y, r });
  const A = (x, y, r, a1, a2) => pr.push({ t: 'arc', x, y, r, a1, a2 });
  const T = (x, y, s, h, o) => pr.push(Object.assign({ t: 'text', x, y, s, h: h || 0.32 }, o || {}));
  const arrow = (x, y, dx, dy) => {
    const ex = x + dx, ey = y + dy; L(x, y, ex, ey); const a = Math.atan2(dy, dx);
    [1, -1].forEach(sg => { const b = a + Math.PI + sg * 25 * Math.PI / 180; L(ex, ey, ex + 0.35 * Math.cos(b), ey + 0.35 * Math.sin(b)); });
  };
  const dirArrow = (cx, cy, deg, len) => { const r = deg * Math.PI / 180; arrow(cx + 0.22 * Math.cos(r), cy + 0.22 * Math.sin(r), len * Math.cos(r), len * Math.sin(r)); };
  const rT = hatCer(P);
  T(0.3, top - 0.6, `CER HESABI  -  HAVAİ ${P.hat ? P.hat.yazi : P.routeCond + ' mm²'}  (T = ${fmt(rT)} KG)${P.wind ? '  -  RÜZGARLI TEPE KUVVETLERİ' : ''}`, 0.5, { bold: true });
  results.forEach((r, k) => {
    const y0 = top - 1.6 - (k + 1) * RH, yc = y0 + 2.6;
    pr.push({ t: 'rect', x: 0.3, y: y0, w: W, h: RH - 0.4 });
    pr.push({ t: 'rect', x: 0.3, y: y0 + RH - 1.3, w: 3.2, h: 0.9 }); T(0.45, y0 + RH - 1.1, r.name, 0.5);
    const capTxt = `${r.name} (${r.type}) = ${r.cap} kg`;
    const okTxt = r.ok ? 'UYGUNDUR' : 'UYGUN DEĞİL';
    const okCol = r.ok ? null : 1;
    const can = r.can, Ls = r.lines;
    // Panel 1: kuvvetler
    C(6, yc, 0.22);
    Ls.forEach((l, j) => {
      const len = 3.2; dirArrow(6, yc, can[j], len);
      const rr = can[j] * Math.PI / 180, lx = 6 + (len + 0.3) * Math.cos(rr), ly = yc + (len + 0.3) * Math.sin(rr);
      T(lx - (Math.cos(rr) < -0.3 ? 1.1 : 0), ly - (Math.abs(Math.sin(rr)) < 0.3 ? 0.75 : 0), `${fmt(l.T)} KG`);
    });
    if (r.kind === 'two') { A(6, yc, 1.2, r.phi, 180); T(5.4, yc + 1.45, `${r.interior}°`, 0.3); }
    T(4.2, yc - 1.5, capTxt, 0.26);
    // Panel 2: bileşenler
    if (r.kind === 'two') {
      C(17, yc, 0.22); dirArrow(17, yc, 180, 3.2); dirArrow(17, yc, r.phi, 3.2);
      T(13.6, yc - 0.75, `${fmt(r.T1)} KG`);
      if (r.phi > 0.5 && r.phi < 179.5) L(17, yc + 0.22, 17, yc + 3.0, { dash: true });
      T(13.0, yc + 3.25, `sin ${r.phi} x ${fmt(r.T2)} = ${r.s} KG`);
      T(17.9, yc - 0.75, `cos ${r.phi} x ${fmt(r.T2)} = ${r.c} KG`);
    } else if (r.kind === 'end') {
      C(17, yc, 0.22); dirArrow(17, yc, 180, 3.2); T(13.6, yc - 0.75, `${fmt(r.lines[0].T)} KG`);
      T(18.0, yc + 0.6, 'NİHAYET DİREĞİ', 0.3); T(18.0, yc - 0.1, 'çekme tek yönlü', 0.28);
    } else if (r.kind === 'multi') {
      T(13.0, yc + 1.6, 'Hatlar vektörel toplanır:', 0.3);
      Ls.forEach((l, j) => T(13.0, yc + 0.9 - j * 0.55, `${fmt(l.T)} KG  @ ${Math.round(can[j])}°`, 0.28));
    }
    // Panel 3: net bileşenler
    const mx = Math.max(1, ...Ls.map(l => l.T));
    if (r.kind === 'two') {
      C(27, yc, 0.22);
      const lx = 0.6 + 2.4 * Math.abs(r.rx) / mx, ly = 0.6 + 2.4 * Math.abs(r.s) / mx;
      if (Math.abs(r.rx) > 0.05) dirArrow(27, yc, r.rx > 0 ? 180 : 0, lx);
      if (r.s > 0) dirArrow(27, yc, 90, ly);
      const cs = r.c < 0 ? `${fmt(r.T1)} + ${-r.c}` : r.rx >= 0 ? `${fmt(r.T1)} - ${r.c}` : `${r.c} - ${fmt(r.T1)}`;
      T(23.4, yc - 0.75, `${cs} = ${fmt(Math.abs(r.rx))} KG`);
      if (r.s > 0) T(27.2, yc + ly + 0.1, `${r.s} KG`);
    } else if (r.kind === 'multi') {
      C(27, yc, 0.22);
      if (Math.abs(r.X) > 0) dirArrow(27, yc, r.X < 0 ? 180 : 0, 0.6 + 2.4 * Math.abs(r.X) / mx);
      if (Math.abs(r.Y) > 0) dirArrow(27, yc, r.Y > 0 ? 90 : 270, 0.6 + 2.4 * Math.abs(r.Y) / mx);
      T(23.4, yc - 0.75, `Top. X = ${Math.abs(r.X)} KG   Top. Y = ${Math.abs(r.Y)} KG`);
    }
    // Panel 4: bileşke
    C(35.5, yc, 0.22);
    if (r.R > 0) {
      const d = Math.atan2(r.dir[1], r.dir[0]) * 180 / Math.PI, len = 0.8 + 2.2 * Math.min(1, r.R / mx);
      dirArrow(35.5, yc, d, len);
      const rr = d * Math.PI / 180; T(35.5 + (len + 0.3) * Math.cos(rr) - 0.6, yc + (len + 0.3) * Math.sin(rr) + 0.1, `${r.R} KG`);
    }
    T(35.95, yc - 0.15, `${r.R} KG  ${okTxt}`, 0.32, { bold: true, color: okCol });
    T(34.0, yc - 1.5, capTxt, 0.26);
    if (!r.ok) T(23.4, yc - 1.5, r.cap ? `${r.R} > ${r.cap} kg  - DİREK TİPİNİ BÜYÜT` : 'Uygun direk yok', 0.28, { color: 1 });
  });
  // Özet
  const sm = summaryLines(results, P);
  let y = top - 1.6 - n * RH - 1.6;
  sm.forEach(s => { if (s) T(0.5, y, s, 0.45); y -= s ? 0.85 : 0.45; });
  return { prims: pr, w: W + 0.6, top, bottom: y - 0.5 };
}

function summaryLines(results, P) {
  const out = [], seen = new Set();
  const order = POLES.map(p => p.n);
  const types = [...new Set(results.filter(r => !r.lines.length || true).map(r => r.type))];
  // direk taşıma satırları (önce yeni tipler, sonra mevcut)
  results.filter(r => !r.isMev).forEach(() => {});
  const newT = types.filter(t => order.includes(t)).sort((a, b) => order.indexOf(a) - order.indexOf(b));
  const mevT = results.filter(r => !order.includes(r.type));
  newT.forEach(t => out.push(`${t} DİREK ${poleCap(t, P)} KG TAŞIR`));
  mevT.forEach(r => { const k = r.type + '|' + r.cap; if (!seen.has(k)) { seen.add(k); out.push(`${r.type} DİREK ${r.cap} KG TAŞIR`); } });
  out.push('');
  const conds = new Map();
  conds.set(P.hat ? P.hat.yazi : P.routeCond, hatCer(P));
  results.forEach(r => r.lines.filter(l => l.kind === 'ex').forEach(l => conds.set(l.lab, l.T)));
  conds.forEach((v, k) => {
    const nm = P.hat && k === P.hat.yazi ? k : /AER/i.test(k) ? `${k.replace(/^AER\s*/i, 'AER ')} mm` : /^\d/.test(k) && !/[RPA]/i.test(k) ? `MEVCUT HAT` : `MEVCUT ${k.toUpperCase()} HAT`;
    out.push(`${nm} ${fmt(v)} KG çeker.`);
  });
  if (P.kesit && !P.hat) {
    const k = P.kesit; out.push('');
    out.push(`Bağlantı gücü ${fmt(k.kW)} kW, ${k.tri ? 'trifaze ' + (k.U3 || 380) + ' V' : 'monofaze ' + (k.U1 || 220) + ' V'}, cosφ ${fmt(k.cos)}, hat boyu ${Math.round(k.L)} m`);
    out.push(`I = ${fmt(k.res.I)} A ≤ ${k.res.sel.amp} A  ;  %e = ${fmt(k.res.sel.e)} ≤ %${fmt(k.limit)}  →  ${P.routeCond} ${k.res.sel.okI && k.res.sel.okE ? 'uygundur.' : 'UYGUN DEĞİLDİR.'}`);
  }
  out.push('');
  results.forEach(r => {
    const lab = r.name.startsWith('MEVCUT') ? `${r.name}  DİREK` : `${r.name} DİREĞİ`;
    out.push(r.ok ? `${lab} Toplam cer ${r.R}<${r.cap} olduğu için uygundur.` : `${lab} Toplam cer ${r.R}>${r.cap} olduğu için UYGUN DEĞİLDİR.`);
  });
  return out;
}

// ===== Kroki primitifleri (dünya koordinatı) =====
function krokiPrims(poles, results, P, opt) {
  const pr = [], u = opt.unit;  // u: 1 metreye karşılık gelen çizim birimi... burada yazı yüksekliği tabanı
  const h = opt.textH;
  const names = poleNames(poles);
  for (let i = 0; i < poles.length - 1; i++) {
    const a = poles[i], b = poles[i + 1];
    pr.push({ t: 'line', x1: a.x, y1: a.y, x2: b.x, y2: b.y, layer: 'HAT' });
    let ang = Math.atan2(b.y - a.y, b.x - a.x) * 180 / Math.PI; if (ang > 90) ang -= 180; if (ang < -90) ang += 180;
    const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2, nx = -Math.sin(ang * Math.PI / 180), ny = Math.cos(ang * Math.PI / 180);
    const len = opt.mpu ? Math.hypot(b.x - a.x, b.y - a.y) * opt.mpu : null;
    pr.push({ t: 'text', x: mx + nx * h * 0.6, y: my + ny * h * 0.6, s: `HAVAİ ${P.hat ? P.hat.yazi : P.routeCond + 'mm²'}`, h: h * 0.7, rot: ang, center: true, layer: 'YAZI' });
    if (len) pr.push({ t: 'text', x: mx - nx * h * 1.3, y: my - ny * h * 1.3, s: `${Math.round(len)} m`, h: h * 0.7, rot: ang, center: true, layer: 'YAZI' });
  }
  poles.forEach((p, i) => {
    const r = results[i];
    (p.ex || []).forEach(e => {
      pr.push({ t: 'line', x1: p.x, y1: p.y, x2: e.x, y2: e.y, dash: true, layer: 'MEVCUT' });
      pr.push({ t: 'text', x: (p.x + e.x) / 2 + h * 0.4, y: (p.y + e.y) / 2, s: `${String(e.c).toUpperCase()} MEVCUT`, h: h * 0.7, layer: 'YAZI' });
    });
    poleSymbol(pr, p, r, h);
    pr.push({ t: 'text', x: p.x + h * 1.1, y: p.y + h * 0.2, s: r.name, h: h * 1.2, layer: 'YAZI' });
    pr.push({ t: 'text', x: p.x + h * 1.1, y: p.y - h * 1.3, s: r.type, h: h * 1.2, layer: 'YAZI' });
    if (r.kind === 'two') {
      const a0 = r.lines[0].ang, a1 = r.lines[1].ang;
      let d = ((a1 - a0) % 360 + 360) % 360; let s0 = a0, s1 = a1; if (d > 180) { s0 = a1; s1 = a0; }
      pr.push({ t: 'arc', x: p.x, y: p.y, r: h * 2.2, a1: s0, a2: s1, layer: 'ACI' });
      let mid = s0 + (((s1 - s0) % 360 + 360) % 360) / 2; const mr = mid * Math.PI / 180;
      pr.push({ t: 'text', x: p.x + h * 3.0 * Math.cos(mr), y: p.y + h * 3.0 * Math.sin(mr), s: `${r.interior}°`, h: h * 0.8, center: true, layer: 'ACI' });
    }
  });
  return pr;
}

// Direk sembolleri (örnek krokilerdeki gösterim): beton/mevcut = daire, I-U demir = dikdörtgen
// (uzun kenar bileşke yönünde, düz hatta hatta dik), K kafes = kare, yeni demir direklere topraklama işareti
function poleSymbol(pr, p, r, h) {
  const rot = (cx, cy, pts, deg) => { const a = deg * Math.PI / 180, c = Math.cos(a), s = Math.sin(a); return pts.map(([x, y]) => [cx + x * c - y * s, cy + x * s + y * c]); };
  const poly = (pts, layer) => { for (let k = 0; k < pts.length; k++) { const a = pts[k], b = pts[(k + 1) % pts.length]; pr.push({ t: 'line', x1: a[0], y1: a[1], x2: b[0], y2: b[1], layer }); } };
  const isConc = p.mev || !(r.isIU || r.isK);
  let axis = r.wdir != null && r.R > 5 && r.cat !== 'duz' ? r.wdir : r.lineDir + 90;
  if (isConc) { pr.push({ t: 'circle', x: p.x, y: p.y, r: h * 0.75, layer: 'DIREK' }); return; }
  if (r.isK) { const a = h * 0.75; poly(rot(p.x, p.y, [[-a, -a], [a, -a], [a, a], [-a, a]], axis), 'DIREK'); }
  else { const a = h * 1.1, b = h * 0.45; poly(rot(p.x, p.y, [[-a, -b], [a, -b], [a, b], [-a, b]], axis), 'DIREK'); }
  // topraklama: bileşkenin tersi yönünde kısa hat + 3 çizgi
  const g = ((r.wdir != null ? r.wdir : r.lineDir) + 180 - 35) * Math.PI / 180;
  const ex = p.x + h * 2.6 * Math.cos(g), ey = p.y + h * 2.6 * Math.sin(g), nx = -Math.sin(g), ny = Math.cos(g);
  pr.push({ t: 'line', x1: p.x + h * 0.8 * Math.cos(g), y1: p.y + h * 0.8 * Math.sin(g), x2: ex, y2: ey, layer: 'TOPRAK' });
  [1, 0.65, 0.3].forEach((w, k) => { const ox = ex + Math.cos(g) * k * h * 0.3, oy = ey + Math.sin(g) * k * h * 0.3; pr.push({ t: 'line', x1: ox - nx * w * h * 0.8, y1: oy - ny * w * h * 0.8, x2: ox + nx * w * h * 0.8, y2: oy + ny * w * h * 0.8, layer: 'TOPRAK' }); });
}

// ===== DXF (R12 ASCII) =====
const CP1254 = { 'İ': 0xDD, 'ı': 0xFD, 'Ş': 0xDE, 'ş': 0xFE, 'Ğ': 0xD0, 'ğ': 0xF0, 'Ç': 0xC7, 'ç': 0xE7, 'Ö': 0xD6, 'ö': 0xF6, 'Ü': 0xDC, 'ü': 0xFC, '°': 0xB0, '²': 0xB2, '·': 0xB7, 'Â': 0xC2, 'â': 0xE2 };
const DXF_ASCII = { '√': 'kök', 'Σ': 'Top.', 'α': 'a', 'β': 'b', 'φ': 'fi', 'κ': 'k', '≤': '<=', '→': '->', '–': '-' };
function dxfEsc(s, uni) { if (!uni) s = String(s).replace(/[√Σαβφκ≤→–]/g, ch => DXF_ASCII[ch]); return String(s).replace(/[^\x20-\x7E]/g, ch => (!uni && CP1254[ch]) ? ch : '\\U+' + ch.charCodeAt(0).toString(16).toUpperCase().padStart(4, '0')); }
// DXF metnini Windows-1254 baytlarına çevir
function dxfBytes(str) { const out = new Uint8Array(str.length); for (let i = 0; i < str.length; i++) { const ch = str[i], c = str.charCodeAt(i); out[i] = c < 128 ? c : (CP1254[ch] || 63); } return out; }
function toDXF(prims, opt) {
  opt = opt || {}; const ox = opt.ox || 0, oy = opt.oy || 0, K = opt.scale || 1;
  const o = [];
  const g = (c, v) => o.push(String(c), String(v));
  const N = v => (Math.round(v * K * 10000) / 10000).toString();
  g(0, 'SECTION'); g(2, 'HEADER'); g(9, '$ACADVER'); g(1, 'AC1009'); g(9, '$DWGCODEPAGE'); g(3, 'ANSI_1254'); g(9, '$INSUNITS'); g(70, 6); g(0, 'ENDSEC');
  g(0, 'SECTION'); g(2, 'TABLES');
  g(0, 'TABLE'); g(2, 'LTYPE'); g(70, 2);
  g(0, 'LTYPE'); g(2, 'CONTINUOUS'); g(70, 0); g(3, 'Solid line'); g(72, 65); g(73, 0); g(40, 0);
  g(0, 'LTYPE'); g(2, 'DASHED'); g(70, 0); g(3, '__ __ __'); g(72, 65); g(73, 2); g(40, opt.dash * 1.5 || 0.75); g(49, opt.dash || 0.5); g(49, -(opt.dash || 0.5) / 2);
  g(0, 'ENDTAB');
  const layers = [...new Set(prims.map(p => p.layer || opt.layer || 'CER'))];
  g(0, 'TABLE'); g(2, 'LAYER'); g(70, layers.length);
  const LC = Object.assign({ HAT: 1, MEVCUT: 8, DIREK: 7, YAZI: 7, ACI: 7, TOPRAK: 7, PARSEL: 8, PARSEL_NO: 8, ALTLIK: 8, CERCEVE: 7, TABLO: 7, SEMA: 7, BILESKE: 1, LEJANT: 7, YOL: 8 }, opt.layerColors || {});
  layers.forEach(l => { g(0, 'LAYER'); g(2, l); g(70, 0); g(62, LC[l] || 7); g(6, 'CONTINUOUS'); });
  g(0, 'ENDTAB');
  g(0, 'TABLE'); g(2, 'STYLE'); g(70, 1); g(0, 'STYLE'); g(2, 'STANDARD'); g(70, 0); g(40, 0); g(41, 1); g(50, 0); g(71, 0); g(42, 0.3); g(3, 'arial.ttf'); g(4, ''); g(0, 'ENDTAB');
  g(0, 'ENDSEC');
  g(0, 'SECTION'); g(2, 'ENTITIES');
  const head = (type, p) => { g(0, type); g(8, p.layer || opt.layer || 'CER'); if (p.color) g(62, p.color); if (p.dash) g(6, 'DASHED'); };
  prims.forEach(p => {
    if (p.t === 'line') { head('LINE', p); g(10, N(p.x1 + ox)); g(20, N(p.y1 + oy)); g(30, 0); g(11, N(p.x2 + ox)); g(21, N(p.y2 + oy)); g(31, 0); }
    else if (p.t === 'rect') { const q = [[p.x, p.y], [p.x + p.w, p.y], [p.x + p.w, p.y + p.h], [p.x, p.y + p.h]]; for (let k = 0; k < 4; k++) { const a = q[k], b = q[(k + 1) % 4]; head('LINE', p); g(10, N(a[0] + ox)); g(20, N(a[1] + oy)); g(30, 0); g(11, N(b[0] + ox)); g(21, N(b[1] + oy)); g(31, 0); } }
    else if (p.t === 'circle') { head('CIRCLE', p); g(10, N(p.x + ox)); g(20, N(p.y + oy)); g(30, 0); g(40, N(p.r)); }
    else if (p.t === 'arc') { head('ARC', p); g(10, N(p.x + ox)); g(20, N(p.y + oy)); g(30, 0); g(40, N(p.r)); g(50, (Math.round(p.a1 * 1000) / 1000).toString()); g(51, (Math.round(p.a2 * 1000) / 1000).toString()); }
    else if (p.t === 'text') {
      const ha = p.center ? 1 : (p.ha || 0), va = p.center ? 2 : (p.va || 0);
      head('TEXT', p); g(10, N(p.x + ox)); g(20, N(p.y + oy)); g(30, 0); g(40, N(p.h)); g(1, dxfEsc(p.s, opt.uni)); if (p.rot) g(50, (Math.round(p.rot * 1000) / 1000).toString());
      if (ha || va) { g(72, ha); g(73, va); g(11, N(p.x + ox)); g(21, N(p.y + oy)); g(31, 0); }
    }
    else if (p.t === 'wline') { head('POLYLINE', p); g(66, 1); g(10, 0); g(20, 0); g(30, 0); g(40, N(p.w)); g(41, N(p.w));
      [[p.x1, p.y1], [p.x2, p.y2]].forEach(([x, y]) => { g(0, 'VERTEX'); g(8, p.layer || opt.layer || 'CER'); g(10, N(x + ox)); g(20, N(y + oy)); g(30, 0); });
      g(0, 'SEQEND'); g(8, p.layer || opt.layer || 'CER'); }
    else if (p.t === 'solid') { head('SOLID', p); const q = p.pts, v = [q[0], q[1], q[2], q[3] || q[2]];
      const order = [0, 1, 3, 2]; [10, 11, 12, 13].forEach((c, k) => { const pt = v[order[k]]; g(c, N(pt[0] + ox)); g(c + 10, N(pt[1] + oy)); g(c + 20, 0); }); }
    else if (p.t === 'pline') { for (let k = 0; k + 1 < p.pts.length; k++) { head('LINE', p); g(10, N(p.pts[k][0] + ox)); g(20, N(p.pts[k][1] + oy)); g(30, 0); g(11, N(p.pts[k + 1][0] + ox)); g(21, N(p.pts[k + 1][1] + oy)); g(31, 0); } }
  });
  g(0, 'ENDSEC'); g(0, 'EOF');
  return o.join('\r\n') + '\r\n';
}

// ===== SVG =====
function toSVG(prims, box, scale, opts) {
  opts = opts || {};
  const sc = scale || 30, W = box.w * sc, H = (box.top - box.bottom) * sc;
  const X = x => ((x - (box.left || 0)) * sc).toFixed(2), Y = y => ((box.top - y) * sc).toFixed(2);
  const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const ink = opts.ink || '#111', red = '#c0261c', ACI = { 1: '#c0261c', 3: '#1d7a3e', 5: '#1f5fbf', 8: '#777', 7: ink };
  const o = [`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W.toFixed(0)} ${H.toFixed(0)}" width="${W.toFixed(0)}" height="${H.toFixed(0)}" font-family="Times New Roman, serif">`, `<rect width="100%" height="100%" fill="#fff"/>`];
  prims.forEach(p => {
    const col = ACI[p.color] || (p.layer === 'HAT' ? '#c0261c' : p.layer === 'BILESKE' ? '#c0261c' : (p.layer === 'PARSEL' || p.layer === 'PARSEL_NO' || p.layer === 'ALTLIK') ? '#555' : ink);
    if (p.t === 'line') o.push(`<line x1="${X(p.x1)}" y1="${Y(p.y1)}" x2="${X(p.x2)}" y2="${Y(p.y2)}" stroke="${col}" stroke-width="${p.lw || 1.1}"${p.dash ? ' stroke-dasharray="6 4"' : ''}/>`);
    else if (p.t === 'rect') o.push(`<rect x="${X(p.x)}" y="${Y(p.y + p.h)}" width="${(p.w * sc).toFixed(2)}" height="${(p.h * sc).toFixed(2)}" fill="none" stroke="${col}" stroke-width="1.4"/>`);
    else if (p.t === 'circle') o.push(`<circle cx="${X(p.x)}" cy="${Y(p.y)}" r="${(p.r * sc).toFixed(2)}" fill="${p.layer === 'DIREK' || !p.layer ? '#fff' : 'none'}" stroke="${col}" stroke-width="${p.lw || 1.4}"/>`);
    else if (p.t === 'arc') {
      const a1 = p.a1 * Math.PI / 180, a2 = p.a2 * Math.PI / 180;
      let span = ((p.a2 - p.a1) % 360 + 360) % 360;
      o.push(`<path d="M ${X(p.x + p.r * Math.cos(a1))} ${Y(p.y + p.r * Math.sin(a1))} A ${(p.r * sc).toFixed(2)} ${(p.r * sc).toFixed(2)} 0 ${span > 180 ? 1 : 0} 0 ${X(p.x + p.r * Math.cos(a2))} ${Y(p.y + p.r * Math.sin(a2))}" fill="none" stroke="${col}" stroke-width="1.1"/>`);
    } else if (p.t === 'text') { const ha = p.center ? 1 : (p.ha || 0), va = p.center ? 2 : (p.va || 0);
      o.push(`<text x="${X(p.x)}" y="${Y(p.y)}" font-size="${(p.h * sc * 1.25).toFixed(2)}" fill="${col}"${p.bold ? ' font-weight="bold"' : ''}${ha ? ` text-anchor="${ha === 1 ? 'middle' : 'end'}"` : ''}${va === 2 ? ' dominant-baseline="middle"' : ''}${p.rot ? ` transform="rotate(${-p.rot} ${X(p.x)} ${Y(p.y)})"` : ''}>${esc(p.s)}</text>`); }
    else if (p.t === 'wline') o.push(`<line x1="${X(p.x1)}" y1="${Y(p.y1)}" x2="${X(p.x2)}" y2="${Y(p.y2)}" stroke="${col}" stroke-width="${Math.max(1.2, p.w * sc).toFixed(2)}" stroke-linecap="round"/>`);
    else if (p.t === 'solid') o.push(`<polygon points="${p.pts.map(q => X(q[0]) + ',' + Y(q[1])).join(' ')}" fill="${col}"/>`);
    else if (p.t === 'pline') o.push(`<polyline points="${p.pts.map(q => X(q[0]) + ',' + Y(q[1])).join(' ')}" fill="none" stroke="${col}" stroke-width="${p.lw || 1}"${p.dash ? ' stroke-dasharray="6 4"' : ''}/>`);
  });
  o.push('</svg>');
  return o.join('');
}

// ===== DXF okuma (LWPOLYLINE, POLYLINE/VERTEX, LINE) =====
function parseDXF(text) {
  const lines = text.split(/\r?\n/);
  const pairs = [];
  for (let i = 0; i + 1 < lines.length; i += 2) pairs.push([parseInt(lines[i].trim()), lines[i + 1].trim()]);
  let inEnt = false; const ents = []; let cur = null;
  for (let i = 0; i < pairs.length; i++) {
    const [c, v] = pairs[i];
    if (c === 2 && pairs[i - 1] && pairs[i - 1][1] === 'SECTION') inEnt = (v === 'ENTITIES');
    if (!inEnt) continue;
    if (c === 0) { cur = { type: v, g: [] }; ents.push(cur); continue; }
    if (cur) cur.g.push([c, v]);
  }
  const polys = [], segs = [], texts = [];
  let pl = null;
  ents.forEach(e => {
    const layer = (e.g.find(x => x[0] === 8) || [0, '0'])[1];
    if (e.type === 'LWPOLYLINE') {
      const pts = []; let x = null; const fl = +((e.g.find(q => q[0] === 70) || [0, 0])[1]);
      e.g.forEach(([c, v]) => { if (c === 10) x = +v; else if (c === 20 && x !== null) { pts.push({ x, y: +v }); x = null; } });
      if (fl & 1 && pts.length > 2) pts.closed = true;
      polys.push({ layer, pts, closed: !!(fl & 1) });
    } else if (e.type === 'POLYLINE') { pl = { layer, pts: [], closed: !!(+((e.g.find(q => q[0] === 70) || [0, 0])[1]) & 1) }; }
    else if (e.type === 'VERTEX' && pl) { const x = +(e.g.find(q => q[0] === 10) || [0, 0])[1], y = +(e.g.find(q => q[0] === 20) || [0, 0])[1]; pl.pts.push({ x, y }); }
    else if (e.type === 'SEQEND' && pl) { polys.push(pl); pl = null; }
    else if (e.type === 'TEXT' || e.type === 'MTEXT') {
      const f = k => (e.g.find(q => q[0] === k) || [0, null])[1];
      let str = e.type === 'TEXT' ? f(1) : e.g.filter(q => q[0] === 3 || q[0] === 1).map(q => q[1]).join('');
      if (str) { str = str.replace(/\\[A-Za-z][^;]*;/g, '').replace(/[{}]/g, '').replace(/\\P/g, ' ').replace(/%%[dD]/g, '°');
        texts.push({ layer, x: +f(10), y: +f(20), h: +f(40) || 1, rot: +(f(50) || 0), s: str }); }
    }
    else if (e.type === 'LINE') {
      const f = k => +(e.g.find(q => q[0] === k) || [0, 0])[1];
      segs.push({ layer, x1: f(10), y1: f(20), x2: f(11), y2: f(21) });
    }
  });
  polys.forEach(p => { p.len = 0; for (let i = 1; i < p.pts.length; i++) p.len += Math.hypot(p.pts[i].x - p.pts[i - 1].x, p.pts[i].y - p.pts[i - 1].y); });
  return { polys, segs, texts };
}

// ===== ZIP (store) =====
function crc32(buf) { let c, crc = 0xFFFFFFFF; const T = crc32.t || (crc32.t = Array.from({ length: 256 }, (_, n) => { c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; })); for (let i = 0; i < buf.length; i++) crc = T[(crc ^ buf[i]) & 0xFF] ^ (crc >>> 8); return (crc ^ 0xFFFFFFFF) >>> 0; }
function makeZip(files) {
  const enc = new TextEncoder(), parts = [], central = []; let off = 0;
  files.forEach(f => {
    const name = enc.encode(f.name), data = typeof f.data === 'string' ? enc.encode(f.data) : f.data, crc = crc32(data);
    const h = new DataView(new ArrayBuffer(30));
    h.setUint32(0, 0x04034b50, true); h.setUint16(4, 20, true); h.setUint16(6, 0x0800, true); h.setUint16(8, 0, true); h.setUint16(12, 0x21, true);
    h.setUint32(14, crc, true); h.setUint32(18, data.length, true); h.setUint32(22, data.length, true); h.setUint16(26, name.length, true);
    parts.push(new Uint8Array(h.buffer), name, data);
    const c = new DataView(new ArrayBuffer(46));
    c.setUint32(0, 0x02014b50, true); c.setUint16(4, 20, true); c.setUint16(6, 20, true); c.setUint16(8, 0x0800, true); c.setUint16(14, 0x21, true);
    c.setUint32(16, crc, true); c.setUint32(20, data.length, true); c.setUint32(24, data.length, true); c.setUint16(28, name.length, true); c.setUint32(42, off, true);
    central.push(new Uint8Array(c.buffer), name);
    off += 30 + name.length + data.length;
  });
  const csize = central.reduce((s, a) => s + a.length, 0);
  const e = new DataView(new ArrayBuffer(22));
  e.setUint32(0, 0x06054b50, true); e.setUint16(8, files.length, true); e.setUint16(10, files.length, true); e.setUint32(12, csize, true); e.setUint32(16, off, true);
  const all = [...parts, ...central, new Uint8Array(e.buffer)], total = all.reduce((s, a) => s + a.length, 0), out = new Uint8Array(total);
  let p = 0; all.forEach(a => { out.set(a, p); p += a.length; });
  return out;
}

// ===== KESİT KONTROLÜ (akım + gerilim düşümü) =====
const AER_AMP = { 16: 70, 25: 90, 35: 115, 50: 140, 70: 180 };   // ALPEK faz akım taşıma (A)
function kesitCheck(o) {
  // o: {kW, cos, tri, L, kappa, limit, cond}
  const U = o.tri ? (o.U3 || 380) : (o.U1 || 220), P = o.kW * 1000;
  const I = o.tri ? P / (Math.sqrt(3) * U * o.cos) : P / (U * o.cos);
  const rows = AER_LIST.map(n => {
    const S = +n.match(/3x(\d+)/)[1];
    const e = o.tri ? 100 * P * o.L / (o.kappa * S * U * U) : 200 * P * o.L / (o.kappa * S * U * U);
    const amp = AER_AMP[S];
    return { n, S, amp, e: Math.round(e * 100) / 100, okI: I <= amp, okE: e <= o.limit };
  });
  const sel = rows.find(r => r.n === o.cond) || rows[1];
  const best = rows.find(r => r.okI && r.okE);
  return { I: Math.round(I * 10) / 10, U, rows, sel, best };
}
if (typeof module !== 'undefined') module.exports = { POLES, DEFAULTS, BARE, TERTIP, SBA_BOY, SBA_TIP, parseCer, computeAll, sheetPrims, summaryLines, krokiPrims, toDXF, dxfBytes, kesitCheck, poleSymbol, toSVG, parseDXF, makeZip };
