# AGY Evrak İşleyici — kurulum (Windows)

Program arka planda çalışır; saatin yanında lacivert "E" simgesi görünür. Şirket Drive'ındaki `AGY Evrak\0-Gelen`
klasörüne telefondan gelen evrakı işler ve `Çizilecek Projeler` klasörüne koyar. Kişisel veri hiçbir yere gönderilmez.

## 1. İndir
- GitHub'da depo → **Releases** → **AGY Evrak İşleyici** → `AGY-Evrak.exe` (yaklaşık 60–90 MB).
- Bir klasöre koy: ör. `C:\AGY\AGY-Evrak.exe` (masaüstüne koyma; masaüstü iş klasörleri için).

## 2. İlk çalıştırma
- `AGY-Evrak.exe`'ye çift tıkla.
- Windows "Bilgisayarınız korundu" (SmartScreen) derse: **Ek bilgi** → **Yine de çalıştır**. (Program imzasız olduğu için çıkar.)
- Antivirüs uyarırsa: dosyayı güvenilir olarak işaretle (PyInstaller programlarında sık görülen yanlış alarm).
- İlk açılışta program kendiliğinden:
  - masaüstüne **Çizilecek Projeler** kısayolu ve **Evrak Bırak** klasörü koyar,
  - sağ tık → **Gönder** menüsüne **AGY Evrak** ekler,
  - Windows açılışında kendiliğinden başlamayı açar (simge menüsünden kapatılabilir).

## 3. Kontrol
- Saatin yanındaki **E** simgesine sağ tık: üst satırda "çalışıyor · son kontrol …" yazmalı.
- "Drive klasörü bulunamadı" yazıyorsa: Google Drive masaüstü uygulaması açık mı? Şirket hesabının sürücüsü
  (`H:`) görünüyor mu? Gerekirse simge menüsü → **Ayar dosyası** → `kok` satırına doğru yolu yaz
  (ör. `H:\\Drive'ım\\AGY Evrak`), kaydet, programı kapatıp aç.

## 4. Kullanım
- Telefon: WhatsApp → evrakları seç → Paylaş → **AGY Evrak** → formu doldur → Kaydet.
- PC: dosyaları masaüstündeki **Evrak Bırak** klasörüne sürükle (ya da sağ tık → Gönder → AGY Evrak) → açılan pencereyi doldur.
- Birkaç saniye içinde iş **Çizilecek Projeler**'de görünür ve Windows bildirimi gelir.
- Çizime başlarken iş klasörünü masaüstüne sürükle; bitince kendi klasörüne koy.
- Klasör adındaki durum sözcüğünü elle değiştirebilirsin (`2 BEKLİYOR` → `1 HAZIR`); `KONTROL` sözcüğünü silince kontrol uyarısı kalkar.

## Ayarlar (`%APPDATA%\AGY Evrak\ayar.json`)
| Ayar | Anlamı | Varsayılan |
|---|---|---|
| `kok` | Şirket Drive'ındaki AGY Evrak klasörü | `H:\Drive'ım\AGY Evrak` |
| `kalite` | Fotoğraf işleme: `tam` (kırp + gölge gider), `hafif` (yalnız kırp), `ham` (dokunma) | `tam` |
| `gecikme_gun` | Kaç gün bekleyen iş "GECİKİYOR" sayılır | `3` |
| `yokla_sn` | Kaç saniyede bir kontrol | `15` |
