// Bağlantı hattı projesi — HAVAİ hat eki.
// Kullanıcının "AG Cer Hesabı ve Direk Seçimi" aracı (havai/src, araclar/havai-cer.html) krokiyi ve cer raporunu çizim
// parçası (prim) listesi olarak verir; bu dosya onları bağlantı hattı paftasının çizim listesine (BHPCizim.Cizim) çevirir:
//   - ana paftada detay yerine "havai hat direk listesi ve cer özeti" tablosu,
//   - paftanın sağına ikinci sayfa: proje krokisi + cer hesabı raporu,
//   - havai malzeme listesi ve genel notlar önerisi.
(function (kok) {
  const KALIN = 'BHP-K';
  const RENK = { HAT: 1, BILESKE: 1, MEVCUT: 8, PARSEL: 8, PARSEL_NO: 8, ALTLIK: 8, YOL: 8 };

  // ---------- cer aracının çizim parçalarını Cizim'e aktar ----------
  function kapsam(pr) {
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    const p = (x, y) => { if (isFinite(x) && isFinite(y)) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); } };
    for (const q of pr) {
      if (q.t === 'line' || q.t === 'wline') { p(q.x1, q.y1); p(q.x2, q.y2); }
      else if (q.t === 'rect') { p(q.x, q.y); p(q.x + q.w, q.y + q.h); }
      else if (q.t === 'circle' || q.t === 'arc') { p(q.x - q.r, q.y - q.r); p(q.x + q.r, q.y + q.r); }
      else if (q.t === 'text') { const w = String(q.s).length * q.h * 0.62, ha = q.center ? 1 : (q.ha || 0); p(q.x - w * ha / 2, q.y - q.h); p(q.x + w * (1 - ha / 2), q.y + q.h); }
      else if (q.pts) q.pts.forEach(([x, y]) => p(x, y));
    }
    return isFinite(x0) ? [x0, y0, x1, y1] : null;
  }
  function primCiz(c, pr) {
    for (const q of pr) {
      const L = q.layer || 'TABLO', o = { katman: 'HAVAI-' + L.replace(/^CER_/, '') };
      if (RENK[L] != null) o.renk = RENK[L];
      if (q.dash) o.lt = 'BHP-KESIK';
      if (q.t === 'line') c.cizgi(q.x1, q.y1, q.x2, q.y2, o);
      else if (q.t === 'wline') c.cizgi(q.x1, q.y1, q.x2, q.y2, { ...o, kalin: true });
      else if (q.t === 'rect') c.kutu(q.x, q.y, q.x + q.w, q.y + q.h, o);
      else if (q.t === 'circle') c.daire(q.x, q.y, q.r, o);
      else if (q.t === 'arc') {
        let a1 = q.a1, a2 = q.a2; if (a2 < a1) a2 += 360;
        const n = Math.max(4, Math.ceil((a2 - a1) / 6));
        c.cokgen(Array.from({ length: n + 1 }, (_, i) => { const a = (a1 + (a2 - a1) * i / n) * Math.PI / 180; return [q.x + q.r * Math.cos(a), q.y + q.r * Math.sin(a)]; }), o);
      } else if (q.t === 'solid') c.dolgu(q.pts.slice(0, 4), o);
      else if (q.t === 'pline') c.cokgen(q.pts, o);
      else if (q.t === 'text') {
        const ha = q.center ? 1 : (q.ha || 0), va = q.center ? 2 : (q.va || 0);
        // bizim DXF yazıları dikeyde ortalı (73=2); cer aracının taban çizgisi / üst hizasını kaydırarak koru
        const dy = va === 0 || va === 1 ? q.h / 2 : va === 3 ? -q.h / 2 : 0, r = (q.rot || 0) * Math.PI / 180;
        c.yazi(q.s, q.x - Math.sin(r) * dy, q.y + Math.cos(r) * dy, q.h, { ...o, hiza: ['sol', 'orta', 'sag'][ha] || 'sol', aci: q.rot || 0 });
      }
    }
  }
  // prim listesini hedef kutuya oran koruyarak yerleştir
  function kutuyaCiz(c, pr, hedef, enFazla = 50) {
    const k = kapsam(pr);
    if (!k) return;
    c.donustur(k, hedef, enFazla); primCiz(c, pr); c.donustur(null);
  }

  // ---------- ana paftada: direk listesi ve cer özeti (detay bölgesinde) ----------
  const sayi = n => (Math.round(n * 10) / 10).toString().replace('.', ',');
  function direkListesi(c, v, [x0, y0, x1, y1]) {
    const H = v.havai || {}, T = { katman: 'BHP-TABLO' }, r = H.sonuclar || [];
    c.kutu(x0, y0, x1, y1, { ...T, kalin: true });
    const bas = 8;
    c.cizgi(x0, y1 - bas, x1, y1 - bas, T);
    c.yazi('HAVAİ HAT DİREK LİSTESİ VE CER ÖZETİ', (x0 + x1) / 2, y1 - bas / 2, 3.2, { stil: KALIN, hiza: 'orta' });
    const bsl = ['No', 'Direk', 'Görevi', 'Açıklık (m)', 'İç açı', 'Bileşke R (kg)', 'Direk tipi', 'Tepe kuvveti (kg)', 'Sonuç'];
    const gen = [10, 34, 40, 30, 22, 34, 34, 38, 0]; gen[8] = (x1 - x0) - gen.slice(0, 8).reduce((a, b) => a + b, 0);
    const xs = gen.reduce((a, g) => (a.push(a[a.length - 1] + g), a), [x0]);
    const sh = Math.min(8, (y1 - y0 - bas - 9 - 6) / Math.max(1, r.length));
    const yb = y1 - bas - 9;
    c.cizgi(x0, yb, x1, yb, T);
    bsl.forEach((t, i) => c.yazi(t, (xs[i] + xs[i + 1]) / 2, yb + 4.5, 2.4, { stil: KALIN, hiza: 'orta' }));
    const yAlt = yb - sh * r.length;
    c.cizgi(x0, yAlt, x1, yAlt, T);
    xs.slice(1, -1).forEach(x => c.cizgi(x, yAlt, x, yb + 9, T));
    const hz = Math.min(2.5, sh * 0.42);
    r.forEach((d, j) => {
      const y = yb - sh * (j + 0.5);
      const durum = d.mev ? 'mevcut' : d.ok ? (d.kViol ? 'K direk gerekli' : 'UYGUN') : 'UYGUN DEĞİL';
      const hucre = [String(j + 1), d.name, d.catName, j === 0 ? '—' : sayi(d.span || 0), d.interior != null ? Math.round(d.interior) + '°' : '—',
        String(d.R), d.type, String(d.cap), durum];
      hucre.forEach((t, i) => c.yazi(t, (xs[i] + xs[i + 1]) / 2, y, hz, { stil: i === 8 || i === 6 ? KALIN : 'BHP', hiza: 'orta' }));
      if (j < r.length - 1) c.cizgi(x0, yb - sh * (j + 1), x1, yb - sh * (j + 1), T);
    });
    c.yazi(`Hat: ${v.kablo.yazi} · L = ${sayi(v.L)} m · ${H.bolge || 1}. buz yükü bölgesi · cer hesabı ve kuvvet şemaları 2. paftada`,
      x0 + 2, y0 + 3, 2.2, {});
  }

  // ---------- ikinci sayfa: proje krokisi + cer hesabı raporu (ana paftanın sağında) ----------
  function ikinciSayfa(c, v, bilgi) {
    const H = v.havai || {};
    const k = bilgi.kagit || [-269.5, 5393.6, 684.6, 6293.6];
    const W = k[2] - k[0], x0 = k[2] + 20, y0 = k[1], x1 = x0 + W, y1 = k[3];
    const T = { katman: 'BHP-TABLO' };
    c.kutu(x0, y0, x1, y1, T);
    c.kutu(x0 + 10, y0 + 10, x1 - 10, y1 - 10, { ...T, kalin: true });
    // başlık şeridi
    const ys = y1 - 10 - 16;
    c.cizgi(x0 + 10, ys, x1 - 10, ys, T);
    c.yazi('HAVAİ BAĞLANTI HATTI — PROJE KROKİSİ VE CER HESABI', (x0 + x1) / 2, ys + 8, 5, { stil: KALIN, hiza: 'orta' });
    c.yazi(`Başvuru: ${v.basvuruNo || '-'}   ·   Ada ${v.ada || '-'} / Parsel ${v.parsel || '-'}   ·   Enerji: ${v.kaynakAd || 'AG direği'}   ·   ${v.kablo.yazi}, L = ${sayi(v.L)} m`,
      x0 + 16, ys - 7, 2.8, {});
    // kroki (üst), rapor (alt)
    const ayir = y0 + 10 + 400;
    c.cizgi(x0 + 10, ayir, x1 - 10, ayir, T);
    c.yazi('PROJE KROKİSİ', x0 + 16, ys - 14, 3.2, { stil: KALIN });
    if (H.kroki && H.kroki.length) kutuyaCiz(c, H.kroki, [x0 + 20, ayir + 10, x1 - 20, ys - 20]);
    else c.yazi('Kroki çizilmedi (havai hat bölümünde direkleri işaretleyin).', (x0 + x1) / 2, (ayir + ys) / 2, 4, { hiza: 'orta' });
    c.yazi('CER HESABI RAPORU', x0 + 16, ayir - 7, 3.2, { stil: KALIN });
    if (H.rapor && H.rapor.prims) kutuyaCiz(c, H.rapor.prims, [x0 + 20, y0 + 16, x1 - 20, ayir - 14]);
  }

  // ---------- malzeme ve notlar ----------
  function malzemeOner(BHP, b, kablo, H) {
    const yeni = (H.sonuclar || []).filter(d => !d.mev);
    const tipler = {};
    yeni.forEach(d => { tipler[d.type] = (tipler[d.type] || 0) + 1; });
    const L = Math.ceil((H.hatBoyu || b.uzunluk || 0) * 1.03);        // %3 sehim ve bağlantı payı
    const gergi = (H.sonuclar || []).reduce((t, d) => t + (/Nihayet/.test(d.catName) ? 1 : /Köşe|Branşman/.test(d.catName) ? 2 : d.mev ? 1 : 0), 0);
    const aski = yeni.filter(d => /düz/i.test(d.catName)).length;
    const nih = yeni.filter(d => /Nihayet/.test(d.catName)).length;
    const r = [
      { ad: `${kablo.yazi} havai hat kablosu`, birim: 'm', miktar: L },
      ...Object.entries(tipler).map(([t, n]) => ({ ad: /\//.test(t) ? `SBA beton direk ${t}` : `AG demir direk ${t} (beton temeli ile)`, birim: 'adet', miktar: n })),
      { ad: 'ALPEK gergi takımı (gergi klemensi + konsol)', birim: 'takım', miktar: gergi },
      { ad: 'ALPEK askı takımı (askı klemensi + konsol)', birim: 'takım', miktar: aski },
      { ad: 'Koruma topraklaması (KT): galvaniz kazık 65x65x7 mm L=2 m + 1x16 mm² Cu iletken', birim: 'takım', miktar: yeni.length },
      { ad: 'İşletme topraklaması (İT), nihayet direği', birim: 'takım', miktar: nih },
    ];
    const eski = BHP.malzemeOner(b, kablo).filter(m => !/yeraltı|kazı|kum|tuğla|ikaz|kablo başlığı|koruma borusu|topraklama kazığı|topraklama iletkeni/i.test(m.ad));
    return r.filter(m => m.miktar > 0).concat(eski);
  }
  function notlarOner(BHP, b, kablo, H) {
    const yer = BHP.notlarOner(b);
    return [
      yer[0],
      `Bağlantı hattı ${kablo.yazi} ile havai olarak çekilecektir. Direk tipleri cer hesabına göre seçilmiştir (direk listesi bu paftada, kroki ve cer hesabı raporu 2. paftada).`,
      'Yeni demir direklerde koruma topraklaması (KT), nihayet direğinde ayrıca işletme topraklaması (İT) yapılacaktır.',
      'ALPEK askı teli gergi ve askı takımlarıyla direklere tespit edilecek; hattın yapılara, yollara ve diğer tesislere olan mesafeleri Elektrik Kuvvetli Akım Tesisleri Yönetmeliğine uygun olacaktır.',
      'GEREKLİ GEÇİŞ İZİNLERİ ALINMADAN HAT ÇEKİLMEYECEKTİR. Direk yerleri arazide aplikasyonla belirlenecektir.',
      ...yer.slice(5).filter(n => !/kazı/i.test(n)),
    ];
  }

  // Ana paftada yeraltına özgü bölgeler (şablon koordinatı): kablo kanalı detayı ve "enerji kabloları uygulama usul ve esasları"
  const SIL = [[18, 5968, 388, 6134], [389, 5394, 684.6, 6293.6]];
  // kablo kanalı detayının yerine kroki (ayrıntısı ve cer raporu 2. paftada)
  function krokiOzet(c, v, [x0, y0, x1, y1] = SIL[0]) {
    const H = v.havai || {}, T = { katman: 'BHP-TABLO' };
    c.kutu(x0, y0 + 2, x1, y1, { ...T, kalin: true });
    c.cizgi(x0, y1 - 8, x1, y1 - 8, T);
    c.yazi('HAVAİ HAT KROKİSİ (ayrıntı ve cer hesabı 2. paftada)', (x0 + x1) / 2, y1 - 4, 3.0, { stil: KALIN, hiza: 'orta' });
    if (H.kroki && H.kroki.length) kutuyaCiz(c, H.kroki, [x0 + 4, y0 + 5, x1 - 4, y1 - 11]);
  }

  const BHPHavai = { SIL, krokiOzet, kapsam, primCiz, kutuyaCiz, direkListesi, ikinciSayfa, malzemeOner, notlarOner };
  if (typeof module !== 'undefined' && module.exports) module.exports = BHPHavai;
  kok.BHPHavai = BHPHavai;
})(typeof window !== 'undefined' ? window : globalThis);
