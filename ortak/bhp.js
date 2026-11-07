// Bağlantı hattı projesi (BHP): GDZ bağlantı görüşü ve iç tesisat PDF'lerinden bilgi okuma,
// kablo seçimi, gerilim düşümü / akım hesabı ve AutoCAD şablonunu (DXF) doldurma.
// Hem tarayıcıda (window.BHP) hem Node'da (require) çalışır. PDF okuma işini çağıran yapar;
// buraya her sayfa için {s, x, y} listesi gelir (x sağa, y aşağı doğru artar, eğik yazılar hariç).
(function (kok) {
  // tarayıcıda veri/katalog.js önce yüklenir (genel KATALOG sabiti); Node'da require ile alınır
  const KATALOG = (typeof globalThis.KATALOG !== 'undefined' && globalThis.KATALOG)
    || (typeof require !== 'undefined' ? require('../veri/katalog.js') : (0, eval)('KATALOG'));

  const temiz = s => String(s || '').replace(/\s+/g, ' ').trim();
  const sayi = s => { const m = String(s || '').replace(/\./g, '').replace(',', '.').match(/-?\d+(\.\d+)?/); return m ? parseFloat(m[0]) : NaN; };
  const virgul = (n, b) => n.toFixed(b).replace('.', ',');
  const buyuk = s => temiz(s).toLocaleUpperCase('tr-TR');
  const baslikHarf = s => temiz(s).toLocaleLowerCase('tr-TR').replace(/(^|[\s\/(-])(\S)/g, (a, b, c) => b + c.toLocaleUpperCase('tr-TR'));

  // Bir etiketin sağındaki (aynı satırdaki) yazılar
  function sagindaki(ogeler, etiket, enAz = 60, tol = 4) {
    const l = ogeler.find(o => etiket.test(temiz(o.s)));
    if (!l) return '';
    return temiz(ogeler.filter(o => o !== l && Math.abs(o.y - l.y) <= tol && o.x > l.x + enAz)
      .sort((a, b) => a.x - b.x).map(o => o.s).join(' '));
  }
  // Bir etiketin altındaki ilk yazı (tablo başlığı altındaki değer)
  const ETIKET_SOZ = /^(ADEDİ|BÖLÜM|ALANI|İNŞAAT|SINIFI|TOPLAM|BAĞIMSIZ|KAT|YAPI|GÜCÜ|GÜÇ BİLGİLERİ.*)$/;
  function altindaki(ogeler, etiket, enCok = 45, yatay = 30) {
    const ler = ogeler.filter(o => etiket.test(temiz(o.s)));
    for (const l of ler) {
      const a = ogeler.filter(o => o !== l && o.y > l.y + 3 && o.y < l.y + enCok && Math.abs(o.x - l.x) < yatay && !ETIKET_SOZ.test(temiz(o.s)))
        .sort((p, q) => (p.y - q.y) || (Math.abs(p.x - l.x) - Math.abs(q.x - l.x)));
      if (a.length) return temiz(a[0].s);
    }
    return '';
  }

  // ---------- GDZ bağlantı görüşü ----------
  function gdzOku(sayfalar) {
    const tum = sayfalar.flat();
    const bul = (re, enAz) => { for (const s of sayfalar) { const v = sagindaki(s, re, enAz); if (v) return v; } return ''; };
    const v = {};
    v.basvuruNo = bul(/^Başvuru Numarası/);
    v.sahibi = bul(/^Başvuru Sahibi/);
    v.adres = bul(/^Güç İstenen Yerin Adresi/);
    const ap = bul(/^Güç İstenen Yeri Ada\s*\/\s*Parsel/).split('/').map(temiz);
    v.ada = ap[0] || ''; v.parsel = ap[1] || '';
    v.kullanim = bul(/^Kullanım Amacı/);
    v.kuruluKW = sayi(bul(/^Kurulu Güç \(kW\)/));
    v.talepKW = sayi(bul(/^Talep Edilen Güç \(kW\)/));
    v.bagimsiz = bul(/^Bağımsız Bölüm Sayısı/);
    v.kaziIzni = bul(/^Kazı İz(in|ni) Durumu/);
    v.baglantiSekli = bul(/^Bağlantı Şekli/);
    // Enerji alınacak şebeke noktası: etiketin altındaki satır
    for (const s of sayfalar) {
      const l = s.find(o => /^Enerji Alınacak Şebeke Noktası/.test(temiz(o.s)));
      if (!l) continue;
      const a = s.filter(o => o.y > l.y + 2 && o.y < l.y + 25 && Math.abs(o.x - l.x) < 40).sort((p, q) => p.y - q.y);
      if (a.length) { v.direk = temiz(a[0].s); break; }
    }
    // Bağlantı hattı bilgileri tablosu: "AG | yapı adı | hat tipi | güç | sınıra kadar | parsel içi | toplam"
    for (const s of sayfalar) {
      for (const ag of s.filter(o => temiz(o.s) === 'AG')) {
        const satir = s.filter(o => o !== ag && Math.abs(o.y - ag.y) <= 4 && o.x > ag.x).sort((a, b) => a.x - b.x).map(o => temiz(o.s));
        const ti = satir.findIndex(t => /^(Yer\s*altı|Yeraltı|Havai)/i.test(t));
        if (ti < 0) continue;
        const sayilar = satir.slice(ti + 1).map(sayi).filter(n => !isNaN(n));
        v.hatTipi = /havai/i.test(satir[ti]) ? 'HAVAI' : 'YERALTI';
        if (sayilar.length >= 4) { v.sinira = sayilar[1]; v.parselIci = sayilar[2]; v.uzunluk = sayilar[3]; }
        break;
      }
      if (v.hatTipi) break;
    }
    if (!v.hatTipi) { // eski düzen: "Bağlantı Hattı  Yer Altı: 10"
      const t = bul(/^Bağlantı Hattı$/);
      if (t) { v.hatTipi = /havai/i.test(t) ? 'HAVAI' : 'YERALTI'; v.uzunluk = sayi(t.split(':')[1]); }
    }
    v.geciciTesis = tum.some(o => /Geçici Tesis/i.test(o.s));
    return v;
  }

  // GDZ'nin uydu görüntüsünün olduğu sayfa: yazısı çok az olan sayfa (1. sayfa hariç)
  function uyduSayfasi(sayfalar) {
    let en = -1, az = 1e9;
    sayfalar.forEach((s, i) => { if (i > 0 && s.length < az) { az = s.length; en = i; } });
    return az <= 5 ? en : -1;
  }

  // ---------- İç tesisat projesi (kullanıcının kendi antet düzeni) ----------
  function icTesisatOku(ogeler) {
    const v = {};
    v.malSahibi = sagindaki(ogeler, /^MAL SAHİBİ$/);
    v.kullanim = sagindaki(ogeler, /^KULLANIM AMACI$/);
    // iki "ADRES" var (müellif ve yapı): yapının adresi "MAL SAHİBİ" satırına en yakın olanı
    const ms = ogeler.find(o => /^MAL SAHİBİ$/.test(temiz(o.s)));
    const adresler = ogeler.filter(o => temiz(o.s) === 'ADRES');
    if (ms && adresler.length) {
      const a = adresler.sort((p, q) => Math.abs(p.y - ms.y) - Math.abs(q.y - ms.y))[0];
      v.adres = temiz(ogeler.filter(o => o !== a && Math.abs(o.y - a.y) <= 4 && o.x > a.x + 40).sort((p, q) => p.x - q.x).map(o => o.s).join(' '));
    }
    v.il = altindaki(ogeler, /^İL$/);
    v.ilce = altindaki(ogeler, /^İLÇE$/);
    v.belediye = altindaki(ogeler, /^BELEDİYE$/);
    v.mahalle = altindaki(ogeler, /^MAHALLE$/);
    v.pafta = altindaki(ogeler, /^PAFTA$/);
    v.ada = altindaki(ogeler, /^ADA$/);
    v.parsel = altindaki(ogeler, /^PARSEL$/);
    v.kuruluW = sayi(altindaki(ogeler, /^KURULU GÜÇ$/));
    v.talepW = sayi(altindaki(ogeler, /^TALEP GÜ(Ç|CÜ)$/));
    v.kat = altindaki(ogeler, /^KAT$/, 45);
    v.alan = altindaki(ogeler, /^TOPLAM$/, 45);
    v.bagimsiz = altindaki(ogeler, /^BAĞIMSIZ$/, 45);
    // Sayaç bölmesi: önce 100 mA ve üstü kaçak akım rölesi, ona en yakın "4x40A" röle akımı,
    // röleye en yakın diğer "4x..A" ana sigorta, sigortaya en yakın "..kA" kesme gücü.
    const uz = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
    const akimlar = ogeler.filter(o => /^\d\s*[xX*]\s*\d+\s*A$/.test(temiz(o.s)));
    const ma = ogeler.filter(o => /^\d+\s*mA$/i.test(temiz(o.s)) && sayi(o.s) >= 100);
    const ka = ogeler.filter(o => /^\d+\s*kA$/i.test(temiz(o.s)));
    const yaz = o => temiz(o.s).replace(/\s+/g, '').replace(/[X*]/, 'x');
    if (ma.length) {
      const m0 = ma.sort((a, b) => a.y - b.y)[0];
      v.karMA = yaz(m0);
      const kar = akimlar.slice().sort((a, b) => uz(a, m0) - uz(b, m0))[0];
      if (kar) {
        v.karA = yaz(kar);
        const sig = akimlar.filter(o => o !== kar).sort((a, b) => uz(a, kar) - uz(b, kar))[0];
        if (sig) {
          v.sigortaA = yaz(sig);
          const k = ka.slice().sort((a, b) => uz(a, sig) - uz(b, sig))[0];
          if (k) v.sigortaKA = yaz(k);
        }
      }
    }
    v.reaktif = ogeler.some(o => /kVArh/i.test(o.s));
    const sy = ogeler.map(o => temiz(o.s)).find(t => /^3\s*[xX*]\s*\d+(\s*\(\d+\))?\s*A?$/.test(t));
    if (sy) v.sayac = sy.replace(/\s+/g, '').replace(/[X*]/, 'x').replace(/A$/, '');
    return v;
  }

  // ---------- Kablo seçimi ve hesap (kullanıcının yöntemi) ----------
  const C = { cu: 0.0000124, al: 0.0000198 };       // 3 fazlı, 380 V; κ Cu 56, Al 35
  const BOLEN = 527;                                 // √3 · 380 · 0,8 (kullanıcının projesindeki değer)
  function kablolar(iletken) {
    const tur = iletken === 'al' ? 'NAYY' : 'NYY';
    const liste = [];
    for (const t of KATALOG.filter(t => t.kablo === tur)) {
      for (const r of t.satirlar) {
        const ad = r[0].replace(/\s*(rm|re|sm|se)\b/gi, '').replace(/\s+/g, '');
        const m = ad.match(/^(\d)x(\d+(?:[.,]\d+)?)(?:\/(\d+(?:[.,]\d+)?))?$/);
        if (!m) continue;
        const damar = +m[1], kesit = sayi(m[2]), notr = m[3];
        const iz = sayi(r[t.akimSutun]);
        if (isNaN(iz)) continue;
        // kullanıcının kuralı: 16 mm²'ye kadar 4 damarlı, üstünde nötrü küçültülmüş 3x../..
        if ((damar === 4 && !notr && kesit <= 16) || (damar === 3 && notr && kesit > 16)) {
          liste.push({ ad, kesit, iz, tur, iletken, yazi: `${ad} mm² ${tur}` });
        }
      }
    }
    return liste.sort((a, b) => a.kesit - b.kesit);
  }
  function hesap(k, N, L) {
    const c = C[k.iletken];
    const e = c * N * L / k.kesit, I = N / BOLEN;
    return { c, e, I, uygun: e <= 1.5 && I <= k.iz, eUygun: e <= 1.5, iUygun: I <= k.iz };
  }
  function kabloOner(iletken, N, L, enKucuk) {
    const l = kablolar(iletken);
    return l.find(k => k.kesit >= (enKucuk || 0) && hesap(k, N, L).uygun) || l[l.length - 1];
  }

  // ---------- Bilgileri birleştir ----------
  function birlestir(g, i) {
    const ilk = (...a) => a.find(x => x !== undefined && x !== null && x !== '' && !(typeof x === 'number' && isNaN(x)));
    const adresParca = temiz(g.adres).split('/').map(temiz); // sokak/mahalle/ilçe/il
    const kullanim = buyuk(ilk(i.kullanim, g.kullanim) || '');
    const alanS = temiz(i.alan || '');
    const kuruluW = Math.round(ilk(i.kuruluW, g.kuruluKW * 1000) || 0), talepW = Math.round(ilk(i.talepW, g.talepKW * 1000) || 0);
    const bbSayi = parseInt(ilk(g.bagimsiz, (i.bagimsiz || '').replace(/\D+/g, '')) || '1', 10) || 1;
    const gucKullanim = /MESKEN|KONUT/.test(kullanim) ? 'KONUT' : kullanim;
    const sayac = i.sayac || '3x10';
    const satirlar = bbSayi === 1
      ? [{ bb: '1', tablo: 'AT', kurulu: String(kuruluW), baglanti: String(talepW), sayac: '3FAZ', kullanim: gucKullanim, tesis: '' }]
      : Array.from({ length: bbSayi }, (_, k) => ({ bb: String(k + 1), tablo: `D${k + 1}`, kurulu: '', baglanti: '', sayac: '3FAZ', kullanim: gucKullanim, tesis: '' }));
    return {
      basvuruNo: g.basvuruNo || '',
      malSahibi: buyuk(ilk(i.malSahibi, g.sahibi) || ''),
      kullanim,
      adres: ilk(i.adres, buyuk(g.adres)) || '',
      il: buyuk(ilk(i.il, adresParca[3]) || ''),
      ilce: buyuk(ilk(i.ilce, adresParca[2]) || ''),
      belediye: buyuk(ilk(i.belediye, i.ilce, adresParca[2]) || ''),
      mahalle: buyuk(ilk(i.mahalle, adresParca[1]) || ''),
      pafta: ilk(i.pafta) || '-',
      ada: ilk(i.ada, g.ada) || '',
      parsel: ilk(i.parsel, g.parsel) || '',
      kuruluW, talepW,
      bagimsiz: String(bbSayi),
      kat: i.kat || '-',
      alan: /\d/.test(alanS) ? alanS.replace(/\s*m²?$/, '') : '-',
      direk: buyuk(g.direk || ''),
      baglanti: /box/i.test(g.baglantiSekli || '') ? 'box' : 'direk',
      uzunluk: g.uzunluk || 0, Ldis: g.sinira != null ? g.sinira : (g.uzunluk || 0), Lic: g.parselIci || 0,
      hatTipiGdz: g.hatTipi || '',
      korumalar: bbSayi === 1
        ? [{ tur: 'sigorta', deger: `${i.sigortaA || '4x40A'} ${i.sigortaKA || '10kA'}` }, { tur: 'kar', deger: `${i.karA || '4x40A'} ${i.karMA || '300mA'}` }]
        : [{ tur: 'tmsyks', deger: '' }],
      sayac, sayacAdet: bbSayi, reaktif: !!i.reaktif,
      satirlar,
    };
  }

  // ---------- Malzeme listesi önerisi (kullanıcı düzeltebilir) ----------
  function malzemeOner(b, kablo) {
    const L = Math.ceil(b.uzunluk || 0), direk = b.baglanti !== 'box';
    const r = [
      { ad: `${kablo.yazi} yeraltı kablosu`, birim: 'm', miktar: L },
      { ad: 'Kablo kanalı kazısı ve dolgusu (40x100 cm)', birim: 'm', miktar: L },
      { ad: 'Kablo altı ve üstü elenmiş kum', birim: 'm', miktar: L },
      { ad: 'Koruma tuğlası', birim: 'adet', miktar: 4 * L },
      { ad: 'Plastik ikaz şeridi', birim: 'm', miktar: L },
    ];
    if (direk) {
      r.push({ ad: 'AG kablo başlığı (dış tip)', birim: 'adet', miktar: 1 });
      r.push({ ad: 'Galvanizli çelik koruma borusu (direk inişi, 3 m)', birim: 'adet', miktar: 1 });
    }
    r.push({ ad: 'Galvaniz topraklama kazığı 65x65x7 mm, L=2 m', birim: 'adet', miktar: direk ? 1 : 2 });
    r.push({ ad: '1x16 mm² NYY topraklama iletkeni', birim: 'm', miktar: direk ? 3 : 6 });
    r.push({ ad: 'Sayaç panosu (TEDAŞ şartnamesine uygun)', birim: 'adet', miktar: 1 });
    r.push({ ad: `Elektronik sayaç ${b.sayac}A`, birim: 'adet', miktar: b.sayacAdet || 1 });
    const AD = { sigorta: 'Sigorta', kar: 'Kaçak akım rölesi', tms: 'TMŞ', tmsyks: 'TMŞ + YKŞ' };
    for (const k of b.korumalar || []) if (k.tur) r.push({ ad: `${AD[k.tur]} ${k.deger}`.trim(), birim: 'adet', miktar: 1 });
    return r;
  }

  // ---------- Çizim verisi (ortak/bhp-cizim.js için) ----------
  function cizimVerisi(b, kablo, malzeme) {
    const N = b.talepW, L = b.uzunluk;
    return {
      baglanti: b.baglanti, kaynakAd: b.direk, kablo, L, Ldis: b.Ldis, Lic: b.Lic, N, h: hesap(kablo, N, L),
      korumalar: (b.korumalar || []).filter(k => k.tur),
      sayacAdet: b.sayacAdet || 1, sayacTip: b.sayac, sayacTur: b.reaktif ? 'Aktif-Reaktif (kombi)' : 'Aktif',
      satirlar: b.satirlar, kuruluToplam: b.satirlar.reduce((t, s) => t + (parseFloat(s.kurulu) || 0), 0) || b.kuruluW,
      malzeme: malzeme || malzemeOner(b, kablo),
    };
  }

  // ---------- Şablondaki yazılar ----------
  function degerler(b, kablo, uyduDosya, vaziyetDosya) {
    const L = b.uzunluk;
    return {
      MALSAHIBI: b.malSahibi, KULLANIM: b.kullanim, ADRES: b.adres, IL: b.il, ILCE: b.ilce, BELEDIYE: b.belediye,
      MAHALLE: b.mahalle, PAFTA: b.pafta, ADA: b.ada, PARSEL: b.parsel,
      KURULU: `${b.kuruluW} W`, TALEP: `${b.talepW} W`, BB: b.bagimsiz, KAT: b.kat, ALAN: b.alan === '-' ? '-' : `${b.alan} m²`,
      KABLO: kablo.yazi, UZUNLUK: `${String(L).replace('.', ',')} m`, HATTIPI: 'YERALTI', DIREK: b.direk,
      ADAPARSEL: `${b.ada}/${b.parsel}`,
      UYDU: '.\\' + uyduDosya, VAZIYET: '.\\' + vaziyetDosya,
    };
  }
  function doldur(sablon, d) {
    return sablon.replace(/\{\{([A-Z_0-9]+)\}\}/g, (a, k) => temiz(d[k] === undefined ? '' : d[k]));
  }

  const BHP = { gdzOku, uyduSayfasi, icTesisatOku, kablolar, hesap, kabloOner, birlestir, malzemeOner, cizimVerisi, degerler, doldur,
    virgul, baslikHarf, RESIM: { uydu: [2000, 1087], vaziyet: [2000, 1056] } };
  if (typeof module !== 'undefined' && module.exports) module.exports = BHP; else kok.BHP = BHP;
})(typeof window !== 'undefined' ? window : globalThis);
