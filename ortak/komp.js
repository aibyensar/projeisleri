// Reaktif güç kompanzasyonu hesapları (AG, 400 V). Kaynaklar ve sayıların dayanağı: kompanzasyon/ARASTIRMA.md
// Tarayıcıda window.KOMP, Node'da module.exports.
(function (kok) {
  'use strict';
  const K3 = Math.sqrt(3);
  const tan = c => Math.tan(Math.acos(Math.min(1, Math.max(0.05, c))));
  const cosDan = t => Math.cos(Math.atan(t));
  const ustDeger = (liste, x) => liste.find(v => v >= x - 1e-9) ?? null;     // listeden x'e eşit ya da büyük ilk değer

  // ---------- Standart değerler ----------
  const KADEME_KVAR = [2.5, 5, 7.5, 10, 12.5, 15, 20, 25, 30, 40, 50, 60, 75, 100];   // piyasada bulunan kademe güçleri
  const KADEME_EN_BUYUK = 50;                                                       // tek kademe (bir kontaktör) üst sınırı
  const REAKTOR_KVAR = [0.5, 1, 1.5, 2, 2.5, 3, 4, 5, 7.5, 10, 15, 20, 25, 30, 40, 50];          // şönt reaktör
  const KONTAKTOR_KVAR = [12.5, 16.7, 20, 25, 33.3, 40, 50, 60, 80, 100];                        // kompanzasyon kontaktörü, 400 V
  const SIGORTA_A = [2, 4, 6, 10, 16, 20, 25, 32, 35, 40, 50, 63, 80, 100, 125, 160, 200, 250, 315, 400, 500, 630, 800, 1000, 1250];
  const AT_PRIMER = [50, 75, 100, 150, 200, 250, 300, 400, 500, 600, 750, 800, 1000, 1200, 1250, 1500, 1600, 2000, 2500, 3000, 4000];

  // ---------- EPDK reaktif sınırları (Usul ve Esaslar md. 13, RG 30.04.2022/31825) ----------
  function cezaSiniri(kuruluKVA) {
    return kuruluKVA >= 50 ? { enduktif: 0.20, kapasitif: 0.15, esik: '50 kVA ve üstü' } : { enduktif: 0.33, kapasitif: 0.20, esik: '50 kVA altı' };
  }
  // fatura: aktif kWh, endüktif kVArh, kapasitif kVArh → oranlar, ihlal, bedel (TL)
  function cezaKontrol({ kWh, indKVArh = 0, kapKVArh = 0, kuruluKVA, kuruluKW, muafTur = false, birimTL = 0 }) {
    const s = cezaSiniri(kuruluKVA || 0);
    const muaf = muafTur || (kuruluKW > 0 && kuruluKW <= 15);
    const ind = kWh > 0 ? indKVArh / kWh : 0, kap = kWh > 0 ? kapKVArh / kWh : 0;
    const indAsim = !muaf && ind > s.enduktif, kapAsim = !muaf && kap > s.kapasitif;
    // ikisi birden aşılırsa en yüksek kaydeden sayacın tamamı; tek aşımda o sayacın tamamı
    const faturalanan = indAsim && kapAsim ? Math.max(indKVArh, kapKVArh) : indAsim ? indKVArh : kapAsim ? kapKVArh : 0;
    return { sinir: s, muaf, ind, kap, indAsim, kapAsim, faturalanan, bedel: faturalanan * (birimTL || 0) };
  }

  // ---------- Kondansatör gücü ----------
  // Qc = P (tanφ1 − tanφ2)
  function gerekenQ(P, cos1, cos2) {
    const t1 = tan(cos1), t2 = tan(cos2);
    return { t1, t2, kvarKW: Math.max(0, t1 - t2), Qc: Math.max(0, P * (t1 - t2)) };
  }
  // faturadan: ortalama P ve tanφ1
  function faturadan({ kWh, indKVArh, saat }) {
    const P = saat > 0 ? kWh / saat : 0, t1 = kWh > 0 ? indKVArh / kWh : 0;
    return { P, t1, cos1: cosDan(t1), Qort: saat > 0 ? indKVArh / saat : 0 };
  }

  // ---------- Trafo boşta reaktif gücü (20 kV primerli dağıtım trafoları; boşta / tam yük kVAr) ----------
  const TRAFO = [[100, 2.5, 6.1], [160, 3.7, 9.6], [250, 5.3, 14.7], [315, 6.3, 18.4], [400, 7.6, 22.9], [500, 9.5, 28.7], [630, 11.3, 35.7],
    [800, 20, 54.5], [1000, 23.9, 72.4], [1250, 27.4, 94.5], [1600, 31.9, 126], [2000, 37.8, 176]];
  function trafoReaktif(Sn) {
    if (!(Sn > 0)) return null;
    const i = TRAFO.findIndex(r => r[0] >= Sn);
    let bos, tam;
    if (i === 0) { bos = TRAFO[0][1] * Sn / 100; tam = TRAFO[0][2] * Sn / 100; }
    else if (i < 0) { bos = Sn * 0.018; tam = TRAFO[TRAFO.length - 1][2] * Sn / 2000; }
    else { const a = TRAFO[i - 1], b = TRAFO[i], k = (Sn - a[0]) / (b[0] - a[0]); bos = a[1] + k * (b[1] - a[1]); tam = a[2] + k * (b[2] - a[2]); }
    // sabit kademe: boşta gücün altındaki en büyük standart değer (aşırı kompanzasyona düşmemek için aşağı yuvarlanır)
    const sabit = [...KADEME_KVAR].reverse().find(v => v <= bos + 1e-9) || 0;
    return { Sn, bos, tam, sabit, tabloda: TRAFO.some(r => r[0] === Sn) };
  }

  // ---------- Harmonik sınıfı (Gh / Sn basit kuralı, Sn ≤ 2 MVA) ----------
  function harmonikSinif(Gh, Sn, baskin = 5) {
    const oran = Sn > 0 ? Gh / Sn : 0;
    let sinif, ad, UN, p = 0;
    if (!(Gh > 0)) { sinif = 'standart'; ad = 'Standart kondansatör'; UN = 400; }
    else if (oran <= 0.10) { sinif = 'standart'; ad = 'Standart kondansatör'; UN = 400; }
    else if (oran <= 0.20) { sinif = 'agir'; ad = 'Ağır hizmet (heavy duty) kondansatör, %10 yüksek gerilimli'; UN = 440; }
    else if (oran <= 0.50) { sinif = 'reaktorlu'; p = baskin === 3 ? 0.14 : 0.07; ad = `Harmonik filtre reaktörlü (p = %${Math.round(p * 1000) / 10}) kademeler, 480 V kondansatör`; UN = 480; }
    else { sinif = 'filtre'; p = baskin === 3 ? 0.14 : 0.07; ad = 'Harmonik etüdü gerekli: aktif / pasif filtre (en az reaktörlü kademe)'; UN = 480; }
    const fr = p > 0 ? 50 / Math.sqrt(p) : null;
    // şalter uzun gecikme ayarı katsayısı (IMP/IN)
    const kKoruma = sinif === 'standart' ? 1.5 : sinif === 'agir' ? 1.8 : p === 0.14 ? 1.12 : p === 0.057 ? 1.31 : 1.19;
    return { oran, sinif, ad, UN, p, fr, kKoruma };
  }
  // reaktörlü / yüksek gerilimli kondansatörün etiket gücü ↔ şebekeye verdiği net güç
  const netGuc = (QN, UN, U = 400, p = 0) => QN * (U / UN) ** 2 / (1 - p);
  const etiketGuc = (Qnet, UN, U = 400, p = 0) => Qnet * (UN / U) ** 2 * (1 - p);

  // ---------- Kademe planı ----------
  const DUZENLER = {
    '1-1-1': { ad: 'Eşit (1-1-1-1…)', k: n => Array(n).fill(1) },
    '1-2-2': { ad: '1-2-2-2…', k: n => Array.from({ length: n }, (_, i) => i ? 2 : 1) },
    '1-1-2': { ad: '1-1-2-2…', k: n => Array.from({ length: n }, (_, i) => i < 2 ? 1 : 2) },
    '1-2-4': { ad: '1-2-4-4…', k: n => Array.from({ length: n }, (_, i) => [1, 2][i] || 4) },
    '1-2-4-8': { ad: '1-2-4-8 (ikili)', k: n => Array.from({ length: n }, (_, i) => [1, 2, 4][i] || 8) },
  };
  function kademeSayisiOner(Q) { return Q <= 40 ? 6 : Q <= 120 ? 8 : Q <= 300 ? 12 : Q <= 600 ? 15 : 18; }
  // otomatik kısım Qoto (kVAr, net) → kademeler. nMaks: rölenin kademe çıkışı; kullanılmayan çıkışlar yedek kalır.
  // Seçim: toplam ≥ Qoto; fazlalık en az; ilk kademe (çözünürlük) yükün en küçük hâline göre yeterince küçük.
  function kademePlani(Qoto, nMaks, duzen = '1-2-2', Pmin = 0) {
    if (!(Qoto > 0)) return { kademeler: [], toplam: 0, q1: 0, adim: 0, n: 0, nMaks: nMaks || 0, bos: nMaks || 0 };
    nMaks = Math.max(2, Math.round(nMaks || kademeSayisiOner(Qoto)));
    let yetersiz = false;
    if (Qoto > KADEME_EN_BUYUK * nMaks * 1.5) { duzen = '1-1-1'; yetersiz = true; }   // kademe sayısı yetmiyor: eşit büyük kademeler
    const D = DUZENLER[duzen] || DUZENLER['1-2-2'];
    const q1Sinir = Math.max(Pmin > 0 ? 0.25 * Pmin : 0, Qoto / 6);       // ilk kademe bundan büyük olmasın
    let en = null;
    for (const q1 of KADEME_KVAR) {
      if (q1 > q1Sinir + 1e-9 && en) break;
      for (let n = 2; n <= nMaks; n++) {
        const k = D.k(n), toplam = q1 * k.reduce((x, y) => x + y, 0);
        if (!yetersiz && Math.max(...k) * q1 > KADEME_EN_BUYUK + 1e-9) break;              // kademe çok büyük
        if (toplam < Qoto - 1e-9) continue;
        const puan = (toplam - Qoto) / Qoto + 0.004 * n + (q1 > q1Sinir + 1e-9 ? 1 : 0);
        if (!en || puan < en.puan - 1e-9) en = { puan, q1, n, k };
        break;                                                             // bu q1 için en az kademe yeterli
      }
    }
    if (!en) {                                                             // hiçbir standart değer yetmiyor: büyük kademe
      const k = D.k(nMaks), birim = k.reduce((x, y) => x + y, 0);
      const q = Qoto / birim; en = { q1: ustDeger(KADEME_KVAR, q) || Math.ceil(q / 25) * 25, n: nMaks, k };
    }
    const kademeler = en.k.map(m => +(m * en.q1).toFixed(2));
    const toplam = kademeler.reduce((x, y) => x + y, 0);
    const ul = new Set([0]); for (const m of en.k) for (const v of [...ul]) ul.add(v + m);
    return { kademeler, k: en.k, toplam, q1: en.q1, adim: ul.size - 1, n: en.n, nMaks, bos: nMaks - en.n, duzen, yetersiz };
  }

  // ---------- Kademe ekipmanı ----------
  // kondansatör bataryası besleme kablosu, 400 V (kVAr → Cu / Al mm²)
  const KABLO = [[10, '2,5', '16'], [20, '4', '16'], [30, '6', '16'], [40, '10', '16'], [50, '16', '25'], [60, '25', '35'], [80, '35', '50'],
    [100, '50', '70'], [120, '70', '95'], [140, '95', '120'], [180, '120', '185'], [200, '150', '240'], [240, '185', '2x95'],
    [250, '240', '2x120'], [300, '2x95', '2x150'], [360, '2x120', '2x185'], [420, '2x150', '2x240'], [480, '2x185', '2x300'],
    [540, '2x240', '3x185'], [600, '2x300', '3x240'], [660, '3x150', '3x240'], [720, '3x185', '3x300']];
  const kabloSec = Q => { const r = KABLO.find(x => x[0] >= Q - 1e-9); return r ? { cu: r[1], al: r[2] } : { cu: 'özel hesap', al: 'özel hesap' }; };
  function ekipman(Qnet, h, U = 400) {
    const In = Qnet * 1000 / (K3 * U);
    const ayar = In * h.kKoruma;
    return {
      Qnet, In, ayar,
      etiket: h.sinif === 'standart' ? Qnet : etiketGuc(Qnet, h.UN, U, h.p),
      sigorta: ustDeger(SIGORTA_A, ayar),
      kontaktor: ustDeger(KONTAKTOR_KVAR, Qnet) || Math.ceil(Qnet),
      kablo: kabloSec(Qnet),
      reaktor: h.p > 0 ? Qnet : 0,
    };
  }
  const atSec = InAna => { const p = ustDeger(AT_PRIMER, InAna); return p ? { primer: p, oran: p / 5, ad: `${p}/5 A` } : null; };

  // ---------- Şönt reaktör (kapasitif sorun) ----------
  const reaktorSec = Qkap => (Qkap > 0 ? ustDeger(REAKTOR_KVAR, Qkap) || Math.ceil(Qkap / 10) * 10 : 0);

  // ---------- Motor bireysel kompanzasyonu: kendi kendine uyarma sınırı (400 V) ----------
  const MOTOR = [[22, 6, 8, 9, 10], [30, 7.5, 10, 11, 12.5], [37, 9, 11, 12.5, 16], [45, 11, 13, 14, 17], [55, 13, 17, 18, 21], [75, 17, 22, 25, 28],
    [90, 20, 25, 27, 30], [110, 24, 29, 33, 37], [132, 31, 36, 38, 43], [160, 35, 41, 44, 52], [200, 43, 47, 53, 61], [250, 52, 57, 63, 71],
    [280, 57, 63, 70, 79], [355, 67, 76, 86, 98], [400, 78, 82, 97, 106], [450, 87, 93, 107, 117]];
  const DEVIR = [3000, 1500, 1000, 750], KORUMA_AZALT = { 3000: 0.93, 1500: 0.91, 1000: 0.90, 750: 0.88 };
  function motorKomp(kW, devir) {
    const j = DEVIR.indexOf(+devir); if (j < 0 || !(kW > 0)) return null;
    const r = MOTOR.find(x => x[0] >= kW);
    return r ? { tabloKW: r[0], Qmaks: r[1 + j], azalt: KORUMA_AZALT[devir] } : { tabloKW: null, Qmaks: null, azalt: KORUMA_AZALT[devir] };
  }


  // ---------- Rezonans (paralel rezonans: şebeke / trafo endüktansı ↔ kondansatör bataryası) ----------
  // h0 = √(Ssc / Q) (Schneider EIG, "Risk of resonance"); trafo beslemede Ssc ≈ Sn / uk (üst şebeke empedansı ihmal → h0 biraz büyük çıkar)
  const ukTipik = Sn => (Sn > 630 ? 0.06 : 0.04);                                    // EN 50464-1 tipik kısa devre gerilimi
  const HARMONIKLER = [5, 7, 11, 13];
  function rezonans({ Ssc, toplamlar, h, baskin = 5 }) {
    if (!(Ssc > 0) || !toplamlar || !toplamlar.length) return null;
    const izle = baskin === 3 ? [3, ...HARMONIKLER] : HARMONIKLER;
    const noktalar = toplamlar.filter(Q => Q > 0).map(Q => {
      const h0 = Math.sqrt(Ssc / Q);
      const yakin = izle.find(n => Math.abs(h0 - n) / n <= 0.07) || null;   // ±%7 bandı: rezonans tehlikesi
      return { Q, h0, f0: 50 * h0, yakin };
    });
    const h0min = Math.min(...noktalar.map(x => x.h0)), h0max = Math.max(...noktalar.map(x => x.h0));
    const riskli = noktalar.filter(x => x.yakin);
    const aralikta = izle.filter(n => n >= h0min * 0.93 && n <= h0max * 1.07);
    const korunmali = h && h.p > 0;                                             // reaktörlü: paralel rezonans ayar frekansının altına iner
    return { Ssc, noktalar, h0min, h0max, f0min: 50 * h0min, f0max: 50 * h0max, riskli, aralikta, korunmali,
      ayar: korunmali ? 1 / Math.sqrt(h.p) : null };
  }
  // kademe planından ulaşılabilen bütün toplam güçler (sabit kademe hep devrede)
  function toplamlar(plan, sabit = 0) {
    const ul = new Set([0]);
    for (const q of plan.kademeler || []) for (const v of [...ul]) ul.add(+(v + q).toFixed(3));
    return [...ul].map(v => v + sabit).filter(v => v > 0).sort((a, b) => a - b);
  }

  // ---------- Yük listesi (proje aşaması) ----------
  // cos φ: Schneider EIG Fig. L7 "practical values"; LED / klima / UPS / sürücü / priz: üretici tipik değeri (kabul).
  // eşzamanlılık: Elektrik İç Tesisleri Yönetmeliği (RG 22479, 1995 değişikliği) tablosu; "öneri" olanlar mühendis kabulü.
  const YUK_TIPLERI = [
    { k: 'motor', ad: 'Asenkron motor (pompa, fan, kompresör)', cos: 0.80, esz: 0.75, kaynak: 'cos: EIG L7 (%75 yük 0,80) · eşz: öneri' },
    { k: 'motorBos', ad: 'Az yüklü motor (%25–50 yük)', cos: 0.65, esz: 0.75, kaynak: 'cos: EIG L7 (%25 0,55 · %50 0,73)' },
    { k: 'surucu', ad: 'Hız kontrollü motor (sürücülü)', cos: 0.95, esz: 0.75, harm: true, kaynak: 'cos: sürücü giriş (temel bileşen) tipik' },
    { k: 'led', ad: 'Aydınlatma · LED', cos: 0.90, esz: 1, kaynak: 'cos: >25 W sürücü tipik · eşz: İç Tes. %100' },
    { k: 'floresan', ad: 'Aydınlatma · floresan (kompanzasyonlu)', cos: 0.93, esz: 1, kaynak: 'cos: EIG L7 · eşz: İç Tes. %100' },
    { k: 'desarj', ad: 'Aydınlatma · sodyum / metal halide', cos: 0.50, esz: 1, kaynak: 'cos: EIG L7 (0,4–0,6)' },
    { k: 'priz', ad: 'Priz devreleri', cos: 0.90, esz: 'priz', kaynak: 'eşz: İç Tes. ilk 10 kVA %100, kalanı %50 · cos: kabul' },
    { k: 'mekanik', ad: 'Mekanik tesisat (klima, ısı pompası)', cos: 0.85, esz: 1, kaynak: 'eşz: İç Tes. %100 (kış/yaz büyüğü) · cos: kabul' },
    { k: 'mutfak', ad: 'Mutfak cihazları', cos: 0.98, esz: 0.70, kaynak: 'eşz: İç Tes. %70 · cos: ağırlıklı rezistif' },
    { k: 'asansor', ad: 'Asansör (konut / diğer)', cos: 0.80, esz: 0.55, kaynak: 'eşz: İç Tes. %55' },
    { k: 'asansorO', ad: 'Asansör (okul / hastane)', cos: 0.80, esz: 0.85, kaynak: 'eşz: İç Tes. %85' },
    { k: 'asansorB', ad: 'Asansör (büro / otel)', cos: 0.80, esz: 1, kaynak: 'eşz: İç Tes. %100' },
    { k: 'isitici', ad: 'Rezistanslı ısıtıcı / fırın', cos: 1.00, esz: 1, kaynak: 'cos: EIG L7' },
    { k: 'induksiyon', ad: 'Endüksiyon fırını', cos: 0.85, esz: 1, harm: true, kaynak: 'cos: EIG L7 (kompanzasyonlu)' },
    { k: 'kaynak', ad: 'Kaynak makinesi (trafo-doğrultucu)', cos: 0.75, esz: 0.5, harm: true, kaynak: 'cos: EIG L7 (0,7–0,8) · eşz: öneri' },
    { k: 'ark', ad: 'Ark kaynağı (tek fazlı)', cos: 0.50, esz: 0.5, kaynak: 'cos: EIG L7' },
    { k: 'ups', ad: 'UPS (online)', cos: 0.99, esz: 1, harm: true, kaynak: 'cos: IGBT doğrultuculu UPS tipik' },
    { k: 'elektronik', ad: 'Bilgisayar / elektronik yük', cos: 0.95, esz: 0.8, harm: true, kaynak: 'cos: kabul · 3. harmonik' },
    { k: 'diger', ad: 'Diğer (elle)', cos: 0.85, esz: 1, kaynak: '' },
  ];
  const yukTipi = k => YUK_TIPLERI.find(t => t.k === k) || YUK_TIPLERI[YUK_TIPLERI.length - 1];
  // priz eşzamanlılığı: ilk 10 kVA %100, kalan %50 (cos φ ile kVA'ya çevrilir)
  function prizEsz(kW, cos = 0.9) { const S = kW / cos; return S <= 10 ? 1 : (10 + 0.5 * (S - 10)) / S; }
  // satırlar: [{ tip, kW, esz (sayı ya da boş → tipin değeri), cos }] → toplamlar
  function yukListesi(satirlar) {
    let kurulu = 0, P = 0, Q = 0, Gh = 0;
    const s = satirlar.filter(r => r.kW > 0).map(r => {
      const t = yukTipi(r.tip), cos = r.cos > 0 ? r.cos : t.cos;
      const esz = r.esz > 0 ? r.esz : t.esz === 'priz' ? prizEsz(r.kW, cos) : t.esz;
      const p = r.kW * esz, q = p * tan(cos);
      kurulu += r.kW; P += p; Q += q; if (t.harm) Gh += r.kW / 0.7;
      return { ...r, ad: t.ad, cos, esz, P: p, Q: q, harm: !!t.harm };
    });
    return { satirlar: s, kurulu, P, Q, cos: P > 0 ? P / Math.hypot(P, Q) : 1, esz: kurulu > 0 ? P / kurulu : 0, Gh };
  }

  // ---------- Hepsi bir arada ----------
  // g: { P, cos1, cos2, trafoKVA, kuruluKVA, Gh, baskin, kademeN, duzen, yedek (0..), Pmin, InAna, U, Qkap, uk (0..1), Ssc (kVA) }
  function tasarla(g) {
    const U = g.U || 400;
    const q = gerekenQ(g.P, g.cos1, g.cos2);
    const tr = trafoReaktif(g.trafoKVA);
    const sabit = tr ? tr.sabit : 0;
    const Qhedef = q.Qc * (1 + (g.yedek || 0));                         // yedek pay dahil kurulacak otomatik + sabit
    const Qoto = Math.max(0, Qhedef);                                     // yük kompanzasyonu otomatik kademelerden
    // harmonik oranı: özel trafo varsa trafo gücüne, yoksa (AG abonesi) tesisin kurulu gücüne (kVA) göre
    const Sref = g.trafoKVA > 0 ? g.trafoKVA : (g.kuruluKVA || 0);
    const h = Object.assign(harmonikSinif(g.Gh || 0, Sref, g.baskin || 5), { Sref, referans: g.trafoKVA > 0 ? 'trafo' : 'kurulu' });
    const plan = kademePlani(Qoto, g.kademeN, g.duzen, g.Pmin);
    const kademeler = plan.kademeler.map(Q => ekipman(Q, h, U));
    const sabitEk = sabit > 0 ? ekipman(sabit, h, U) : null;
    const Qtop = plan.toplam + sabit;
    const ana = ekipman(Qtop, h, U);
    const at = atSec(g.InAna || 0);
    const reaktor = reaktorSec(g.Qkap || 0);
    // rezonans: trafo varsa Ssc = Sn / uk; trafosuz abonede kullanıcı şebeke kısa devre gücünü girerse
    const uk = g.uk > 0 ? g.uk : ukTipik(g.trafoKVA);
    const Ssc = g.Ssc > 0 ? g.Ssc : g.trafoKVA > 0 ? g.trafoKVA / uk : 0;
    const rez = rezonans({ Ssc, toplamlar: toplamlar(plan, sabit), h, baskin: g.baskin || 5 });
    if (rez) rez.uk = g.Ssc > 0 ? null : uk;
    const uyarilar = [];
    if (g.Pmin > 0 && plan.q1 > 0.25 * g.Pmin) uyarilar.push(`En küçük kademe (${plan.q1} kVAr) en düşük yükün (${g.Pmin} kW) %25'inden büyük; düşük yükte kapasitife geçme riski. Kademe sayısını artırın ya da daha küçük ilk kademe seçin.`);
    if (h.sinif === 'filtre') uyarilar.push('Harmonik üreten yükler trafo gücünün yarısından fazla: harmonik ölçümü ve filtre etüdü yapılmadan kondansatör bataryası kurulmamalı.');
    if (g.cos2 >= 0.999) uyarilar.push('Hedef cos φ 1,00: küçük yük değişimlerinde kapasitife geçilir (kapasitif sınır %15). 0,98–0,99 önerilir.');
    if (q.Qc <= 0) uyarilar.push('Mevcut güç katsayısı hedeften iyi; kondansatör gerekmiyor.');
    // uyarı yalnız genliği büyük harmoniklerde (5., 7.; baskın 3. ise 3.) — 11. ve 13. rezonans kartında bilgi olarak gösterilir
    const buyukH = rez && !rez.korunmali ? [...new Set(rez.riskli.map(x => x.yakin))].filter(n => n <= 7) : [];
    if (buyukH.length) uyarilar.push(`Rezonans riski: bazı kademe birleşimlerinde rezonans mertebesi h0, ${buyukH.join('. ve ')}. harmoniğe çok yakın (±%7).${(g.Gh || 0) > 0 ? ' Harmonik üreten yük olduğu için reaktörlü (%7) kademe kullanın.' : ' Tesiste harmonik kaynak yoksa sorun olmaz; ileride sürücü / UPS eklenirse reaktörlü kademeye geçin.'}`);
    if (plan.yetersiz) uyarilar.push(`Gereken güç ${Math.round(Qoto)} kVAr, ${plan.nMaks} kademeli röle için büyük: kademeler eşit ve ${plan.q1} kVAr oldu. Daha çok kademeli röle ya da iki ayrı kompanzasyon panosu düşünün.`);
    if (!plan.yetersiz && Qoto > KADEME_EN_BUYUK * plan.nMaks) uyarilar.push('Kademe sayısı sınırda; daha çok kademeli röle seçmek çözünürlüğü artırır.');
    return { U, q, tr, sabit, Qhedef, Qoto, h, plan, kademeler, sabitEk, Qtop, ana, at, reaktor, uyarilar, rez,
      Ck: at && plan.q1 ? plan.q1 / at.oran : null, cos2Gercek: g.P > 0 ? cosDan(Math.abs(q.t1 - plan.toplam / g.P)) : null,
      kapasitifeGecer: g.P > 0 && q.t1 - plan.toplam / g.P < 0 };
  }

  const KOMP = { tan, cosDan, gerekenQ, faturadan, cezaSiniri, cezaKontrol, trafoReaktif, harmonikSinif, netGuc, etiketGuc,
    kademePlani, kademeSayisiOner, ekipman, atSec, reaktorSec, motorKomp, tasarla, DUZENLER, TRAFO, MOTOR, KABLO, KADEME_KVAR,
    rezonans, toplamlar, ukTipik, YUK_TIPLERI, yukTipi, prizEsz, yukListesi };
  if (typeof module !== 'undefined' && module.exports) module.exports = KOMP; else kok.KOMP = KOMP;
})(typeof window !== 'undefined' ? window : globalThis);
