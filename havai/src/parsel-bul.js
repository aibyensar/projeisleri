// ===== OTOMATİK PARSEL BULMA (resimdeki parsel sınır çizgilerinden) =====
const WAND = { data: null, w: 0, h: 0, sc: 1 };
function wandPrep(img) {
  const sc = Math.min(1, 1600 / Math.max(img.width, img.height)), w = Math.round(img.width * sc), h = Math.round(img.height * sc);
  const c = document.createElement('canvas'); c.width = w; c.height = h; const x = c.getContext('2d', { willReadFrequently: true }); x.drawImage(img, 0, 0, w, h);
  Object.assign(WAND, { data: x.getImageData(0, 0, w, h).data, w, h, sc, comps: null, canvas: c });
}
function isLinePx(r, g, b) {
  if (WAND.lineColor) { const [R, G, B] = WAND.lineColor; return (r - R) ** 2 + (g - G) ** 2 + (b - B) ** 2 < (WAND.lineTol || 45) ** 2; }
  const lum = 0.3 * r + 0.59 * g + 0.11 * b; return r - g > 55 && g < 60 && lum < 105;
}
// sınır çizgisi maskesi + bağlı bileşenler (önbellekli)
function wandComponents() {
  if (WAND.comps) return WAND.comps;
  const { data, w, h } = WAND; if (!data) return null;
  const N = w * h, bar = new Uint8Array(N);
  for (let k = 0, i = 0; k < N; k++, i += 4) if (isLinePx(data[i], data[i + 1], data[i + 2])) bar[k] = 1;
  const b2 = bar.slice(); for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) { const k = y * w + x; if (bar[k]) { b2[k - 1] = b2[k + 1] = b2[k - w] = b2[k + w] = 1; } }
  const lab = new Int32Array(N), list = [null]; let id = 0;
  for (let s = 0; s < N; s++) {
    if (b2[s] || lab[s]) continue; id++; const st = [s], px = []; lab[s] = id; let edge = false;
    while (st.length) { const k = st.pop(); px.push(k); const x = k % w, y = (k / w) | 0; if (x === 0 || y === 0 || x === w - 1 || y === h - 1) edge = true;
      if (x > 0 && !b2[k - 1] && !lab[k - 1]) { lab[k - 1] = id; st.push(k - 1); } if (x < w - 1 && !b2[k + 1] && !lab[k + 1]) { lab[k + 1] = id; st.push(k + 1); }
      if (y > 0 && !b2[k - w] && !lab[k - w]) { lab[k - w] = id; st.push(k - w); } if (y < h - 1 && !b2[k + w] && !lab[k + w]) { lab[k + w] = id; st.push(k + w); } }
    list.push({ id, px, edge });
  }
  WAND.comps = { lab, list }; return WAND.comps;
}
function compPoly(c) {
  const { w, h } = WAND, N = w * h, m = new Uint8Array(N); c.px.forEach(k => m[k] = 1);
  let cur = m; for (let it = 0; it < 3; it++) { const nx = cur.slice(); for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) { const k = y * w + x; if (!cur[k] && (cur[k - 1] || cur[k + 1] || cur[k - w] || cur[k + w])) nx[k] = 1; } cur = nx; }
  const poly = traceContour(cur, w, h); if (!poly || poly.length < 3) return null;
  const simp = simplifyClosed(poly, Math.max(2.5, Math.sqrt(c.px.length) * 0.04));
  const xs = simp.map(q => q[0]), ys = simp.map(q => q[1]), bw = Math.max(...xs) - Math.min(...xs), bh = Math.max(...ys) - Math.min(...ys);
  return { pts: simp.map(([x, y]) => ({ x: x / WAND.sc, y: -y / WAND.sc })), area: c.px.length, fill: c.px.length / Math.max(1, bw * bh) };
}
function wandAll() {
  const C = wandComponents(); if (!C) return []; const N = WAND.w * WAND.h, out = [];
  C.list.forEach(c => { if (!c || c.edge || c.px.length < N * 0.002 || c.px.length > N * 0.3) return; const p = compPoly(c); if (p && p.fill > 0.25 && p.pts.length >= 3) out.push(p); });
  return out;
}
// tek tık: tıklanan noktanın bileşeni, olmazsa renk benzerliğiyle bölge büyütme
function wandAt(ix, iy) {
  const C = wandComponents(); if (!C) return { fail: 'resim yok' };
  const x = Math.round(ix * WAND.sc), y = Math.round(iy * WAND.sc); if (x < 0 || y < 0 || x >= WAND.w || y >= WAND.h) return { fail: 'resim dışı' };
  const id = C.lab[y * WAND.w + x], c = id ? C.list[id] : null, N = WAND.w * WAND.h;
  if (c && !c.edge && c.px.length > 150 && c.px.length < N * 0.35) { const p = compPoly(c); if (p) return p; }
  return wandRegion(ix * WAND.sc, iy * WAND.sc, WAND.tol || 40);
}
function wandSetLine(ix, iy) {
  const { data, w } = WAND; if (!data) return; const x = Math.round(ix * WAND.sc), y = Math.round(iy * WAND.sc); let R = 0, G = 0, B = 0, n = 0;
  for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const i = ((y + dy) * w + x + dx) * 4; if (data[i] == null) continue; R += data[i]; G += data[i + 1]; B += data[i + 2]; n++; }
  WAND.lineColor = [R / n, G / n, B / n]; WAND.comps = null; return WAND.lineColor;
}
function wandRegion(px, py, tol) {
  const { data, w, h } = WAND; if (!data) return null;
  px = Math.round(px); py = Math.round(py); if (px < 1 || py < 1 || px >= w - 1 || py >= h - 1) return null;
  // tohum rengi: 5x5 ortanca
  const rs = [], gs = [], bs = [];
  for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) { const i = ((py + dy) * w + px + dx) * 4; rs.push(data[i]); gs.push(data[i + 1]); bs.push(data[i + 2]); }
  const med = a => a.sort((p, q) => p - q)[12], R0 = med(rs), G0 = med(gs), B0 = med(bs);
  const t2 = tol * tol, N = w * h;
  // engel: renk farkı büyük ya da koyu kırmızı/siyah sınır çizgisi
  const bar = new Uint8Array(N);
  for (let k = 0, i = 0; k < N; k++, i += 4) {
    const r = data[i], g = data[i + 1], b = data[i + 2], dr = r - R0, dg = g - G0, db = b - B0;
    if (dr * dr + dg * dg + db * db > t2 || isLinePx(r, g, b)) bar[k] = 1;
  }
  // engeli 1 px kalınlaştır (küçük boşlukları kapat)
  const bar2 = bar.slice();
  for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) { const k = y * w + x; if (bar[k]) { bar2[k - 1] = bar2[k + 1] = bar2[k - w] = bar2[k + w] = 1; } }
  const seed = py * w + px; if (bar2[seed]) bar2[seed] = 0;
  const reg = new Uint8Array(N), st = [seed]; reg[seed] = 1; let cnt = 0, edge = false;
  while (st.length) { const k = st.pop(); cnt++; const x = k % w, y = (k / w) | 0; if (x === 0 || y === 0 || x === w - 1 || y === h - 1) edge = true;
    if (cnt > N * 0.35) return { fail: 'büyük' };
    for (const n of [k - 1, k + 1, k - w, k + w]) if (n >= 0 && n < N && !reg[n] && !bar2[n]) { reg[n] = 1; st.push(n); } }
  if (cnt < 150) return { fail: 'küçük' };
  // delikleri kapat ve sınır çizgisinin ortasına kadar genişlet (2 px)
  let cur = reg;
  for (let it = 0; it < 3; it++) { const nx = cur.slice(); for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) { const k = y * w + x; if (!cur[k] && (cur[k - 1] || cur[k + 1] || cur[k - w] || cur[k + w])) nx[k] = 1; } cur = nx; }
  const poly = traceContour(cur, w, h); if (!poly || poly.length < 3) return { fail: 'kontur' };
  const simp = simplifyClosed(poly, Math.max(2.5, Math.sqrt(cnt) * 0.04));
  return { pts: simp.map(([x, y]) => ({ x: x / WAND.sc, y: -y / WAND.sc })), area: cnt, edge };
}
function traceContour(m, w, h) {
  // Moore komşuluk takibi
  let start = -1; for (let k = 0; k < w * h; k++) if (m[k]) { start = k; break; } if (start < 0) return null;
  const dirs = [[1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1], [0, -1], [1, -1]];
  const at = (x, y) => x >= 0 && y >= 0 && x < w && y < h && m[y * w + x];
  let x = start % w, y = (start / w) | 0, sx = x, sy = y, d = 6; const out = [[x, y]];
  for (let guard = 0; guard < w * h * 2; guard++) {
    let found = false;
    for (let i = 0; i < 8; i++) { const nd = (d + 6 + i) % 8, nx = x + dirs[nd][0], ny = y + dirs[nd][1]; if (at(nx, ny)) { x = nx; y = ny; d = nd; found = true; break; } }
    if (!found) break; if (x === sx && y === sy) break; out.push([x, y]);
  }
  return out;
}
function simplifyClosed(pts, eps) {
  // en uzak iki noktadan böl, iki yarıyı Douglas–Peucker ile sadeleştir
  let far = 0, fd = -1; for (let i = 0; i < pts.length; i++) { const d = (pts[i][0] - pts[0][0]) ** 2 + (pts[i][1] - pts[0][1]) ** 2; if (d > fd) { fd = d; far = i; } }
  const dp = arr => { if (arr.length < 3) return arr; const [a, b] = [arr[0], arr[arr.length - 1]]; let mi = 0, md = -1; const L = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
    for (let i = 1; i < arr.length - 1; i++) { const d = Math.abs((b[0] - a[0]) * (a[1] - arr[i][1]) - (a[0] - arr[i][0]) * (b[1] - a[1])) / L; if (d > md) { md = d; mi = i; } }
    if (md > eps) { const l = dp(arr.slice(0, mi + 1)), r = dp(arr.slice(mi)); return l.slice(0, -1).concat(r); } return [a, b]; };
  const A = dp(pts.slice(0, far + 1)), B = dp(pts.slice(far).concat([pts[0]]));
  return A.slice(0, -1).concat(B.slice(0, -1));
}
