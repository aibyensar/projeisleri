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
  function malzemeOner(BHP, b, kablo, H, inis) {
    const yeni = (H.sonuclar || []).filter(d => !d.mev);
    const tipler = {};
    yeni.forEach(d => { tipler[d.type] = (tipler[d.type] || 0) + 1; });
    const L = Math.ceil((H.hatBoyu || b.uzunluk || 0) * 1.03);        // %3 sehim ve bağlantı payı
    const gergi = (H.sonuclar || []).reduce((t, d) => t + (/Nihayet/.test(d.catName) ? 1 : /Köşe|Branşman/.test(d.catName) ? 2 : d.mev ? 1 : 0), 0);
    const aski = yeni.filter(d => /düz/i.test(d.catName)).length;
    const nih = yeni.filter(d => /Nihayet/.test(d.catName)).length;
    const nyy = !!kablo.askiTelli, kisa = H.kisa, ayni = inis && inis.ayniKablo;
    const r = [
      { ad: ayni ? `${inis.kablo.yazi} kablo (havai + ${kisa ? 'bina' : 'direk'} inişi${(inis.yer || 0) > 0 ? ' + yeraltı' : ''})` : `${kablo.yazi} havai hat kablosu`,
        birim: 'm', miktar: ayni ? L + Math.ceil(inis.L) : L },
      ...(nyy ? [{ ad: `Askı teli: ${kablo.askiTel || 'galvanizli örgülü çelik tel halat'}`, birim: 'm', miktar: L },
        { ad: 'Kablo askı kelepçesi / bağı (kablonun askı teline tespiti)', birim: 'adet', miktar: Math.ceil((H.hatBoyu || b.uzunluk || 0) / 0.5) }] : []),
      ...Object.entries(tipler).map(([t, n]) => ({ ad: /\//.test(t) ? `SBA beton direk ${t}` : `AG demir direk ${t} (beton temeli ile)`, birim: 'adet', miktar: n })),
      ...(kisa === 'dam' ? [{ ad: 'Dam direği: Ø40 mm siyah çelik boru, 3 mm et kalınlığı, h = 2,5 m (izolatör ve gergi konsolu ile, çatıya tespitli)', birim: 'adet', miktar: 1 }] : []),
      ...(kisa === 'cephe' ? [{ ad: 'Duvar gergi konsolu (dübelli tespit)', birim: 'adet', miktar: 1 }] : []),
      { ad: nyy ? 'Askı teli gergi takımı (gergi konsolu + gergi klemensi / germe tertibatı)' : 'ALPEK gergi takımı (gergi klemensi + konsol)', birim: 'takım', miktar: kisa ? 2 : gergi },
      { ad: nyy ? 'Askı teli askı takımı (askı konsolu + askı klemensi)' : 'ALPEK askı takımı (askı klemensi + konsol)', birim: 'takım', miktar: aski },
      { ad: 'Koruma topraklaması (KT): galvaniz kazık 65x65x7 mm L=2 m + 1x16 mm² Cu iletken', birim: 'takım', miktar: yeni.length },
      { ad: 'İşletme topraklaması (İT), nihayet direği', birim: 'takım', miktar: nih },
    ];
    // kısa mesafede (yeni direk yok) pano topraklaması yeraltı listesindeki gibi kalır
    const eski = BHP.malzemeOner(b, kablo).filter(m => !(kisa ? /yeraltı|kazısı|kum|tuğla|ikaz|kablo başlığı|koruma borusu/i : /yeraltı|kazı|kum|tuğla|ikaz|kablo başlığı|koruma borusu|topraklama kazığı|topraklama iletkeni/i).test(m.ad));
    if (inis) {                                   // nihayet direğinden yeraltı iniş (kullanıcının onaylı direk bağlantı detayıyla aynı kalemler)
      const Ly = Math.ceil(inis.yer || 0);
      if (!ayni) r.push({ ad: `${inis.kablo.yazi} kablo (direk inişi ve yeraltı)`, birim: 'm', miktar: Math.ceil(inis.L) },
        { ad: 'AG kablo başlığı (dış tip)', birim: 'adet', miktar: 1 });
      if (kisa) r.push({ ad: 'Kablo tespit kroşesi / kelepçesi (bina duvarında iniş)', birim: 'adet', miktar: Math.ceil(inis.L / 0.5) });
      else r.push({ ad: 'Galvanizli çelik koruma borusu (direk inişi, 3 m)', birim: 'adet', miktar: 1 });
      r.push({ ad: 'Çelik spiral (sayaç panosu altında kablo koruması)', birim: 'takım', miktar: 1 });
      if (Ly > 0) r.push({ ad: 'Kablo kanalı kazısı ve dolgusu (40x100 cm)', birim: 'm', miktar: Ly }, { ad: 'Kablo altı ve üstü elenmiş kum', birim: 'm', miktar: Ly },
        { ad: 'Koruma tuğlası', birim: 'adet', miktar: 4 * Ly }, { ad: 'Plastik ikaz şeridi', birim: 'm', miktar: Ly });
    }
    return r.filter(m => m.miktar > 0).concat(eski);
  }
  function notlarOner(BHP, b, kablo, H, inis) {
    const yer = BHP.notlarOner(b);
    return [
      yer[0],
      ...(H.kisa ? [
        `Bağlantı hattı ${kablo.yazi} ile mevcut AG direğinden ${H.kisa === 'dam' ? 'binadaki dam direğine' : 'bina cephesindeki duvar gergi konsoluna'} havai olarak çekilecek, yeni direk dikilmeyecektir. Havai açıklık ${sayi(H.hatBoyu || 0)} m'dir (en çok 60 m, EKAT md. 4-c).`,
        ...(H.kisa === 'dam' ? ['Dam direği Ø40 mm siyah çelik borudan (3 mm et kalınlığı, h = 2,5 m) yapılacak, çatıya sağlam biçimde tespit edilecektir.'] : ['Duvar gergi konsolu taşıyıcı duvara dübelle sağlam biçimde tespit edilecektir.']),
        'Kablo bina duvarında tespit kroşeleriyle sayaç panosuna indirilecek, pano altında çelik spiral ile korunacaktır.',
      ] : [
        `Bağlantı hattı ${kablo.yazi} ile havai olarak çekilecektir. Direk tipleri cer hesabına göre seçilmiştir (direk listesi bu paftada, kroki ve cer hesabı raporu 2. paftada).`,
        'Yeni demir direklerde koruma topraklaması (KT), nihayet direğinde ayrıca işletme topraklaması (İT) yapılacaktır.',
      ]),
      ...(kablo.askiTelli ? [
        `${kablo.yazi.replace(/ \(askı telli\)$/, '')} kablo, direkler arasına gergi ve askı takımlarıyla tespit edilen ${kablo.askiTel || 'galvanizli örgülü çelik tel halat'} askı teline kelepçelerle asılacak; kablonun mekanik yükünü askı teli taşıyacaktır (EKAT md. 45-b). İletkenin en büyük salgı durumunda düşey uzaklıkları EKAT md. 46 Çizelge-8\'e uygun olacaktır (direk detayındaki tablo).`,
        ...(H.kisa ? [] : ['İki direk arası açıklık 60 m\'yi geçmeyecektir (EKAT md. 4-c). Demir direklere zeminden en az 4 m yükseklikte tırmanma engeli takılacaktır (EKAT md. 44-o).']),
      ] : [
        'ALPEK askı teli gergi ve askı takımlarıyla direklere tespit edilecektir. İletkenin en büyük salgı durumunda yere, yollara, yapılara ve diğer tesislere olan düşey uzaklıkları Elektrik Kuvvetli Akım Tesisleri Yönetmeliği md. 46 Çizelge-8\'e uygun olacaktır (direk detayındaki tablo).',
        ...(H.kisa ? [] : ['Yalıtılmış iletkenli küçük aralıklı hat olarak iki direk arası açıklık 60 m\'yi geçmeyecektir (EKAT md. 4-c). Demir direklere zeminden en az 4 m yükseklikte tırmanma engeli takılacaktır (EKAT md. 44-o).']),
      ]),
      ...(inis && !H.kisa ? [(inis.ayniKablo ? `Nihayet direğinden sayaç panosuna aynı ${inis.kablo.yazi} kablo ekleme yapılmadan inecektir; direk inişinde galvanizli çelik koruma borusu kullanılacaktır.`
        : `Nihayet direğinden sayaç panosuna ${inis.kablo.yazi} kablo ile inilecektir; direk inişinde galvanizli çelik koruma borusu kullanılacak, direk tarafında kablo başlığı yapılacaktır.`)
        + ((inis.yer || 0) > 0 ? ' Yeraltı kısmında kablo kanalı, kablo kanalı detayına uygun açılacak; kablo altına ve üstüne 10\'ar cm kum, üzerine koruma tuğlası ve ikaz şeridi konacaktır.' : '')] : []),
      H.kisa ? 'GEREKLİ GEÇİŞ İZİNLERİ ALINMADAN HAT ÇEKİLMEYECEKTİR.' : 'GEREKLİ GEÇİŞ İZİNLERİ ALINMADAN HAT ÇEKİLMEYECEKTİR. Direk yerleri arazide aplikasyonla belirlenecektir.',
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

  // ---------- sağ sütun: AG havai hat direk tesis detayları (ölçeksiz) ----------
  // Değerler: Elektrik Kuvvetli Akım Tesisleri Yönetmeliği (EKAT) md. 44-o (tırmanma engeli), md. 46 Çizelge-8 (en küçük
  // düşey uzaklıklar, 0–1 kV; (*) işaretlilerde yalıtılmış hava hattı kablosu için 0,5 m azaltılmış); topraklama kazığı ve
  // iletkeni kullanıcının onaylı bağlantı hattı detayıyla aynı. Temel ölçüleri kaynağı doğrulanamadığı için sayı yazılmaz.
  const UZAKLIK = [
    ['Araç geçen köy ve şehir içi yolları', '5,0 *'], ['Araç geçmesine elverişli çayır, tarla, otlak', '4,5 *'],
    ['Şehirlerarası karayolları', '7,0'], ['Elektriksiz demiryolları (ray üstünden)', '7,0'], ['Otoyollar', '14,0'],
    ['Üzerine çıkılabilen düz damlı yapılar', '2,5'], ['Üzerine çıkılmayan eğik damlı yapılar', '2,0'],
    ['Ağaçlar', '1,5'], ['Elektrik hatları', '2,0'], ['İletişim (haberleşme) hatları', '1,0'],
  ];
  function direkDetay(c, v, [x0, y0, x1, y1] = [394, 5404, 674, 6283]) {
    const T = { katman: 'BHP-TABLO' }, D = { katman: 'HAVAI-DETAY' }, K = { katman: 'HAVAI-HAT', renk: 1, kalin: true };
    const W = x1 - x0, nyy = !!(v.kablo && v.kablo.askiTelli), AK = nyy ? 'askı teli' : 'ALPEK';
    // NYY + askı telinde Çizelge-8'in 0,5 m azaltması (yalnız yalıtılmış hava hattı kablosu için) uygulanmaz
    const uzak = UZAKLIK.map(([a, d]) => [a, nyy && /\*/.test(d) ? (parseFloat(d.replace(',', '.')) + 0.5).toFixed(1).replace('.', ',') : d]);
    c.kutu(x0, y0, x1, y1, { ...T, kalin: true });
    c.cizgi(x0, y1 - 10, x1, y1 - 10, T);
    c.yazi('AG HAVAİ HAT DİREK TESİS DETAYLARI (ÖLÇEKSİZ)', (x0 + x1) / 2, y1 - 5, 3.4, { stil: KALIN, hiza: 'orta' });
    const etiket = (x, y, tx, ty, satirlar, hiza = 'sol') => {        // ok çizgisi + yazı
      c.cizgi(x, y, tx, ty, D); c.daire(x, y, 0.6, D);
      satirlar.forEach((t, i) => c.yazi(t, tx + (hiza === 'sol' ? 1.5 : -1.5), ty - i * 3.6, 2.4, { hiza, stil: i === 0 ? KALIN : 'BHP' }));
    };
    const kazik = (x, yz, ad) => {                                  // topraklama kazığı (zeminde)
      c.cizgi(x, yz - 4, x, yz - 34, { ...D, kalin: true });
      c.cokgen([[x - 2.5, yz - 34], [x, yz - 39], [x + 2.5, yz - 34]], { ...D, kapali: true });
      c.yazi(ad, x, yz - 43, 2.4, { stil: KALIN, hiza: 'orta' });
    };
    // demir direk yan görünüşü: zeminden h yukarı, temel bloğu, tırmanma engeli
    const direk = (xd, yz, h) => {
      c.cizgi(xd - 2.2, yz, xd - 1.4, yz + h, { ...D, kalin: true }); c.cizgi(xd + 2.2, yz, xd + 1.4, yz + h, { ...D, kalin: true });
      for (let y = yz + 6; y < yz + h - 4; y += 10) c.cizgi(xd - 2.1, y, xd + 2.1, y + 6, D);         // kafes / profil çizgisi
      c.kutu(xd - 9, yz - 22, xd + 9, yz + 1.5, { ...D, lt: 'BHP-GIZLI' });                            // beton temel (zemin altı)
      c.dolgu([[xd - 9, yz - 22], [xd + 9, yz - 22], [xd + 9, yz - 21], [xd - 9, yz - 21]], { ...D, renk: 254 });
      c.cizgi(xd - 5, yz + 28, xd + 5, yz + 28, { ...D, kalin: true }); c.cizgi(xd - 5, yz + 30, xd + 5, yz + 30, D);   // tırmanma engeli
    };
    const zemin = (xa, xb, yz) => {
      c.cizgi(xa, yz, xb, yz, { ...T, kalin: true });
      for (let x = xa + 2; x < xb; x += 5) c.cizgi(x, yz, x - 3, yz - 3, T);
    };

    // 1) Nihayet direği
    const h1 = y1 - 18, yz1 = y1 - 250, xd1 = x0 + 150;
    c.yazi(`1. NİHAYET DİREĞİ (${AK} gergi bağlantısı, KT + İT)`, x0 + 6, h1, 2.8, { stil: KALIN });
    zemin(x0 + 8, x1 - 8, yz1);
    const hD = 215;
    direk(xd1, yz1, hD);
    const yk = yz1 + hD - 10;                                                                    // konsol yüksekliği
    c.cizgi(xd1 - 1.5, yk, xd1 - 22, yk, { ...D, kalin: true }); c.cizgi(xd1 - 1.5, yk - 8, xd1 - 22, yk, D);   // gergi konsolu
    c.cokgen([[xd1 - 22, yk], [xd1 - 30, yk + 1.6], [xd1 - 30, yk - 1.6]], { ...D, kapali: true });               // gergi klemensi
    const ah = [];                                                                               // hat, sehimli
    for (let i = 0; i <= 20; i++) { const t = i / 20; ah.push([xd1 - 30 - t * 100, yk - 18 * Math.sin(Math.PI * t * 0.5)]); }
    c.cokgen(ah, K);
    c.yazi(v.kablo ? v.kablo.yazi : 'ALPEK', xd1 - 80, yk + 6, 2.6, { stil: KALIN, hiza: 'orta', katman: 'HAVAI-HAT' });
    // en küçük yükseklik ölçüsü (yol)
    const xo = xd1 - 112, ye = ah[20][1];
    c.cizgi(xo, yz1, xo, ye, D); [yz1, ye].forEach(y => c.cizgi(xo - 2, y, xo + 2, y, D));
    c.yazi(nyy ? 'en az 5,5 m' : 'en az 5,0 m', xo - 2, (yz1 + ye) / 2 + 2, 2.4, { stil: KALIN, hiza: 'sag' });
    c.yazi(nyy ? '(yol, NYY)' : '(yol, ALPEK)', xo - 2, (yz1 + ye) / 2 - 2, 2.2, { hiza: 'sag' });
    etiket(xd1 - 12, yk - 2, xd1 + 18, yk + 14, ['Gergi konsolu ve', `${AK} gergi klemensi`]);
    etiket(xd1 + 2, yz1 + 29, xd1 + 18, yz1 + 52, ['Tırmanma engeli', 'zeminden en az 4 m (EKAT md. 44-o)']);
    etiket(xd1 + 2, yz1 + 120, xd1 + 18, yz1 + 140, ['AG demir direk', 'tipi direk listesine göre']);
    etiket(xd1 - 8, yz1 - 14, xd1 - 30, yz1 - 30, ['Beton temel', 'TEDAŞ direk montaj', 'şartnamesine göre'], 'sag');
    // topraklamalar
    const kt = xd1 + 45, it = xd1 + 85;
    c.cizgi(xd1 + 2, yz1 + 3, xd1 + 6, yz1 - 4, D); c.cizgi(xd1 + 6, yz1 - 4, kt, yz1 - 4, D); kazik(kt, yz1, 'KT');
    c.cizgi(xd1 - 1, yk - 4, xd1 - 6, yk - 30, { ...D, lt: 'BHP-KESIK' });                      // nötr → İT iniş (direk üzerinden)
    c.cizgi(it, yz1 - 4, kt + 6, yz1 - 4, { ...D, lt: 'BHP-KESIK' }); kazik(it, yz1, 'İT');
    c.yazi('Galv. kazık 65x65x7 mm, L = 2 m', (kt + it) / 2, yz1 - 50, 2.3, { hiza: 'orta' });
    c.yazi('1x16 mm² Cu topraklama iletkeni', (kt + it) / 2, yz1 - 54, 2.3, { hiza: 'orta' });

    // 2) Taşıyıcı (ara) direk
    const ust2 = yz1 - 70, yz2 = ust2 - 200, xd2 = (x0 + x1) / 2;
    c.cizgi(x0 + 4, ust2 + 6, x1 - 4, ust2 + 6, T);
    c.yazi(`2. TAŞIYICI (ARA) DİREK (${AK} askı bağlantısı, KT)`, x0 + 6, ust2, 2.8, { stil: KALIN });
    zemin(x0 + 8, x1 - 8, yz2);
    const hD2 = 170; direk(xd2, yz2, hD2);
    const yk2 = yz2 + hD2 - 8;
    c.cizgi(xd2 - 1.5, yk2, xd2 - 14, yk2, { ...D, kalin: true }); c.daire(xd2 - 14, yk2 - 2.5, 2.5, D);            // askı konsolu + klemens
    const ah2 = [];
    for (let i = 0; i <= 30; i++) { const t = i / 30; ah2.push([xd2 - 14 + (t - 0.5) * 220, yk2 - 5 - 22 * (4 * (t - 0.5) * (t - 0.5))]); }
    c.cokgen(ah2, K);
    etiket(xd2 - 14, yk2, xd2 + 20, yk2 + 14, ['Askı konsolu ve', `${AK} askı klemensi`]);
    etiket(xd2 + 2, yz2 + 29, xd2 + 18, yz2 + 48, ['Tırmanma engeli (en az 4 m)']);
    c.cizgi(xd2 + 2, yz2 + 3, xd2 + 6, yz2 - 4, D); c.cizgi(xd2 + 6, yz2 - 4, xd2 + 45, yz2 - 4, D); kazik(xd2 + 45, yz2, 'KT');

    // 3) En küçük düşey uzaklıklar tablosu
    const ust3 = yz2 - 60, sh = 7.2, kx = x0 + 6, kv = x1 - 40;
    c.cizgi(x0 + 4, ust3 + 6, x1 - 4, ust3 + 6, T);
    c.yazi('3. İLETKENİN EN KÜÇÜK DÜŞEY UZAKLIKLARI (0–1 kV)', x0 + 6, ust3, 2.8, { stil: KALIN });
    c.yazi('EKAT md. 46, Çizelge-8 · en büyük salgı durumunda', x0 + 6, ust3 - 4.5, 2.2, {});
    const tu = ust3 - 9, tb = tu - sh * (uzak.length + 1);
    c.kutu(kx, tb, x1 - 6, tu, T); c.cizgi(kv, tb, kv, tu, T);
    c.yazi('İletkenin üzerinden geçtiği yer', kx + 2, tu - sh / 2, 2.4, { stil: KALIN });
    c.yazi('Uzaklık (m)', (kv + x1 - 6) / 2, tu - sh / 2, 2.4, { stil: KALIN, hiza: 'orta' });
    uzak.forEach(([ad, d], i) => {
      const y = tu - sh * (i + 1);
      c.cizgi(kx, y, x1 - 6, y, T);
      c.yazi(ad, kx + 2, y - sh / 2, 2.3, {}); c.yazi(d, (kv + x1 - 6) / 2, y - sh / 2, 2.4, { stil: KALIN, hiza: 'orta' });
    });
    c.yazi(nyy ? 'NYY askı telli hat yalıtılmış hava hattı kablosu sayılmadığından Çizelge-8 değerleri azaltılmadan alınmıştır.'
      : '* Yalıtılmış hava hattı kablosu (ALPEK) için Çizelge-8 değerinden 0,5 m azaltılmıştır.', kx, tb - 4.5, 2.2, {});
    c.yazi('Direk temeli, gömme derinliği ve tırmanma engeli TEDAŞ direk montaj teknik şartnamesine uygun yapılacaktır.', kx, tb - 9, 2.2, {});
  }

  // ---------- kısa mesafe: mevcut direkten doğrudan binaya (dam direği ya da cephe), yeni direk yok ----------
  // Kullanıcının onaylı örneği (dam direği: Ø40 mm siyah çelik boru, 3 mm et, h = 2,5 m, izolatörlü; kablo duvarda kroşelerle panoya).
  const KISA_AD = { dam: 'DAM DİREĞİ', cephe: 'BİNA CEPHESİ' };
  function kisaListe(c, v, [x0, y0, x1, y1]) {
    const H = v.havai || {}, T = { katman: 'BHP-TABLO' }, nyy = !!(v.kablo && v.kablo.askiTelli);
    c.kutu(x0, y0, x1, y1, { ...T, kalin: true });
    c.cizgi(x0, y1 - 8, x1, y1 - 8, T);
    c.yazi('KISA MESAFE HAVAİ BAĞLANTI (YENİ DİREK YOK)', (x0 + x1) / 2, y1 - 4, 3.2, { stil: KALIN, hiza: 'orta' });
    const satir = [
      ['Enerji alınan', v.kaynakAd || 'GDZ mevcut AG direği'],
      ['Binada bağlantı noktası', H.kisa === 'dam' ? 'Dam direği (Ø40 mm siyah çelik boru, 3 mm et, h = 2,5 m)' : 'Bina cephesi (duvar gergi konsolu)'],
      ['Havai açıklık', `${sayi(v.L)} m (EKAT md. 4-c: en çok 60 m)`],
      ['İletken', nyy ? `${v.kablo.yazi}, askı teli: ${v.kablo.askiTel || '-'}` : v.kablo.yazi],
      ...(v.inis ? [['Binada iniş', `${v.inis.kablo.yazi}, L = ${sayi(v.inis.L)} m`]] : []),
      ['Cer hesabı', 'Yeni direk olmadığından direk cer hesabı yapılmamıştır; mevcut direğin uygunluğu GDZ\'ce değerlendirilir.'],
    ];
    const sh = Math.min(9, (y1 - y0 - 12) / satir.length), xa = x0 + 4, xb = x0 + 70;
    satir.forEach(([a, b], i) => {
      const y = y1 - 8 - sh * (i + 0.5);
      c.yazi(a, xa, y, 2.5, { stil: KALIN }); c.yazi(b, xb, y, b.length > 70 ? 2.1 : 2.4, {});
      if (i < satir.length - 1) c.cizgi(x0, y1 - 8 - sh * (i + 1), x1, y1 - 8 - sh * (i + 1), T);
    });
    c.cizgi(xb - 3, y1 - 8, xb - 3, y1 - 8 - sh * satir.length, T);
    // altta bağlantı şeması (ölçeksiz, üstten görünüş)
    const ya = y1 - 8 - sh * satir.length;
    if (ya - y0 < 40) return;
    c.cizgi(x0, ya, x1, ya, T);
    c.yazi('BAĞLANTI ŞEMASI (ÖLÇEKSİZ)', x0 + 4, ya - 5, 2.6, { stil: KALIN });
    const ym = (ya + y0) / 2 - 2, xs = x0 + 40, xbn = x1 - 70, D = { katman: 'HAVAI-DETAY' };
    c.daire(xs, ym, 4, D); c.yazi(v.kaynakAd || 'Mevcut AG direği', xs, ym - 9, 2.4, { stil: KALIN, hiza: 'orta' });
    c.yazi('(GDZ, mevcut)', xs, ym - 12.5, 2.1, { hiza: 'orta' });
    c.kutu(xbn, ym - 18, xbn + 50, ym + 18, { ...D, kalin: true }); c.yazi('BİNA', xbn + 25, ym - 3, 2.8, { stil: KALIN, hiza: 'orta' });
    c.kutu(xbn + 2, ym - 2, xbn + 6, ym + 2, D);
    c.yazi(H.kisa === 'dam' ? 'dam direği' : 'cephe konsolu', xbn + 8, ym + 6, 2.2, {});
    c.cizgi(xs + 4, ym, xbn + 2, ym, { katman: 'HAVAI-HAT', renk: 1, kalin: true });
    c.yazi(v.kablo.yazi, (xs + xbn) / 2, ym + 3.5, 2.5, { stil: KALIN, hiza: 'orta' });
    c.yazi(`HAVAİ · L = ${sayi(v.L)} m`, (xs + xbn) / 2, ym - 4.5, 2.4, { hiza: 'orta' });
  }
  function binaDetay(c, v, [x0, y0, x1, y1] = [394, 5404, 674, 6283]) {
    const T = { katman: 'BHP-TABLO' }, D = { katman: 'HAVAI-DETAY' }, K = { katman: 'HAVAI-HAT', renk: 1, kalin: true };
    const H = v.havai || {}, dam = H.kisa === 'dam', nyy = !!(v.kablo && v.kablo.askiTelli), AK = nyy ? 'askı teli' : 'ALPEK';
    c.kutu(x0, y0, x1, y1, { ...T, kalin: true });
    c.cizgi(x0, y1 - 10, x1, y1 - 10, T);
    c.yazi(`AG HAVAİ BAĞLANTI — ${dam ? 'DAM DİREĞİ' : 'CEPHE'} BAĞLANTI DETAYI (ÖLÇEKSİZ)`, (x0 + x1) / 2, y1 - 5, 3.2, { stil: KALIN, hiza: 'orta' });
    const etiket = (x, y, tx, ty, satirlar, hiza = 'sol') => {
      c.cizgi(x, y, tx, ty, D); c.daire(x, y, 0.6, D);
      satirlar.forEach((t, i) => c.yazi(t, tx + (hiza === 'sol' ? 1.5 : -1.5), ty - i * 3.6, 2.4, { hiza, stil: i === 0 ? KALIN : 'BHP' }));
    };
    const yz = y1 - 330, xd = x0 + 40, hD = 230;                       // zemin, mevcut direk
    c.cizgi(x0 + 8, yz, x1 - 8, yz, { ...T, kalin: true });
    for (let x = x0 + 10; x < x1 - 8; x += 5) c.cizgi(x, yz, x - 3, yz - 3, T);
    c.cizgi(xd - 2.2, yz, xd - 1.4, yz + hD, { ...D, kalin: true }); c.cizgi(xd + 2.2, yz, xd + 1.4, yz + hD, { ...D, kalin: true });
    c.yazi('MEVCUT AG DİREĞİ', xd, yz + hD + 6, 2.5, { stil: KALIN, hiza: 'orta' });
    c.yazi('(GDZ)', xd, yz + hD + 2.4, 2.2, { hiza: 'orta' });
    const yk = yz + hD - 14;
    c.cizgi(xd + 1.5, yk, xd + 16, yk, { ...D, kalin: true });                                  // gergi konsolu
    c.cokgen([[xd + 16, yk], [xd + 23, yk + 1.6], [xd + 23, yk - 1.6]], { ...D, kapali: true });
    etiket(xd + 18, yk + 1, xd + 30, yk + 20, ['Gergi konsolu ve', `${AK} gergi klemensi`]);
    // bina
    const bx0 = x0 + 175, bx1 = x1 - 20, by1 = yz + 150;
    c.kutu(bx0, yz, bx1, by1, { ...D, kalin: true });
    c.cizgi(bx0 - 4, by1, bx1 + 4, by1, { ...D, kalin: true });
    c.yazi('BİNA', (bx0 + bx1) / 2 + 20, yz + 110, 3, { stil: KALIN, hiza: 'orta' });
    // bağlantı noktası
    const xb = bx0 + 4;
    let yb;
    if (dam) {
      yb = by1 + 72;
      c.kutu(xb - 2, by1, xb + 2, yb + 6, { ...D, kalin: true });                              // Ø40 boru, h 2,5 m
      c.cizgi(xb - 2, yb, xb - 14, yb, { ...D, kalin: true }); c.daire(xb - 14, yb - 2.2, 2.2, D);
      etiket(xb + 2, yb - 20, xb + 18, yb - 6, ['Dam direği', 'Ø40 mm siyah çelik boru', '3 mm et kalınlığı, h = 2,5 m', 'izolatör ve gergi konsolu ile']);
      c.cizgi(xb + 8, by1, xb + 8, yb + 6, D); [by1, yb + 6].forEach(y => c.cizgi(xb + 6, y, xb + 10, y, D));
      c.yazi('2,5 m', xb + 10, (by1 + yb) / 2, 2.3, { stil: KALIN });
    } else {
      yb = by1 - 12;
      c.cizgi(xb - 4, yb, xb - 14, yb, { ...D, kalin: true }); c.daire(xb - 14, yb - 2.2, 2.2, D);
      etiket(xb - 10, yb + 1, xb + 14, yb + 18, ['Duvar gergi konsolu', `${AK} gergi klemensi, dübelli tespit`]);
    }
    const ah = [];                                                                               // sehimli hat
    for (let i = 0; i <= 24; i++) { const t = i / 24; ah.push([xd + 23 + t * (xb - 16 - xd - 23), yk + (yb - yk) * t - 16 * Math.sin(Math.PI * t)]); }
    c.cokgen(ah, K);
    c.yazi(v.kablo ? v.kablo.yazi : AK, (xd + xb) / 2, Math.max(yk, yb) + 6, 2.6, { stil: KALIN, hiza: 'orta', katman: 'HAVAI-HAT' });
    c.yazi(`açıklık ${sayi(v.L)} m (en çok 60 m)`, (xd + xb) / 2, Math.max(yk, yb) + 2, 2.3, { hiza: 'orta' });
    // binada iniş: duvarda kelepçeli kablo → pano → çelik spiral → toprak
    const xw = bx0 - 3, yp = yz + 55;
    c.cizgi(xb - 16, yb - 2, xw, yb - 8, K); c.cizgi(xw, yb - 8, xw, yp + 22, K);
    for (let y = yb - 18; y > yp + 26; y -= 14) c.cizgi(xw - 2.5, y, xw + 2.5, y, D);
    etiket(xw, yb - 46, xw - 30, yb - 30, ['Kablo duvarda', 'tespit kroşeleriyle'], 'sag');
    c.kutu(xw - 9, yp, xw + 3, yp + 22, { ...D, kalin: true });
    c.yazi('SAYAÇ', xw - 3, yp + 13, 2, { stil: KALIN, hiza: 'orta' }); c.yazi('PANOSU', xw - 3, yp + 9.5, 2, { stil: KALIN, hiza: 'orta' });
    c.cizgi(xw - 3, yp, xw - 3, yz - 6, { ...D, kalin: true }); c.cizgi(xw - 1, yp, xw - 1, yz - 6, D);
    etiket(xw - 2, yp - 20, xw - 34, yp - 14, ['Çelik spiral', '(pano altı koruma)'], 'sag');
    const xk = xw - 48;
    c.cizgi(xw - 3, yz - 6, xk, yz - 6, D);
    c.cizgi(xk, yz - 4, xk, yz - 34, { ...D, kalin: true });
    c.cokgen([[xk - 2.5, yz - 34], [xk, yz - 39], [xk + 2.5, yz - 34]], { ...D, kapali: true });
    c.yazi('Pano topraklaması', xk, yz - 44, 2.4, { stil: KALIN, hiza: 'orta' });
    c.yazi('Galv. kazık 65x65x7 mm, L = 2 m', xk, yz - 48, 2.2, { hiza: 'orta' });
    c.yazi('1x16 mm² Cu topraklama iletkeni', xk, yz - 52, 2.2, { hiza: 'orta' });
    // en küçük düşey uzaklıklar tablosu (direk detayıyla aynı)
    const ust3 = yz - 75, sh = 7.2, kx = x0 + 6, kv = x1 - 40;
    const uzak = UZAKLIK.map(([a, d]) => [a, nyy && /\*/.test(d) ? (parseFloat(d.replace(',', '.')) + 0.5).toFixed(1).replace('.', ',') : d]);
    c.cizgi(x0 + 4, ust3 + 6, x1 - 4, ust3 + 6, T);
    c.yazi('İLETKENİN EN KÜÇÜK DÜŞEY UZAKLIKLARI (0–1 kV)', x0 + 6, ust3, 2.8, { stil: KALIN });
    c.yazi('EKAT md. 46, Çizelge-8 · en büyük salgı durumunda', x0 + 6, ust3 - 4.5, 2.2, {});
    const tu = ust3 - 9, tb = tu - sh * (uzak.length + 1);
    c.kutu(kx, tb, x1 - 6, tu, T); c.cizgi(kv, tb, kv, tu, T);
    c.yazi('İletkenin üzerinden geçtiği yer', kx + 2, tu - sh / 2, 2.4, { stil: KALIN });
    c.yazi('Uzaklık (m)', (kv + x1 - 6) / 2, tu - sh / 2, 2.4, { stil: KALIN, hiza: 'orta' });
    uzak.forEach(([ad, d], i) => {
      const y = tu - sh * (i + 1);
      c.cizgi(kx, y, x1 - 6, y, T);
      c.yazi(ad, kx + 2, y - sh / 2, 2.3, {}); c.yazi(d, (kv + x1 - 6) / 2, y - sh / 2, 2.4, { stil: KALIN, hiza: 'orta' });
    });
    c.yazi(nyy ? 'NYY askı telli hat yalıtılmış hava hattı kablosu sayılmadığından Çizelge-8 değerleri azaltılmadan alınmıştır.'
      : '* Yalıtılmış hava hattı kablosu (ALPEK) için Çizelge-8 değerinden 0,5 m azaltılmıştır.', kx, tb - 4.5, 2.2, {});
  }

  const BHPHavai = { SIL, KISA_AD, kisaListe, binaDetay, krokiOzet, direkDetay, kapsam, primCiz, kutuyaCiz, direkListesi, ikinciSayfa, malzemeOner, notlarOner };
  if (typeof module !== 'undefined' && module.exports) module.exports = BHPHavai;
  kok.BHPHavai = BHPHavai;
})(typeof window !== 'undefined' ? window : globalThis);
