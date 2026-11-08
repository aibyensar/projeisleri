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

  // ---------- Semboller (kullanıcının onaylı paftasındaki kuvvetli akım sembol tablosuyla aynı biçim) ----------
  // Her sembol yerel koordinatta çizilir; dikey: true ise saat yönünün tersine 90° döner (enerji yukarı akar).
  const S = { katman: 'BHP-SEMBOL' };
  function yerel(x, y, dikey) { return dikey ? (u, w) => [x - w, y + u] : (u, w) => [x + u, y + w]; }
  const sembol = {
    // 3 ~ W otomat sigorta: dikdörtgen + ortada daire + üç çizgi (uzunluk 16, merkez x,y)
    otomat3(c, x, y, dikey = false) {
      const T = yerel(x, y, dikey), L = (a, b, d, e) => c.cizgi(...T(a, b), ...T(d, e), S);
      L(-8, 0, -4.5, 0); L(4.5, 0, 8, 0);
      c.cokgen([T(-4.5, -1.8), T(4.5, -1.8), T(4.5, 1.8), T(-4.5, 1.8)], { ...S, kapali: true });
      c.daire(...T(0, 0), 1.35, S);
      [-0.7, 0, 0.7].forEach(d => L(d, -1.8, d, 1.8));
    },
    // 3 ~ buşonlu sigorta: dikdörtgen + üç çizgi
    buson3(c, x, y, dikey = false) {
      const T = yerel(x, y, dikey), L = (a, b, d, e) => c.cizgi(...T(a, b), ...T(d, e), S);
      L(-8, 0, -4.5, 0); L(4.5, 0, 8, 0);
      c.cokgen([T(-4.5, -1.8), T(4.5, -1.8), T(4.5, 1.8), T(-4.5, 1.8)], { ...S, kapali: true });
      [-0.7, 0, 0.7].forEach(d => L(d, -1.8, d, 1.8));
    },
    // YKŞ / kaçak akım rölesi (kullanıcının sembolü): kutu içinde iki bağlantı ucu, açık bıçak, açma işareti (dolu üçgen
    // ve ×) ve basamaklı mandal; hat soldan girer, sağdaki uçtan çıkar (genişlik 16, merkez x,y)
    ykş(c, x, y) {
      const L = (a, b, d, e) => c.cizgi(x + a, y + b, x + d, y + e, S);
      c.kutu(x - 7, y - 4, x + 7, y + 7.5, S);
      L(-8, -1.5, -7, -1.5); c.daire(x - 4.6, y - 1.5, 1.5, S); L(-7, -1.5, -6.1, -1.5);
      c.daire(x + 4.6, y - 1.5, 1.5, S); L(6.1, -1.5, 8, -1.5);
      L(-3.5, -0.4, 3.6, 4.0);                                             // bıçak
      c.dolgu([[x - 0.6, y + 1.6], [x - 3.4, y + 1.9], [x - 1.9, y + 4.3]], S);   // açma üçgeni
      L(-4.2, 2.2, -2.2, 4.6); L(-4.2, 4.0, -2.0, 2.6);                     // ×
      L(1.2, 2.6, 1.2, 4.6); L(1.2, 4.6, 2.9, 4.6); L(2.9, 4.6, 2.9, 6.3); L(2.9, 6.3, 1.4, 6.3);   // mandal
    },
    // sigorta (kullanıcının sembolü): hat üzerinde kutu, kutup sayısı kadar dikey çizgi, çapraz ok
    sigorta(c, x, y, kutup = 4) {
      const L = (a, b, d, e) => c.cizgi(x + a, y + b, x + d, y + e, S);
      L(-8, 0, -5, 0); L(5, 0, 8, 0);
      c.kutu(x - 5, y - 2.2, x + 5, y + 2.2, S);
      for (let i = 0; i < kutup; i++) { const u = (i - (kutup - 1) / 2) * 1.7; L(u, -3.2, u, 3.2); }
      L(-5.8, -3.8, 5.4, 3.6);
      c.dolgu([[x + 6.4, y + 4.2], [x + 4.2, y + 3.9], [x + 5.3, y + 2.3]], S);
    },
    // TMŞ (IEC 60617 devre kesici): açık kontak, sabit kontakta ×
    salter(c, x, y, tur, dikey = false) {
      const T = yerel(x, y, dikey), L = (a, b, d, e, o = S) => c.cizgi(...T(a, b), ...T(d, e), o);
      L(-8, 0, -4, 0); L(-4, 0, 3.8, 3.4); L(4.5, 0, 8, 0);
      L(3.4, -1.1, 5.6, 1.1); L(3.4, 1.1, 5.6, -1.1);
    },
    // iletken sayısı: hat üzerinde eğik kısa çizgiler (kullanıcının "kuvvetli akım besleme iletkeni" sembolü)
    iletken(c, x, y, n) { for (let i = 0; i < n; i++) { const u = x + (i - (n - 1) / 2) * 1.6; c.cizgi(u - 1, y - 1.8, u + 1, y + 1.8, S); } },
    // 3 ~ sayaç: dikdörtgen, üstte üç çizgi, altta kWh (merkez x,y; 9 x 11)
    sayac3(c, x, y, tur = 'Aktif') {
      c.kutu(x - 4.5, y - 5.5, x + 4.5, y + 5.5, S);
      [4.4, 3.6, 2.8].forEach(d => c.cizgi(x - 4.5, y + d, x + 4.5, y + d, S));
      c.yazi('kWh', x, y - 0.6, 2.2, { hiza: 'orta', katman: 'BHP-SEMBOL' });
      c.yazi(tur === 'Aktif' ? '' : 'kVArh', x, y - 3.6, 1.5, { hiza: 'orta', katman: 'BHP-SEMBOL' });
    },
    toprak(c, x, y) { c.cizgi(x, y, x, y - 3, S); [3.6, 2.4, 1.2].forEach((w, i) => c.cizgi(x - w, y - 3 - i * 1.2, x + w, y - 3 - i * 1.2, S)); },
    okYukari(c, x, y) { c.dolgu([[x, y], [x - 1.6, y - 4], [x + 1.6, y - 4]], S); },
  };
  // Standart bölüm: kalın çerçeve + üstte 7 birim başlık şeridi (şablondaki bütün bölümlerle aynı biçim); iç kutuyu döndürür
  function blok(c, [x0, y0, x1, y1], baslik) {
    const T = { katman: 'BHP-TABLO' };
    c.kutu(x0, y0, x1, y1, { ...T, kalin: true });
    c.cizgi(x0, y1 - 7, x1, y1 - 7, T);
    c.yazi(baslik, (x0 + x1) / 2, y1 - 3.5, 3.0, { stil: KALIN, hiza: 'orta' });
    return [x0 + 3, y0 + 3, x1 - 3, y1 - 10];
  }
  const CIHAZ_AD = { sigorta: '', kar: 'K.A.R', tms: 'TMŞ', tmsyks: 'YKŞ', diger: '' };
  // Kesici etiketi (kullanıcının kuralı): akım "4x63A" biçiminde (x her zaman küçük); YKŞ ve K.A.R altında her zaman 300 mA, kesicilerde her zaman 10kA
  // kurumun kuralı: trifazede her zaman 4 kutuplu, monofazede 2 kutuplu kesici (iç tesisatta 3x25A yazsa bile 4x25A)
  function kesiciEtiket(k, faz = 3) {
    const d = String(k.deger || ''), a = d.match(/(\d+(?:[.,]\d+)?)\s*A(?![a-zA-Z])/);
    const kutup = +faz === 1 ? 2 : 4, akim = a ? `${kutup}x${a[1].replace('.', ',')}A` : d.trim();
    const kacak = k.tur === 'kar' || k.tur === 'tmsyks';
    return { akim, ek: kacak ? '300 mA' : '10kA', kutup, kacak };
  }
  // Pano topraklama iletkeni: faz kesiti 35 mm²'ye kadar 16 mm²; üstünde faz kesitinin en az yarısı (standart kesit)
  const STD = [16, 25, 35, 50, 70, 95, 120, 150, 185, 240];
  function topraklamaKesit(S_) { return S_ <= 35 ? 16 : STD.find(s => s >= S_ / 2) || 240; }

  // ---------- Tek hat şeması ----------
  // Solda enerji noktası, kesikli yeraltı kablosu ve enerji oku; sağda kesikli "mühürlenebilir alan":
  // ana koruma(lar) → bara → her sayaç grubu YUKARI: sayaç önü otomat sigorta → 3~ sayaç → iç tesisat.
  // Bölge: standart çerçeve içinde; çizim 300 x 118 birimlik sanal kutuda yapılıp kutuyu dolduracak kadar büyütülür.
  // Yeraltı kablosu kesik çizgi; ana kesiciler kullanıcının sembolleriyle (YKŞ / K.A.R kutulu, sigorta kutup çizgili).
  function tekHat(c, v, B) {
    const ic = blok(c, B, 'TEK HAT ŞEMASI');
    const X0 = 0, Y0 = 0, X1 = 300, Y1 = 118;
    c.donustur([X0, Y0, X1, Y1], ic, 1.6);
    const K = { katman: 'BHP-KABLO', lt: 'BHP-KESIK' }, TP = S;            // kullanıcının kuralı: yeraltı kablosu kesik çizgi
    const yh = Y0 + 50, kx = X0 + 18, r = 8;
    if (v.baglanti === 'box') c.kutu(kx - r, yh - r, kx + r, yh + r, S); else c.daire(kx, yh, r, S);   // box kare, direk çember
    c.yazi(v.baglanti === 'box' ? 'AG BOX' : 'AG DİREK', kx, yh, 2.1, { stil: KALIN, hiza: 'orta' });
    const ad = v.kaynakAd || (v.baglanti === 'box' ? 'AG SAHA DAĞITIM KUTUSU' : 'AG DİREĞİ');
    const ah = Math.min(2.8, 95 / Math.max(1, genislik(ad, 1)));
    c.yazi(ad, kx - r, yh - r - 5, ah, { stil: KALIN });
    c.yazi(v.baglanti === 'box' ? 'GDZ AG saha dağıtım kutusu' : 'GDZ mevcut AG direği', kx - r, yh - r - 9.5, 2.2);
    const nGrup = Math.min(((v.gruplar && v.gruplar.length) || 1), 5), nKor = v.korumalar.length;
    const pw = 8 + nKor * 24 + 8 + nGrup * 34 + 12, px2 = X1 - 2, px1 = Math.max(X0 + 120, px2 - pw), py1 = Y0 + 16, py2 = Y1 - 6;
    // bağlantı kablosu
    c.cizgi(kx + r, yh, px1, yh, { ...K, kalin: true });
    const ox = (kx + r + px1) / 2;
    c.yazi(v.kablo.yazi, ox, yh + 9, 3.2, { stil: KALIN, hiza: 'orta' });
    c.yazi(`L = ${sayiYaz(v.L)} m  ·  YERALTI`, ox, yh + 4.6, 2.5, { hiza: 'orta' });
    c.yazi(`N = ${v.N} W`, ox, yh - 5.5, 2.5, { hiza: 'orta' });
    // sayaç panosu (mühürlenebilir)
    c.kutu(px1, py1, px2, py2, { katman: 'BHP', kalin: true });
    c.yazi('SAYAÇ PANOSU', px1 + 2.5, py2 - 4, 2.6, { stil: KALIN });
    c.yazi('(mühürlenebilir)', px1 + 2.5, py2 - 8, 2.1);
    let x = px1;
    c.cizgi(x, yh, x + 4, yh, S); x += 4;
    for (const k of v.korumalar) {
      const cx = x + 8;
      const et = kesiciEtiket(k, v.faz);
      if (et.kacak) sembol.ykş(c, cx, yh); else if (k.tur === 'sigorta') sembol.sigorta(c, cx, yh, et.kutup); else sembol.salter(c, cx, yh, k.tur);   // diğer: devre kesici
      // etiket: YKŞ / K.A.R → ad, akım, 300 mA; kesici → (ad), 10kA, akım (kullanıcının örnekleri)
      // elle yazı varsa aynen (satırlar / ile), yoksa kural: YKŞ / K.A.R → ad, akım, 300 mA; kesici → (ad), 10kA, akım
      const elle = String(k.yazi || '').split('/').map(t => t.trim()).filter(Boolean);
      const sat = elle.length ? elle : k.tur === 'diger' ? [String(k.deger || '').trim()] : et.kacak ? [CIHAZ_AD[k.tur], et.akim, et.ek] : [CIHAZ_AD[k.tur], et.ek, et.akim].filter(Boolean);
      const y0 = yh + (et.kacak ? 9.5 : 6.8);
      sat.slice().reverse().forEach((t, i) => c.yazi(t, cx, y0 + i * 4, 2.5, { stil: !elle.length && i === sat.length - 1 && CIHAZ_AD[k.tur] ? INCE : KALIN, hiza: 'orta' }));
      x += 16; c.cizgi(x, yh, x + 8, yh, S); x += 8;
    }
    const gruplar = v.gruplar && v.gruplar.length ? v.gruplar : [{ onu: '', adet: v.sayacAdet || 1, ad: '', tip: v.sayacTip }];
    const adim = 34, xg0 = x + 8, goster = gruplar.slice(0, 5), artan = gruplar.length - goster.length;
    const xgSon = xg0 + (goster.length - 1) * adim;
    c.cizgi(x, yh, xgSon + 6, yh, { ...S, kalin: true });                 // bara
    c.yazi('BARA', xgSon + 6, yh - 3.6, 2.0, { hiza: 'sag' });
    goster.forEach((g, i) => {
      const gx = xg0 + i * adim;
      c.daire(gx, yh, 0.8, S);
      let y = yh;
      if (g.onu) {
        sembol.otomat3(c, gx, yh + 14, true);
        c.cizgi(gx, yh, gx, yh + 6, S);
        const et = kesiciEtiket({ tur: 'sigorta', deger: g.onu }, v.faz);    // sigortalarda her zaman 10kA, kutup faza göre
        c.yazi(et.ek, gx + 4, yh + 15, 2.3, { stil: KALIN }); c.yazi(et.akim, gx + 4, yh + 11.3, 2.3, { stil: KALIN });
        y = yh + 22;
      }
      const sy = yh + 35;
      c.cizgi(gx, y, gx, sy - 5.5, S);
      sembol.sayac3(c, gx, sy, v.sayacTur);
      c.yazi(`${g.tip}A`, gx + 6, sy + 1.5, 2.3, { stil: KALIN });
      c.yazi(`${g.adet} adet`, gx + 6, sy - 2.5, 2.2);
      c.cizgi(gx, sy + 5.5, gx, py2 - 13, S); sembol.okYukari(c, gx, py2 - 9);
      c.yazi('İÇ TESİSAT', gx + 2.5, py2 - 11.5, 2.0);
      if (g.ad) c.yazi(g.ad, gx + 2.5, py2 - 14.8, 2.0);
    });
    if (artan > 0) c.yazi(`+ ${artan} grup (güç dağıtım tablosuna bakınız)`, px2 - 2, yh - 8, 2.0, { hiza: 'sag' });
    c.yazi(`Toplam ${v.sayacAdet} adet elektronik sayaç`, px2 - 2, py1 + 3, 2.2, { hiza: 'sag' });
    // pano topraklaması: pano gövdesinin sağ alt köşesinden topraklama kazığına
    const tk = topraklamaKesit(v.kablo.kesit), gxT = px2 - 10;
    c.cizgi(gxT, py1, gxT, Y0 + 6, TP); c.daire(gxT, py1, 0.8, S); sembol.toprak(c, gxT, Y0 + 6);
    c.yazi(`1x${tk} mm² NYY`, gxT - 6, Y0 + 6.5, 2.2, { stil: KALIN, hiza: 'sag' }); c.yazi('pano topraklaması', gxT - 6, Y0 + 3, 2.1, { hiza: 'sag' });
    // açıklama
    c.donustur(null);
  }

  // ---------- Bağlantı hattı tesis / montaj detayı (ölçeksiz; box ve direk için ayrı) ----------
  function tarama(c, x0, y0, x1, y1, ad = 2.2) {             // dikdörtgen içine 45° tarama
    for (let t = x0 - (y1 - y0); t < x1; t += ad) {
      let ax = t, ay = y0, bx = t + (y1 - y0), by = y1;
      if (ax < x0) { ay += x0 - ax; ax = x0; }
      if (bx > x1) { by -= bx - x1; bx = x1; }
      if (ay < by) c.cizgi(ax, ay, bx, by, { katman: 'BHP-TABLO' });
    }
  }
  function etiket(c, px, py, tx, ty, satirlar, sag = true, h = 2.3) {   // önder çizgili açıklama
    const w = Math.max(...satirlar.map(s => genislik(s, h))) + 1;
    const T = { katman: 'BHP-TABLO' };
    c.cizgi(px, py, tx, ty, T); c.daire(px, py, 0.5, T);
    const x0 = sag ? tx : tx - w;
    c.cizgi(x0, ty, x0 + w, ty, T);
    satirlar.forEach((s, i) => c.yazi(s, x0 + 0.5, ty + 1.6 + (satirlar.length - 1 - i) * h * 1.5, h, { stil: i === 0 ? KALIN : INCE }));
  }
  // galvaniz topraklama kazığı (kullanıcının onaylı detayındaki yazıyla)
  function kazik(c, x, yg, sag) {
    c.dolgu([[x - 1.2, yg - 4], [x + 1.2, yg - 4], [x + 1.2, yg - 40], [x - 1.2, yg - 40]], S);
    const tx = sag ? x + 3 : x - 3, h = sag ? 'sol' : 'sag';
    c.yazi('DAL.GAL.TOP.KAZ.', tx, yg - 30, 2.0, { stil: KALIN, hiza: h }); c.yazi('L=2m 65x65x7 mm', tx, yg - 33.5, 2.0, { hiza: h });
  }
  function detay(c, v, [x0, y0, x1, y1], cerceveYok) {
    const T = { katman: 'BHP-TABLO' }, K = { katman: 'BHP-KABLO', lt: 'BHP-KESIK', kalin: true };
    if (!cerceveYok) {
      c.kutu(x0, y0, x1, y1, T);
      c.cizgi(x0, y0 + 9, x1, y0 + 9, T);
      c.yazi('BAĞLANTI HATTI TESİS / MONTAJ DETAYI (ÖLÇEKSİZ)', (x0 + x1) / 2, y0 + 4.5, 3.0, { stil: KALIN, hiza: 'orta' });
    }
    const yg = y0 + 58, yc = yg - 30, M = 30;           // zemin, kablo kotu (1 m ≈ 30 birim)
    // zemin çizgisi ve toprak işareti
    c.cizgi(x0 + 2, yg, x1 - 2, yg, { katman: 'BHP-TABLO', kalin: true });
    for (let x = x0 + 4; x < x1 - 4; x += 6) c.cizgi(x, yg, x - 2.5, yg - 2.5, T);
    c.dolgu([[x0 + 112, yg], [x0 + 109.5, yg + 3], [x0 + 114.5, yg + 3]], S);
    c.yazi('BİTMİŞ ZEMİN KOTU ±0,00', x0 + 117, yg + 1.6, 2.2);
    // kablo kanalı: kum yatağı ve ikaz şeridi
    const xa = x0 + 48, xb = x1 - 78;                       // kablonun yatay kısmı
    c.kutu(xa - 6, yc - 5, xb + 6, yc + 7, { katman: 'BHP-TABLO', lt: 'BHP-GIZLI' });
    c.cizgi(xa, yc + 13, xb, yc + 13, { katman: 'BHP-TABLO', lt: 'BHP-KESIK' });
    etiket(c, xa + 30, yc + 13, xa + 40, yc + 21, ['İKAZ ŞERİDİ (kablonun 30-40 cm üstünde)'], true, 2.1);
    // kablo derinliği
    const xd = (xa + xb) / 2 + 20;
    c.cizgi(xd, yg, xd, yc, T); c.dolgu([[xd, yg], [xd - 1, yg - 3], [xd + 1, yg - 3]], T); c.dolgu([[xd, yc], [xd - 1, yc + 3], [xd + 1, yc + 3]], T);
    c.yazi('100 cm', xd + 1.5, (yg + yc) / 2, 2.3, { stil: KALIN });
    // sol: enerji noktası
    let xk;                                                 // kablonun yere girdiği x
    if (v.baglanti === 'box') {
      const bx = x0 + 32;
      // box kendi alt çerçevesi üstünde (kullanıcının detayı; beton kaide yok)
      c.cizgi(bx - 17, yg + 5, bx + 17, yg + 5, { ...T, kalin: true }); c.cizgi(bx - 17, yg + 5, bx - 17, yg, T); c.cizgi(bx + 17, yg + 5, bx + 17, yg, T);
      c.kutu(bx - 14, yg + 5, bx + 14, yg + 52, { katman: 'BHP-TABLO', kalin: true });
      c.dolgu([[bx - 16, yg + 52], [bx + 16, yg + 52], [bx + 16, yg + 55], [bx - 16, yg + 55]], S);
      c.cizgi(bx, yg + 10, bx, yg + 50, T);
      c.dolgu([[bx - 7, yg + 40], [bx - 10, yg + 34.5], [bx - 4, yg + 34.5]], S);
      c.yazi('AG', bx + 7, yg + 32, 2.6, { stil: KALIN, hiza: 'orta' }); c.yazi('BOX', bx + 7, yg + 27.5, 2.6, { stil: KALIN, hiza: 'orta' });
      etiket(c, bx + 10, yg + 50, x0 + 52, y1 - 16, ['AG SAHA DAĞITIM KUTUSU (BOX) - GDZ ŞEBEKESİ', v.kaynakAd || ''].filter(Boolean));
      xk = bx + 4;
      c.cokgen([[xk, yg + 5], [xk, yc + 6], [xk + 6, yc], [xa, yc]], K);
      const xkz = x0 + 8;                                    // box topraklama kazığı
      c.cokgen([[bx - 12, yg + 5], [bx - 12, yg - 2], [xkz, yg - 4]], T); kazik(c, xkz, yg, true);
    } else {
      const dx = x0 + 30;
      c.cokgen([[dx - 3, yg], [dx - 1.6, y1 - 6], [dx + 1.6, y1 - 6], [dx + 3, yg]], { katman: 'BHP-TABLO', kapali: false });
      const ty = y1 - 12;
      c.cizgi(dx - 14, ty, dx + 14, ty, { katman: 'BHP-TABLO', kalin: true });
      [-11, -5, 5, 11].forEach(d => { c.daire(dx + d, ty + 2, 1.1, T); c.cizgi(dx + d, ty + 3.1, x0 + 2, ty + 3.1 + (d + 11) * 0.15, T); });
      // kablo başlığı ve galvaniz boru
      const kx = dx + 4.5;
      c.dolgu([[kx, ty - 4], [kx - 1.8, ty - 9], [kx + 1.8, ty - 9]], S);
      c.cizgi(kx, ty - 4, dx + 5, ty + 1, T);
      c.kutu(kx - 1.4, yg, kx + 1.4, yg + 2 * M, T);
      c.cizgi(kx, ty - 9, kx, yg, K);
      etiket(c, kx + 1, ty - 7, x0 + 50, ty - 4, ['KABLO BAŞLIĞI']);
      etiket(c, kx + 1.4, yg + 40, x0 + 50, yg + 46, ['GALVANİZ KORUMA BORUSU', '(zeminden 2 m)']);
      etiket(c, dx, y1 - 42, x0 + 50, y1 - 34, ['AG DİREĞİ - GDZ ŞEBEKESİ', v.kaynakAd || ''].filter(Boolean));
      xk = kx;
      c.cokgen([[xk, yg], [xk, yc + 6], [xk + 6, yc], [xa, yc]], K);
    }
    // kablo (yatay)
    c.cizgi(xa, yc, xb, yc, K);
    c.yazi(`${v.kablo.yazi} YERALTI KABLOSU`, xa + 2, yc - 3.2, 2.4, { stil: KALIN });
    // parsel sınırı ve uzunluklar
    const xp = xk + (xb + 30 - xk) * (v.L > 0 ? Math.min(0.85, Math.max(0.15, v.Ldis / v.L)) : 0.5);
    c.cizgi(xp, yc - 10, xp, yg + 34, { katman: 'BHP-TABLO', lt: 'BHP-KESIK' });
    c.yazi('PARSEL SINIRI', xp - 2.2, yg + 20, 2.2, { stil: KALIN, aci: 90, hiza: 'orta' });
    const yo = yc - 8, xr = x1 - 48;
    const olcu = (a, b, t) => { c.cizgi(a, yo, b, yo, T); [a, b].forEach(q => c.cizgi(q - 1, yo - 1, q + 1, yo + 1, T)); c.yazi(t, (a + b) / 2, yo + 1.8, 2.2, { hiza: 'orta' }); };
    olcu(xk, xp, `parsel dışı ${sayiYaz(v.Ldis)} m`); olcu(xp, xr, `parsel içi ${sayiYaz(v.Lic)} m`);
    c.yazi(`L = ${sayiYaz(v.L)} m`, (xk + xr) / 2, yo - 3.4, 2.4, { stil: KALIN, hiza: 'orta' });
    // sağ: sayaç panosu pano ayağı üstünde (kullanıcının detayı; beton kaide yok), koruma borusu
    const pb = yg + M;
    c.dolgu([[xr - 3.5, yg], [xr + 3.5, yg], [xr + 3.5, pb], [xr - 3.5, pb]], S);
    c.dolgu([[xr - 7, yg], [xr + 7, yg], [xr + 3.5, yg + 2.5], [xr - 3.5, yg + 2.5]], S);
    c.kutu(xr - 15, pb, xr + 15, pb + 34, { katman: 'BHP-TABLO', kalin: true });
    c.cizgi(xr - 17, pb + 34, xr + 17, pb + 34, { katman: 'BHP-TABLO', kalin: true });
    c.kutu(xr - 11, pb + 18, xr - 1, pb + 29, T); c.yazi('kWh', xr - 6, pb + 23.5, 2.0, { hiza: 'orta' });
    c.dolgu([[xr + 7, pb + 29], [xr + 3.5, pb + 22.5], [xr + 10.5, pb + 22.5]], S);
    c.cizgi(xr - 15, pb + 14, xr + 15, pb + 14, T);
    c.daire(xr + 11, pb + 8, 0.9, T);
    // koruma borusu (zeminden pano ayağına)
    c.cizgi(xr - 3, yc + 3, xr - 3, yg, { katman: 'BHP-TABLO', lt: 'BHP-GIZLI' }); c.cizgi(xr + 3, yc - 3, xr + 3, yg, { katman: 'BHP-TABLO', lt: 'BHP-GIZLI' });
    c.cokgen([[xb, yc], [xr - 6, yc], [xr, yc + 6], [xr, yg]], K);
    // topraklama
    const tk = topraklamaKesit(v.kablo.kesit), xt = x1 - 8;
    kazik(c, xt, yg, false);
    c.cokgen([[xr + 15, pb + 4], [xr + 19, pb + 4], [xr + 19, yg - 2], [xt, yg - 4]], { katman: 'BHP-TABLO' });
    // açıklamalar
    etiket(c, xr - 15, pb + 30, xr - 24, pb + 40, ['SAYAÇ PANOSU', '(mühürlenebilir bölümlü, kilitli)'], false);
    etiket(c, xr - 3, yg - 10, xr - 30, yg - 6, ['Ø100 PVC KORUMA BORUSU'], false);
    etiket(c, xr + 19, yg + 10, x1 - 3, pb + 46, [`1x${tk} mm² NYY`, 'TOPRAKLAMA İLETKENİ'], false, 2.1);
  }

  // ---------- Gerilim düşümü ve akım hesabı: solda hesapta kullanılan değerler, sağda hesap adımları ----------
  function hesap(c, v, [x0, ya, x1, yu]) {
    const T = { katman: 'BHP-TABLO' }, h = v.h, vg = virgul, mono = v.faz === 1;
    const U = mono ? 220 : 380, k = v.kablo.iletken === 'al' ? 35 : 56, sabit = mono ? 200 : 100;
    const bas = 7;
    c.kutu(x0, ya, x1, yu, T);
    c.cizgi(x0, yu - bas, x1, yu - bas, T);
    c.yazi('GERİLİM DÜŞÜMÜ VE AKIM HESABI', (x0 + x1) / 2, yu - bas / 2, 3.0, { stil: KALIN, hiza: 'orta' });
    // sol: değerler tablosu
    const xa = x0, xb = x0 + 80, xc = x0 + 152, ust = yu - bas;
    const satir = [
      ['Bağlantı gücü (eş zamanlı)', 'N', `${v.N} W`],
      ['Hat uzunluğu', 'L', `${sayiYaz(v.L)} m (${sayiYaz(v.Ldis)} + ${sayiYaz(v.Lic)})`],
      ['Kablo', '', v.kablo.yazi],
      ['Faz iletkeni kesiti', 'S', `${sayiYaz(v.kablo.kesit)} mm²`],
      ['İletkenlik', 'κ', `${k} m/Ω·mm² (${v.kablo.iletken === 'al' ? 'alüminyum' : 'bakır'})`],
      ['İşletme gerilimi', 'U', `${U} V`],
      ['Güç katsayısı', 'cos φ', '0,8'],
      ['Gerilim düşümü katsayısı', 'c', vg(h.c, 7)],
      ['Akım taşıma kapasitesi (toprak)', 'Iz', `${v.kablo.iz} A`],
    ].concat(h.In ? [['Ana kesici anma akımı', 'In', `${sayiYaz(h.In)} A`]] : []);
    const sh = Math.min(9, (ust - ya - 16) / (satir.length + 1));
    c.cizgi(xc, ya, xc, ust, T);
    c.yazi('HESAPTA KULLANILAN DEĞERLER', (xa + xc) / 2, ust - sh / 2, 2.4, { stil: KALIN, hiza: 'orta' });
    c.cizgi(xa, ust - sh, xc, ust - sh, T);
    satir.forEach(([ad, sm, d], i) => {
      const yy = ust - sh * (i + 1.5);
      c.cizgi(xa, ust - sh * (i + 2), xc, ust - sh * (i + 2), T);
      c.yazi(ad, xa + 2, yy, 2.2);
      if (sm) c.yazi(sm, xb - 7, yy, 2.4, { stil: KALIN, hiza: 'orta' });
      c.yazi(d, xb, yy, 2.3, { stil: KALIN });
    });
    c.cizgi(xb - 14, ust - sh, xb - 14, ust - sh * (satir.length + 1), T);
    const yn = ust - sh * (satir.length + 1);
    c.yazi('Iz: Öznur Kablo kataloğu, toprakta döşeme.', xa + 2, yn - 4.5, 2.0);
    c.yazi('Bağlantı hattında izin verilen gerilim düşümü: %1,5.', xa + 2, yn - 9, 2.0);
    // sağ üst: hat şeması (kullanıcının hesap çizelgesindeki gibi)
    const X = xc + 6;
    const ys = ust - 13, sx0 = X + 32, sx1 = x1 - 66;
    c.yazi(v.baglanti === 'box' ? 'AG BOX (GDZ)' : 'AG DİREĞİ (GDZ)', sx0 - 3, ys, 2.4, { stil: KALIN, hiza: 'sag' });
    if (v.baglanti === 'box') c.kutu(sx0, ys - 2.5, sx0 + 5, ys + 2.5, S); else c.daire(sx0 + 2.5, ys, 2.5, S);
    c.cizgi(sx0 + 5, ys, sx1, ys, S);
    c.yazi(v.kablo.yazi, (sx0 + sx1) / 2, ys + 3.5, 2.5, { stil: KALIN, hiza: 'orta' });
    c.yazi(`L = ${sayiYaz(v.L)} m`, (sx0 + sx1) / 2, ys - 3.5, 2.5, { hiza: 'orta' });
    c.kutu(sx1, ys - 6, sx1 + 5, ys + 6, S); c.cizgi(sx1, ys + 6, sx1 + 5, ys - 6, S);
    c.yazi('SAYAÇ PANOSU', sx1 + 8, ys + 3, 2.4, { stil: KALIN });
    c.yazi(`N = ${v.N} W`, sx1 + 8, ys - 2, 2.3);
    c.cizgi(xc, ys - 10, x1, ys - 10, T);
    // sağ: hesap adımları
    let y = ys - 17;
    const baslik = t => { c.yazi(t, X, y, 2.7, { stil: KALIN }); c.cizgi(X, y - 2.2, X + genislik(t, 2.7), y - 2.2, T); y -= 7; };
    const satirY = (t, hh = 2.6, o = {}) => { c.yazi(t, X + 4, y, hh, o); y -= hh * 2.2; };
    const sonuc = (iyi, t, yy) => {
      const bx = x1 - 4 - 62;
      c.kutu(bx, yy - 3.5, x1 - 4, yy + 3.5, T);
      c.yazi(iyi ? t + ' UYGUNDUR' : t + ' UYGUN DEĞİL', (bx + x1 - 4) / 2, yy, 2.4, { stil: KALIN, hiza: 'orta' });
    };
    baslik('1. GERİLİM DÜŞÜMÜ');
    satirY(`c = ${sabit} / (κ · U²) = ${sabit} / (${k} · ${U}²) = ${vg(h.c, 7)}`);
    satirY(`%e = c · N · L / S = ${vg(h.c, 7)} · ${v.N} · ${sayiYaz(v.L)} / ${sayiYaz(v.kablo.kesit)} = ${vg(h.e, 4)}`);
    sonuc(h.eUygun, 'GERİLİM DÜŞÜMÜ', y);
    satirY(`%e = ${vg(h.e, 2)}  ${h.eUygun ? '<' : '>'}  %1,5`, 2.9, { stil: KALIN });
    y -= 4;
    baslik('2. AKIM KONTROLÜ');
    satirY(mono ? `I = N / (U · cos φ) = ${v.N} / (220 · 0,8) = ${v.N} / ${v.bolen}` : `I = N / (√3 · U · cos φ) = ${v.N} / (√3 · 380 · 0,8) = ${v.N} / ${v.bolen}`);
    sonuc(h.iUygun, 'AKIM YÖNÜNDEN', y);
    satirY(`I = ${vg(h.I, 2)} A  ${h.iUygun ? '<' : '>'}  Iz = ${v.kablo.iz} A`, 2.9, { stil: KALIN });
    if (h.In) {
      y -= 4;
      baslik('3. KORUMA UYUMU (ANA KESİCİ)');
      sonuc(h.kUygun && h.ibUygun, 'KORUMA YÖNÜNDEN', y);
      satirY(`I = ${vg(h.I, 2)} A  ${h.ibUygun ? '≤' : '>'}  In = ${sayiYaz(h.In)} A  ${h.kUygun ? '≤' : '>'}  Iz = ${v.kablo.iz} A`, 2.9, { stil: KALIN });
    }
    // sonuç satırı (alt kenarda)
    c.cizgi(xc, ya + 11, x1, ya + 11, T);
    c.yazi(`SONUÇ: ${v.kablo.yazi} kablo ${h.uygun ? (h.In ? 'gerilim düşümü, akım taşıma ve koruma uyumu yönünden uygundur.' : 'gerilim düşümü ve akım taşıma yönünden uygundur.') : 'UYGUN DEĞİLDİR, kesit büyütülmelidir.'}`, X, ya + 5.5, 2.8, { stil: KALIN });
  }

  // ---------- Güç dağıtım tablosu (kullanıcının onaylı projelerindeki sütunlar) ----------
  function gucTablosu(c, v, [x0, ya, x1, yu]) {
    const T = { katman: 'BHP-TABLO' }, W = x1 - x0;
    const K = [0, 0.12, 0.25, 0.38, 0.505, 0.63, 0.72, 0.84, 1].map(o => x0 + o * W);
    const n = v.satirlar.length, basY = 6.5, sutunY = 11, alt = 2 * 6;
    const sh = Math.min(6.5, Math.max(3.4, (yu - ya - basY - sutunY - alt) / Math.max(1, n)));
    const yH = yu, yS = yH - basY, yV = yS - sutunY, yT = yV - n * sh, yA = yT - alt;
    const yz = Math.min(2.6, sh * 0.48);
    c.kutu(x0, yA, x1, yH, T);
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
      [s.bb, s.tablo, s.kurulu, s.baglanti, /^3\s*FAZ$/i.test(s.sayac || '') || !s.sayac ? `${v.sayacTip} A` : s.sayac, s.kullanim, s.tesis || ''].forEach((t, i) =>
        c.yazi(t == null ? '' : t, (K[i + 1] + K[i + 2]) / 2, yy, yz, { hiza: 'orta' }));
    });
    if (yV - yT >= 8) {
      c.yazi('BAĞLANTI', (K[0] + K[1]) / 2, (yV + yT) / 2 + 1.8, 2.3, { stil: KALIN, hiza: 'orta' });
      c.yazi('HATTI', (K[0] + K[1]) / 2, (yV + yT) / 2 - 1.8, 2.3, { stil: KALIN, hiza: 'orta' });
    } else c.yazi('B. HATTI', (K[0] + K[1]) / 2, (yV + yT) / 2, 2.0, { stil: KALIN, hiza: 'orta' });
    const alts = [['TOPLAM KURULU GÜÇ (W)', v.kuruluToplam], ['BAĞLANTI GÜCÜ (EŞ ZAMANLI, W)', v.N]];
    alts.forEach(([t, d], i) => {
      const y = yT - 6 * (i + 0.5);
      if (i) c.cizgi(x0, yT - 6 * i, x1, yT - 6 * i, T);
      c.yazi(t, K[4] - 2, y, 2.3, { stil: i === 1 ? KALIN : INCE, hiza: 'sag' });
      c.yazi(String(d), (K[4] + K[5]) / 2, y, 2.5, { stil: KALIN, hiza: 'orta' });
    });
    c.cizgi(K[4], yT, K[4], yA, T); c.cizgi(K[5], yT, K[5], yA, T);
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
      // kullanıcının kuralı: box küçük kare, direk çember
      if (v.baglanti === 'box') c.kutu(a[0] - 2.6, a[1] - 2.6, a[0] + 2.6, a[1] + 2.6, K);
      else c.daire(a[0], a[1], 2.8, K);
      // sayaç panosu: uzun kenarı parsel sınırına paralel (kullanıcı sınır üzerinde 2 nokta tıklar)
      const aci = panoAci(isaret, W, H), ca = Math.cos(aci), sa = Math.sin(aci);
      const R = (dx, dy) => [b[0] + dx * ca - dy * sa, b[1] + dx * sa + dy * ca];
      // kullanıcının sembol tablosundaki işaret: dikdörtgen içinde ortada birleşen iki dolu üçgen
      c.cokgen([R(-3.5, -2), R(3.5, -2), R(3.5, 2), R(-3.5, 2)], { ...K, kapali: true });
      c.dolgu([R(-3.5, -2), R(-3.5, 2), R(0, 0)], { ...K, renk: 1 }); c.dolgu([R(3.5, -2), R(3.5, 2), R(0, 0)], { ...K, renk: 1 });
      // etiketler: altı çizili yazı; birbirine ve çerçeve kenarına çarpmayan ilk yere konur
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
        // altı çizili açıklama: çizgi yazının altında, önder çizgi işaretten çizginin yakın ucuna
        c.cizgi(ex, ey, ex + w, ey, K);
        satirlar.forEach((s, i) => c.yazi(s, ex + 1, ey + 1.6 + (satirlar.length - 1 - i) * h * 1.45 + h * 0.5, h, { katman: 'BHP-VAZIYET', stil: i === 0 ? KALIN : INCE }));
        const bx = Math.abs(p[0] - ex) < Math.abs(p[0] - ex - w) ? ex : ex + w;
        c.cizgi(p[0], p[1], bx, ey, K);
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
    hesap(c, v, B.hesap);
    if (B.detay) {
      if (bilgi.duzen) {                                       // düzenlenmiş pafta: ortak çerçeve, eski çizim kutuya büyütülür
        const ic = blok(c, B.detay, 'BAĞLANTI HATTI TESİS / MONTAJ DETAYI (ÖLÇEKSİZ)');
        c.donustur([0, 9, 318, 149], ic, 1.3); detay(c, v, [0, 0, 318, 149], true); c.donustur(null);
      } else detay(c, v, B.detay);
    }
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
        out.push('100', 'AcDbText', ' 10', f(e.x), ' 20', f(e.y), ' 30', '0', ' 40', f(e.h), '  1', e.s.replace(/\r?\n/g, ' '), ' 50', f(e.aci || 0),
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
        o += `<text x="${X(e.x)}" y="${Y(e.y)}" font-size="${(e.h * sc * 1.15).toFixed(1)}" text-anchor="${a}" dominant-baseline="central"${e.aci ? ` transform="rotate(${-e.aci} ${X(e.x)} ${Y(e.y)})"` : ''} font-family="Arial, sans-serif"${e.stil === KALIN ? ' font-weight="700"' : ''} fill="${renk(e)}">${t}</text>`;
      }
    }
    return o + '</svg>';
  }

  const BHPCizim = { Cizim, hepsi, panoAci, genislik, tekHat, detay, topraklamaKesit, hesap, gucTablosu, malzemeListesi, notlar, vaziyet, dxfeEkle, bilgiOku, svg, sayiYaz, satirlaraBol };
  if (typeof module !== 'undefined' && module.exports) module.exports = BHPCizim; else kok.BHPCizim = BHPCizim;
})(typeof window !== 'undefined' ? window : globalThis);
