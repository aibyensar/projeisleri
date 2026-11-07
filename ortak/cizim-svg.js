// AutoLISP yorumlayıcısının topladığı çizim nesnelerini (MTEXT, LINE, LWPOLYLINE, SOLID) SVG'ye çevirir.
// Hem önizleme betiğinde (Node) hem web aracında (tarayıcı) kullanılır.
(function () {
'use strict';
const ACI = { 1: '#ff0000', 2: '#ffff00', 3: '#00ff00', 4: '#00ffff', 5: '#0000ff', 6: '#ff00ff', 7: '#ffffff',
  8: '#808080', 9: '#c0c0c0', 30: '#ff7f00', 140: '#007fff', 150: '#0060c0', 160: '#004c99', 250: '#333333', 251: '#505050',
  252: '#696969', 253: '#828282', 254: '#bebebe', 255: '#ffffff', 256: '#ffffff' };
const renk = n => ACI[n] || '#ffffff';
const kac = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');

// MTEXT biçim kodlarını (\P satır, {\C2;..} renk, {\fArial|b1;..} kalın) SVG tspan'larına çevirir
function mtextSatirlari(metin, varsayilan) {
  const satirlar = [[]];
  const yigin = [{ renk: varsayilan, kalin: false }];
  let i = 0, tampon = '';
  const bosalt = () => { if (tampon) { satirlar[satirlar.length - 1].push({ ...yigin[yigin.length - 1], t: tampon }); tampon = ''; } };
  while (i < metin.length) {
    const c = metin[i];
    if (c === '{') { bosalt(); yigin.push({ ...yigin[yigin.length - 1] }); i++; continue; }
    if (c === '}') { bosalt(); if (yigin.length > 1) yigin.pop(); i++; continue; }
    if (c === '\\') {
      const k = metin[i + 1];
      if (k === 'P') { bosalt(); satirlar.push([]); i += 2; continue; }
      if (k === 'C' || k === 'f' || k === 'H' || k === 'T' || k === 'W' || k === 'A' || k === 'Q') {
        bosalt();
        const son = metin.indexOf(';', i); const deger = metin.slice(i + 2, son);
        if (k === 'C') yigin[yigin.length - 1].renk = renk(+deger);
        if (k === 'f') yigin[yigin.length - 1].kalin = /\|b1/.test(deger);
        if (k === 'H') yigin[yigin.length - 1].olcek = parseFloat(deger);
        i = son + 1; continue;
      }
    }
    tampon += c; i++;
  }
  bosalt();
  return satirlar;
}

function svg(nesneler, secenek = {}) {
  if (secenek.kagit) nesneler = nesneler.map(n => ({ ...n, renk: n.katman === 'GD-DOLGU' ? 253 : 250 }));
  let minx = Infinity, miny = Infinity, maxx = -Infinity, maxy = -Infinity;
  const genislet = (x, y) => { minx = Math.min(minx, x); maxx = Math.max(maxx, x); miny = Math.min(miny, y); maxy = Math.max(maxy, y); };
  for (const n of nesneler) {
    if (n.tip === 'LINE') { genislet(n.x1, n.y1); genislet(n.x2, n.y2); }
    else if (n.pts) n.pts.forEach(p => genislet(p[0], p[1]));
    else if (n.tip === 'CIRCLE') { genislet(n.x - n.r, n.y - n.r); genislet(n.x + n.r, n.y + n.r); }
    else if (n.tip === 'MTEXT') { genislet(n.x, n.y); }
  }
  const pay = 6; minx -= pay; miny -= pay; maxx += pay; maxy += pay;
  const W = maxx - minx, H = maxy - miny, Y = y => maxy - y, X = x => x - minx;
  const parcalar = [];
  for (const n of nesneler) {
    if (n.tip === 'SOLID') {
      const [a, b, c, d] = n.pts; // AutoCAD sırası: 1-2-4-3
      parcalar.push(`<polygon points="${[a, b, d, c].map(p => `${X(p[0])},${Y(p[1])}`).join(' ')}" fill="${renk(n.renk)}"/>`);
    }
  }
  for (const n of nesneler) {
    if (n.tip === 'LINE') parcalar.push(`<line x1="${X(n.x1)}" y1="${Y(n.y1)}" x2="${X(n.x2)}" y2="${Y(n.y2)}" stroke="${renk(n.renk)}" stroke-width="${Math.max(0.12, (n.kalinlik || 25) / 100)}"/>`);
    else if (n.tip === 'LWPOLYLINE') parcalar.push(`<polygon points="${n.pts.map(p => `${X(p[0])},${Y(p[1])}`).join(' ')}" fill="none" stroke="${renk(n.renk)}" stroke-width="${n.genislik || Math.max(0.12, (n.kalinlik || 25) / 100)}"/>`);
    else if (n.tip === 'CIRCLE') parcalar.push(`<circle cx="${X(n.x)}" cy="${Y(n.y)}" r="${n.r}" fill="none" stroke="${renk(n.renk)}" stroke-width="0.25"/>`);
    else if (n.tip === 'MTEXT') {
      const satirlar = mtextSatirlari(n.yazi, renk(n.renk));
      const yatay = { 1: 'start', 4: 'start', 7: 'start', 2: 'middle', 5: 'middle', 8: 'middle', 3: 'end', 6: 'end', 9: 'end' }[n.hiza];
      const dikey = Math.ceil(n.hiza / 3); // 1 üst, 2 orta, 3 alt
      const aralik = n.h * 1.666, toplam = aralik * (satirlar.length - 1);
      const ilkY = dikey === 1 ? n.h : dikey === 2 ? n.h / 2 - toplam / 2 : -toplam;
      satirlar.forEach((s, i) => {
        parcalar.push(`<text x="${X(n.x)}" y="${Y(n.y) + ilkY + i * aralik}" font-family="Arial" font-size="${n.h * 1.0}" text-anchor="${yatay}">` +
          s.map(p => `<tspan fill="${p.renk}"${p.kalin ? ' font-weight="bold"' : ''}${p.olcek ? ` font-size="${n.h * p.olcek}"` : ''}>${kac(p.t)}</tspan>`).join('') + '</text>');
      });
    }
  }
  const zemin = secenek.kagit ? '#fff' : '#000';
  const boyut = secenek.duyarli ? 'width="100%"' : `width="${W * 6}" height="${H * 6}"`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" ${boyut} role="img" aria-label="Gerilim düşümü hesap çizimi"><rect width="100%" height="100%" fill="${zemin}"/>${parcalar.join('')}</svg>`;
}

const api = { svg, mtextSatirlari, renk };
if (typeof module !== 'undefined' && module.exports) module.exports = api; else window.CizimSVG = api;
})();
