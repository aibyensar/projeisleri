// ===== CORE 2: coğrafi içe aktarma, proje krokisi, mühendislik cer raporu =====

// --- TM3 projeksiyonu (GRS80, k0 = 1, FE = 500000) — Türkiye ITRF96 TM3 dilimleri
function tmProject(lon, lat, lon0) {
  const a = 6378137, f = 1 / 298.257222101, e2 = f * (2 - f), ep2 = e2 / (1 - e2), k0 = 1;
  const d2r = Math.PI / 180, ph = lat * d2r, lam = (lon - lon0) * d2r;
  const N = a / Math.sqrt(1 - e2 * Math.sin(ph) ** 2), T = Math.tan(ph) ** 2, C = ep2 * Math.cos(ph) ** 2, A = Math.cos(ph) * lam;
  const e4 = e2 * e2, e6 = e4 * e2;
  const M = a * ((1 - e2 / 4 - 3 * e4 / 64 - 5 * e6 / 256) * ph - (3 * e2 / 8 + 3 * e4 / 32 + 45 * e6 / 1024) * Math.sin(2 * ph) + (15 * e4 / 256 + 45 * e6 / 1024) * Math.sin(4 * ph) - (35 * e6 / 3072) * Math.sin(6 * ph));
  const x = k0 * N * (A + (1 - T + C) * A ** 3 / 6 + (5 - 18 * T + T * T + 72 * C - 58 * ep2) * A ** 5 / 120) + 500000;
  const y = k0 * (M + N * Math.tan(ph) * (A * A / 2 + (5 - T + 9 * C + 4 * C * C) * A ** 4 / 24 + (61 - 58 * T + T * T + 600 * C - 330 * ep2) * A ** 6 / 720));
  return { x, y };
}
function parcelLabel(props) {
  if (!props) return '';
  const keys = Object.keys(props);
  const ada = keys.find(k => /^ada(no|_no)?$/i.test(k) || /adano/i.test(k));
  const par = keys.find(k => /^parsel(no|_no)?$/i.test(k) || /parselno/i.test(k));
  if (ada || par) return `${ada ? props[ada] : ''}${ada && par ? '/' : ''}${par ? props[par] : ''}`;
  const nm = keys.find(k => /^(name|ad|label|etiket)$/i.test(k));
  return nm ? String(props[nm]) : '';
}
// GeoJSON / KML -> [{ll:[[lon,lat]...], label}]
function parseGeo(text) {
  const out = [];
  const t = text.trim();
  if (t[0] === '{' || t[0] === '[') {
    const j = JSON.parse(t);
    const feats = j.type === 'FeatureCollection' ? j.features : j.type === 'Feature' ? [j] : Array.isArray(j) ? j : [{ geometry: j, properties: {} }];
    feats.forEach(f => {
      const g = f.geometry; if (!g) return; const lab = parcelLabel(f.properties);
      const rings = g.type === 'Polygon' ? [g.coordinates[0]] : g.type === 'MultiPolygon' ? g.coordinates.map(p => p[0]) : g.type === 'LineString' ? [g.coordinates] : [];
      rings.forEach(r => out.push({ ll: r.map(c => [c[0], c[1]]), label: lab, line: g.type === 'LineString' }));
    });
  } else {
    const pms = t.split(/<Placemark[\s>]/i).slice(1);
    pms.forEach(pm => {
      const nm = (pm.match(/<name>([\s\S]*?)<\/name>/i) || [])[1] || '';
      const props = {}; (pm.match(/<SimpleData[^>]*name="([^"]+)"[^>]*>([\s\S]*?)<\/SimpleData>/gi) || []).forEach(sd => { const m = sd.match(/name="([^"]+)"[^>]*>([\s\S]*?)</i); if (m) props[m[1]] = m[2].trim(); });
      (pm.match(/<Data[^>]*name="([^"]+)"[^>]*>\s*<value>([\s\S]*?)<\/value>/gi) || []).forEach(sd => { const m = sd.match(/name="([^"]+)"[^>]*>\s*<value>([\s\S]*?)</i); if (m) props[m[1]] = m[2].trim(); });
      const lab = parcelLabel(props) || nm.replace(/<!\[CDATA\[|\]\]>/g, '').trim();
      (pm.match(/<coordinates>([\s\S]*?)<\/coordinates>/gi) || []).slice(0, 1).forEach(c => {
        const pts = c.replace(/<\/?coordinates>/gi, '').trim().split(/\s+/).map(s => s.split(',').map(Number)).filter(q => q.length >= 2 && !isNaN(q[0]));
        if (pts.length >= 2) out.push({ ll: pts.map(q => [q[0], q[1]]), label: lab, line: !/Polygon/i.test(pm) });
      });
    });
  }
  return out;
}
function projectGeo(items) {
  const all = items.flatMap(i => i.ll); if (!all.length) return { parcels: [], lon0: 27 };
  const mlon = all.reduce((s, c) => s + c[0], 0) / all.length, lon0 = Math.round(mlon / 3) * 3;
  const parcels = items.map(i => { const pts = i.ll.map(c => tmProject(c[0], c[1], lon0)); if (pts.length > 2 && Math.hypot(pts[0].x - pts[pts.length - 1].x, pts[0].y - pts[pts.length - 1].y) < 0.01) pts.pop(); return { pts, label: i.label, open: i.line }; });
  return { parcels, lon0 };
}
function polyCentroid(pts) {
  let A = 0, cx = 0, cy = 0;
  for (let i = 0; i < pts.length; i++) { const p = pts[i], q = pts[(i + 1) % pts.length], c = p.x * q.y - q.x * p.y; A += c; cx += (p.x + q.x) * c; cy += (p.y + q.y) * c; }
  if (Math.abs(A) < 1e-9) return { x: pts.reduce((s, p) => s + p.x, 0) / pts.length, y: pts.reduce((s, p) => s + p.y, 0) / pts.length };
  return { x: cx / (3 * A), y: cy / (3 * A) };
}

// --- ortak çizim yardımcıları
function arrowPr(pr, x1, y1, x2, y2, o) {
  o = o || {}; const L = Math.hypot(x2 - x1, y2 - y1); if (L < 1e-9) return;
  const ux = (x2 - x1) / L, uy = (y2 - y1) / L, hl = o.head || L * 0.18, hw = hl * 0.38;
  const bx = x2 - ux * hl, by = y2 - uy * hl;
  if (o.w) pr.push({ t: 'wline', x1, y1, x2: bx, y2: by, w: o.w, layer: o.layer, color: o.color });
  else pr.push({ t: 'line', x1, y1, x2: bx, y2: by, layer: o.layer, color: o.color, lw: o.lw });
  pr.push({ t: 'solid', pts: [[x2, y2], [bx - uy * hw, by + ux * hw], [bx + uy * hw, by - ux * hw]], layer: o.layer, color: o.color });
}
// --- topraklama sembolleri: İT = toprak işareti (3 kademeli çizgi), KT = daire içinde toprak işareti (koruma topraklaması)
function groundPr(pr, x, y, dirDeg, h, label, layer, kind, start) {
  const r = dirDeg * Math.PI / 180, ux = Math.cos(r), uy = Math.sin(r);
  const s0 = start == null ? h * 0.9 : start, L = s0 + h * 2.4;
  const ex = x + ux * L, ey = y + uy * L, w = h * 0.15;
  pr.push({ t: 'wline', x1: x + ux * s0, y1: y + uy * s0, x2: ex, y2: ey, w, layer });
  // çizgiler hat yönüne dik: iletken doğrultusuna (u) dik n
  const nx = -uy, ny = ux;
  [1, 0.64, 0.28].forEach((k, i) => { const ox = ex + ux * i * h * 0.4, oy = ey + uy * i * h * 0.4; pr.push({ t: 'wline', x1: ox - nx * k * h * 0.95, y1: oy - ny * k * h * 0.95, x2: ox + nx * k * h * 0.95, y2: oy + ny * k * h * 0.95, w, layer }); });
  const cx = ex + ux * h * 0.4, cy = ey + uy * h * 0.4;
  if (kind === 'KT') { pr.push({ t: 'circle', x: cx, y: cy, r: h * 1.2, layer, lw: 1.6 }); pr.push({ t: 'circle', x: cx, y: cy, r: h * 1.2 - w * 0.6, layer }); }
  if (label) { const d = kind === 'KT' ? h * 2.3 : h * 1.9, lx = cx + ux * d, ly = cy + uy * d; pr.push({ t: 'text', x: lx, y: ly, s: label, h: h * 0.9, center: true, bold: true, layer }); }
  return { x: cx, y: cy, R: h * (kind === 'KT' ? 1.3 : 1.1), tx: cx + ux * (kind === 'KT' ? h * 2.3 : h * 1.9), ty: cy + uy * (kind === 'KT' ? h * 2.3 : h * 1.9) };
}

// --- direk sembolü; dış kenara olan mesafeyi bulmak için şekil bilgisi döner
function poleSymbol2(pr, p, r, h) {
  const rot = (cx, cy, pts, deg) => { const a = deg * Math.PI / 180, c = Math.cos(a), s = Math.sin(a); return pts.map(([x, y]) => [cx + x * c - y * s, cy + x * s + y * c]); };
  const poly = (pts, layer, w) => { for (let k = 0; k < pts.length; k++) { const a = pts[k], b = pts[(k + 1) % pts.length]; pr.push({ t: 'wline', x1: a[0], y1: a[1], x2: b[0], y2: b[1], w, layer }); } };
  const isConc = p.mev && !(r.isIU || r.isK);
  const axis = r.wdir != null && r.R > 5 && r.cat !== 'duz' ? r.wdir : r.lineDir + 90;
  const w = h * 0.12;
  if (isConc) { pr.push({ t: 'circle', x: p.x, y: p.y, r: h * 0.95, layer: 'DIREK' }); pr.push({ t: 'circle', x: p.x, y: p.y, r: h * 0.95 - w, layer: 'DIREK' }); return { kind: 'c', r: h * 0.95, axis }; }
  if (r.isK) { const a = h * 0.85; poly(rot(p.x, p.y, [[-a, -a], [a, -a], [a, a], [-a, a]], axis), 'DIREK', w); const d = rot(p.x, p.y, [[-a, -a], [a, a], [a, -a], [-a, a]], axis); pr.push({ t: 'line', x1: d[0][0], y1: d[0][1], x2: d[1][0], y2: d[1][1], layer: 'DIREK' }); pr.push({ t: 'line', x1: d[2][0], y1: d[2][1], x2: d[3][0], y2: d[3][1], layer: 'DIREK' }); return { kind: 'r', A: a, B: a, axis }; }
  const a = h * 1.25, b = h * 0.5; poly(rot(p.x, p.y, [[-a, -b], [a, -b], [a, b], [-a, b]], axis), 'DIREK', w); return { kind: 'r', A: a, B: b, axis };
}
function shapeExit(sh, dirDeg) {
  if (sh.kind === 'c') return sh.r;
  const t = (dirDeg - sh.axis) * Math.PI / 180, c = Math.abs(Math.cos(t)), s = Math.abs(Math.sin(t));
  return Math.min(c > 1e-6 ? sh.A / c : 1e9, s > 1e-6 ? sh.B / s : 1e9);
}

// --- yazı yerleşimi için yaklaşık kutular
function textBox(x, y, s, h, rot, ha, va) {
  const w = String(s).length * h * 0.64, x0 = ha === 1 ? -w / 2 : ha === 2 ? -w : 0, y0 = va === 2 ? -h / 2 : -h * 0.18, y1 = y0 + h * (va === 2 ? 1 : 1.0);
  const a = (rot || 0) * Math.PI / 180, c = Math.cos(a), sn = Math.sin(a);
  const pts = [[x0, y0], [x0 + w, y0], [x0 + w, y1], [x0, y1]].map(([u, v]) => [x + u * c - v * sn, y + u * sn + v * c]);
  return { x0: Math.min(...pts.map(q => q[0])), x1: Math.max(...pts.map(q => q[0])), y0: Math.min(...pts.map(q => q[1])), y1: Math.max(...pts.map(q => q[1])) };
}
function boxOverlap(a, b) { const w = Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0), h = Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0); return w > 0 && h > 0 ? w * h : 0; }
function segHitsBox(s, b) {
  // Liang–Barsky kırpma
  let t0 = 0, t1 = 1; const dx = s.x2 - s.x1, dy = s.y2 - s.y1;
  const chk = (p, q) => { if (Math.abs(p) < 1e-12) return q >= 0; const r = q / p; if (p < 0) { if (r > t1) return false; if (r > t0) t0 = r; } else { if (r < t0) return false; if (r < t1) t1 = r; } return true; };
  return chk(-dx, s.x1 - b.x0) && chk(dx, b.x1 - s.x1) && chk(-dy, s.y1 - b.y0) && chk(dy, b.y1 - s.y1);
}
function pointInPoly(x, y, pts) { let c = false; for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) { const a = pts[i], b = pts[j]; if (((a.y > y) !== (b.y > y)) && x < (b.x - a.x) * (y - a.y) / (b.y - a.y) + a.x) c = !c; } return c; }
function offsetPolyline(pts, d) {
  const out = [];
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i], a = pts[i - 1] || null, b = pts[i + 1] || null;
    const n1 = a ? norm(-(p.y - a.y), p.x - a.x) : null, n2 = b ? norm(-(b.y - p.y), b.x - p.x) : null;
    let nx, ny, k = 1;
    if (n1 && n2) { nx = n1[0] + n2[0]; ny = n1[1] + n2[1]; const l = Math.hypot(nx, ny) || 1; nx /= l; ny /= l; k = 1 / Math.max(0.35, nx * n1[0] + ny * n1[1]); }
    else [nx, ny] = n1 || n2;
    out.push({ x: p.x + nx * d * k, y: p.y + ny * d * k });
  }
  return out;
  function norm(x, y) { const l = Math.hypot(x, y) || 1; return [x / l, y / l]; }
}

// --- PROJE KROKİSİ (dünya koordinatı), çakışmayı azaltan yerleşimle
function krokiPrims2(m, results, P, opt) {
  const pr = [], h = opt.h, mpu = opt.mpu, poles = m.poles;
  const boxes = [], segs = [], weak = [];
  const addBox = b => boxes.push(b);
  const scoreBox = (b, own) => { let s = 0; boxes.forEach(o => s += boxOverlap(b, o)); s = s / (h * h) * 10; segs.forEach(g => { if (g !== own && segHitsBox(g, b)) s += 6; }); weak.forEach(g => { if (segHitsBox(g, b)) s += 0.6; }); return s; };
  const pushText = (t) => { pr.push(t); addBox(textBox(t.x, t.y, t.s, t.h, t.rot, t.center ? 1 : (t.ha || 0), t.center ? 2 : (t.va || 0))); };
  // altlık
  (m.bgSegs || []).forEach(s => { pr.push({ t: 'line', x1: s.x1, y1: s.y1, x2: s.x2, y2: s.y2, layer: 'ALTLIK' }); weak.push(s); });
  (m.bgTexts || []).forEach(s => { pr.push({ t: 'text', x: s.x, y: s.y, s: s.s, h: s.h, rot: s.rot, layer: 'PARSEL_NO' }); addBox(textBox(s.x, s.y, s.s, s.h, s.rot, 0, 0)); });
  (m.parcels || []).forEach(pc => { const pts = pc.pts; for (let i = 0; i < pts.length - (pc.open ? 1 : 0); i++) { const a = pts[i], b = pts[(i + 1) % pts.length], g = { x1: a.x, y1: a.y, x2: b.x, y2: b.y }; pr.push(Object.assign({ t: 'line', layer: 'PARSEL' }, g)); weak.push(g); } });
  // yollar
  (m.roads || []).forEach(rd => {
    if (rd.pts.length < 2) return; const half = rd.w / 2;
    [offsetPolyline(rd.pts, half), offsetPolyline(rd.pts, -half)].forEach(side => { for (let i = 1; i < side.length; i++) { const g = { x1: side[i - 1].x, y1: side[i - 1].y, x2: side[i].x, y2: side[i].y }; pr.push(Object.assign({ t: 'line', layer: 'YOL', lw: 1.3 }, g)); weak.push(g); } });
  });
  // hat
  const routeSegs = [];
  for (let i = 0; i < poles.length - 1; i++) { const a = poles[i], b = poles[i + 1], g = { x1: a.x, y1: a.y, x2: b.x, y2: b.y }; pr.push(Object.assign({ t: 'wline', w: h * 0.22, layer: 'HAT' }, g)); segs.push(g); routeSegs.push(g); }
  poles.forEach(p => (p.ex || []).forEach(e => { const g = { x1: p.x, y1: p.y, x2: e.x, y2: e.y }; pr.push(Object.assign({ t: 'line', dash: true, layer: 'MEVCUT', lw: 1.6 }, g)); segs.push(g); }));
  // direk sembolleri (kutu olarak engel)
  const shapes = poles.map((p, i) => { const sh = poleSymbol2(pr, p, results[i], h); addBox({ x0: p.x - h * 1.4, x1: p.x + h * 1.4, y0: p.y - h * 1.4, y1: p.y + h * 1.4 }); return sh; });
  // açı yayları
  poles.forEach((p, i) => {
    const r = results[i]; if (r.kind !== 'two') return;
    const a0 = r.lines[0].ang, a1 = r.lines[1].ang;
    let d = ((a1 - a0) % 360 + 360) % 360, s0 = a0, s1 = a1; if (d > 180) { s0 = a1; s1 = a0; d = 360 - d; }
    let mid = s0 + d / 2;
    if (d > 179) { // düz: iki taraftan boş olanı seç
      const tryMid = m0 => { const mr = m0 * Math.PI / 180; return scoreBox(textBox(p.x + h * 3.3 * Math.cos(mr), p.y + h * 3.3 * Math.sin(mr), `${r.interior}°`, h * 0.85, 0, 1, 2)); };
      if (tryMid(s1 + 90) < tryMid(s0 + 90)) { const t = s0; s0 = s1; s1 = t; } mid = s0 + 90;
    }
    pr.push({ t: 'arc', x: p.x, y: p.y, r: h * 2.4, a1: s0, a2: s1, layer: 'ACI' });
    const mr = mid * Math.PI / 180; pushText({ t: 'text', x: p.x + h * 3.3 * Math.cos(mr), y: p.y + h * 3.3 * Math.sin(mr), s: `${r.interior}°`, h: h * 0.85, center: true, layer: 'ACI' });
    r._arcMid = mid;
  });
  // açıklık yazıları
  for (let i = 0; i < poles.length - 1; i++) {
    const a = poles[i], b = poles[i + 1], g = routeSegs[i];
    let ang = Math.atan2(b.y - a.y, b.x - a.x) * 180 / Math.PI; if (ang > 90) ang -= 180; if (ang < -90) ang += 180;
    const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2, nx = -Math.sin(ang * Math.PI / 180), ny = Math.cos(ang * Math.PI / 180);
    const segL = Math.hypot(b.x - a.x, b.y - a.y), len = mpu ? segL * mpu : null, cond = hatAd(P);
    const th = h * 0.8, wCond = cond.length * th * 0.58;
    if (segL > wCond + h * 6) {
      const sides = [1, -1].map(sd => { const t1 = { x: mx + sd * nx * h * 1.05, y: my + sd * ny * h * 1.05 }, t2 = { x: mx - sd * nx * h * 1.05, y: my - sd * ny * h * 1.05 }, t3 = { x: mx - sd * nx * h * 2.3, y: my - sd * ny * h * 2.3 };
        return { sd, t1, t2, t3, sc: scoreBox(textBox(t1.x, t1.y, 'HAVAİ', th, ang, 1, 2), g) + scoreBox(textBox(t2.x, t2.y, cond, th, ang, 1, 2), g) + (len ? scoreBox(textBox(t3.x, t3.y, `${Math.round(len)} m`, th, ang, 1, 2), g) : 0) }; });
      const s = sides[0].sc <= sides[1].sc ? sides[0] : sides[1];
      pushText({ t: 'text', x: s.t1.x, y: s.t1.y, s: 'HAVAİ', h: th, rot: ang, center: true, layer: 'YAZI' });
      pushText({ t: 'text', x: s.t2.x, y: s.t2.y, s: cond, h: th, rot: ang, center: true, layer: 'YAZI' });
      if (len) pushText({ t: 'text', x: s.t3.x, y: s.t3.y, s: `${Math.round(len)} m`, h: th, rot: ang, center: true, layer: 'YAZI' });
    } else {
      // kısa açıklık: tek satır, dışa kaydır
      const txt = len ? `${Math.round(len)} m` : 'HAVAİ'; const cands = [1, -1].flatMap(sd => [1.1, 2.2].map(k => ({ x: mx + sd * nx * h * k, y: my + sd * ny * h * k })));
      let best = cands[0], bs = 1e9; cands.forEach(c => { const sc = scoreBox(textBox(c.x, c.y, txt, th, ang, 1, 2), g); if (sc < bs) { bs = sc; best = c; } });
      pushText({ t: 'text', x: best.x, y: best.y, s: txt, h: th, rot: ang, center: true, layer: 'YAZI' });
    }
  }
  // mevcut hat yazısı
  poles.forEach(p => (p.ex || []).forEach(e => {
    let ta = Math.atan2(e.y - p.y, e.x - p.x) * 180 / Math.PI; if (ta > 90) ta -= 180; if (ta < -90) ta += 180;
    const nx = -Math.sin(ta * Math.PI / 180), ny = Math.cos(ta * Math.PI / 180), s = `${String(e.c).toUpperCase()} MEVCUT`;
    let best = null, bs = 1e9;
    [0.6, 0.75, 0.45, 0.9].forEach(t => [1, -1].forEach(sd => { const x = p.x + (e.x - p.x) * t + sd * nx * h * 0.9, y = p.y + (e.y - p.y) * t + sd * ny * h * 0.9; const sc = scoreBox(textBox(x, y, s, h * 0.8, ta, 1, 2)) + Math.abs(t - 0.6); if (sc < bs) { bs = sc; best = { x, y }; } }));
    pushText({ t: 'text', x: best.x, y: best.y, s, h: h * 0.8, rot: ta, center: true, layer: 'YAZI' });
  }));
  // topraklamalar: hatlardan ve açı yayından uzak yön
  const angDist = (a, b) => { const d = Math.abs(((a - b) % 360 + 540) % 360 - 180); return d; };
  poles.forEach((p, i) => {
    const r = results[i]; if (p.mev || opt.showGround === false) return;
    const kinds = r.cat === 'nihayet' ? ['KT', 'İT'] : ['KT']; const used = [];
    kinds.forEach(kd => {
      let best = 0, bs = 1e9;
      for (let a = 0; a < 360; a += 15) {
        let sc = 0; r.lines.forEach(l => { const d = angDist(a, l.ang); if (d < 40) sc += (40 - d) * 2; });
        if (r._arcMid != null && angDist(a, r._arcMid) < 60) sc += 40;
        used.forEach(u => { const d = angDist(a, u); if (d < 55) sc += (55 - d) * 3; });
        const st = shapeExit(shapes[i], a) * 1.0, rr = a * Math.PI / 180, L = st + h * 3.2;
        const bx = { x0: p.x + Math.cos(rr) * L - h * 1.8, x1: p.x + Math.cos(rr) * L + h * 1.8, y0: p.y + Math.sin(rr) * L - h * 1.8, y1: p.y + Math.sin(rr) * L + h * 1.8 };
        sc += scoreBox(bx) * 2;
        if (sc < bs) { bs = sc; best = a; }
      }
      used.push(best);
      const g = groundPr(pr, p.x, p.y, best, h, kd, 'TOPRAK', kd, shapeExit(shapes[i], best));
      addBox({ x0: g.x - g.R, x1: g.x + g.R, y0: g.y - g.R, y1: g.y + g.R }); addBox(textBox(g.tx, g.ty, kd, h * 0.9, 0, 1, 2));
      const rr = best * Math.PI / 180; segs.push({ x1: p.x, y1: p.y, x2: g.x - Math.cos(rr) * g.R, y2: g.y - Math.sin(rr) * g.R });
    });
  });
  // direk etiketleri: en boş yön
  poles.forEach((p, i) => {
    const r = results[i];
    const nm = p.mev ? (P.mevAd ? r.name : 'MEVCUT DİREK') : r.name, tp = p.mev ? r.type : r.type.replace(/^(\d+(?:\.\d+)?)([IU])$/, '$1 $2');
    const hs = h * (p.mev ? 1.3 : 1.8), W = Math.max(nm.length, tp.length) * hs * 0.58, H = hs * 2.3;
    const pref = (r.cat !== 'duz' && r.wdir != null && r.R > 5) ? r.wdir + 180 : r.lineDir + 90;
    let best = null, bs = 1e9;
    for (let a = 0; a < 360; a += 20) {
      const rr = a * Math.PI / 180, c = Math.cos(rr), s = Math.sin(rr);
      for (const extra of [0, h * 1.5]) {
        const D = h * 1.9 + Math.abs(c) * W / 2 + Math.abs(s) * H / 2 + extra, cx = p.x + c * D, cy = p.y + s * D;
        const b = { x0: cx - W / 2, x1: cx + W / 2, y0: cy - H / 2, y1: cy + H / 2 };
        const sc = scoreBox(b) + angDist(a, pref) / 180 * 0.8 + extra / h * 0.3;
        if (sc < bs) { bs = sc; best = { cx, cy, b }; }
      }
    }
    pr.push({ t: 'text', x: best.cx, y: best.cy + hs * 0.58, s: nm, h: hs, ha: 1, va: 2, layer: 'YAZI' });
    pr.push({ t: 'text', x: best.cx, y: best.cy - hs * 0.58, s: tp, h: hs, ha: 1, va: 2, layer: 'YAZI' });
    addBox(best.b);
  });
  // yol isimleri
  (m.roads || []).forEach(rd => {
    if (!rd.name || rd.pts.length < 2) return; let bi = 0, bl = 0;
    for (let i = 1; i < rd.pts.length; i++) { const l = Math.hypot(rd.pts[i].x - rd.pts[i - 1].x, rd.pts[i].y - rd.pts[i - 1].y); if (l > bl) { bl = l; bi = i; } }
    const a = rd.pts[bi - 1], b = rd.pts[bi]; let ang = Math.atan2(b.y - a.y, b.x - a.x) * 180 / Math.PI; if (ang > 90) ang -= 180; if (ang < -90) ang += 180;
    let best = null, bs = 1e9; [0.5, 0.3, 0.7, 0.2, 0.8].forEach(t => { const x = a.x + (b.x - a.x) * t, y = a.y + (b.y - a.y) * t, sc = scoreBox(textBox(x, y, rd.name, Math.min(rd.w * 0.45, h * 1.2), ang, 1, 2)); if (sc < bs) { bs = sc; best = { x, y }; } });
    pushText({ t: 'text', x: best.x, y: best.y, s: rd.name, h: Math.min(rd.w * 0.45, h * 1.2), rot: ang, center: true, layer: 'YOL' });
  });
  // parsel numaraları: poligon içinde en boş nokta
  (m.parcels || []).forEach(pc => {
    if (!pc.label || pc.open) return; const pts = pc.pts, th = h * 1.25;
    const xs = pts.map(q => q.x), ys = pts.map(q => q.y), x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
    const c = polyCentroid(pts), cands = [c];
    for (let gx = 1; gx < 6; gx++) for (let gy = 1; gy < 6; gy++) cands.push({ x: x0 + (x1 - x0) * gx / 6, y: y0 + (y1 - y0) * gy / 6 });
    let best = c, bs = 1e9;
    cands.forEach(q => { if (!pointInPoly(q.x, q.y, pts)) return; const b = textBox(q.x, q.y, pc.label, th, 0, 1, 2); const out = [[b.x0, b.y0], [b.x1, b.y0], [b.x1, b.y1], [b.x0, b.y1]].filter(([x, y]) => !pointInPoly(x, y, pts)).length; const sc = scoreBox(b) + out * 3 + Math.hypot(q.x - c.x, q.y - c.y) / (h * 40); if (sc < bs) { bs = sc; best = q; } });
    pushText({ t: 'text', x: best.x, y: best.y, s: pc.label, h: th, center: true, layer: 'PARSEL_NO' });
  });
  // kuzey oku ve lejant
  const ext = primExtents(pr);
  if (ext && opt.legend !== false) {
    const nx = ext.x1 + h * 4, ny = ext.y1 - h * 2;
    arrowPr(pr, nx, ny - h * 5, nx, ny, { head: h * 1.6, layer: 'LEJANT' });
    pr.push({ t: 'text', x: nx, y: ny + h * 1.2, s: 'K', h: h * 1.6, center: true, bold: true, layer: 'LEJANT' });
    legendPr(pr, ext.x1 + h * 2, ext.y0 + h * 21, h, P, (m.roads || []).length > 0);
  }
  return pr;
}
function legendPr(pr, x, y, h, P, hasRoad) {
  const W = h * 27, rows = [
    ['conc', 'Mevcut beton direk'], ['I', 'Yeni I / U demir direk'], ['K', 'Yeni K (kafes) demir direk'],
    ['hat', `Yeni havai hat (${P.hat ? P.hat.yazi : P.routeCond.replace(/^AER/, 'ALPEK')})`], ['mev', 'Mevcut hat'], ['KT', 'Koruma topraklaması (KT)'], ['IT', 'İşletme topraklaması (İT)'],
  ];
  if (hasRoad) rows.push(['yol', 'Yol']);
  const rh = h * 3.0, H = rh * rows.length + h * 3;
  pr.push({ t: 'rect', x, y: y - H, w: W, h: H, layer: 'LEJANT' });
  pr.push({ t: 'text', x: x + W / 2, y: y - h * 1.5, s: 'LEJANT', h: h * 1.1, center: true, bold: true, layer: 'LEJANT' });
  pr.push({ t: 'line', x1: x, y1: y - h * 3, x2: x + W, y2: y - h * 3, layer: 'LEJANT' });
  rows.forEach(([k, s], i) => {
    const cy = y - h * 3 - rh * (i + 0.5), cx = x + h * 3.2;
    const fake = { x: cx, y: cy, mev: k === 'conc' }, rr = { isIU: k === 'I', isK: k === 'K', wdir: null, R: 0, cat: 'duz', lineDir: 90 };
    if (k === 'conc' || k === 'I' || k === 'K') poleSymbol2(pr, fake, rr, h * 0.8);
    if (k === 'hat') pr.push({ t: 'wline', x1: cx - h * 1.8, y1: cy, x2: cx + h * 1.8, y2: cy, w: h * 0.22, layer: 'HAT' });
    if (k === 'mev') pr.push({ t: 'line', x1: cx - h * 1.8, y1: cy, x2: cx + h * 1.8, y2: cy, dash: true, lw: 1.6, layer: 'MEVCUT' });
    if (k === 'yol') { pr.push({ t: 'line', x1: cx - h * 1.8, y1: cy + h * 0.5, x2: cx + h * 1.8, y2: cy + h * 0.5, layer: 'YOL', lw: 1.3 }); pr.push({ t: 'line', x1: cx - h * 1.8, y1: cy - h * 0.5, x2: cx + h * 1.8, y2: cy - h * 0.5, layer: 'YOL', lw: 1.3 }); }
    if (k === 'KT' || k === 'IT') groundPr(pr, cx, cy + h * 1.15, -90, h * 0.55, '', 'TOPRAK', k === 'KT' ? 'KT' : 'IT', 0);
    pr.push({ t: 'text', x: x + h * 6.5, y: cy, s, h: h * 0.85, va: 2, layer: 'LEJANT' });
  });
}

function primExtents(pr) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  const add = (x, y) => { if (isFinite(x) && isFinite(y)) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); } };
  pr.forEach(p => { if (p.t === 'line' || p.t === 'wline') { add(p.x1, p.y1); add(p.x2, p.y2); } else if (p.t === 'circle' || p.t === 'arc') { add(p.x - p.r, p.y - p.r); add(p.x + p.r, p.y + p.r); } else if (p.t === 'text') add(p.x, p.y); else if (p.t === 'rect') { add(p.x, p.y); add(p.x + p.w, p.y + p.h); } else if (p.pts) p.pts.forEach(q => add(q[0], q[1])); });
  return isFinite(x0) ? { x0, y0, x1, y1 } : null;
}

// --- MÜHENDİSLİK CER RAPORU (mm, A3 yatay; içerik büyürse boy uzar)
function reportPrims(results, P, info) {
  info = info || {};
  const pr = [], W = 420;
  const T = (x, y, s, h, o) => pr.push(Object.assign({ t: 'text', x, y, s: String(s), h: h || 2.5, layer: 'TABLO' }, o || {}));
  const Ln = (x1, y1, x2, y2, o) => pr.push(Object.assign({ t: 'line', x1, y1, x2, y2, layer: 'TABLO' }, o || {}));
  const rT = hatCer(P);
  const n = results.length;
  // yükseklik hesabı
  const cols = 4, cellW = (380 - 9) / 4, cellH = 64, gridRows = Math.ceil(n / cols);
  const tblH = 14 + n * 7;
  const ksv = P.kesit && !P.hat;                        // NYY + askı telinde kesit kontrolü BHP hesap tablosunda
  const nRes = n + (ksv ? 4 : 0) + 3;
  const H = Math.max(297, 10 + 18 + 52 + 10 + tblH + 12 + gridRows * (cellH + 4) + 12 + nRes * 5.6 + 22);
  // çerçeve
  pr.push({ t: 'rect', x: 0, y: 0, w: W, h: H, layer: 'CERCEVE' });
  pr.push({ t: 'rect', x: 20, y: 10, w: W - 30, h: H - 20, layer: 'CERCEVE' });
  let y = H - 10;
  // başlık bandı
  Ln(20, y - 16, W - 10, y - 16, { layer: 'CERCEVE' });
  T((20 + W - 10) / 2, y - 7, 'AG HAVAİ HAT DİREK MUKAVEMET (CER) HESABI', 6, { center: true, bold: true });
  T((20 + W - 10) / 2, y - 13, info.proje || ' ', 3, { center: true });
  y -= 16;
  // 1. HESAP ESASLARI
  const sec = (title) => { y -= 8; T(25, y, title, 3.5, { bold: true }); y -= 2; Ln(25, y, W - 15, y); };
  sec('1. HESAP ESASLARI VE KABULLER');
  const exConds = new Map(); results.forEach(r => r.lines.filter(l => l.kind === 'ex').forEach(l => exConds.set(l.lab, l.T)));
  const bR = ['I', 'II', 'III', 'IV'][(P.bolge || 1) - 1];
  const sm = (P.routeCond.match(/\+\s*(\d+)/) || [])[1];
  const L1 = [
    P.hat ? `a) Yeni hat iletkeni: HAVAİ ${P.hat.yazi}, askı teline asılı  -  en büyük çekme: ${P.hat.aciklama}`
      : `a) Yeni hat iletkeni: HAVAİ ${P.routeCond.replace(/^AER/, 'ALPEK')} mm²  -  en büyük çekme T = ${sm || '?'} mm² (askı teli) x ${fmt(P.sigma)} kg/mm² = ${fmt(rT)} kg`,
    ...[...exConds].map(([k, v]) => `b) Mevcut hat: ${String(k).toUpperCase()}  -  T = ${fmt(v)} kg  (${bR}. buz yükü bölgesi müşterek hat çekme kuvveti)`),
    `c) Buz yükü bölgesi: ${bR}. bölge (EKAT Çizelge-9)   -   Hesap ${P.wind ? 'rüzgarlı' : 'rüzgarsız'} tepe kuvvetleriyle yapılmıştır.${P.margin ? `  Emniyet payı %${P.margin}.` : ''}`,
    `d) Direk tepe kuvvetleri (P): 8I 300, 10I 500, 12I 900, 10U 700, 12U 1200, K1 1000, K2 2000 kg (AG demir direk); SBA beton direkte P = tip x 100 kg.`,
    `e) Bileşke kuvvet: R = √[(ΣTx)² + (ΣTy)²].  İki hatlı direkte  R = √[(T1 - T2·cosα)² + (T2·sinα)²],  α = 180° - β (β: hat açısı).`,
    `f) Şart: R ≤ P.  ${[P.kKose && 'köşe', P.kBrans && 'branşman', P.kNih && 'nihayet'].filter(Boolean).join(', ') || '—'} direklerinde K (kafes) direk kullanılmıştır; I/U direkler güçlü eksenleri bileşke yönünde dikilecektir.`,
  ];
  L1.forEach(s => { y -= 6; T(28, y, s.replace(/Σ/g, 'Σ'), 2.6); });
  // 2. TABLO
  sec('2. DİREK KUVVET TABLOSU');
  y -= 3;
  const C = [['DİREK', 20], ['GÖREVİ', 30], ['DİREK TİPİ', 26], ['AÇIKLIK (m)', 22], ['HAT AÇISI β', 24], ['SAPMA α', 20], ['HAT ÇEKMELERİ T (kg)', 70], ['BİLEŞKE R (kg)', 28], ['TEPE KUV. P (kg)', 28], ['KULLANIM', 22], ['KONTROL', 0]];
  const x0 = 25, xe = W - 15; let used = C.reduce((s, c) => s + c[1], 0); C[C.length - 1][1] = xe - x0 - used;
  const xs = [x0]; C.forEach(c => xs.push(xs[xs.length - 1] + c[1]));
  const top = y, hh = 9, rh = 7;
  pr.push({ t: 'rect', x: x0, y: top - hh - n * rh, w: xe - x0, h: hh + n * rh, layer: 'TABLO' });
  Ln(x0, top - hh, xe, top - hh);
  C.forEach((c, i) => { T(xs[i] + c[1] / 2, top - hh / 2, c[0], 2.2, { center: true, bold: true }); if (i) Ln(xs[i], top, xs[i], top - hh - n * rh); });
  results.forEach((r, k) => {
    const yy = top - hh - k * rh - rh / 2; if (k) Ln(x0, top - hh - k * rh, xe, top - hh - k * rh, { lw: 0.6 });
    const ts = r.lines.map(l => `${fmt(l.T)}`).join(' + ') || '-';
    const vals = [r.name, r.catName, r.type, r.span ? fmt(Math.round(r.span * 10) / 10) : '-', r.kind === 'two' ? `${r.interior}°` : '-', r.kind === 'two' ? `${r.phi}°` : '-', ts, r.R, r.cap, r.cap ? `%${Math.round(r.R / r.cap * 100)}` : '-', r.ok ? 'R ≤ P  UYGUN' : 'R > P  UYGUN DEĞİL'];
    vals.forEach((v, i) => T(xs[i] + C[i][1] / 2, yy, v, 2.4, { center: true, bold: i === 10, color: i === 10 && !r.ok ? 1 : undefined }));
  });
  y = top - hh - n * rh;
  // 3. KUVVET ŞEMALARI
  sec('3. DİREK KUVVET ŞEMALARI');
  y -= 3;
  results.forEach((r, k) => {
    const cx0 = 25 + (k % cols) * (cellW + 3), cy1 = y - Math.floor(k / cols) * (cellH + 4);
    forceCell(pr, cx0, cy1 - cellH, cellW, cellH, r);
  });
  y -= gridRows * (cellH + 4);
  // 4. kesit + sonuç
  let yy = y - 4;
  const lsec = (t) => { yy -= 7; T(25, yy, t, 3.5, { bold: true }); yy -= 2; Ln(25, yy, W - 15, yy); };
  if (ksv) {
    const k = P.kesit;
    lsec('4. KESİT KONTROLÜ');
    [`Talep (bağlantı) gücü N = ${fmt(k.kW)} kW, ${k.tri ? 'trifaze U = ' + (k.U3 || 380) + ' V' : 'monofaze U = ' + (k.U1 || 220) + ' V'}, cosφ = ${fmt(k.cos)}, hat boyu L = ${Math.round(k.L)} m, κ = ${fmt(k.kappa)}`,
      `Akım: I = ${k.tri ? 'N / (√3·U·cosφ)' : 'N / (U·cosφ)'} = ${fmt(k.res.I)} A  ≤  ${k.res.sel.amp} A (${P.routeCond.replace(/^AER/, 'ALPEK')}) → ${k.res.sel.okI ? 'uygun' : 'UYGUN DEĞİL'}`,
      `Gerilim düşümü: %e = ${k.tri ? '100' : '200'}·N·L / (κ·S·U²) = %${fmt(k.res.sel.e)}  <  %1,5 → ${k.res.sel.e < 1.5 ? 'uygun' : 'UYGUN DEĞİL'}`]   // kullanıcının kuralı: kesit %1'e göre seçilir, %1,5 sınırı yazılır.forEach(s => { yy -= 5.5; T(28, yy, s, 2.5); });
  }
  lsec(`${ksv ? 5 : 4}. SONUÇ`);
  results.forEach(r => { yy -= 5.5; T(28, yy, r.ok ? `${r.name}: Toplam cer R = ${r.R} kg < P = ${r.cap} kg (${r.type}) olduğundan uygundur.` : `${r.name}: Toplam cer R = ${r.R} kg > P = ${r.cap} kg (${r.type}) olduğundan UYGUN DEĞİLDİR.`, 2.5, { color: r.ok ? undefined : 1 }); });
  return { prims: pr, w: W, h: H };
}
function forceCell(pr, x, y, w, h, r) {
  pr.push({ t: 'rect', x, y, w, h, layer: 'SEMA' });
  pr.push({ t: 'line', x1: x, y1: y + h - 7, x2: x + w, y2: y + h - 7, layer: 'SEMA' });
  pr.push({ t: 'text', x: x + 3, y: y + h - 3.5, s: `${r.name}  -  ${r.catName.toUpperCase()}  -  ${r.type}`, h: 2.6, va: 2, bold: true, layer: 'SEMA' });
  // şema (gerçek doğrultular)
  const cx = x + 23, cy = y + (h - 7) / 2, Lmax = 17;
  const mx = Math.max(1, ...r.lines.map(l => l.T), r.R || 0);
  pr.push({ t: 'circle', x: cx, y: cy, r: 1.3, layer: 'SEMA' });
  r.lines.forEach((l, j) => {
    const a = l.ang * Math.PI / 180, L = 6 + (Lmax - 6) * l.T / mx;
    arrowPr(pr, cx + 1.3 * Math.cos(a), cy + 1.3 * Math.sin(a), cx + L * Math.cos(a), cy + L * Math.sin(a), { head: 2.4, layer: 'SEMA' });
    pr.push({ t: 'text', x: cx + (L + 3.5) * Math.cos(a), y: cy + (L + 3.5) * Math.sin(a), s: `T${j + 1}`, h: 2.2, center: true, layer: 'SEMA' });
  });
  if (r.R > 0 && r.wdir != null) {
    const a = r.wdir * Math.PI / 180, L = 6 + (Lmax - 6) * r.R / mx;
    arrowPr(pr, cx, cy, cx + L * Math.cos(a), cy + L * Math.sin(a), { head: 2.8, w: 0.5, layer: 'BILESKE', color: 1 });
    pr.push({ t: 'text', x: cx + (L * 0.55) * Math.cos(a) - 3 * Math.sin(a), y: cy + (L * 0.55) * Math.sin(a) + 3 * Math.cos(a), s: 'R', h: 2.4, center: true, bold: true, layer: 'BILESKE', color: 1 });
  }
  // hesap satırları
  const tx = x + 48; let ty = y + h - 12;
  const line = (s, o) => { pr.push(Object.assign({ t: 'text', x: tx, y: ty, s, h: 2.3, layer: 'SEMA' }, o || {})); ty -= 4.6; };
  r.lines.forEach((l, j) => line(`T${j + 1} = ${fmt(l.T)} kg${l.kind === 'ex' ? ' (mevcut)' : ''}`));
  if (r.kind === 'two') {
    line(`β = ${r.interior}°   α = ${r.phi}°`);
    line(`T2·sinα = ${r.s} kg`);
    line(`T1 - T2·cosα = ${fmt(r.rx)} kg`);
    line(`R = √(${fmt(Math.abs(r.rx))}² + ${r.s}²) = ${r.R} kg`, { bold: true });
  } else if (r.kind === 'end') line(`Nihayet: R = T1 = ${r.R} kg`, { bold: true });
  else if (r.kind === 'multi') { line(`ΣX = ${r.X} kg   ΣY = ${r.Y} kg`); line(`R = ${r.R} kg`, { bold: true }); }
  line(`P = ${r.cap} kg (${r.type})`);
  pr.push({ t: 'text', x: x + w - 3, y: y + 4, s: r.ok ? 'R ≤ P  UYGUNDUR' : 'R > P  UYGUN DEĞİL', h: 2.6, ha: 2, bold: true, color: r.ok ? 3 : 1, layer: 'SEMA' });
}

// --- canvas üzerinde primitif çizimi (proje görünümü)
function drawPrims(ctx, pr, W2S, k, opt) {
  opt = opt || {};
  const col = p => p.color === 1 ? '#c0261c' : p.color === 3 ? '#1d7a3e' : p.layer === 'HAT' ? '#c0261c' : (p.layer === 'PARSEL' || p.layer === 'ALTLIK') ? '#3a3a3a' : p.layer === 'PARSEL_NO' ? '#3a3a3a' : '#111';
  pr.forEach(p => {
    ctx.strokeStyle = ctx.fillStyle = col(p);
    if (p.t === 'line') { const a = W2S(p.x1, p.y1), b = W2S(p.x2, p.y2); ctx.lineWidth = p.lw || (p.layer === 'PARSEL' ? 1.1 : 1); ctx.setLineDash(p.dash ? [8, 5] : []); ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke(); ctx.setLineDash([]); }
    else if (p.t === 'wline') { const a = W2S(p.x1, p.y1), b = W2S(p.x2, p.y2); ctx.lineWidth = Math.max(1.5, p.w * k); ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke(); ctx.lineCap = 'butt'; }
    else if (p.t === 'circle') { const a = W2S(p.x, p.y); ctx.lineWidth = 1.6; ctx.beginPath(); ctx.arc(a[0], a[1], p.r * k, 0, 7); if (opt.fillPoles && p.layer === 'DIREK') { ctx.save(); ctx.fillStyle = '#fff'; ctx.fill(); ctx.restore(); } ctx.stroke(); }
    else if (p.t === 'arc') { const a = W2S(p.x, p.y); ctx.lineWidth = 1.1; ctx.beginPath(); ctx.arc(a[0], a[1], p.r * k, -p.a2 * Math.PI / 180, -p.a1 * Math.PI / 180); ctx.stroke(); }
    else if (p.t === 'rect') { const a = W2S(p.x, p.y + p.h); ctx.lineWidth = 1; ctx.strokeRect(a[0], a[1], p.w * k, p.h * k); }
    else if (p.t === 'solid') { ctx.beginPath(); p.pts.forEach((q, i) => { const a = W2S(q[0], q[1]); i ? ctx.lineTo(a[0], a[1]) : ctx.moveTo(a[0], a[1]); }); ctx.closePath(); ctx.fill(); }
    else if (p.t === 'text') {
      const px = p.h * k * 1.3; if (px < 4) return; const a = W2S(p.x, p.y);
      ctx.save(); ctx.translate(a[0], a[1]); if (p.rot) ctx.rotate(-p.rot * Math.PI / 180);
      ctx.font = `${p.bold ? 600 : 400} ${px}px "Times New Roman", serif`;
      const ha = p.center ? 1 : (p.ha || 0), va = p.center ? 2 : (p.va || 0);
      ctx.textAlign = ha === 1 ? 'center' : ha === 2 ? 'right' : 'left'; ctx.textBaseline = va === 2 ? 'middle' : 'alphabetic';
      ctx.fillText(p.s, 0, 0); ctx.restore();
    }
  });
}

if (typeof module !== 'undefined' && module.exports) Object.assign(module.exports, { offsetPolyline, tmProject, parseGeo, projectGeo, krokiPrims2, reportPrims, primExtents, polyCentroid });
