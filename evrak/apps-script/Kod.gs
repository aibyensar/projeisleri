// AGY Evrak — telefondaki kestirmeden gelen dosyaları şirket Drive'ına kaydeder.
// Sürüm 0.1 (deneme). Kurulum: evrak/KURGU.md · Faz 0. Gizli anahtarı yalnız burada ve telefondaki kestirmede tutun.
const ANAHTAR = 'BURAYA-KENDİ-GİZLİ-ANAHTARINIZ';
const ANA_KLASOR = 'AGY Evrak';
const GELEN = '0-Gelen';

function doGet() {
  return ContentService.createTextOutput('AGY Evrak çalışıyor');
}

// Gövde (JSON): { anahtar, paket?, sira?, ad, uzanti?, veri (base64), bilgi? }
function doPost(e) {
  const kilit = LockService.getScriptLock();
  try {
    kilit.waitLock(30000);
    const g = JSON.parse(e.postData.contents);
    if (g.anahtar !== ANAHTAR) return cevap({ tamam: false, hata: 'anahtar yanlış' });
    const paket = temiz(g.paket) || Utilities.formatDate(new Date(), 'Europe/Istanbul', 'yyyy-MM-dd_HHmm') + '_deneme';
    const klasor = klasorAl(klasorAl(klasorAl(DriveApp.getRootFolder(), ANA_KLASOR), GELEN), paket);
    let kaydedilen = null;
    if (g.veri) {
      const bayt = Utilities.base64Decode(String(g.veri).replace(/\s/g, ''));
      let ad = temiz(g.ad) || 'dosya';
      const uz = temiz(g.uzanti).replace(/^\./, '').toLowerCase();
      if (uz && !ad.toLowerCase().endsWith('.' + uz)) ad += '.' + uz;
      if (g.sira) ad = String(g.sira).padStart(2, '0') + '_' + ad;
      kaydedilen = klasor.createFile(Utilities.newBlob(bayt, turBul(ad), ad)).getName();
    }
    if (g.bilgi) klasor.createFile('paket.json', JSON.stringify(g.bilgi, null, 2), 'application/json');
    return cevap({ tamam: true, paket: paket, dosya: kaydedilen });
  } catch (hata) {
    return cevap({ tamam: false, hata: String(hata) });
  } finally {
    kilit.releaseLock();
  }
}

function klasorAl(ust, ad) {
  const bul = ust.getFoldersByName(ad);
  return bul.hasNext() ? bul.next() : ust.createFolder(ad);
}

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
