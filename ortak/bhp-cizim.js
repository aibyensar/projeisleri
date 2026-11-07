// Bağlantı hattı projesinin her işte değişen çizimleri: tek hat şeması, gerilim düşümü hesabı,
// güç dağılım tablosu, malzeme listesi. Aynı çizim hem DXF varlıklarına (AutoCAD) hem SVG'ye (ekranda önizleme)
// dönüştürülür. Koordinatlar şablonun (BHP-SABLON.dxf) çizim birimleridir.
(function (kok) {
  const KALIN = 'style2', INCE = 'TR';     // şablondaki yazı stilleri (arialbd / arial)

  class Cizim {
    constructor() { this.l = []; }
    cizgi(x1, y1, x2, y2, o = {}) { this.l.push({ t: 'cizgi', x1, y1, x2, y2, ...o }); }
    kutu(x1, y1, x2, y2, o = {}) { this.l.push({ t: 'cokgen', p: [[x1, y1], [x2, y1], [x2, y2], [x1, y2]], kapali: true, ...o }); }
    cokgen(p, o = {}) { this.l.push({ t: 'cokgen', p, ...o }); }
    daire(x, y, r, o = {}) { this.l.push({ t: 'daire', x, y, r, ...o }); }
    dolgu(p, o = {}) { this.l.push({ t: 'dolgu', p, ...o }); }
    yazi(s, x, y, h = 2.5, o = {}) { this.l.push({ t: 'yazi', s: String(s), x, y, h, ...o }); }
  }

  // ---------- Semboller (şablondaki sembol listesiyle aynı) ----------
  const S = { katman: 'BHP-SEMBOL' };
  const sembol = {
    direk(c, x, y, r = 6) { c.daire(x, y, r, S); },
    box(c, x, y) { c.kutu(x - 9, y - 6, x + 9, y + 6, S); c.cizgi(x - 9, y - 6, x + 9, y + 6, S); c.cizgi(x - 9, y + 6, x + 9, y - 6, S); },
    nokta(c, x, y) { const p = []; for (let i = 0; i < 12; i++) p.push([x + 1.8 * Math.cos(i / 12 * 2 * Math.PI), y + 1.8 * Math.sin(i / 12 * 2 * Math.PI)]); c.dolgu(p, S); },
    baslik(c, x, y) { c.dolgu([[x, y], [x + 7, y + 3.2], [x + 7, y - 3.2]], S); },           // sola bakan uç x'te
    sigorta(c, x, y) { c.kutu(x, y - 2.4, x + 12, y + 2.4, S); c.cizgi(x, y, x + 12, y, S); },  // x..x+12
    kar(c, x, y) { c.cizgi(x, y, x + 10, y + 4.5, S); c.kutu(x + 2.5, y - 6.5, x + 7.5, y - 3.5, S); c.cizgi(x + 5, y - 3.5, x + 5, y + 2, { ...S, lt: 'HIDDEN' }); },
    tms(c, x, y) { c.cizgi(x, y, x + 10, y + 4.5, S); c.cizgi(x + 8.2, y - 1.2, x + 11.8, y + 1.2, S); c.cizgi(x + 8.2, y + 1.2, x + 11.8, y - 1.2, S); },
    tmsyks(c, x, y) { sembol.tms(c, x, y); c.kutu(x + 2.5, y - 6.5, x + 7.5, y - 3.5, S); c.cizgi(x + 5, y - 3.5, x + 5, y + 2, { ...S, lt: 'HIDDEN' }); },
    sayac(c, x, y, w = 14, h = 12) {   // x,y sol alt
      c.kutu(x, y, x + w, y + h, S); c.cizgi(x, y + h * 0.45, x + w, y + h * 0.45, S);
      c.yazi('kWh', x + w / 2, y + h * 0.72, 2.2, { hiza: 'orta', katman: 'BHP-SEMBOL' });
    },
    toprak(c, x, y) { c.cizgi(x, y, x, y - 4, S); [5, 3.4, 1.8].forEach((w, i) => c.cizgi(x - w, y - 4 - i * 1.6, x + w, y - 4 - i * 1.6, S)); },
    ok(c, x, y) { c.dolgu([[x + 7, y], [x, y + 3], [x, y - 3]], S); },
  };
  const CIHAZ_GENISLIK = { sigorta: 12, kar: 10, tms: 12, tmsyks: 12 };

  // ---------- Tek hat şeması (bölge x -40..390, y 5715..5792) ----------
  function tekHat(c, v) {
    const yh = 5752;                               // ana hattın yüksekliği
    c.yazi('TEK HAT ŞEMASI', 175, 5786, 4.0, { stil: KALIN, hiza: 'orta' });
    // enerji alınan nokta
    let xb;
    if (v.baglanti === 'box') { sembol.box(c, -16, yh); xb = -7; c.yazi('AG BOX (GDZ ŞEBEKESİ)', -16, yh + 10, 2.4, { hiza: 'orta' }); }
    else { sembol.direk(c, -16, yh); xb = -10; c.yazi('MEVCUT AG DİREĞİ (GDZ)', -16, yh + 10, 2.4, { hiza: 'orta' }); }
    c.yazi(v.kaynakAd || '', -16, yh - 11, 2.6, { stil: KALIN, hiza: 'orta' });
    sembol.nokta(c, xb, yh);
    // kablo başlığı (direkte) ve yeraltı kablosu
    let x = xb;
    if (v.baglanti !== 'box') { c.cizgi(x, yh, x + 6, yh, S); sembol.baslik(c, x + 6, yh); x += 13; }
    const xp = 222;                                // pano başlangıcı
    c.cizgi(x, yh, xp, yh, { katman: 'BHP-KABLO', lt: 'DASHED' });
    sembol.ok(c, (x + xp) / 2 - 3, yh);
    c.yazi(v.kablo.yazi, (x + xp) / 2, yh + 6, 3.4, { stil: KALIN, hiza: 'orta' });
    c.yazi(`L = ${sayiYaz(v.L)} m  ·  YERALTI`, (x + xp) / 2, yh - 6, 3.0, { hiza: 'orta' });
    c.yazi(`Parsel dışı ${sayiYaz(v.Ldis)} m + parsel içi ${sayiYaz(v.Lic)} m`, (x + xp) / 2, yh - 11, 2.2, { hiza: 'orta' });
    // sayaç panosu (kesik çizgili mühürlenebilir bölüm)
    const px1 = xp, px2 = 386, py1 = 5720, py2 = 5780;
    c.kutu(px1, py1, px2, py2, { katman: 'BHP', lt: 'DASHED' });
    c.yazi('SAYAÇ PANOSU (mühürlenebilir bölüm)', (px1 + px2) / 2, py2 - 4, 2.6, { stil: KALIN, hiza: 'orta' });
    x = px1;
    c.cizgi(x, yh, x + 6, yh, S); x += 6;
    for (const k of v.korumalar) {
      const w = CIHAZ_GENISLIK[k.tur] || 12;
      sembol[k.tur](c, x, yh);
      const ad = { sigorta: 'SİGORTA', kar: 'K.A.R', tms: 'TMŞ', tmsyks: 'TMŞ+YKŞ' }[k.tur];
      c.yazi(ad, x + w / 2, yh + 15, 2.2, { hiza: 'orta' });
      c.yazi(k.deger, x + w / 2, yh + 10.5, 2.4, { stil: KALIN, hiza: 'orta' });
      c.cizgi(x + w, yh, x + w + 20, yh, S); x += w + 20;   // yazılar çakışmasın
    }
    // bara ve sayaçlar
    const n = Math.max(1, v.sayacAdet | 0);
    const goster = Math.min(n, 4), sw = 13, ara = 5;
    c.cizgi(x, yh, x + 3, yh, S);
    const xs0 = x + 3;
    const baraSon = xs0 + (goster - 1) * (sw + ara) + sw / 2 + (n > goster ? 14 : 0);
    if (goster > 1 || n > 1) c.cizgi(xs0 + sw / 2, yh, baraSon, yh, { ...S, kalin: true });
    for (let i = 0; i < goster; i++) {
      const sx = xs0 + i * (sw + ara);
      if (i === goster - 1 && n > goster) {          // "…" ve son sayaç
        c.yazi('…', sx - 2, yh + 4, 3.5, { hiza: 'orta' });
      }
      c.cizgi(sx + sw / 2, yh, sx + sw / 2, yh + 2, S);
      sembol.sayac(c, sx, yh + 2, sw, 11);
    }
    c.yazi(n > 1 ? `${n} adet ${v.sayacTip}A elektronik sayaç` : `Elektronik sayaç ${v.sayacTip}A`, xs0 + Math.min(goster, 3) * (sw + ara) / 2, yh - 5, 2.4, { hiza: 'orta' });
    c.yazi(v.sayacTur, xs0 + Math.min(goster, 3) * (sw + ara) / 2, yh - 9, 2.2, { hiza: 'orta' });
    // iç tesisata çıkış
    const xc = Math.min(px2 - 22, Math.max(baraSon + 6, xs0 + goster * (sw + ara)));
    c.cizgi(baraSon, yh, xc + 10, yh, S); sembol.ok(c, xc + 10, yh);
    c.yazi('İÇ TESİSAT', xc + 10, yh + 6, 2.4, { stil: KALIN, hiza: 'orta' });
    // pano topraklaması
    c.cizgi(px2 - 6, py1, px2 - 6, py1 - 1, S); sembol.toprak(c, px2 - 6, py1 - 1);
    c.yazi('1x16 mm² NYY pano topraklaması', px2 - 13, py1 - 3.5, 2.0, { hiza: 'sag' });
  }

  // ---------- Gerilim düşümü ve akım hesabı (bölge x 43..361, y 5796..5963) ----------
  function hesap(c, v) {
    const X = 43, Y = 5963, h = v.h, vg = virgul;
    const sari = (t, x1, x2, y, hh = 3.4) => { c.dolgu([[x1, y - 2.6], [x2, y - 2.6], [x2, y + 2.6], [x1, y + 2.6]], { katman: 'BHP-DOLGU', renk: 2 }); c.yazi(t, (x1 + x2) / 2, y, hh, { stil: KALIN, hiza: 'orta', siyah: true }); };
    const y = (t, x, yy, hh = 3.4, o = {}) => c.yazi(t, X + x, Y - yy, hh, o);
    y('GERİLİM DÜŞÜMÜ VE AKIM HESABI', 50, 12, 4.0, { stil: KALIN });
    y(v.baglanti === 'box' ? 'AG BOX (GDZ)' : 'A.G. DİREĞİ (GDZ)', 33, 32, 3.2, { stil: KALIN, hiza: 'sag' });
    c.dolgu([[X + 36, Y - 35], [X + 44, Y - 35], [X + 44, Y - 29], [X + 36, Y - 29]], { katman: 'BHP-SEMBOL' });
    c.cizgi(X + 44, Y - 32, X + 186, Y - 32);
    sari(v.kablo.yazi, X + 70, X + 160, Y - 25);
    sari(sayiYaz(v.L), X + 103, X + 117, Y - 39); y('m', 119, 39, 3.4);
    c.kutu(X + 186, Y - 46, X + 194, Y - 18); c.cizgi(X + 186, Y - 18, X + 194, Y - 46);
    y('SAYAÇ PANOSU', 190, 13, 3.0, { stil: KALIN, hiza: 'orta' });
    y('BAĞLANTI GÜCÜ', 180, 54, 3.2, { stil: KALIN, hiza: 'sag' }); sari(String(v.N), X + 184, X + 204, Y - 54); y('W', 206, 54, 3.4);
    y('ANA BESLEME HATTI (BAĞLANTI HATTI)', 50, 67, 3.4, { stil: KALIN });
    y('% e =', 30, 80, 3.4, { stil: KALIN, hiza: 'sag' }); sari(vg(h.c, 7), X + 31, X + 59, Y - 80);
    for (const [t, x] of [['x', 66], [String(v.N), 82], ['x', 100], [sayiYaz(v.L), 114], ['/', 128]]) y(t, x, 80, 3.4, { hiza: 'orta' });
    sari(sayiYaz(v.kablo.kesit), X + 134, X + 148, Y - 80);
    y('=', 154, 80, 3.4, { hiza: 'orta' }); y(vg(h.e, 5), 159, 80, 3.4);
    y(`c = 100 / (κ · U²) = 100 / (${v.kablo.iletken === 'al' ? 35 : 56} · 380²)  ·  %e = c · N · L / S`, 31, 87, 2.2);
    y('TOPLAM GERİLİM DÜŞÜMÜ', 50, 98, 3.4, { stil: KALIN });
    y('% e =', 30, 110, 3.4, { stil: KALIN, hiza: 'sag' }); y(vg(h.e, 6), 82, 110, 3.4, { hiza: 'orta' });
    for (const [t, x] of [['=', 154], [vg(h.e, 2), 166], [h.eUygun ? '<' : '>', 180], ['1,5', 192]]) y(t, x, 110, 3.4, { hiza: 'orta' });
    y(h.uygun ? 'KULLANILAN KESİT UYGUNDUR' : 'KESİT UYGUN DEĞİL', 202, 110, 3.0, { stil: KALIN });
    c.cizgi(X + 201, Y - 113.5, X + 300, Y - 113.5);
    y('AKIM KONTROLÜ', 50, 124, 3.4, { stil: KALIN });
    y('I =', 30, 136, 3.4, { stil: KALIN, hiza: 'sag' });
    for (const [t, x] of [[String(v.N), 44], ['/', 66], ['527', 82], ['=', 100], [vg(h.I, 2), 118], [h.iUygun ? '<' : '>', 134]]) y(t, x, 136, 3.4, { hiza: 'orta' });
    sari(String(v.kablo.iz), X + 140, X + 156, Y - 136); y('A', 159, 136, 3.4);
    y(v.kablo.yazi, 172, 136, 3.4, { stil: KALIN });
    y('I = N / (√3 · U · cos φ) ; 527 = √3 · 380 · 0,8', 31, 143, 2.2);
    y(`Akım taşıma kapasitesi (${v.kablo.iz} A): Öznur Kablo kataloğu, ${v.kablo.tur}, toprakta (20 °C)`, 31, 148, 2.2);
  }

  // ---------- Güç dağılım tablosu (bölge x -268..-79, y 5672..5806; satır sayısına göre büyür) ----------
  function gucTablosu(c, v) {
    const x0 = -267.8, x1 = -79.2, ya = 5672.3;
    const K = [0, 20, 40, 62, 88, 114, 132, 158, 188.6];
    const satir = v.satirlar.length, ust = 5804, bas = 13, tH = 4.4, alt = 2 * 5.2;
    const sh = Math.min(5.0, Math.max(2.6, (ust - ya - tH - bas - alt) / Math.max(1, satir)));
    const yu = ya + alt + satir * sh + bas + tH;
    const yH = yu - tH, yV = yH - bas, yT = yV - satir * sh;
    const yz = Math.min(2.1, sh * 0.5);
    c.kutu(x0, ya, x1, yu);
    c.cizgi(x0, yH, x1, yH); c.cizgi(x0 + K[1], yV, x1, yV); c.cizgi(x0, yT, x1, yT);
    c.yazi('GÜÇ DAĞILIM TABLOSU', (x0 + x1) / 2, yu - tH / 2, 2.4, { stil: KALIN, hiza: 'orta' });
    for (let i = 1; i < 8; i++) c.cizgi(x0 + K[i], yH, x0 + K[i], i === 4 || i === 5 ? ya : yT);
    const baslik = [['Bağlantı', 'Hattı'], ['Bağımsız', 'Bölüm No'], ['Enerji Aldığı', 'Tablo Adı'], ['Kurulu', 'Güç (W)'],
      ['Bağlantı', 'Gücü (W)'], ['Sayaç', 'Tipi'], ['Kullanım', 'Amacı'], ['Tesis Mevcut İse', 'Tesisat No']];
    baslik.forEach((b, i) => { const cx = x0 + (K[i] + K[i + 1]) / 2; c.yazi(b[0], cx, yH - 4.4, 1.9, { stil: KALIN, hiza: 'orta' }); c.yazi(b[1], cx, yH - 8.4, 1.9, { stil: KALIN, hiza: 'orta' }); });
    v.satirlar.forEach((s, j) => {
      const yy = yV - sh * (j + 0.5);
      if (j > 0) c.cizgi(x0 + K[1], yV - sh * j, x1, yV - sh * j, { ince: true });
      [s.bb, s.tablo, s.kurulu, s.baglanti, s.sayac, s.kullanim, s.tesis].forEach((t, i) =>
        c.yazi(t == null ? '' : t, x0 + (K[i + 1] + K[i + 2]) / 2, yy, yz, { hiza: 'orta' }));
    });
    c.yazi(v.baglanti === 'box' ? 'AG BOX' : 'AG DİREK', x0 + K[1] / 2, (yV + yT) / 2, 2.0, { stil: KALIN, hiza: 'orta' });
    c.cizgi(x0 + K[1], ya + 5.2, x1, ya + 5.2);
    c.yazi('Toplam Kurulu Güç', x0 + (K[1] + K[4]) / 2, yT - 2.6, 1.9, { hiza: 'orta' });
    c.yazi(String(v.kuruluToplam), x0 + (K[4] + K[5]) / 2, yT - 2.6, 2.1, { stil: KALIN, hiza: 'orta' });
    c.yazi('Toplam Bağlantı Gücü (eş zamanlı)', x0 + (K[1] + K[4]) / 2, ya + 2.6, 1.9, { hiza: 'orta' });
    c.yazi(String(v.N), x0 + (K[4] + K[5]) / 2, ya + 2.6, 2.1, { stil: KALIN, hiza: 'orta' });
    c.cizgi(x0, ya + 5.2 * 2, x0 + K[1], ya + 5.2 * 2);
  }

  // ---------- Malzeme listesi (bölge x 200..391, y 5395..5708) ----------
  function malzemeListesi(c, v) {
    const x0 = 200, x1 = 391, yu = 5708, sh = 9.5;
    const K = [0, 12, 142, 162, 191];
    c.yazi('MALZEME LİSTESİ (BAĞLANTI HATTI)', (x0 + x1) / 2, yu - 5.5, 4.0, { stil: KALIN, hiza: 'orta' });
    const y0 = yu - 11, n = v.malzeme.length;
    const ya = y0 - sh * (n + 1);
    c.kutu(x0, ya, x1, y0);
    for (let i = 1; i < K.length - 1; i++) c.cizgi(x0 + K[i], ya, x0 + K[i], y0);
    ['No', 'Malzemenin cinsi', 'Birim', 'Miktar'].forEach((t, i) => c.yazi(t, x0 + (K[i] + K[i + 1]) / 2, y0 - sh / 2, 2.8, { stil: KALIN, hiza: 'orta' }));
    v.malzeme.forEach((r, j) => {
      const yy = y0 - sh * (j + 1);
      c.cizgi(x0, yy, x1, yy);
      c.yazi(String(j + 1), x0 + K[1] / 2, yy - sh / 2, 2.6, { hiza: 'orta' });
      c.yazi(r.ad, x0 + K[1] + 2, yy - sh / 2, 2.6);
      c.yazi(r.birim, x0 + (K[2] + K[3]) / 2, yy - sh / 2, 2.6, { hiza: 'orta' });
      c.yazi(sayiYaz(r.miktar), x0 + (K[3] + K[4]) / 2, yy - sh / 2, 2.6, { hiza: 'orta' });
    });
    c.yazi('Miktarlar projeye göre yaklaşıktır; kesin metraj kabulde belirlenir.', x0, ya - 4, 2.2);
  }

  function hepsi(v) { const c = new Cizim(); tekHat(c, v); hesap(c, v); gucTablosu(c, v); malzemeListesi(c, v); return c; }

  // ---------- DXF'e yazma ----------
  function virgul(n, b) { return n.toFixed(b).replace('.', ','); }
  function sayiYaz(n) { return (Math.round(n * 100) / 100).toString().replace('.', ','); }
  function dxfVarliklar(c, model, tohum) {
    let h = parseInt(tohum, 16);
    const out = [];
    const bas = (tip, o) => {
      out.push('  0', tip, '  5', (h++).toString(16).toUpperCase(), '330', model, '100', 'AcDbEntity', '  8', o.katman || 'BHP');
      if (o.lt) out.push('  6', o.lt);
      if (o.siyah) out.push(' 62', '7', '420', '0');
      else if (o.renk != null) out.push(' 62', String(o.renk));
      if (o.kalin) out.push('370', '50');
    };
    const f = n => (Math.round(n * 1e4) / 1e4).toString();
    for (const e of c.l) {
      if (e.t === 'cizgi') { bas('LINE', e); out.push('100', 'AcDbLine', ' 10', f(e.x1), ' 20', f(e.y1), ' 30', '0', ' 11', f(e.x2), ' 21', f(e.y2), ' 31', '0'); }
      else if (e.t === 'cokgen') {
        bas('LWPOLYLINE', e); out.push('100', 'AcDbPolyline', ' 90', String(e.p.length), ' 70', e.kapali ? '1' : '0', ' 43', '0');
        for (const [x, y] of e.p) out.push(' 10', f(x), ' 20', f(y));
      } else if (e.t === 'daire') { bas('CIRCLE', e); out.push('100', 'AcDbCircle', ' 10', f(e.x), ' 20', f(e.y), ' 30', '0', ' 40', f(e.r)); }
      else if (e.t === 'dolgu') {
        bas('HATCH', { renk: 7, ...e });
        out.push('100', 'AcDbHatch', ' 10', '0', ' 20', '0', ' 30', '0', '210', '0', '220', '0', '230', '1', '  2', 'SOLID', ' 70', '1', ' 71', '0',
          ' 91', '1', ' 92', '3', ' 72', '0', ' 73', '1', ' 93', String(e.p.length));
        for (const [x, y] of e.p) out.push(' 10', f(x), ' 20', f(y));
        out.push(' 97', '0', ' 75', '1', ' 76', '1', ' 98', '0');
      } else if (e.t === 'yazi') {
        bas('TEXT', e);
        const ha = { sol: 0, orta: 1, sag: 2 }[e.hiza || 'sol'];
        out.push('100', 'AcDbText', ' 10', f(e.x), ' 20', f(e.y), ' 30', '0', ' 40', f(e.h), '  1', e.s.replace(/\r?\n/g, ' '),
          '  7', e.stil || INCE, ' 72', String(ha), ' 11', f(e.x), ' 21', f(e.y), ' 31', '0', '100', 'AcDbText', ' 73', '2');
      }
    }
    return { metin: out.join('\n'), sonraki: h.toString(16).toUpperCase() };
  }
  // Şablona ekle: varlıkları ENTITIES bölümünün sonuna koy, $HANDSEED'i güncelle, kullanılmayan detay katmanını dondur
  function dxfeEkle(sablon, c, baglanti) {
    const ilk = sablon.indexOf('\n');
    const bilgi = JSON.parse(sablon.slice(0, sablon.indexOf('\n', ilk + 1)).split('\n')[1].replace(/^BHP /, ''));
    let s = sablon.slice(sablon.indexOf('\n', ilk + 1) + 1);   // 999 açıklamasını çıkar
    const tm = s.match(/\$HANDSEED\r?\n\s*5\r?\n([0-9A-Fa-f]+)/);
    const { metin, sonraki } = dxfVarliklar(c, bilgi.model, tm[1]);
    s = s.replace(tm[0], tm[0].replace(tm[1], sonraki));
    const ent = s.indexOf('\nENTITIES\n'), son = s.indexOf('\n  0\nENDSEC', ent);
    s = s.slice(0, son) + '\n' + metin + s.slice(son);
    const kapat = baglanti === 'box' ? 'BHP-DETAY-DIREK' : 'BHP-DETAY-BOX';
    // kullanılmayan detayın blok yerleşimini sil, katmanını da dondur (1 = dondurulmuş)
    s = s.replace(new RegExp(`\\n  0\\nINSERT\\n  5\\n[0-9A-F]+\\n330\\n[0-9A-F]+\\n100\\nAcDbEntity\\n  8\\n${kapat}\\n[\\s\\S]*?(?=\\n  0\\n)`), '');
    s = s.replace(new RegExp(`(\\n  2\\n${kapat}\\n 70\\n)\\s*0\\n`), '$11\n');
    return s;
  }

  // ---------- SVG önizleme ----------
  function svg(c, [x0, y0, x1, y1], gen = 900) {
    const sc = gen / (x1 - x0), H = (y1 - y0) * sc;
    const X = x => ((x - x0) * sc).toFixed(1), Y = y => ((y1 - y) * sc).toFixed(1);
    const renk = e => e.katman === 'BHP-KABLO' ? 'var(--kablo, #c0392b)' : 'currentColor';
    let o = `<svg viewBox="0 0 ${gen} ${H.toFixed(0)}" xmlns="http://www.w3.org/2000/svg" style="width:100%;height:auto">`;
    for (const e of c.l) {
      const kesik = e.lt === 'DASHED' ? ` stroke-dasharray="${(3 * sc).toFixed(1)} ${(1.5 * sc).toFixed(1)}"` : e.lt === 'HIDDEN' ? ` stroke-dasharray="${sc.toFixed(1)} ${sc.toFixed(1)}"` : '';
      const sw = e.kalin ? 2 : 1;
      if (e.t === 'cizgi') o += `<line x1="${X(e.x1)}" y1="${Y(e.y1)}" x2="${X(e.x2)}" y2="${Y(e.y2)}" stroke="${renk(e)}" stroke-width="${sw}"${kesik}/>`;
      else if (e.t === 'cokgen') o += `<polyline points="${e.p.concat(e.kapali ? [e.p[0]] : []).map(([x, y]) => X(x) + ',' + Y(y)).join(' ')}" fill="none" stroke="${renk(e)}" stroke-width="${sw}"${kesik}/>`;
      else if (e.t === 'daire') o += `<circle cx="${X(e.x)}" cy="${Y(e.y)}" r="${(e.r * sc).toFixed(1)}" fill="none" stroke="currentColor"/>`;
      else if (e.t === 'dolgu') o += `<polygon points="${e.p.map(([x, y]) => X(x) + ',' + Y(y)).join(' ')}" fill="${e.renk === 2 ? '#ffe600' : 'currentColor'}"/>`;
      else if (e.t === 'yazi') {
        const a = { sol: 'start', orta: 'middle', sag: 'end' }[e.hiza || 'sol'];
        const t = e.s.replace(/&/g, '&amp;').replace(/</g, '&lt;');
        o += `<text x="${X(e.x)}" y="${Y(e.y)}" font-size="${(e.h * sc * 1.15).toFixed(1)}" text-anchor="${a}" dominant-baseline="central" font-family="Arial, sans-serif"${e.stil === KALIN ? ' font-weight="700"' : ''} fill="${e.siyah ? '#000' : 'currentColor'}">${t}</text>`;
      }
    }
    return o + '</svg>';
  }
  const BOLGE = { tekhat: [-42, 5708, 392, 5792], hesap: [43, 5810, 361, 5963], guc: [-270, 5670, -77, 5808], malzeme: [198, 5385, 393, 5710] };

  const BHPCizim = { Cizim, hepsi, tekHat, hesap, gucTablosu, malzemeListesi, dxfeEkle, svg, BOLGE, sayiYaz };
  if (typeof module !== 'undefined' && module.exports) module.exports = BHPCizim; else kok.BHPCizim = BHPCizim;
})(typeof window !== 'undefined' ? window : globalThis);
