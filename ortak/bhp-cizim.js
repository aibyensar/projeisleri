// Bağlantı hattı projesinin her işte değişen çizimleri: tek hat şeması, gerilim düşümü ve akım hesabı,
// güç dağılım tablosu, malzeme listesi, genel notlar ve vaziyet planı işaretleri.
// Aynı çizim hem DXF varlıklarına (AutoCAD) hem SVG'ye (ekranda önizleme) dönüştürülür.
// Bölümlerin yerleri şablonun (BHP-SABLON.dxf) başındaki 999 açıklamasından okunur.
(function (kok) {
  const KALIN = 'BHP-K', INCE = 'BHP';      // şablondaki yazı stilleri (arialbd / arial)

  // ---------- Çizim listesi (isteğe bağlı dönüşümle: kaynak kutudan hedef kutuya ölçekleme) ----------
  class Cizim {
    constructor() { this.l = []; this.d = null; }
    // kaynak [x0,y0,x1,y1] → hedef [x0,y0,x1,y1]; oran korunur, hedefe ortalanır; enFazla: en büyük ölçek
    donustur(k, h, enFazla = 1.5) {
      if (!k) { this.d = null; return; }
      const s = Math.min((h[2] - h[0]) / (k[2] - k[0]), (h[3] - h[1]) / (k[3] - k[1]), enFazla);
      const ox = (h[0] + h[2]) / 2 - (k[0] + k[2]) / 2 * s, oy = (h[1] + h[3]) / 2 - (k[1] + k[3]) / 2 * s;
      this.d = { s, ox, oy };
    }
    _p(x, y) { const d = this.d; return d ? [x * d.s + d.ox, y * d.s + d.oy] : [x, y]; }
    _u(v) { return this.d ? v * this.d.s : v; }
    cizgi(x1, y1, x2, y2, o = {}) { const [a, b] = this._p(x1, y1), [c, d] = this._p(x2, y2); this.l.push({ t: 'cizgi', x1: a, y1: b, x2: c, y2: d, ...o }); }
    kutu(x1, y1, x2, y2, o = {}) { this.cokgen([[x1, y1], [x2, y1], [x2, y2], [x1, y2]], { kapali: true, ...o }); }
    cokgen(p, o = {}) { this.l.push({ t: 'cokgen', p: p.map(([x, y]) => this._p(x, y)), ...o }); }
    daire(x, y, r, o = {}) { const [a, b] = this._p(x, y); this.l.push({ t: 'daire', x: a, y: b, r: this._u(r), ...o }); }
    dolgu(p, o = {}) { this.l.push({ t: 'dolgu', p: p.map(([x, y]) => this._p(x, y)), ...o }); }
    yazi(s, x, y, h = 2.5, o = {}) { const [a, b] = this._p(x, y); this.l.push({ t: 'yazi', s: String(s), x: a, y: b, h: this._u(h), ...o }); }
  }

  // ---------- Semboller (şablondaki sembol listesiyle aynı) ----------
  const S = { katman: 'BHP-SEMBOL' };
  const sembol = {
    direk(c, x, y, r = 6) { c.daire(x, y, r, S); },
    box(c, x, y) { c.kutu(x - 9, y - 6, x + 9, y + 6, S); c.cizgi(x - 9, y - 6, x + 9, y + 6, S); c.cizgi(x - 9, y + 6, x + 9, y - 6, S); },
    nokta(c, x, y, r = 1.8) { const p = []; for (let i = 0; i < 12; i++) p.push([x + r * Math.cos(i / 12 * 2 * Math.PI), y + r * Math.sin(i / 12 * 2 * Math.PI)]); c.dolgu(p, S); },
    baslik(c, x, y) { c.dolgu([[x, y], [x + 7, y + 3.2], [x + 7, y - 3.2]], S); },
    sigorta(c, x, y) { c.kutu(x, y - 2.4, x + 12, y + 2.4, S); c.cizgi(x, y, x + 12, y, S); },
    kar(c, x, y) { c.cizgi(x, y, x + 10, y + 4.5, S); c.kutu(x + 2.5, y - 6.5, x + 7.5, y - 3.5, S); c.cizgi(x + 5, y - 3.5, x + 5, y + 2, { ...S, lt: 'BHP-GIZLI' }); },
    tms(c, x, y) { c.cizgi(x, y, x + 10, y + 4.5, S); c.cizgi(x + 8.2, y - 1.2, x + 11.8, y + 1.2, S); c.cizgi(x + 8.2, y + 1.2, x + 11.8, y - 1.2, S); },
    tmsyks(c, x, y) { sembol.tms(c, x, y); c.kutu(x + 2.5, y - 6.5, x + 7.5, y - 3.5, S); c.cizgi(x + 5, y - 3.5, x + 5, y + 2, { ...S, lt: 'BHP-GIZLI' }); },
    sayac(c, x, y, w = 14, h = 12) {   // x,y sol alt
      c.kutu(x, y, x + w, y + h, S); c.cizgi(x, y + h * 0.45, x + w, y + h * 0.45, S);
      c.yazi('kWh', x + w / 2, y + h * 0.72, 2.2, { hiza: 'orta', katman: 'BHP-SEMBOL' });
    },
    toprak(c, x, y) { c.cizgi(x, y, x, y - 4, S); [5, 3.4, 1.8].forEach((w, i) => c.cizgi(x - w, y - 4 - i * 1.6, x + w, y - 4 - i * 1.6, S)); },
    ok(c, x, y) { c.dolgu([[x + 7, y], [x, y + 3], [x, y - 3]], S); },
  };
  const CIHAZ_GENISLIK = { sigorta: 12, kar: 10, tms: 12, tmsyks: 12 };
  const CIHAZ_AD = { sigorta: 'SİGORTA', kar: 'K.A.R', tms: 'TMŞ', tmsyks: 'TMŞ+YKŞ' };

  // ---------- Tek hat şeması (kullanıcının onaylı projelerindeki düzen; şablon koordinatlarında çizilir) ----------
  // Solda enerji noktası (direk: daire, box: çarpılı kutu), kesikli yeraltı kablosu ve enerji oku, sağda
  // kesikli "mühürlenebilir alan" (sayaç panosu): ana koruma(lar) → bara → her sayaç grubu: sayaç önü sigorta → sayaç → iç tesisat.
  function tekHat(c, v, [X0, Y0, X1, Y1]) {
    const yh = Y0 + (Y1 - Y0) * 0.62, mono = v.faz === 1, K = { katman: 'BHP-KABLO', lt: 'BHP-KESIK' };
    const kx = X0 + 92, r = 12.15;                         // enerji noktası merkezi
    if (v.baglanti === 'box') {
      c.kutu(kx - 13, yh - 8.5, kx + 13, yh + 8.5, S); c.cizgi(kx - 13, yh - 8.5, kx + 13, yh + 8.5, S); c.cizgi(kx - 13, yh + 8.5, kx + 13, yh - 8.5, S);
    } else c.daire(kx, yh, r, S);
    const ad = v.kaynakAd || (v.baglanti === 'box' ? 'AG BOX (GDZ)' : 'AG DİREĞİ (GDZ)');
    const ah = Math.min(4.2, 190 / Math.max(1, genislik(ad, 1)));
    c.yazi(ad, Math.max(X0 + 2 + genislik(ad, ah) / 2, kx), yh - r - 7, ah, { hiza: 'orta' });
    c.yazi(v.baglanti === 'box' ? 'AG BOX (GDZ ŞEBEKESİ)' : 'MEVCUT AG DİREĞİ (GDZ)', kx, yh + r + 4, 2.6, { hiza: 'orta' });
    const px1 = X0 + 268, px2 = X1 - 4, py1 = Y0 + 9, py2 = Y1 - 7;
    const xs = kx + (v.baglanti === 'box' ? 13 : r);
    c.cizgi(xs, yh, px1, yh, K);
    const ox = (xs + px1) / 2;
    c.dolgu([[ox + 6, yh], [ox - 6, yh + 4.3], [ox - 6, yh - 4.3]], S);
    c.yazi(v.kablo.yazi, ox, yh + 9, 4.6, { hiza: 'orta' });
    c.yazi(`${sayiYaz(v.L)} m`, ox, yh - 8, 4.2, { hiza: 'orta' });
    c.yazi(`YERALTI · ${mono ? 'MONOFAZE 220 V' : 'TRİFAZE 380 V'}`, ox, yh - 14, 3.6, { hiza: 'orta' });
    c.yazi(`(parsel dışı ${sayiYaz(v.Ldis)} m + parsel içi ${sayiYaz(v.Lic)} m)`, ox, yh - 19.5, 2.4, { hiza: 'orta' });
    // sayaç panosu
    c.kutu(px1, py1, px2, py2, { katman: 'BHP', lt: 'BHP-KESIK', kalin: true });
    c.yazi('mühürlenebilir alan', (px1 + px2) / 2, py2 + 3.6, 4.0, { hiza: 'orta' });
    c.yazi('SAYAÇ PANOSU', px1 + 2, py2 - 3.5, 2.4, { stil: KALIN });
    let x = px1;
    c.cizgi(x, yh, x + 8, yh, S); x += 8;
    for (const k of v.korumalar) {
      const w = CIHAZ_GENISLIK[k.tur] || 12;
      sembol[k.tur](c, x, yh);
      c.yazi(CIHAZ_AD[k.tur], x + w / 2, yh + 15, 2.6, { hiza: 'orta' });
      const [a, b] = String(k.deger || '').split(/\s+(?=\d+\s*m?A$|\d+\s*kA$)/);
      c.yazi(a || '', x + w / 2, yh + 11, 2.6, { stil: KALIN, hiza: 'orta' });
      if (b) c.yazi(b, x + w / 2, yh + 7.2, 2.6, { stil: KALIN, hiza: 'orta' });
      c.cizgi(x + w, yh, x + w + 10, yh, S); x += w + 10;
    }
    const gruplar = v.gruplar && v.gruplar.length ? v.gruplar : [{ onu: '', adet: v.sayacAdet || 1, ad: '', tip: v.sayacTip }];
    const adim = 34, sigar = Math.max(1, Math.floor((px2 - 6 - x) / adim) + 1);
    const goster = gruplar.slice(0, sigar), artan = gruplar.length - goster.length;
    const xg0 = x + 4, xgSon = xg0 + (goster.length - 1) * adim;
    c.cizgi(x, yh, Math.max(xgSon, x + 4), yh, { ...S, kalin: goster.length > 1 });
    goster.forEach((g, i) => {
      const gx = xg0 + i * adim;
      let y = yh;
      if (g.onu) {
        c.cizgi(gx, y, gx, yh - 3, S);
        c.kutu(gx - 2.2, yh - 12, gx + 2.2, yh - 3, S); c.cizgi(gx, yh - 12, gx, yh - 3, S);
        c.yazi(g.onu.replace(/\s+(?=\d+\s*kA$)/, ' / '), gx + 3.5, yh - 7.5, 2.2, { stil: KALIN });
        y = yh - 12;
      }
      const sy = yh - 30;
      c.cizgi(gx, y, gx, sy + 11, S);
      c.kutu(gx - 6, sy, gx + 6, sy + 11, S); c.cizgi(gx - 6, sy + 5.5, gx + 6, sy + 5.5, S);
      c.yazi('kWh', gx, sy + 8.2, 2.3, { hiza: 'orta' }); c.yazi(v.sayacTur === 'Aktif' ? 'Aktif' : 'A+R', gx, sy + 2.8, 2.1, { hiza: 'orta' });
      c.yazi(`${g.tip}A`, gx + 7.5, sy + 8, 2.2, { stil: KALIN });
      c.yazi(`${g.adet} ad.`, gx + 7.5, sy + 4, 2.2);
      c.cizgi(gx, sy, gx, py1 + 3, S); c.dolgu([[gx, py1 + 0.5], [gx - 1.8, py1 + 4], [gx + 1.8, py1 + 4]], S);
      if (g.ad) c.yazi(g.ad, gx + 2.5, py1 + 2.2, 2.0);
    });
    if (artan > 0) c.yazi(`+ ${artan} grup (güç dağıtım tablosu)`, px2 - 2, yh + 4, 2.0, { hiza: 'sag' });
    c.yazi(`Toplam ${v.sayacAdet} adet elektronik sayaç`, px2 - 2, py2 - 3.5, 2.2, { hiza: 'sag' });
    // pano topraklaması
    c.cizgi(px2 - 4, py1, px2 - 4, Y0 + 5, S); sembol.toprak(c, px2 - 4, Y0 + 5);
    c.yazi('1x16 mm² NYY pano topraklaması', px2 - 7, py1 - 4.5, 2.2, { hiza: 'sag' });
  }

  // ---------- 6. Gerilim düşümü ve akım hesabı (kendi koordinatlarında: x 43..361, y 5812..5958) ----------
  const HESAP_KAYNAK = [40, 5806, 362, 5960];
  function hesap(c, v) {
    const X = 43, Y = 5963, h = v.h, vg = virgul, mono = v.faz === 1;
    const sari = (t, x1, x2, y, hh = 3.4) => { c.dolgu([[x1, y - 2.6], [x2, y - 2.6], [x2, y + 2.6], [x1, y + 2.6]], { katman: 'BHP-DOLGU', renk: 254 }); c.yazi(t, (x1 + x2) / 2, y, hh, { stil: KALIN, hiza: 'orta' }); };
    const y = (t, x, yy, hh = 3.4, o = {}) => c.yazi(t, X + x, Y - yy, hh, o);
    const U = mono ? 220 : 380, k = v.kablo.iletken === 'al' ? 35 : 56;
    y(v.baglanti === 'box' ? 'AG BOX (GDZ)' : 'AG DİREĞİ (GDZ)', 33, 18, 2.6, { stil: KALIN, hiza: 'sag' });
    c.dolgu([[X + 36, Y - 21], [X + 44, Y - 21], [X + 44, Y - 15], [X + 36, Y - 15]], { katman: 'BHP-SEMBOL' });
    c.cizgi(X + 44, Y - 18, X + 186, Y - 18);
    sari(v.kablo.yazi, X + 70, X + 160, Y - 11);
    sari(sayiYaz(v.L), X + 103, X + 117, Y - 25); y('m', 119, 25, 3.4);
    c.kutu(X + 186, Y - 32, X + 194, Y - 4); c.cizgi(X + 186, Y - 4, X + 194, Y - 32);
    y('SAYAÇ PANOSU', 198, 10, 2.8, { stil: KALIN });
    y('BAĞLANTI GÜCÜ', 198, 18, 2.8); sari(String(v.N), X + 238, X + 258, Y - 18); y('W', 260, 18, 3.0);
    y(mono ? 'Monofaze, 220 V' : 'Trifaze, 380 V', 198, 26, 2.8);
    y('ANA BESLEME HATTI (BAĞLANTI HATTI)', 50, 45, 3.4, { stil: KALIN });
    y('% e =', 30, 58, 3.4, { stil: KALIN, hiza: 'sag' }); sari(vg(h.c, 7), X + 31, X + 59, Y - 58);
    for (const [t, x] of [['x', 66], [String(v.N), 82], ['x', 100], [sayiYaz(v.L), 114], ['/', 128]]) y(t, x, 58, 3.4, { hiza: 'orta' });
    sari(sayiYaz(v.kablo.kesit), X + 134, X + 148, Y - 58);
    y('=', 154, 58, 3.4, { hiza: 'orta' }); y(vg(h.e, 5), 159, 58, 3.4);
    y(`%e = c · N · L / S ;  c = ${mono ? 200 : 100} / (κ · U²) = ${mono ? 200 : 100} / (${k} · ${U}²) ;  κ = ${k} m/Ω·mm² (${v.kablo.iletken === 'al' ? 'alüminyum' : 'bakır'})`, 31, 65, 2.2);
    y('TOPLAM GERİLİM DÜŞÜMÜ', 50, 79, 3.4, { stil: KALIN });
    y('% e =', 30, 91, 3.4, { stil: KALIN, hiza: 'sag' }); y(vg(h.e, 6), 82, 91, 3.4, { hiza: 'orta' });
    for (const [t, x] of [['=', 154], [vg(h.e, 2), 166], [h.eUygun ? '<' : '>', 180], ['1,5', 192]]) y(t, x, 91, 3.4, { hiza: 'orta' });
    y(h.eUygun ? 'GERİLİM DÜŞÜMÜ UYGUNDUR' : 'GERİLİM DÜŞÜMÜ UYGUN DEĞİL', 202, 91, 3.0, { stil: KALIN });
    c.cizgi(X + 201, Y - 94.5, X + 300, Y - 94.5);
    y('AKIM KONTROLÜ', 50, 108, 3.4, { stil: KALIN });
    y('I =', 30, 120, 3.4, { stil: KALIN, hiza: 'sag' });
    for (const [t, x] of [[String(v.N), 44], ['/', 66], [String(v.bolen), 82], ['=', 100], [vg(h.I, 2), 118], [h.iUygun ? '<' : '>', 134]]) y(t, x, 120, 3.4, { hiza: 'orta' });
    sari(String(v.kablo.iz), X + 140, X + 156, Y - 120); y('A', 159, 120, 3.4);
    y(h.iUygun ? 'AKIM YÖNÜNDEN UYGUNDUR' : 'AKIM YÖNÜNDEN UYGUN DEĞİL', 202, 120, 3.0, { stil: KALIN });
    c.cizgi(X + 201, Y - 123.5, X + 300, Y - 123.5);
    y(mono ? 'I = N / (U · cos φ) ;  176 = 220 · 0,8' : 'I = N / (√3 · U · cos φ) ;  527 = √3 · 380 · 0,8', 31, 127, 2.2);
    y(`Akım taşıma kapasitesi: ${v.kablo.yazi} toprakta ${v.kablo.iz} A (Öznur Kablo kataloğu, toprak sıcaklığı 20 °C)`, 31, 132, 2.2);
    y(`SONUÇ: ${v.kablo.yazi} ${h.uygun ? 'kablo kullanılması uygundur.' : 'kablo UYGUN DEĞİLDİR, kesit büyütülmelidir.'}`, 31, 143, 3.2, { stil: KALIN });
  }

  // ---------- Güç dağıtım tablosu (kullanıcının onaylı projelerindeki sütunlar) ----------
  function gucTablosu(c, v, [x0, ya, x1, yu]) {
    const T = { katman: 'BHP-TABLO' }, W = x1 - x0;
    const K = [0, 0.12, 0.25, 0.38, 0.505, 0.63, 0.72, 0.84, 1].map(o => x0 + o * W);
    const n = v.satirlar.length, basY = 6.5, sutunY = 11, alt = 3 * 6;
    const sh = Math.min(6.5, Math.max(3.4, (yu - ya - basY - sutunY - alt) / Math.max(1, n)));
    const yH = yu, yS = yH - basY, yV = yS - sutunY, yT = yV - n * sh, yA = yT - alt;
    const yz = Math.min(2.6, sh * 0.48);
    c.kutu(x0, yA, x1, yH, T);
    c.dolgu([[x0, yS], [x1, yS], [x1, yH], [x0, yH]], { katman: 'BHP-DOLGU', renk: 254 });
    c.yazi('GÜÇ DAĞITIM TABLOSU', (x0 + x1) / 2, yH - basY / 2, 3.0, { stil: KALIN, hiza: 'orta' });
    [yS, yV, yT].forEach(y => c.cizgi(x0, y, x1, y, T));
    for (let i = 1; i < 8; i++) c.cizgi(K[i], yS, K[i], yT, T);
    [['TABLO', 'ADI'], ['BAĞIMSIZ', 'BÖLÜM NO'], ['ENERJİ ALDIĞI', 'TABLO ADI'], ['KURULU', 'GÜCÜ (W)'], ['BAĞLANTI', 'GÜCÜ (W)'],
      ['SAYAÇ', 'TİPİ'], ['KULLANIM', 'AMACI'], ['TESİS MEVCUT İSE', 'TESİSAT NUMARASI']].forEach((b, i) => {
      const cx = (K[i] + K[i + 1]) / 2, h = Math.min(2.2, (K[i + 1] - K[i]) / genislik(b[1].length > b[0].length ? b[1] : b[0], 1) * 0.9);
      c.yazi(b[0], cx, yS - 3.6, h, { stil: KALIN, hiza: 'orta' }); c.yazi(b[1], cx, yS - 7.6, h, { stil: KALIN, hiza: 'orta' });
    });
    v.satirlar.forEach((s, j) => {
      const yy = yV - sh * (j + 0.5);
      if (j) c.cizgi(K[1], yV - sh * j, x1, yV - sh * j, T);
      [s.bb, s.tablo, s.kurulu, s.baglanti, s.sayac, s.kullanim, s.tesis || 'YENİ'].forEach((t, i) =>
        c.yazi(t == null ? '' : t, (K[i + 1] + K[i + 2]) / 2, yy, yz, { hiza: 'orta' }));
    });
    if (yV - yT >= 8) {
      c.yazi('BAĞLANTI', (K[0] + K[1]) / 2, (yV + yT) / 2 + 1.8, 2.3, { stil: KALIN, hiza: 'orta' });
      c.yazi('HATTI', (K[0] + K[1]) / 2, (yV + yT) / 2 - 1.8, 2.3, { stil: KALIN, hiza: 'orta' });
    } else c.yazi('B. HATTI', (K[0] + K[1]) / 2, (yV + yT) / 2, 2.0, { stil: KALIN, hiza: 'orta' });
    const bgT = v.satirlar.reduce((t, s) => t + (parseFloat(s.baglanti) || 0), 0);
    const alts = [['TOPLAM KURULU GÜÇ (W)', v.kuruluToplam], ['TOPLAM BAĞLANTI GÜCÜ (BG\'LER TOPLAMI, W)', bgT || v.N],
      ['BAĞLANTI HATTI BAĞLANTI GÜCÜ (EŞ ZAMANLI, W)', v.N]];
    alts.forEach(([t, d], i) => {
      const y = yT - 6 * (i + 0.5);
      if (i) c.cizgi(x0, yT - 6 * i, x1, yT - 6 * i, T);
      c.yazi(t, K[4] - 2, y, 2.3, { stil: i === 2 ? KALIN : INCE, hiza: 'sag' });
      c.yazi(String(d), (K[4] + K[5]) / 2, y, 2.5, { stil: KALIN, hiza: 'orta' });
    });
    c.cizgi(K[4], yT, K[4], yA, T); c.cizgi(K[5], yT, K[5], yA, T);
  }

  // ---------- Yük dağılımı ve tablo yükleme cetveli (kullanıcının boxlu onaylı projesindeki gibi) ----------
  function cetvel(c, v, [x0, ya, x1, yu]) {
    const T = { katman: 'BHP-TABLO' }, W = x1 - x0;
    const o = [0, 0.055, 0.115, 0.175, 0.215, 0.29, 0.325, 0.36, 0.44, 0.52, 0.585, 0.635, 0.745, 0.818, 0.9, 1];
    const K = o.map(t => x0 + t * W);
    const yH = yu, y1 = yH - 6, y2 = y1 - 5, y3 = y2 - 9, y4 = y3 - 12, yA = Math.max(ya, y4 - 7);
    c.kutu(x0, yA, x1, yH, T);
    c.dolgu([[x0, y1], [x1, y1], [x1, yH], [x0, yH]], { katman: 'BHP-DOLGU', renk: 254 });
    c.yazi('YÜK DAĞILIMI ve TABLO YÜKLEME CETVELİ', (x0 + x1) / 2, yH - 3, 3.0, { stil: KALIN, hiza: 'orta' });
    c.cizgi(x0, y1, x1, y1, T); c.cizgi(x0, y3, x1, y3, T); c.cizgi(x0, y4, x1, y4, T);
    c.cizgi(K[3], y2, K[11], y2, T);
    // dikey çizgiler (gruplu başlıklar: sigorta 3-5, sorti 5-7, kurulu güçler 7-11)
    [1, 2, 3, 5, 7, 11, 12, 13, 14].forEach(i => c.cizgi(K[i], y1, K[i], y4, T));
    [4, 6, 8, 9, 10].forEach(i => c.cizgi(K[i], y2, K[i], y4, T));
    const b = (t, i, j, y, h = 2.2) => c.yazi(t, (K[i] + K[j]) / 2, y, h, { stil: KALIN, hiza: 'orta' });
    const ort = (y1 + y3) / 2;
    b('TABLO', 0, 1, ort + 1.8); b('ADI', 0, 1, ort - 1.8); b('K.A.R', 1, 2, ort); b('LİNYE', 2, 3, ort + 1.8); b('NO', 2, 3, ort - 1.8);
    b('SİGORTA', 3, 5, y1 - 2.5); b('SORTİ', 5, 7, y1 - 2.5); b('KURULU GÜÇLER (W)', 7, 11, y1 - 2.5);
    b('W-ot', 3, 4, (y2 + y3) / 2 + 1.6, 1.9); b('tipi', 3, 4, (y2 + y3) / 2 - 1.6, 1.9); b('AMPER', 4, 5, (y2 + y3) / 2, 1.9);
    b('AYD.', 5, 6, (y2 + y3) / 2, 1.9); b('PRİZ', 6, 7, (y2 + y3) / 2, 1.9);
    ['R', 'S', 'T', 'RST'].forEach((t, i) => b(t, 7 + i, 8 + i, (y2 + y3) / 2));
    b('AÇIKLAMALAR', 11, 12, ort); b('BAĞLANTI', 12, 13, ort + 1.8, 2.0); b('GÜCÜ (W)', 12, 13, ort - 1.8, 2.0);
    b('AKIM', 13, 14, ort + 1.8); b('TAŞIMA (A)', 13, 14, ort - 1.8); b('KABLO', 14, 15, ort + 1.8); b('CİNSİ', 14, 15, ort - 1.8);
    const ym = (y3 + y4) / 2, d = (t, i, j, y = ym, h = 2.3, o = {}) => c.yazi(t, (K[i] + K[j]) / 2, y, h, { hiza: 'orta', ...o });
    const tablo = v.satirlar.length > 1 ? 'ADP' : (v.satirlar[0] && v.satirlar[0].tablo) || 'AT';
    d(tablo, 0, 1);
    const ana = v.korumalar[v.korumalar.length - 1] || v.korumalar[0];
    if (ana) { const [a1, a2] = String(ana.deger || '').split(/\s+(?=\d+\s*m?A$|\d+\s*kA$)/); d(a1 || '', 1, 2, ym + 1.8, 1.9); d(((a2 || '') + ' ' + ({ tmsyks: 'YKŞ', kar: 'K.A.R', tms: 'TMŞ', sigorta: '' }[ana.tur] || '')).trim(), 1, 2, ym - 1.8, 1.9); }
    d(String(v.kuruluToplam), 10, 11);
    d('BİNA BAĞLANTI', 11, 12, ym + 1.8, 2.1); d('GÜCÜ', 11, 12, ym - 1.8, 2.1);
    d(String(v.N), 12, 13); d(virgul(v.h.I, 2), 13, 14);
    const [k1, k2] = v.kablo.yazi.split(/\s(?=mm²)/); d(k1, 14, 15, ym + 1.8, 2.1); d(k2 || '', 14, 15, ym - 1.8, 2.1);
    c.yazi('BAĞLANTI GÜCÜ (W)', x0 + 2, (y4 + yA) / 2, 2.4, { stil: KALIN });
    c.yazi(String(v.N), (K[12] + K[13]) / 2, (y4 + yA) / 2, 2.8, { stil: KALIN, hiza: 'orta' });
  }

  // ---------- 8. Malzeme listesi ----------
  function malzemeListesi(c, v, [x0, ya, x1, yu]) {
    const W = x1 - x0, n = v.malzeme.length;
    const K = [0, 0.07, 0.75, 0.86, 1].map(o => o * W);
    const sh = Math.min(9.0, Math.max(5.0, (yu - ya - 12) / (n + 1)));
    const y0 = yu, yA = y0 - sh * (n + 1);
    c.kutu(x0, yA, x1, y0);
    for (let i = 1; i < K.length - 1; i++) c.cizgi(x0 + K[i], yA, x0 + K[i], y0);
    ['No', 'Malzemenin cinsi', 'Birim', 'Miktar'].forEach((t, i) => c.yazi(t, x0 + (K[i] + K[i + 1]) / 2, y0 - sh / 2, 2.6, { stil: KALIN, hiza: 'orta' }));
    const yz = Math.min(2.5, sh * 0.42);
    v.malzeme.forEach((r, j) => {
      const yy = y0 - sh * (j + 1);
      c.cizgi(x0, yy, x1, yy);
      c.yazi(String(j + 1), x0 + K[1] / 2, yy - sh / 2, yz, { hiza: 'orta' });
      c.yazi(r.ad, x0 + K[1] + 2, yy - sh / 2, yz);
      c.yazi(r.birim, x0 + (K[2] + K[3]) / 2, yy - sh / 2, yz, { hiza: 'orta' });
      c.yazi(sayiYaz(+r.miktar || 0), x0 + (K[3] + K[4]) / 2, yy - sh / 2, yz, { hiza: 'orta' });
    });
    c.yazi('Miktarlar projeye göre yaklaşıktır; kesin metraj kabulde belirlenir.', x0, yA - 4, 2.0);
  }

  // ---------- 10. Genel notlar (satırlara bölünerek yazılır) ----------
  // Arial için yaklaşık harf genişliği (AutoCAD'de yazı yüksekliği h büyük harf yüksekliğidir; genişlikler h'nin katı)
  function genislik(t, h) {
    let w = 0;
    for (const ch of String(t)) w += /[MWĞ]/.test(ch) ? 1.12 : /[A-ZÇİÖŞÜ]/.test(ch) ? 0.94 : /[mw]/.test(ch) ? 1.08 : /[il.,;:'ı|!]/.test(ch) ? 0.33 : ch === ' ' ? 0.39 : /[0-9]/.test(ch) ? 0.78 : 0.70;
    return w * h;
  }
  function satirlaraBol(metin, en, h) {
    const out = [];
    for (const parca of String(metin).split('\n')) {
      let satir = '';
      for (const s of parca.split(/\s+/)) {
        if (!s) continue;
        const aday = (satir + ' ' + s).trim();
        if (genislik(aday, h) > en * 0.93 && satir) { out.push(satir); satir = s; } else satir = aday;   // %7 pay
      }
      out.push(satir);
    }
    return out;
  }
  function notlar(c, v, [x0, ya, x1, yu]) {
    let h = 4.0, aralik = 1.5;
    const W = x1 - x0 - 4;
    const hazirla = hh => v.notlar.map((n, i) => satirlaraBol(n, W - hh * 3.2, hh));
    let parcalar = hazirla(h);
    const yukseklik = (p, hh) => p.reduce((t, l) => t + l.length * hh * aralik + hh * 0.9, 0);
    while (yukseklik(parcalar, h) > yu - ya - 4 && h > 1.8) { h -= 0.1; parcalar = hazirla(h); }
    let y = yu - h;
    parcalar.forEach((satirlar, i) => {
      c.yazi(`${i + 1}.`, x0 + 2, y, h, { stil: KALIN });
      satirlar.forEach((s, j) => { c.yazi(s, x0 + 2 + h * 3.2, y - j * h * aralik, h); });
      y -= satirlar.length * h * aralik + h * 0.9;
    });
  }

  // ---------- 1. Vaziyet planı işaretleri (kullanıcının resim üzerinde tıkladığı yerler) ----------
  function vaziyet(c, v, [x0, y0, x1, y1]) {
    const W = x1 - x0, H = y1 - y0;
    const P = ([u, w]) => [x0 + u * W, y1 - w * H];          // resim kesirleri (sol üst 0,0) → çizim
    const isaret = v.vaziyet || {};
    const K = { katman: 'BHP-VAZIYET' };
    if (isaret.nokta && isaret.bina) {
      const a = P(isaret.nokta), b = P(isaret.bina);
      const ara = (isaret.ara || []).map(P);
      const yol = [a, ...ara, b];
      c.cokgen(yol, { katman: 'BHP-VAZIYET', lt: 'BHP-KESIK', kalin: true, renk: 1 });
      if (v.baglanti === 'box') { c.kutu(a[0] - 4, a[1] - 2.8, a[0] + 4, a[1] + 2.8, K); c.cizgi(a[0] - 4, a[1] - 2.8, a[0] + 4, a[1] + 2.8, K); c.cizgi(a[0] - 4, a[1] + 2.8, a[0] + 4, a[1] - 2.8, K); }
      else c.daire(a[0], a[1], 2.8, K);
      // sayaç panosu: uzun kenarı parsel sınırına paralel (kullanıcı sınır üzerinde 2 nokta tıklar)
      const aci = panoAci(isaret, W, H), ca = Math.cos(aci), sa = Math.sin(aci);
      const R = (dx, dy) => [b[0] + dx * ca - dy * sa, b[1] + dx * sa + dy * ca];
      // kullanıcının sembol tablosundaki işaret: dikdörtgen içinde ortada birleşen iki dolu üçgen
      c.cokgen([R(-3.5, -2), R(3.5, -2), R(3.5, 2), R(-3.5, 2)], { ...K, kapali: true });
      c.dolgu([R(-3.5, -2), R(-3.5, 2), R(0, 0)], { ...K, renk: 1 }); c.dolgu([R(3.5, -2), R(3.5, 2), R(0, 0)], { ...K, renk: 1 });
      // etiketler: beyaz zeminli kutu; birbirine ve çerçeve kenarına çarpmayan ilk yere konur
      const dolu = [];
      const kesisir = (r, q) => !(r[2] < q[0] || r[0] > q[2] || r[3] < q[1] || r[1] > q[3]);
      const etiket = (p, satirlar, yon) => {
        const h = 2.4, w = Math.max(...satirlar.map(s => genislik(s, h))) + 3, hh = satirlar.length * h * 1.45 + 2;
        const adaylar = [[6, 5], [6, -5 - hh], [-6 - w, 5], [-6 - w, -5 - hh], [6, 14], [-6 - w, 14], [6, -14 - hh], [-6 - w, -14 - hh], [-w / 2, 9], [-w / 2, -9 - hh]];
        if (yon < 0) adaylar.sort((m, n) => m[0] - n[0]);
        let sec = null;
        for (const [dx, dy] of adaylar) {
          let ex = p[0] + dx, ey = p[1] + dy;
          ex = Math.max(x0 + 1, Math.min(x1 - w - 1, ex)); ey = Math.max(y0 + 1, Math.min(y1 - hh - 1, ey));
          const r = [ex - 1, ey - 1, ex + w + 1, ey + hh + 1];
          if (!dolu.some(q => kesisir(r, q))) { sec = [ex, ey, r]; break; }
          if (!sec) sec = [ex, ey, r, true];
        }
        const [ex, ey, r] = sec; dolu.push(r);
        c.dolgu([[ex, ey], [ex + w, ey], [ex + w, ey + hh], [ex, ey + hh]], { katman: 'BHP-VAZIYET', renk: 255, beyaz: true });
        c.kutu(ex, ey, ex + w, ey + hh, K);
        satirlar.forEach((s, i) => c.yazi(s, ex + 1.5, ey + hh - 1 - (i + 0.5) * h * 1.45, h, { katman: 'BHP-VAZIYET', stil: i === 0 ? KALIN : INCE }));
        const bx = Math.max(ex, Math.min(ex + w, p[0])), by = p[1] < ey ? ey : (p[1] > ey + hh ? ey + hh : p[1]);
        c.cizgi(p[0], p[1], bx, by, K);
      };
      // işaret noktalarının çevresi de dolu sayılır (etiket sembolün üstüne binmesin)
      for (const q of [a, b]) dolu.push([q[0] - 5, q[1] - 4, q[0] + 5, q[1] + 4]);
      const sol = a[0] < b[0];
      etiket(a, [v.kaynakAd || (v.baglanti === 'box' ? 'AG BOX' : 'AG DİREĞİ'), v.baglanti === 'box' ? 'Bağlantı noktası: AG box (GDZ)' : 'Bağlantı noktası: AG direği (GDZ)'], sol ? -1 : 1);
      etiket(b, ['SAYAÇ PANOSU', `Ada ${v.ada} / Parsel ${v.parsel}`], sol ? 1 : -1);
      const ort = yol[Math.floor(yol.length / 2) - (yol.length % 2 ? 0 : 1)], son = yol[Math.floor(yol.length / 2)];
      const mx = (ort[0] + son[0]) / 2, my = (ort[1] + son[1]) / 2;
      etiket([mx, my], [`${v.kablo.yazi}`, `L = ${sayiYaz(v.L)} m, YERALTI`], sol ? 1 : -1);
    } else {
      // işaretlenmediyse: resmin köşesine bilgi kutusu
      const h = 2.6, s = [v.baglanti === 'box' ? 'Bağlantı noktası (AG box):' : 'Bağlantı noktası (AG direği):', v.kaynakAd || '',
        `Kablo: ${v.kablo.yazi}, L = ${sayiYaz(v.L)} m yeraltı`, `Ada ${v.ada} / Parsel ${v.parsel}`];
      const w = Math.max(...s.map(t => genislik(t, h))) + 4, hh = s.length * h * 1.45 + 3;
      c.dolgu([[x0 + 2, y0 + 2], [x0 + 2 + w, y0 + 2], [x0 + 2 + w, y0 + 2 + hh], [x0 + 2, y0 + 2 + hh]], { katman: 'BHP-VAZIYET', renk: 255, beyaz: true });
      c.kutu(x0 + 2, y0 + 2, x0 + 2 + w, y0 + 2 + hh, K);
      s.forEach((t, i) => c.yazi(t, x0 + 4, y0 + 2 + hh - 1.5 - (i + 0.5) * h * 1.45, h, { katman: 'BHP-VAZIYET', stil: i % 2 ? KALIN : INCE }));
    }
  }

  // Parsel sınırı yönü (radyan, çizim koordinatında; -90°..+90°). Sınır işaretlenmediyse 0 (yatay).
  function panoAci(isaret, W, H) {
    const s = isaret && isaret.sinir;
    if (!s || s.length < 2) return 0;
    let a = Math.atan2(-(s[1][1] - s[0][1]) * H, (s[1][0] - s[0][0]) * W);
    if (a > Math.PI / 2) a -= Math.PI; else if (a <= -Math.PI / 2) a += Math.PI;
    return a;
  }

  function hepsi(v, bilgi) {
    const B = bilgi.bolgeler, c = new Cizim();
    tekHat(c, v, B.tekhat);
    c.donustur(HESAP_KAYNAK, B.hesap, 1.4); hesap(c, v);
    c.donustur(null);
    cetvel(c, v, B.cetvel);
    gucTablosu(c, v, B.guc);
    vaziyet(c, v, bilgi.resim.vaziyet);
    return c;
  }

  // ---------- DXF'e yazma ----------
  function virgul(n, b) { return n.toFixed(b).replace('.', ','); }
  function sayiYaz(n) { return (Math.round(n * 100) / 100).toString().replace('.', ','); }
  function dxfVarliklar(c, model, tohum) {
    let h = parseInt(tohum, 16);
    const out = [];
    const bas = (tip, o) => {
      out.push('  0', tip, '  5', (h++).toString(16).toUpperCase(), '330', model, '100', 'AcDbEntity', '  8', o.katman || 'BHP');
      if (o.lt) out.push('  6', o.lt);
      if (o.beyaz) out.push(' 62', '7', '420', '16777215');
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
  function bilgiOku(sablon) {
    const ilk = sablon.indexOf('\n'), ikinci = sablon.indexOf('\n', ilk + 1);
    return JSON.parse(sablon.slice(ilk + 1, ikinci).replace(/^BHP /, ''));
  }
  // Şablona ekle: varlıkları ENTITIES bölümünün sonuna koy, $HANDSEED'i güncelle, kullanılmayan detayı çıkar
  function dxfeEkle(sablon, c, baglanti, pafta2 = true) {
    const bilgi = bilgiOku(sablon);
    let s = sablon.slice(sablon.indexOf('\n', sablon.indexOf('\n') + 1) + 1);   // 999 açıklamasını çıkar
    const tm = s.match(/\$HANDSEED\r?\n\s*5\r?\n([0-9A-Fa-f]+)/);
    const { metin, sonraki } = dxfVarliklar(c, bilgi.model, tm[1]);
    s = s.replace(tm[0], tm[0].replace(tm[1], sonraki));
    const ent = s.indexOf('\nENTITIES\n'), son = s.indexOf('\n  0\nENDSEC', ent);
    s = s.slice(0, son) + '\n' + metin + s.slice(son);
    const sil = katman => {
      s = s.replace(new RegExp(`\\n  0\\nINSERT\\n  5\\n[0-9A-F]+\\n330\\n[0-9A-F]+\\n100\\nAcDbEntity\\n  8\\n${katman}\\n[\\s\\S]*?(?=\\n  0\\n)`), '');
      s = s.replace(new RegExp(`(\\n  2\\n${katman}\\n 70\\n)\\s*0\\n`), '$11\n');
    };
    sil(baglanti === 'box' ? 'BHP-DETAY-DIREK' : 'BHP-DETAY-BOX');
    return s;
  }

  // ---------- SVG önizleme ----------
  function svg(c, [x0, y0, x1, y1], gen = 900) {
    const sc = gen / (x1 - x0), H = (y1 - y0) * sc;
    const X = x => ((x - x0) * sc).toFixed(1), Y = y => ((y1 - y) * sc).toFixed(1);
    const renk = e => (e.katman === 'BHP-KABLO' || e.katman === 'BHP-VAZIYET') ? 'var(--kablo, #c0392b)' : 'currentColor';
    let o = `<svg viewBox="0 0 ${gen} ${H.toFixed(0)}" xmlns="http://www.w3.org/2000/svg" style="width:100%;height:auto">`;
    for (const e of c.l) {
      const kesik = e.lt === 'BHP-KESIK' ? ` stroke-dasharray="${(3 * sc).toFixed(1)} ${(1.5 * sc).toFixed(1)}"` : e.lt === 'BHP-GIZLI' ? ` stroke-dasharray="${sc.toFixed(1)} ${sc.toFixed(1)}"` : '';
      const sw = e.kalin ? 2 : 1;
      if (e.t === 'cizgi') o += `<line x1="${X(e.x1)}" y1="${Y(e.y1)}" x2="${X(e.x2)}" y2="${Y(e.y2)}" stroke="${renk(e)}" stroke-width="${sw}"${kesik}/>`;
      else if (e.t === 'cokgen') o += `<polyline points="${e.p.concat(e.kapali ? [e.p[0]] : []).map(([x, y]) => X(x) + ',' + Y(y)).join(' ')}" fill="none" stroke="${renk(e)}" stroke-width="${sw}"${kesik}/>`;
      else if (e.t === 'daire') o += `<circle cx="${X(e.x)}" cy="${Y(e.y)}" r="${(e.r * sc).toFixed(1)}" fill="none" stroke="${renk(e)}"/>`;
      else if (e.t === 'dolgu') o += `<polygon points="${e.p.map(([x, y]) => X(x) + ',' + Y(y)).join(' ')}" fill="${e.beyaz ? '#fff' : e.renk === 254 ? '#e4e4e4' : renk(e)}"/>`;
      else if (e.t === 'yazi') {
        const a = { sol: 'start', orta: 'middle', sag: 'end' }[e.hiza || 'sol'];
        const t = e.s.replace(/&/g, '&amp;').replace(/</g, '&lt;');
        o += `<text x="${X(e.x)}" y="${Y(e.y)}" font-size="${(e.h * sc * 1.15).toFixed(1)}" text-anchor="${a}" dominant-baseline="central" font-family="Arial, sans-serif"${e.stil === KALIN ? ' font-weight="700"' : ''} fill="${renk(e)}">${t}</text>`;
      }
    }
    return o + '</svg>';
  }

  const BHPCizim = { Cizim, hepsi, panoAci, genislik, tekHat, hesap, gucTablosu, cetvel, malzemeListesi, notlar, vaziyet, dxfeEkle, bilgiOku, svg, sayiYaz, satirlaraBol };
  if (typeof module !== 'undefined' && module.exports) module.exports = BHPCizim; else kok.BHPCizim = BHPCizim;
})(typeof window !== 'undefined' ? window : globalThis);
