// Havai bağlantı hattı DXF denemesi (sahte iş bilgisi, müşteri verisi yok):
// node baglanti-hatti/test/havai-dene.js <havai-sonuc.json> <çıkış-klasörü>
// havai-sonuc.json: araclar/havai-cer.html?gomulu=1 sayfasının gönderdiği 'havai-sonuc' iletisi
const fs = require('fs'), path = require('path');
global.window = undefined;
const BHP = require('../../ortak/bhp.js');
const BHPCizim = require('../../ortak/bhp-cizim.js');
const BHPHavai = require('../../ortak/bhp-havai.js');
const [sonucP, cikis] = process.argv.slice(2);
const H = JSON.parse(fs.readFileSync(sonucP, 'utf8'));
const sablon = fs.readFileSync(path.join(__dirname, '../BHP-SABLON.dxf'), 'utf8');
const g = { basvuruNo: '000000000', sahibi: 'DENEME SAHİBİ', adres: 'ÖRNEK SOK./ÖRNEK MAH./ŞEHZADELER/MANİSA', kullanim: 'MESKEN',
  kuruluKW: 20, talepKW: H.talepKW || 15, bagimsiz: '1', baglantiSekli: 'Direk Bağlantısı', direk: 'C-06', hatTipi: 'HAVAI', uzunluk: 90, ada: '100', parsel: '1' };
const b = BHP.birlestir(g, { kuruluW: 20000, talepW: (H.talepKW || 15) * 1000, satirlar: [] });
b.uzunluk = Math.round(H.hatBoyu);
b.korumalar = [{ tur: 'sigorta', deger: '4x40A 10kA' }];
// 3. argüman "nyy": kısa mesafe NYY + askı teli (aynı kablo direkten iner)
const NYY = process.argv[4] === 'nyy';
let kablo, inis;
if (NYY) {
  const L2 = 15, uy = k => { const t = BHP.kablolar('cu', 3).find(x => x.ad === k.ad); return k.kesit >= 6 && t && BHP.hesap(k, b.talepW, b.uzunluk, 40).e + BHP.hesap(t, b.talepW, L2, 40).e <= 1 && BHP.hesap(k, b.talepW, b.uzunluk, 40).kUygun; };
  kablo = { ...BHP.kablolar('nyy-aski', 3).find(uy), askiTel: 'galvanizli örgülü çelik tel halat' };
  const t = BHP.kablolar('cu', 3).find(x => x.ad === kablo.ad);
  inis = { kablo: t, L: L2, yer: 5, h: BHP.hesap(t, b.talepW, L2, 40), ayniKablo: true };
} else {
  kablo = BHP.kablolar('alpek', 3).find(k => k.ad === String(H.routeCond).replace(/^AER\s*/, '')) || BHP.kabloOner('alpek', b.talepW, b.uzunluk, 0, 3, 40);
  const k2 = BHP.kablolar('al', 3).find(k => k.kesit >= 10 && BHP.hesap(kablo, b.talepW, b.uzunluk, 40).e + BHP.hesap(k, b.talepW, 15, 40).e <= 1 && BHP.hesap(k, b.talepW, 15, 40).kUygun);
  inis = { kablo: k2, L: 15, yer: 5, h: BHP.hesap(k2, b.talepW, 15, 40) };
}
const malz = BHPHavai.malzemeOner(BHP, b, kablo, H, inis), notlar = BHPHavai.notlarOner(BHP, b, kablo, H, inis);
const v = BHP.cizimVerisi(b, kablo, malz, notlar);
Object.assign(v, { havai: H, Ldis: v.L, Lic: 0, basvuruNo: b.basvuruNo, inis });
const bilgi = BHPCizim.bilgiOku(sablon);
const c = BHPCizim.hepsi(v, bilgi);
const dxf = BHPCizim.dxfeEkle(BHP.doldur(sablon, BHP.degerler(b, kablo, 'uydu.png', 'vaziyet.png')), c, 'havai', true, BHPHavai.SIL);
fs.mkdirSync(cikis, { recursive: true });
fs.writeFileSync(path.join(cikis, `BHP-${b.basvuruNo}.dxf`), dxf);
const h = BHP.hesap(kablo, b.talepW, b.uzunluk, 40);
console.log(`kablo ${kablo.yazi} · %e ${h.e.toFixed(3)} (seçim ≤ 1, yazılan < 1,5) · I ${h.I.toFixed(1)} A ≤ ${kablo.iz} A`);
console.log(`iniş ${inis.kablo.yazi} L=15 m · toplam %e ${(h.e + inis.h.e).toFixed(3)}`);
console.log('malzeme:', malz.map(m => `${m.ad} ${m.miktar} ${m.birim}`).join(' | '));
console.log('çizim öğesi', c.l.length, 'DXF', Math.round(dxf.length / 1024), 'KB');
if (!/ALPEK/.test(dxf) || !/HAVAİ BAĞLANTI HATTI/.test(dxf) || !/DİREK LİSTESİ/.test(dxf)) { console.error('HATA: havai bölümleri DXF\'te yok'); process.exit(1); }
console.log('HAVAİ DXF: TAMAM');
