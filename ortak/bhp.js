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
    const ust = (sayfalar[0] || []).map(o => temiz(o.s)).find(t => /^\d{2}\.\d{2}\.\d{4}\s*\//.test(t));
    if (ust) { v.tarih = ust.slice(0, 10); v.sayi = temiz(ust.split('/').slice(1).join('/')); }
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
    v.yapiSinifi = altindaki(ogeler, /^SINIFI$/, 30);
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

  // ---------- Güç dağıtım tablosu: PDF'teki gerçek yazılardan (resimden değil) sütun sütun okunur ----------
  // Başlık "GÜÇ DAĞITIM/DAĞILIM TABLOSU" bulunur; altındaki sütun başlıklarının ortası sütun yerini verir;
  // satırlar yazıların yüksekliğine göre gruplanır, "TOPLAM" satırında durulur. Tablo yoksa null döner.
  function gucTablosuOku(ogeler) {
    const T = o => buyuk(o.s), ort = o => o.x + (o.w || 0) / 2;   // büyük harfle karşılaştırılır (ı/i farkı)
    const bas = ogeler.filter(o => /G[ÜU]Ç\s*DA[ĞG]I[LT]IM/i.test(T(o)));
    for (const b of bas) {
      const alt = ogeler.filter(o => o.y > b.y + 0.5 && o.y < b.y + 45);
      const bul = re => alt.filter(o => re.test(T(o))).sort((p, q) => p.y - q.y)[0];
      const kol = { bb: bul(/BA[ĞG]IMSIZ/i), tablo: bul(/ENERJ[İI]|ALDI[ĞG]I/i), kurulu: bul(/KURULU/i), sayac: bul(/SAYA[ÇC]/i), kullanim: bul(/KULLANIM/i), tesis: bul(/TES[İI]S/i) };
      if (!kol.kurulu) continue;
      kol.baglanti = alt.filter(o => /BA[ĞG]LANTI/i.test(T(o)) && ort(o) > ort(kol.kurulu) + 2).sort((p, q) => ort(p) - ort(q))[0];
      const ad = Object.keys(kol).filter(k => kol[k]);
      if (ad.length < 4) continue;
      const merk = ad.map(k => [k, ort(kol[k])]).sort((p, q) => p[1] - q[1]);
      const sinir = merk.map((m, i) => i ? (merk[i - 1][1] + m[1]) / 2 : m[1] - (merk[1][1] - m[1]) / 2);
      sinir.push(merk[merk.length - 1][1] + (merk[merk.length - 1][1] - merk[merk.length - 2][1]) / 2);
      const kW = alt.some(o => /\(\s*kW\s*\)/i.test(T(o)) && Math.abs(ort(o) - ort(kol.kurulu)) < 25);
      const ust = Math.max(...ad.map(k => kol[k].y)) + 1.5;
      const veri = ogeler.filter(o => o.y > ust && o.y < ust + 400 && ort(o) > sinir[0] && ort(o) < sinir[sinir.length - 1]).sort((p, q) => p.y - q.y);
      const gruplar = [];
      for (const o of veri) {
        const g = gruplar[gruplar.length - 1];
        if (g && Math.abs(o.y - g.y) < 2.2) g.l.push(o); else gruplar.push({ y: o.y, l: [o] });
      }
      const satirlar = [];
      for (const g of gruplar) {
        const metin = g.l.map(T).join(' ');
        if (/TOPLAM|D[İI]VERS|E[ŞS]\s*ZAMAN|BG.?LER/i.test(metin)) break;
        const r = { bb: '', tablo: '', kurulu: '', baglanti: '', sayac: '', kullanim: '', tesis: '', onu: '' };
        for (const o of g.l.sort((p, q) => p.x - q.x)) {
          const c = ort(o); let i = sinir.findIndex((x, j) => j < sinir.length - 1 && c >= x && c < sinir[j + 1]);
          if (i < 0) continue;
          const k = merk[i][0]; r[k] = temiz(r[k] + ' ' + temiz(o.s));
        }
        if (!/\d/.test(r.kurulu)) { if (satirlar.length) break; else continue; }
        for (const k of ['kurulu', 'baglanti']) {
          let n = sayi(r[k]);
          if (kW && n < 1000) n = Math.round(n * 1000);
          if (!isNaN(n)) r[k] = String(Math.round(n));
        }
        r.sayac = (r.sayac || '3FAZ').replace(/\s+/g, '');
        satirlar.push(r);
      }
      if (satirlar.length) return satirlar;
    }
    return null;
  }
  // Bağımsız bölüm adedi antette "14+1" gibi yazılır
  function bbSayisi(t) { const p = String(t || '').match(/\d+/g); return p ? p.reduce((a, b) => a + +b, 0) : 0; }
  // Güç dağıtım tablosu kontrolü: hata varsa proje indirilmez
  function gucKontrol(b) {
    const hata = [], uyari = [], r = b.satirlar || [];
    if (!r.length) return { hata: ['güç dağıtım tablosu boş'], uyari };
    const bos = r.filter(x => !(parseFloat(x.kurulu) > 0) || !(parseFloat(x.baglanti) > 0)).map(x => x.bb || x.tablo || '?');
    if (bos.length) hata.push(`kurulu / bağlantı gücü eksik satır: ${bos.slice(0, 6).join(', ')}${bos.length > 6 ? '…' : ''}`);
    const ters = r.filter(x => parseFloat(x.baglanti) > parseFloat(x.kurulu)).map(x => x.bb || x.tablo);
    if (ters.length) hata.push(`bağlantı gücü kurulu güçten büyük: ${ters.join(', ')}`);
    const tk = r.reduce((t, x) => t + (parseFloat(x.kurulu) || 0), 0);
    if (b.kuruluW > 0 && Math.abs(tk - b.kuruluW) > 1) hata.push(`tablodaki kurulu güç toplamı ${tk} W, antette ${b.kuruluW} W`);
    const n = bbSayisi(b.bagimsiz);
    if (n > 1 && n !== r.length) hata.push(`tabloda ${r.length} satır var, antette bağımsız bölüm ${b.bagimsiz} (${n})`);
    const tb = r.reduce((t, x) => t + (parseFloat(x.baglanti) || 0), 0);
    if (b.talepW > 0 && tb + 1 < b.talepW) uyari.push(`satırların bağlantı gücü toplamı (${tb} W) talep gücünden (${b.talepW} W) küçük`);
    return { hata, uyari };
  }

  // ---------- Kablo seçimi ve hesap (kullanıcının yöntemi) ----------
  // Katsayılar kullanıcının yöntemi: c = 100/(κ·U²) trifaze 380 V, 200/(κ·U²) monofaze 220 V; κ Cu 56, Al 35
  const C = { 3: { cu: 0.0000124, al: 0.0000198 }, 1: { cu: 0.000074, al: 0.000118 } };
  const BOLEN = { 3: 527, 1: 176 };                  // √3·380·0,8 ve 220·0,8 (cos φ 0,8)
  function kablolar(iletken, faz = 3) {
    const tur = iletken === 'al' ? 'NAYY' : 'NYY';
    const liste = [];
    for (const t of KATALOG.filter(t => t.kablo === tur)) {
      for (const r of t.satirlar) {
        const ad = r[0].replace(/\s*(rm|re|sm|se)\b/gi, '').replace(/\s+/g, '').replace(/(\d)(rm|re)\//i, '$1/');
        const m = ad.match(/^(\d)x(\d+(?:[.,]\d+)?)(?:\/(\d+(?:[.,]\d+)?))?$/);
        if (!m) continue;
        const damar = +m[1], kesit = parseFloat(m[2].replace(',', '.')), notr = m[3];   // 1.5 → 1,5 mm² (sayi() noktayı binlik sayar)
        const iz = sayi(r[t.akimSutun]);
        if (isNaN(iz)) continue;
        // kullanıcının kuralı: trifazede 16 mm²'ye kadar 4 damarlı, üstünde nötrü küçültülmüş 3x../..;
        // monofazede 3 damarlı (faz + nötr + koruma)
        const uygunTip = faz === 1 ? (damar === 3 && !notr) : ((damar === 4 && !notr && kesit <= 16) || (damar === 3 && notr && kesit > 16));
        const adV = ad.replace(/\./g, ',');
        if (uygunTip) liste.push({ ad: adV, kesit, iz, tur, iletken, faz, yazi: `${adV} mm² ${tur}` });
      }
    }
    return liste.sort((a, b) => a.kesit - b.kesit);
  }
  function hesap(k, N, L) {
    const faz = k.faz || 3, c = C[faz][k.iletken];
    const e = c * N * L / k.kesit, I = N / BOLEN[faz];
    return { c, e, I, uygun: e <= 1.5 && I <= k.iz, eUygun: e <= 1.5, iUygun: I <= k.iz };
  }
  function kabloOner(iletken, N, L, enKucuk, faz = 3) {
    const l = kablolar(iletken, faz);
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
      ? [{ bb: '1', tablo: 'AT', kurulu: String(kuruluW), baglanti: String(talepW), sayac: '3FAZ', kullanim: gucKullanim, tesis: '', onu: '' }]
      : Array.from({ length: bbSayi }, (_, k) => ({ bb: String(k + 1), tablo: `D${k + 1}`, kurulu: '', baglanti: '', sayac: '3FAZ', kullanim: gucKullanim, tesis: '', onu: '' }));
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
      kuruluW, talepW, faz: 3, tarih: g.tarih || '', sayi: g.sayi || '',
      yapiSinifi: (i.yapiSinifi && i.yapiSinifi !== '-') ? i.yapiSinifi : '-',
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

  // ---------- Sayaç grupları: aynı sayaç önü sigortası ve sayaç tipi olan bağımsız bölümler ----------
  function sayacGruplari(b) {
    const g = [];
    for (const r of b.satirlar || []) {
      const onu = temiz(r.onu || ''), tip = b.sayac || '3x10';
      let x = g.find(q => q.onu === onu && q.tip === tip);
      if (!x) g.push(x = { onu, tip, adet: 0, adlar: [] });
      x.adet++; x.adlar.push(temiz(r.tablo || r.bb || ''));
    }
    for (const x of g) x.ad = x.adlar.length > 2 ? `${x.adlar[0]}…${x.adlar[x.adlar.length - 1]}` : x.adlar.join(', ');
    return g;
  }
  // Çok bağımsız bölümlü projede her satırın sayaç önü sigortası girilmiş olmalı
  function sayacOnuEksik(b) { return (b.satirlar || []).length > 1 && (b.satirlar || []).some(r => !temiz(r.onu || '')); }

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
    for (const g of sayacGruplari(b)) if (g.onu) r.push({ ad: `Sayaç önü sigorta ${g.onu}`, birim: 'adet', miktar: g.adet });
    const AD = { sigorta: 'Sigorta', kar: 'Kaçak akım rölesi', tms: 'TMŞ', tmsyks: 'TMŞ + YKŞ' };
    for (const k of b.korumalar || []) if (k.tur) r.push({ ad: `${AD[k.tur]} ${k.deger}`.trim(), birim: 'adet', miktar: 1 });
    return r;
  }

  // ---------- Genel notlar (kaynaklar: kullanıcının kablo kanalı detayı ve şartname metni, GDZ bağlantı görüşü eki) ----------
  function notlarOner(b) {
    const box = b.baglanti === 'box';
    const n = [
      `Proje, GDZ Elektrik Dağıtım A.Ş.'nin ${b.tarih ? b.tarih + ' tarih ve ' : ''}${b.basvuruNo || '...'} sayılı bağlantı görüşüne göre hazırlanmıştır. Enerji, ${b.direk || '...'} ${box ? 'AG box çıkışından' : 'AG direğinden'} alınacaktır.`,
      'Kablo kanalı, kablo kanalı detayına ve paftadaki "Enerji Kabloları Uygulama Usul ve Esasları"na uygun açılacak; kablo altına ve üstüne 10\'ar cm kum, üzerine koruma tuğlası, tuğlanın 20 cm üzerine ikaz şeridi serilecektir.',
      'Demiryolu, su kanalı ve karayolu geçişlerinde muhafaza borusunun üstü en az 1,5 m derinlikte; taşıt geçen diğer yollarda kanal derinliği 1 m olacak, enine geçişler borulu yapılacaktır.',
      box ? 'Box girişinde ve yapı girişlerinde kablo koruma borusu içine alınacak; yeraltı şebekesinde "Cam Elyaf Takviyeli Polyester - Tip B" saha dağıtım kutusu kullanılacaktır.'
        : 'Direkten iniş ve yeraltı geçişlerinde galvanizli çelik boru kullanılacak, kablolar tek boru içinden geçirilecek; direk tarafında kablo başlığı yapılacaktır.',
      'GEREKLİ GEÇİŞ İZİNLERİ ALINMADAN KABLO ÇEKİLMEYECEKTİR. Kazıda karşılaşılan altyapı unsurlarından mevzuattaki mesafeler kadar uzaklaşılacaktır.',
      'Sayaç panosu TEDAŞ şartnamesine uygun ve mühürlenebilir olacak; her sayacın önünde tek hat şemasında gösterilen sayaç önü sigortası bulunacaktır.',
      'Topraklama değerleri yetkili elektrik mühendisince ölçülüp kabul öncesi Kabul Heyetine imzalı iki nüsha verilecek; tesisin muayenesi GDZ Bölge Müdürlüğünce yapılacaktır.',
      'Malzemeler TSE belgeli ve TEDAŞ şartnamelerine uygun olacak; iş güvenliği sorumluluğu talepliye aittir. Tesis ilgili kanun, yönetmelik ve TEDAŞ şartnamelerine uygun yapılacaktır.',
    ];
    if (b.kaziIzni === 'Yok') n.splice(5, 0, 'GDZ bağlantı görüşüne göre kazı izni bulunmamaktadır; kazıya başlanmadan önce kazı izni alınacaktır.');
    return n;
  }

  // ---------- Çizim verisi (ortak/bhp-cizim.js için) ----------
  function cizimVerisi(b, kablo, malzeme, notlar) {
    const N = b.talepW, L = b.uzunluk, faz = kablo.faz || 3;
    return {
      baglanti: b.baglanti, kaynakAd: b.direk, kablo, L, Ldis: b.Ldis, Lic: b.Lic, N, h: hesap(kablo, N, L), faz, bolen: BOLEN[faz],
      korumalar: (b.korumalar || []).filter(k => k.tur),
      sayacAdet: b.sayacAdet || 1, sayacTip: b.sayac, sayacTur: b.reaktif ? 'Aktif-Reaktif (kombi)' : 'Aktif',
      satirlar: b.satirlar, kuruluToplam: b.satirlar.reduce((t, s) => t + (parseFloat(s.kurulu) || 0), 0) || b.kuruluW,
      malzeme: malzeme || malzemeOner(b, kablo), notlar: notlar || notlarOner(b), gruplar: sayacGruplari(b),
      ada: b.ada, parsel: b.parsel, vaziyet: b.vaziyet || null,
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
      ADAPARSEL: `${b.ada}/${b.parsel}`, YAPISINIFI: b.yapiSinifi || '-',
      TARIH: b.projeTarihi || new Date().toLocaleDateString('tr-TR'), BASVURU: b.basvuruNo || '',
      UYDU: '.\\' + uyduDosya, VAZIYET: '.\\' + vaziyetDosya,
    };
  }
  function doldur(sablon, d) {
    return sablon.replace(/\{\{([A-Z_0-9]+)\}\}/g, (a, k) => temiz(d[k] === undefined ? '' : d[k]));
  }

  const BHP = { gdzOku, uyduSayfasi, icTesisatOku, gucTablosuOku, gucKontrol, bbSayisi, kablolar, hesap, kabloOner, birlestir, malzemeOner, notlarOner, sayacGruplari, sayacOnuEksik, cizimVerisi, degerler, doldur,
    virgul, baslikHarf, RESIM: { uydu: [2000, 1083], vaziyet: [2000, 1083] } };
  if (typeof module !== 'undefined' && module.exports) module.exports = BHP; else kok.BHP = BHP;
})(typeof window !== 'undefined' ? window : globalThis);
