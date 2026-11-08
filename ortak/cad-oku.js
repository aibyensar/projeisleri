// İç tesisat projesini DWG ya da DXF dosyasından okur ve pdf.js belgesi gibi kullanılabilen tek sayfalık bir "belge" döndürür:
//   belge.numPages = 1, belge.getPage(1) → { getViewport({scale, offsetX, offsetY}), render({canvasContext, viewport}), getTextContent() }
// Böylece araçtaki işaretleme, yakınlaştırma, bölge kesip okutma ve yazıdan okuma PDF'teki gibi çalışır.
//
// DWG: LibreDWG (WebAssembly; @mlightcad/libredwg-web, GPL-3.0). DXF: @mlightcad/dxf-json (saf JavaScript, GPL-3.0).
// İkisi de ilk DWG/DXF yüklenince CDN'den yüklenir (PDF ile çalışan kullanıcıya yük getirmez).
// Çizim siyah-beyaz çizilir (çıktı alınmış paftaya benzer): kapalı / donmuş / çizdirilmeyen katmanlar ve Defpoints çizilmez.

const DWG_SURUM = '0.8.2', DXF_SURUM = '1.2.8';
const DWG_JS = `https://cdn.jsdelivr.net/npm/@mlightcad/libredwg-web@${DWG_SURUM}/dist/libredwg-web.js`;
const DWG_WASM = `https://cdn.jsdelivr.net/npm/@mlightcad/libredwg-web@${DWG_SURUM}/wasm`;
const DXF_JS = `https://cdn.jsdelivr.net/npm/@mlightcad/dxf-json@${DXF_SURUM}/+esm`;
const YAZI_TIPI = 'Arial, "Liberation Sans", Helvetica, sans-serif';
const HEDEF_YAZI = 7;
const KAP = 71.6;                         // 100 px Arial'de büyük harf boyu (AutoCAD yazı yüksekliği = büyük harf boyu)                     // sayfa biriminde ortanca yazı yüksekliği (A-boyutu PDF'teki 2,5 mm ≈ 7 pt gibi)

let _dwgLib = null;

/** Dosya (File) → belge. secenek.wasmYeri: libredwg-web.wasm dosyasının bulunduğu klasör (yayında yanında durur) */
export async function cadAc(dosya, secenek = {}) {
  const ad = (dosya.name || '').toLowerCase(), veri = new Uint8Array(await dosya.arrayBuffer());
  const imza = String.fromCharCode(...veri.slice(0, 6));
  const dwg = /^AC10\d\d/.test(imza) || ad.endsWith('.dwg');
  const model = dwg ? await dwgOku(veri, secenek.wasmYeri, imza) : await dxfOku(veri);
  if (secenek.ham) return { model, duz: duzlestir(model) };   // deneme için
  return belgeYap(duzlestir(model));
}

const DWG_SURUMLERI = { AC1032: '2018-2024', AC1027: '2013-2017', AC1024: '2010-2012', AC1021: '2007-2009', AC1018: '2004-2006', AC1015: '2000-2002', AC1014: 'R14', AC1012: 'R13' };

async function dwgOku(veri, wasmYeri, imza) {
  let L;
  try {
    const m = await import(DWG_JS);
    if (!_dwgLib) _dwgLib = m.LibreDwg.create(wasmYeri || DWG_WASM);
    L = { lib: await _dwgLib, tur: m.Dwg_File_Type.DWG };
  } catch (x) {
    _dwgLib = null;
    throw hata('DWG okuyucu yüklenemedi (' + (x && x.message || x) + '). İnternet bağlantınızı kontrol edin; olmazsa AutoCAD\'de "Farklı kaydet → DXF" ile kaydedip DXF yükleyin.');
  }
  let ptr, db;
  try {
    ptr = L.lib.dwg_read_data(veri, L.tur);
    if (!ptr) throw new Error('boş');
    db = L.lib.convert(ptr);
  } catch (x) {
    const s = DWG_SURUMLERI[imza] ? `AutoCAD ${DWG_SURUMLERI[imza]} biçimi` : 'bilinmeyen biçim';
    throw hata(`DWG dosyası açılamadı (${s}). AutoCAD'de "Farklı kaydet" ile "AutoCAD 2018 Çizimi (*.dwg)" ya da DXF olarak kaydedip tekrar deneyin.`);
  } finally { try { ptr && L.lib.dwg_free(ptr); } catch (x) { } }
  const kayit = db.tables.BLOCK_RECORD.entries;
  const bloklar = {};
  let model = null;
  for (const b of kayit) {
    if (/^\*Model_Space$/i.test(b.name)) model = b.entities;
    bloklar[b.name] = { taban: b.basePoint || { x: 0, y: 0 }, ogeler: b.entities || [] };
  }
  if (!model) model = db.entities.filter(e => !e.isInPaperSpace);
  const katman = {};
  for (const k of db.tables.LAYER.entries) katman[k.name] = !(k.off || k.frozen || k.colorIndex < 0 || k.plotFlag === 0 || /^defpoints$/i.test(k.name));
  return { ogeler: model, bloklar, katman, derece: false, kaynak: 'dwg' };
}

async function dxfOku(veri) {
  let metin = new TextDecoder('utf-8').decode(veri);
  // 2007 öncesi DXF'ler ANSI (Türkçe: 1254) yazılır
  const sayfa = (metin.match(/\$DWGCODEPAGE\s*\r?\n\s*3\s*\r?\n\s*(\S+)/) || [])[1] || '';
  const surum = (metin.match(/\$ACADVER\s*\r?\n\s*1\s*\r?\n\s*AC(\d+)/) || [])[1] || '9999';
  if (+surum < 1021 && /125[0-8]/.test(sayfa)) metin = new TextDecoder('windows-' + sayfa.match(/125\d/)[0]).decode(veri);
  else if (metin.includes('\uFFFD')) metin = new TextDecoder('windows-1254').decode(veri);
  let db;
  try {
    const m = await import(DXF_JS);
    db = new m.DxfParser().parseSync(metin);
  } catch (x) { throw hata('DXF dosyası okunamadı (' + (x && x.message || x) + ').'); }
  const bloklar = {};
  for (const [ad, b] of Object.entries(db.blocks || {})) bloklar[ad] = { taban: b.position || { x: 0, y: 0 }, ogeler: b.entities || [] };
  const katman = {};
  for (const k of (db.tables && db.tables.LAYER && db.tables.LAYER.entries) || [])
    katman[k.name] = !((k.standardFlag & 1) || k.colorIndex < 0 || k.isPlotting === false || /^defpoints$/i.test(k.name));
  return { ogeler: (db.entities || []).filter(e => !e.inPaperSpace && !e.isInPaperSpace), bloklar, katman, derece: true, kaynak: 'dxf' };
}

const hata = m => Object.assign(new Error(m), { kullanici: true });

// ---------- Düzleştirme: bloklar açılır, her şey dünya koordinatında çizgi / dolgu / yazı olur ----------
// M = [a, b, c, d, e, f]: x' = a·x + c·y + e, y' = b·x + d·y + f
const BIRIM = [1, 0, 0, 1, 0, 0];
const carp = (M, N) => [M[0] * N[0] + M[2] * N[1], M[1] * N[0] + M[3] * N[1], M[0] * N[2] + M[2] * N[3], M[1] * N[2] + M[3] * N[3],
  M[0] * N[4] + M[2] * N[5] + M[4], M[1] * N[4] + M[3] * N[5] + M[5]];
const uygula = (M, x, y) => [M[0] * x + M[2] * y + M[4], M[1] * x + M[3] * y + M[5]];
const tasi = (x, y) => [1, 0, 0, 1, x, y];
const dondur = a => [Math.cos(a), Math.sin(a), -Math.sin(a), Math.cos(a), 0, 0];
const olcekle = (sx, sy) => [sx, 0, 0, sy, 0, 0];
const ocs = e => (e.extrusionDirection && e.extrusionDirection.z < -0.5) ? olcekle(-1, 1) : BIRIM;   // aynalanmış (z = -1) nesneler

function yay(cx, cy, r, a0, a1, ccw = true) {             // radyan; nokta dizisi
  let s = ccw ? a1 - a0 : a0 - a1;
  while (s <= 1e-9) s += 2 * Math.PI;
  const n = Math.max(6, Math.min(180, Math.ceil(s / (2 * Math.PI) * 96)));
  const p = [];
  for (let i = 0; i <= n; i++) { const a = a0 + (ccw ? 1 : -1) * s * i / n; p.push(cx + r * Math.cos(a), cy + r * Math.sin(a)); }
  return p;
}
function cikinti(x0, y0, x1, y1, b) {                     // çoklu çizgi şişkinliği (bulge) → yay noktaları (ilk nokta hariç)
  const d = Math.hypot(x1 - x0, y1 - y0); if (!b || Math.abs(b) < 1e-9 || d < 1e-12) return [x1, y1];
  const ab = Math.abs(b), r = d * (1 + ab * ab) / (4 * ab), sag = ab * d / 2;          // yarıçap, sehim
  const nx = -(y1 - y0) / d, ny = (x1 - x0) / d, o = (r - sag) * Math.sign(b);          // merkez: kirişin solunda (b > 0)
  const cx = (x0 + x1) / 2 + nx * o, cy = (y0 + y1) / 2 + ny * o;
  return yay(cx, cy, r, Math.atan2(y0 - cy, x0 - cx), Math.atan2(y1 - cy, x1 - cx), b > 0).slice(2);
}
function elips(c, maj, oran, t0, t1) {
  const R = Math.hypot(maj.x, maj.y), rot = Math.atan2(maj.y, maj.x);
  let s = t1 - t0; while (s <= 1e-9) s += 2 * Math.PI;
  const n = Math.max(12, Math.ceil(s / (2 * Math.PI) * 96)), p = [];
  for (let i = 0; i <= n; i++) {
    const t = t0 + s * i / n, x = R * Math.cos(t), y = R * oran * Math.sin(t);
    p.push(c.x + x * Math.cos(rot) - y * Math.sin(rot), c.y + x * Math.sin(rot) + y * Math.cos(rot));
  }
  return p;
}
function bspline(e) {                                       // kontrol noktaları + düğümler varsa de Boor; yoksa geçiş noktaları
  const P = e.controlPoints || [], U = e.knots || [], k = e.degree || 3;
  if (P.length > k && U.length === P.length + k + 1) {
    const out = [], u0 = U[k], u1 = U[P.length], n = Math.min(400, P.length * 12);
    for (let i = 0; i <= n; i++) {
      let u = u0 + (u1 - u0) * i / n; if (i === n) u -= 1e-9;
      let s = k; while (s < P.length - 1 && U[s + 1] <= u) s++;
      const d = []; for (let j = 0; j <= k; j++) d.push([P[s - k + j].x, P[s - k + j].y]);
      for (let r = 1; r <= k; r++) for (let j = k; j >= r; j--) {
        const a = (u - U[s - k + j]) / ((U[j + 1 + s - r] - U[s - k + j]) || 1);
        d[j] = [(1 - a) * d[j - 1][0] + a * d[j][0], (1 - a) * d[j - 1][1] + a * d[j][1]];
      }
      out.push(d[k][0], d[k][1]);
    }
    return out;
  }
  const F = (e.fitPoints && e.fitPoints.length ? e.fitPoints : P);
  return F.flatMap(p => [p.x, p.y]);
}

// MTEXT biçim kodlarını temizler → satırlar
export function mtextSatirlar(s) {
  s = String(s || '');
  s = s.replace(/\\[Pp]/g, '\n').replace(/\\~/g, ' ').replace(/\\U\+([0-9A-Fa-f]{4})/g, (_, h) => String.fromCharCode(parseInt(h, 16)));
  s = s.replace(/\\S([^;]*?)[#^/]([^;]*);/g, '$1/$2');                       // üst/alt yazı
  s = s.replace(/\\[ACcFfHhQqTtWw][^;\\]*;/g, '').replace(/\\[LlOoKkNn]/g, '').replace(/\\p[^;]*;/g, '');
  s = s.replace(/\\([\\{}])/g, '\u0000$1').replace(/[{}]/g, '').replace(/\u0000/g, '');
  return ozelKod(s).split('\n');
}
const ozelKod = s => String(s || '').replace(/%%[cC]/g, 'Ø').replace(/%%[dD]/g, '°').replace(/%%[pP]/g, '±').replace(/%%[uUoOkK]/g, '').replace(/%%%/g, '%')
  .replace(/%%(\d{3})/g, (_, n) => String.fromCharCode(+n)).replace(/\\U\+([0-9A-Fa-f]{4})/g, (_, h) => String.fromCharCode(parseInt(h, 16)));

let _olcu = null;
function genislik(s) {                                    // 100 px yazı tipinde metin genişliği (yerel yazı birimi)
  if (!_olcu) { const c = document.createElement('canvas'); _olcu = c.getContext('2d'); _olcu.font = `100px ${YAZI_TIPI}`; }
  return _olcu.measureText(s).width;
}

function duzlestir(m) {
  const A = m.derece ? Math.PI / 180 : 1;
  const P = [], Y = [];                                     // P: çizgi/dolgu, Y: yazı
  const tabloBlok = m.kaynak === 'dwg';                     // libredwg tablo nesnesinin blok adını vermez → *T blokları ayrıca çizilir
  let tabloVar = false;
  const gorunur = (e, ust) => {
    if (e.isVisible === false || e.visible === false) return false;
    const k = (e.layer === '0' && ust) ? ust : e.layer;
    return m.katman[k] !== false;
  };
  const cizgi = (M, pts, kapali, lw) => {
    if (pts.length < 4) return;
    const q = new Float64Array(pts.length);
    for (let i = 0; i < pts.length; i += 2) { const r = uygula(M, pts[i], pts[i + 1]); q[i] = r[0]; q[i + 1] = r[1]; }
    P.push({ p: q, k: kapali, d: 0, lw });
  };
  const dolgu = (M, yollar, tur) => {
    const ql = yollar.filter(p => p.length >= 6).map(pts => { const q = new Float64Array(pts.length); for (let i = 0; i < pts.length; i += 2) { const r = uygula(M, pts[i], pts[i + 1]); q[i] = r[0]; q[i + 1] = r[1]; } return q; });
    if (ql.length) P.push({ yollar: ql, d: tur });
  };
  const yazi = (M, s, x, y, h, rot, xs, yatay, dikey, genis) => {   // yatay: 0 sol,1 orta,2 sağ; dikey: 0 taban,1 alt,2 orta,3 üst
    s = String(s); if (!s.trim() || !(h > 0)) return;
    const T = carp(carp(carp(M, tasi(x, y)), dondur(rot || 0)), olcekle((xs || 1) * h / KAP, h / KAP));
    // T: yerel yazı çerçevesi (100 px yazı tipi, y yukarı) → dünya. Hizalama kayması yerel birimde
    const w = genislik(s), dx = yatay === 1 ? -w / 2 : yatay === 2 ? -w : 0;
    const dy = dikey === 1 ? 22 : dikey === 2 ? -KAP / 2 : dikey === 3 ? -KAP : 0;
    let F = carp(T, tasi(dx, dy));
    if (genis > 0 && w > 0) F = carp(T, olcekle(genis * KAP / ((xs || 1) * h * w), 1));   // hizala / sığdır: iki nokta arası
    Y.push({ s, M: F, w });
  };
  const yaziOge = (M, t, metin) => {                        // TEXT / ATTRIB
    const ha = t.halign ?? t.horizontalJustification ?? 0, va = t.valign ?? t.verticalJustification ?? 0;
    const sp = t.startPoint || t.insertionPoint || { x: 0, y: 0 };
    const ap = t.endPoint || t.alignmentPoint;
    const M2 = carp(M, ocs(t));
    if ((ha === 3 || ha === 5) && ap) {                     // hizalı / sığdır
      const L = Math.hypot(ap.x - sp.x, ap.y - sp.y);
      yazi(M2, ozelKod(metin), sp.x, sp.y, t.textHeight, Math.atan2(ap.y - sp.y, ap.x - sp.x), t.xScale, 0, 0, L);
      return;
    }
    const o = (ha || va) && ap && (ap.x || ap.y) ? ap : sp;
    yazi(M2, ozelKod(metin), o.x, o.y, t.textHeight, (t.rotation || 0) * A, t.xScale, ha === 4 ? 1 : ha, ha === 4 ? 2 : va);
  };
  const mtext = (M, e) => {
    const h = e.textHeight || e.height || 2.5, gen = e.rectWidth || e.width || 0;
    let rot = (e.rotation || 0) * A;
    if (e.direction && (e.direction.x || e.direction.y)) rot = Math.atan2(e.direction.y, e.direction.x);
    const ek = e.attachmentPoint || 1, yat = (ek - 1) % 3, dik = Math.floor((ek - 1) / 3);
    const satir = [];
    for (const s of mtextSatirlar(e.text)) {                 // kutu genişliğine göre sözcük kaydırma
      if (!(gen > 0)) { satir.push(s); continue; }
      let cur = '';
      for (const k of s.split(/(\s+)/)) {
        const den = cur + k;
        if (cur.trim() && genislik(den.trimEnd()) * h / 100 > gen * 1.02) { satir.push(cur.trimEnd()); cur = k.trimStart(); } else cur = den;
      }
      satir.push(cur);
    }
    const ara = h * 1.667 * (e.lineSpacing || e.lineSpacingFactor || 1);
    const top = (satir.length - 1) * ara;
    const y0 = dik === 0 ? -h : dik === 1 ? top / 2 - h / 2 : top;   // ilk satırın tabanı (ekleme noktasına göre)
    const xr = yat === 0 ? 0 : yat === 1 ? 0 : 0;
    const p = e.insertionPoint || { x: 0, y: 0 };
    const M2 = carp(carp(M, tasi(p.x, p.y)), dondur(rot));       // MTEXT dünya koordinatında
    satir.forEach((s, i) => yazi(M2, s, xr, y0 - i * ara, h, 0, 1, yat, 0));
  };
  const hatchYollar = e => (e.boundaryPaths || []).map(y => {
    if (y.vertices) {
      const v = y.vertices, p = [v[0].x, v[0].y];
      for (let i = 0; i < v.length; i++) {
        const a = v[i], b = v[(i + 1) % v.length];
        if (i === v.length - 1 && !(y.isClosed ?? true)) break;
        p.push(...cikinti(a.x, a.y, b.x, b.y, a.bulge || 0));
      }
      return p;
    }
    const p = [];
    for (const k of y.edges || []) {
      if (k.type === 1) p.push(k.start.x, k.start.y, k.end.x, k.end.y);
      else if (k.type === 2) { const a0 = k.startAngle * A, a1 = k.endAngle * A, ccw = k.isCCW !== false; p.push(...yay(k.center.x, k.center.y, k.radius, ccw ? a0 : -a0, ccw ? a1 : -a1, ccw)); }
      else if (k.type === 3) { const ccw = k.isCCW !== false, maj = k.end || k.majorAxisEndPoint;
        const oran = k.lengthOfMinorAxis ?? k.axisRatio ?? 1;              // DXF 40: küçük eksen / büyük eksen
        let t0 = k.startAngle * A, t1 = k.endAngle * A; if (!ccw) { [t0, t1] = [-t1, -t0]; }
        p.push(...elips(k.center, maj, oran > 0 ? oran : 1, t0, t1)); }
      else if (k.type === 4) p.push(...bspline(k));
    }
    return p;
  });
  const kalin = e => (e.lineweight > 0 && e.lineweight >= 40) || (e.constantWidth > 0.3);

  function ciz(e, M, ust, derin) {
    if (!gorunur(e, ust)) return;
    const lay = (e.layer === '0' && ust) ? ust : e.layer;
    const O = carp(M, ocs(e));
    switch (e.type) {
      case 'LINE': cizgi(M, [e.startPoint.x, e.startPoint.y, e.endPoint.x, e.endPoint.y], false, kalin(e)); break;
      case 'CIRCLE': cizgi(O, yay(e.center.x, e.center.y, e.radius, 0, 2 * Math.PI), true, kalin(e)); break;
      case 'ARC': cizgi(O, yay(e.center.x, e.center.y, e.radius, e.startAngle * A, e.endAngle * A), false, kalin(e)); break;
      case 'ELLIPSE': cizgi(M, elips(e.center, e.majorAxisEndPoint, e.axisRatio, e.startAngle, e.endAngle), false, kalin(e)); break;
      case 'LWPOLYLINE': case 'POLYLINE': case 'POLYLINE2D': case 'POLYLINE3D': {
        const v = (e.vertices || []).map(q => q.vertex || q).filter(q => !(q.flag & 16));
        if (!v.length || (e.flag & 64) || (e.flag & 16)) break;
        const kap = !!(e.flag & 1) || e.isClosed === true;
        const p = [v[0].x, v[0].y];
        for (let i = 0; i < v.length - (kap ? 0 : 1); i++) { const a = v[i], b = v[(i + 1) % v.length]; p.push(...cikinti(a.x, a.y, b.x, b.y, a.bulge || 0)); }
        const Mm = e.type === 'POLYLINE3D' ? M : O;
        if (e.constantWidth > 0.5 && v.length === 2) cizgi(Mm, p, false, true); else cizgi(Mm, p, false, kalin(e));
        break;
      }
      case 'SPLINE': cizgi(M, bspline(e), !!(e.flag & 1), kalin(e)); break;
      case 'SOLID': case 'TRACE': {
        const c = e.points || [e.corner1, e.corner2, e.corner3, e.corner4 || e.corner3];
        if (c.length >= 3) dolgu(O, [[c[0].x, c[0].y, c[1].x, c[1].y, (c[3] || c[2]).x, (c[3] || c[2]).y, c[2].x, c[2].y]], 1);
        break;
      }
      case '3DFACE': { const c = [e.corner1, e.corner2, e.corner3, e.corner4 || e.corner3].filter(Boolean); cizgi(M, c.flatMap(q => [q.x, q.y]), true, false); break; }
      case 'HATCH': {
        const yol = hatchYollar(e); if (!yol.length) break;
        const kati = e.solidFill === 1 || /^SOLID$/i.test(e.patternName || '');
        dolgu(O, yol, kati ? 1 : 2);
        break;
      }
      case 'TEXT': yaziOge(M, e, e.text); break;
      case 'ATTRIB': { const t = e.text && typeof e.text === 'object' ? e.text : e; if (!(e.flags & 1) && !(e.attributeFlag & 1)) yaziOge(M, Object.assign({}, t, { extrusionDirection: e.extrusionDirection }), t.text ?? e.text); break; }
      case 'MTEXT': mtext(M, e); break;
      case 'LEADER': { const v = e.vertices || []; if (v.length > 1) cizgi(M, v.flatMap(q => [q.x, q.y]), false, false); break; }
      case 'MULTILEADER': {
        const c = e.contextData || e; const mt = c.mtextContent || c.textContent;
        const t = mt && (mt.text || mt.defaultText || (typeof mt === 'string' ? mt : ''));
        const p = mt && (mt.textLocation || mt.anchorPoint || c.textLocation);
        if (t && p) mtext(M, { text: t, insertionPoint: p, textHeight: c.textHeight || mt.textHeight || 2.5, attachmentPoint: 1, rectWidth: mt.textWidth || 0 });
        break;
      }
      case 'DIMENSION': case 'ARC_DIMENSION': if (e.name && m.bloklar[e.name] && derin < 8) blokCiz(m.bloklar[e.name], M, lay, derin + 1, true); break;
      case 'ACAD_TABLE': tabloVar = true; if (e.name && m.bloklar[e.name] && derin < 8) blokCiz(m.bloklar[e.name], M, lay, derin + 1, true); break;
      case 'INSERT': {
        const b = m.bloklar[e.name]; if (!b || derin > 12) break;
        const sx = e.xScale ?? 1, sy = e.yScale ?? 1, rot = (e.rotation || 0) * A;
        const nc = Math.max(1, e.columnCount || 1), nr = Math.max(1, e.rowCount || 1);
        for (let r = 0; r < nr; r++) for (let c = 0; c < nc; c++) {
          let T = carp(O, tasi(e.insertionPoint.x, e.insertionPoint.y));
          T = carp(T, dondur(rot));
          T = carp(T, tasi(c * (e.columnSpacing || 0), r * (e.rowSpacing || 0)));
          T = carp(T, olcekle(sx, sy));
          T = carp(T, tasi(-(b.taban.x || 0), -(b.taban.y || 0)));
          blokCiz(b, T, lay, derin + 1, false);
        }
        for (const a of e.attribs || e.attributes || []) ciz(a, M, lay, derin);
        break;
      }
      default: break;                                       // XLINE, RAY, POINT, IMAGE, WIPEOUT, VIEWPORT, 3DSOLID… çizilmez
    }
  }
  function blokCiz(b, M, ust, derin, anonim) {
    for (const e of b.ogeler) { if (e.type === 'ATTDEF') continue; ciz(e, M, ust, derin); }
  }
  for (const e of m.ogeler) ciz(e, BIRIM, null, 0);
  if (tabloBlok && tabloVar) for (const [ad, b] of Object.entries(m.bloklar)) if (/^\*T\d/i.test(ad)) blokCiz(b, BIRIM, null, 1, true);
  return { P, Y };
}

// ---------- Sayfa ----------
function kutu(o) {
  let a = Infinity, b = Infinity, c = -Infinity, d = -Infinity;
  const ekle = q => { for (let i = 0; i < q.length; i += 2) { const x = q[i], y = q[i + 1]; if (x < a) a = x; if (x > c) c = x; if (y < b) b = y; if (y > d) d = y; } };
  if (o.p) ekle(o.p); else if (o.yollar) o.yollar.forEach(ekle);
  else { const M = o.M, p = (x, y) => [M[0] * x + M[2] * y + M[4], M[1] * x + M[3] * y + M[5]]; ekle([...p(0, -22), ...p(o.w, -22), ...p(0, 90), ...p(o.w, 90)]); }
  return [a, b, c, d];
}
const yuzde = (l, q) => l[Math.min(l.length - 1, Math.max(0, Math.floor(q * (l.length - 1))))];

function belgeYap({ P, Y }) {
  const hepsi = P.concat(Y);
  if (!hepsi.length) throw hata('Çizimde (model alanında) görünür nesne bulunamadı.');
  for (const o of hepsi) o.bb = kutu(o);
  // Çizimin asıl bölgesi: tek tük uzak nesneler (yanlışlıkla uzağa düşmüş çizgiler) sayfayı büyütmesin
  const cx = hepsi.map(o => (o.bb[0] + o.bb[2]) / 2).sort((a, b) => a - b), cy = hepsi.map(o => (o.bb[1] + o.bb[3]) / 2).sort((a, b) => a - b);
  const qx0 = yuzde(cx, 0.003), qx1 = yuzde(cx, 0.997), qy0 = yuzde(cy, 0.003), qy1 = yuzde(cy, 0.997);
  const pay = Math.max(qx1 - qx0, qy1 - qy0, 1e-6) * 0.15;
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const o of hepsi) {
    const mx = (o.bb[0] + o.bb[2]) / 2, my = (o.bb[1] + o.bb[3]) / 2;
    if (mx < qx0 - pay || mx > qx1 + pay || my < qy0 - pay || my > qy1 + pay) continue;
    x0 = Math.min(x0, o.bb[0]); y0 = Math.min(y0, o.bb[1]); x1 = Math.max(x1, o.bb[2]); y1 = Math.max(y1, o.bb[3]);
  }
  const ken = Math.max(x1 - x0, y1 - y0) * 0.01; x0 -= ken; y0 -= ken; x1 += ken; y1 += ken;
  // Ölçek: ortanca yazı yüksekliği HEDEF_YAZI olacak şekilde (PDF'teki punto ölçüsüne yakın; okuma eşikleri aynı kalır)
  const hl = Y.map(o => Math.hypot(o.M[2], o.M[3]) * KAP).filter(h => h > 0).sort((a, b) => a - b);
  let k = hl.length ? HEDEF_YAZI / yuzde(hl, 0.5) : 2000 / Math.max(x1 - x0, y1 - y0);
  const enBuyuk = Math.max(x1 - x0, y1 - y0) * k;
  if (enBuyuk > 60000) k *= 60000 / enBuyuk; else if (enBuyuk < 600) k *= 600 / enBuyuk;
  const W = (x1 - x0) * k, H = (y1 - y0) * k;
  // Sayfa koordinatına çevir (y yukarı, sol alt 0,0)
  const S = [k, 0, 0, k, -x0 * k, -y0 * k];
  for (const o of P) {
    if (o.p) { for (let i = 0; i < o.p.length; i += 2) { o.p[i] = (o.p[i] - x0) * k; o.p[i + 1] = (o.p[i + 1] - y0) * k; } }
    else for (const q of o.yollar) for (let i = 0; i < q.length; i += 2) { q[i] = (q[i] - x0) * k; q[i + 1] = (q[i + 1] - y0) * k; }
    o.bb = kutu(o);
  }
  for (const o of Y) { o.M = carp(S, o.M); o.bb = kutu(o); }
  // Büyük katı taramalar açık gri çizilir (yazıyı kapatmasın); küçükler (oklar, işaretler) siyah
  const esik = (HEDEF_YAZI * 6) ** 2;
  for (const o of P) if (o.d === 1 && (o.bb[2] - o.bb[0]) * (o.bb[3] - o.bb[1]) > esik) o.d = 2;
  const dolgular = P.filter(o => o.d), cizgiler = P.filter(o => !o.d);

  const sayfa = {
    getViewport({ scale = 1, offsetX = 0, offsetY = 0 } = {}) {
      return { width: W * scale, height: H * scale, scale, transform: [scale, 0, 0, -scale, offsetX, offsetY + H * scale] };
    },
    render({ canvasContext: cx, viewport: vp }) {
      let iptal = false;
      const promise = (async () => {
        const [a, , , d, e, f] = vp.transform, s = a;
        const cw = cx.canvas.width, ch = cx.canvas.height;
        // görünen bölge (sayfa koordinatı)
        const gx0 = (0 - e) / a, gx1 = (cw - e) / a, gy1 = (0 - f) / d, gy0 = (ch - f) / d;
        const gor = bb => bb[2] >= gx0 && bb[0] <= gx1 && bb[3] >= gy0 && bb[1] <= gy1;
        const kucuk = bb => (bb[2] - bb[0]) * s < 0.4 && (bb[3] - bb[1]) * s < 0.4;
        cx.save();
        cx.setTransform(a, 0, 0, d, e, f);
        cx.lineJoin = 'round'; cx.lineCap = 'round';
        let n = 0;
        const bekle = async () => { if (++n % 4000 === 0) { await new Promise(r => setTimeout(r, 0)); if (iptal) throw new Error('iptal'); } };
        try {
          for (const o of dolgular) {
            if (!gor(o.bb)) continue;
            cx.beginPath();
            for (const q of o.yollar) { cx.moveTo(q[0], q[1]); for (let i = 2; i < q.length; i += 2) cx.lineTo(q[i], q[i + 1]); cx.closePath(); }
            cx.fillStyle = o.d === 1 ? '#000' : '#d9d9d9'; cx.fill('evenodd');
            await bekle();
          }
          cx.strokeStyle = '#000';
          for (const kal of [false, true]) {
            cx.lineWidth = (kal ? 1.8 : 0.9) / s;
            cx.beginPath();
            let say = 0;
            for (const o of cizgiler) {
              if (!!o.lw !== kal || !gor(o.bb) || kucuk(o.bb)) continue;
              const q = o.p; cx.moveTo(q[0], q[1]); for (let i = 2; i < q.length; i += 2) cx.lineTo(q[i], q[i + 1]); if (o.k) cx.closePath();
              if (++say % 2000 === 0) { cx.stroke(); cx.beginPath(); await bekle(); }
            }
            cx.stroke();
          }
          cx.fillStyle = '#000'; cx.font = `100px ${YAZI_TIPI}`; cx.textBaseline = 'alphabetic'; cx.textAlign = 'left';
          for (const o of Y) {
            if (!gor(o.bb)) continue;
            const M = o.M, hp = Math.hypot(M[2], M[3]) * KAP * s;
            if (hp < 1.2) { if (hp > 0.3) { cx.save(); cx.transform(M[0], M[1], -M[2], -M[3], M[4], M[5]); cx.fillStyle = '#999'; cx.fillRect(0, -50, o.w, 45); cx.restore(); } continue; }
            cx.save(); cx.transform(M[0], M[1], -M[2], -M[3], M[4], M[5]); cx.fillText(o.s, 0, 0); cx.restore();
            await bekle();
          }
        } finally { cx.restore(); }
      })();
      return { promise, cancel() { iptal = true; } };
    },
    async getTextContent() {
      return { items: Y.map(o => { const M = o.M, h = Math.hypot(M[2], M[3]) * KAP, wx = Math.hypot(M[0], M[1]) * o.w;
        const yon = Math.atan2(M[1], M[0]), c = Math.cos(yon), sn = Math.sin(yon);
        return { str: o.s, transform: [h * c, h * sn, -h * sn, h * c, M[4], M[5]], width: wx, height: h }; }) };
    },
  };
  return { numPages: 1, getPage: async () => sayfa, cad: true, boyut: [W, H], nesne: hepsi.length };
}
