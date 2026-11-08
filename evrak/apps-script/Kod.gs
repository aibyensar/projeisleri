// AGY Evrak — telefondaki kestirmeden gelen dosyaları şirket Drive'ına kaydeder ve paket bilgisini (elektrikçi, proje,
// tür, ACİL, evrak tamam) telefondaki küçük bir formdan alır. Sürüm 1.1 (yazarken öneri). Kurgu: evrak/KURGU.md
// Gizli anahtarı yalnız burada ve telefondaki kestirmede tutun.
const ANAHTAR = 'BURAYA-KENDİ-GİZLİ-ANAHTARINIZ';
const ANA_KLASOR = 'AGY Evrak';
const GELEN = '0-Gelen';
const FORM_SURESI_SAAT = 24;              // paket bilgisi bu süre içinde girilebilir / düzeltilebilir
const TURLER = ['İç Tesisat', 'Bağlantı Hattı', 'İç Tesisat + Bağlantı Hattı', 'Kompanzasyon'];

// ---------- Dosya alma (kestirme, her dosya için bir istek) ----------
// Gövde (JSON): { anahtar, paket, sira, ad, uzanti, veri (base64) }
function doPost(e) {
  const kilit = LockService.getScriptLock();
  try {
    kilit.waitLock(30000);
    const g = JSON.parse(e.postData.contents);
    if (g.anahtar !== ANAHTAR) return cevap({ tamam: false, hata: 'anahtar yanlış' });
    const paket = paketAdi(g.paket) || Utilities.formatDate(new Date(), 'Europe/Istanbul', 'yyyyMMdd-HHmmss');
    const klasor = klasorAl(gelenKlasoru(), paket);
    if (!g.veri) return cevap({ tamam: false, hata: 'veri yok' });
    const bayt = Utilities.base64Decode(String(g.veri).replace(/\s/g, ''));
    let ad = temiz(g.ad) || 'dosya';
    const uz = temiz(g.uzanti).replace(/^\./, '').toLowerCase();
    if (uz && !ad.toLowerCase().endsWith('.' + uz)) ad += '.' + uz;
    if (g.sira) ad = String(g.sira).padStart(2, '0') + '_' + ad;
    const dosya = klasor.createFile(Utilities.newBlob(bayt, turBul(ad), ad));
    return cevap({ tamam: true, paket: paket, dosya: dosya.getName() });
  } catch (hata) {
    return cevap({ tamam: false, hata: String(hata) });
  } finally {
    kilit.releaseLock();
  }
}

// ---------- Sayfalar ----------
// ?form=<paket> → paket bilgisi formu; parametresiz → durum yazısı
function doGet(e) {
  const paket = paketAdi(e && e.parameter && e.parameter.form);
  if (!paket) return ContentService.createTextOutput('AGY Evrak çalışıyor');
  const k = paketKlasoru(paket);
  const t = HtmlService.createTemplateFromFile('Form');
  t.durum = JSON.stringify(k ? paketDurumu(k) : { yok: true, paket: paket });
  t.isler = JSON.stringify(sonIsler());
  t.elektrikciler = JSON.stringify(liste('elektrikciler'));
  t.turler = JSON.stringify(TURLER.concat(liste('turler')));
  return t.evaluate().setTitle('AGY Evrak')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1, maximum-scale=1');
}

// formdan çağrılır (google.script.run)
function bilgiKaydet(paket, b) {
  paket = paketAdi(paket);
  const k = paket && paketKlasoru(paket);
  if (!k) throw new Error('Paket bulunamadı. Dosyalar gönderilmemiş olabilir.');
  const yas = (Date.now() - k.getDateCreated().getTime()) / 3600000;
  if (yas > FORM_SURESI_SAAT) throw new Error('Bu paketin bilgi girme süresi geçmiş.');
  const elektrikci = temiz(b.elektrikci), proje = temiz(b.proje), tur = temiz(b.tur);
  if (!elektrikci || !proje || !tur) throw new Error('Elektrikçi, proje adı ve proje türü boş olamaz.');
  const bilgi = {
    surum: 1, paket: paket, elektrikci: elektrikci, proje: proje, tur: tur,
    acil: !!b.acil, evrakTamam: !!b.tamam, not: String(b.not || '').slice(0, 500),
    dosyaSayisi: dosyaSayisi(k), kayit: new Date().toISOString(),
  };
  const eski = k.getFilesByName('paket.json');
  while (eski.hasNext()) eski.next().setTrashed(true);          // düzeltme: eski bilgi çöpe, yenisi yazılır
  k.createFile('paket.json', JSON.stringify(bilgi, null, 2), 'application/json');
  isEkle({ elektrikci: elektrikci, proje: proje, tur: tur });
  listeyeEkle('elektrikciler', elektrikci, 500);
  if (TURLER.indexOf(tur) < 0) listeyeEkle('turler', tur, 50);
  return { tamam: true, dosyaSayisi: bilgi.dosyaSayisi };
}

// ---------- Yardımcılar ----------
function gelenKlasoru() { return klasorAl(klasorAl(DriveApp.getRootFolder(), ANA_KLASOR), GELEN); }

function paketKlasoru(paket) {
  const bul = gelenKlasoru().getFoldersByName(paket);
  return bul.hasNext() ? bul.next() : null;
}

function paketDurumu(k) {
  const pj = k.getFilesByName('paket.json');
  let bilgi = null;
  if (pj.hasNext()) { try { bilgi = JSON.parse(pj.next().getBlob().getDataAsString()); } catch (x) { bilgi = null; } }
  return { paket: k.getName(), dosyaSayisi: dosyaSayisi(k), bilgi: bilgi };
}

function dosyaSayisi(k) {
  let n = 0; const it = k.getFiles();
  while (it.hasNext()) { if (it.next().getName() !== 'paket.json') n++; }
  return n;
}

// son kullanılan işler (formda hızlı seçim ve proje önerisi için), en yeni başta, en çok 200
function sonIsler() { return liste('sonIsler'); }
function liste(ad) {
  try { return JSON.parse(PropertiesService.getScriptProperties().getProperty(ad) || '[]'); } catch (x) { return []; }
}
// hafızaya ekle: en son kullanılan başa; büyük/küçük harf ve boşluk farkı aynı sayılır
function listeyeEkle(ad, deger, enCok) {
  const k = x => String(x).toLocaleUpperCase('tr-TR').replace(/\s+/g, ' ').trim();
  const l = [deger].concat(liste(ad).filter(x => k(x) !== k(deger))).slice(0, enCok);
  PropertiesService.getScriptProperties().setProperty(ad, JSON.stringify(l));
}
function isEkle(is) {
  const anahtar = x => (x.elektrikci + '|' + x.proje).toLocaleUpperCase('tr-TR').replace(/\s+/g, ' ');
  const liste = [is].concat(sonIsler().filter(x => anahtar(x) !== anahtar(is))).slice(0, 200);
  PropertiesService.getScriptProperties().setProperty('sonIsler', JSON.stringify(liste));
}

function klasorAl(ust, ad) {
  const bul = ust.getFoldersByName(ad);
  return bul.hasNext() ? bul.next() : ust.createFolder(ad);
}

// paket adı yalnız rakam, harf, tire, alt çizgi
function paketAdi(s) { return String(s || '').replace(/[^0-9A-Za-z_-]/g, '').slice(0, 40); }

// Windows'ta sorun çıkaran karakterleri temizler
function temiz(s) {
  return String(s || '').replace(/[\\/:*?"<>|\u0000-\u001f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 120);
}

function turBul(ad) {
  const uz = (ad.split('.').pop() || '').toLowerCase();
  return {
    jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', heic: 'image/heic', webp: 'image/webp', pdf: 'application/pdf',
    doc: 'application/msword', docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    xls: 'application/vnd.ms-excel', xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', zip: 'application/zip',
  }[uz] || 'application/octet-stream';
}

function cevap(nesne) {
  return ContentService.createTextOutput(JSON.stringify(nesne)).setMimeType(ContentService.MimeType.JSON);
}
