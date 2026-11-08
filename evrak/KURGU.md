# Evrak Toplayıcı — kurgu (taslak, 8 Kasım 2026)

WhatsApp'tan gelen müşteri evrakını (fotoğraf, PDF, belge) en az el işiyle, kaliteli PDF olarak, doğru adla ve doğru
klasörde PC masaüstüne getirmek. Bu belge yalnız kurgudur; onaylanmadan kurulum yapılmaz. Müşteri bilgisi bu depoya
hiçbir zaman yazılmaz (örnek evraklar dahil).

---

## 0. Hedef ve başarı ölçütleri

| Ölçüt | Hedef |
|---|---|
| Telefonda harcanan süre | Müşteri başına ≤ 10 saniye (seç → paylaş → müşteri seç) |
| PC'de harcanan süre | Sıfır; yalnız "Kontrol et" klasörüne düşenlere bakılır |
| Evrakın masaüstüne düşmesi | PC açıksa paylaşımdan sonra ≤ 2 dakika |
| Tür (Tapu, Kimlik…) doğruluğu | İlk ay ≥ %90, kurallar öğrendikçe ≥ %97 |
| Kalite | Okunaklı, düz, gölgesiz; renkli evrak renkli; orijinal her zaman saklı |
| Kayıp | Sıfır: hiçbir dosya silinmez, emin olunamayan "Kontrol et"e gider |
| Ücret | Sıfır |
| Kural ihlali / numara riski | Yok (yalnız WhatsApp'ın kendi "Paylaş" özelliği) |

## 1. Kısıtlar (kullanıcıyla netleşenler)

- Normal WhatsApp, kendi numarası; ayrı "evrak hattı" istenmiyor.
- Ücretsiz olmalı. Meta'nın aynı numarayı otomasyona bağlaması (coexistence) yalnız aracı firma / Tech Provider
  üzerinden → şimdilik yok (bkz. 12. bölüm).
- Telefon iPhone; bilgisayar Windows.
- Google: şirket hesabı (evrakın yeri). PC'de şahsi hesapla çalışan Drive yedeklemesi var — **dokunulmayacak**.
- Gelen evrak çeşitli: telefon fotoğrafı, müşterinin PDF'i, kullanıcının CamScanner PDF'i, bazen Word/Excel.
- Kalite şart: dağıtım şirketi / belediye evrakı reddetmemeli.

## 2. Değerlendirilen yollar

| Yol | Ücret | Aynı numara | Otomatiklik | Risk | Karar |
|---|---|---|---|---|---|
| Meta Cloud API, ayrı hat | 0 | Hayır | Tam | Yok | Kullanıcı istemedi |
| Meta + aracı firma (coexistence) | Aylık | Evet | Tam | Yok | Ücretli |
| Kendin Tech Provider ol | 0 (görünüşe göre) | Evet | Tam | Onay belirsiz, haftalar | İleride (12. bölüm) |
| Resmî olmayan WhatsApp Web programı | 0 | Evet | Tam | **Numara kapanabilir** | Reddedildi |
| Sohbeti dışa aktar → Drive | 0 | Evet | Yarı | Yok | Bütün sohbeti taşır, seçici değil |
| Telegram botu | 0 | Evet | Yarı | Yok | Ek uygulama; kestirme daha kısa |
| **iPhone Kestirmesi + Drive + PC işleyici** | **0** | **Evet** | **Yarı (tek paylaşım)** | **Yok** | **Seçilen** |

Neden işleme PC'de: belge taraması (kenar bulma, perspektif, gölge giderme) görüntü işleme ister; Google Apps Script
bunu yapamaz. Bulut sunucusu (Cloud Run vb.) ücretsiz katmanda bile kredi kartı ister. PC zaten her gün açık.

## 3. Mimari

```
 iPhone                         Google Drive (şirket hesabı)              Windows PC
 ───────                        ─────────────────────────────            ──────────────────────────────
 WhatsApp: evrakları seç        AGY Evrak/                                Drive masaüstü uygulaması
   → Paylaş → "AGY Evrak"         0-Gelen/                                 (2. hesap: şirket) eşitler
 Kestirme:                          2026-11-08_1432_ab12/  ──── eşitleme ──►         │
   müşteri / iş seç                   foto1.jpg, belge.pdf …                       ▼
   paketi Drive'a kaydet              paket.json (kim, hangi iş, not)     "Evrak İşleyici" (arka planda)
   "4 evrak gönderildi" bildirimi                                          1 bekle (paket tamam mı)
                                    Çizilecek Projeler/ ◄────────────────  2 tanı · 3 kalite · 4 oku
                                      01 · HAZIR · … – <iş adı>/          5 tür bul · 6 bilgi çıkar
                                        Tapu.pdf, Kimlik.pdf …             7 kontrol · 8 birleştir
                                        _orijinal/ …                       9 adlandır · 10 yerleştir
                                    8-Kontrol Et/                         11 kayıt · 12 bildirim
                                    Kayıt.csv · kurallar.json
                                                                         Masaüstü kısayolu → Çizilecek Projeler
```

Üç parça, her biri tek başına anlaşılır:
1. **iPhone Kestirmesi** — yalnız toplar ve paketler; hiçbir dosyayı değiştirmez.
2. **Google Drive (şirket)** — tek doğru kaynak; PC kapalıyken evrak burada bekler, yedek de budur.
3. **PC Evrak İşleyici** — bütün akıl burada; kurallar `kurallar.json` dosyasında, kod değişmeden güncellenir.

İleride tam otomatik giriş gelirse (12. bölüm) yalnız 1. parça değişir; paketi aynı `0-Gelen` klasörüne bırakır.

## 4. Parça 1 — iPhone Kestirmesi ("AGY Evrak")

**Kullanım:** WhatsApp sohbeti → mesaja basılı tut → *Seç* → evrakları işaretle → *Paylaş* → **AGY Evrak**.

**Kestirmenin soruları (hepsi tek ekranda, hızlı):**
1. Müşteri / iş: `Çizilecek Projeler`deki açık işlerin listesi (en üstte) + "Yeni iş" (müşteri adı yazılır).
2. Yeni işte: aynı müşterinin tamamlanmış işi varsa "bu işin revizyonu mu?" sorusu; "Bilmiyorum (evraktan bulunsun)" seçeneği.
3. İş türü (yeni işte): BHP · İç tesisat · Kompanzasyon · Diğer.
4. Not (isteğe bağlı): ör. "tapunun arkası eksik".

**Yaptığı:** gelen dosyaları **olduğu gibi** (yeniden sıkıştırmadan) `0-Gelen/<tarih_saat_kısa-kod>/` klasörüne kaydeder,
yanına `paket.json` yazar (müşteri, iş, tür, not, dosya sırası, telefon saati), sonra "N evrak gönderildi" bildirimi.

**Kaydetme yolu — iki seçenek, Faz 0'da denenip biri seçilecek:**
- (A) Kestirmenin "Dosyayı Kaydet" eylemiyle iPhone *Dosyalar* içindeki Google Drive konumuna. Sunucu yok, boyut sınırı yok.
  Risk: Drive uygulaması yüklemeyi arka planda geciktirebilir.
- (B) Kestirme dosyaları base64 olarak şirket hesabındaki küçük bir Apps Script web uygulamasına gönderir; o Drive'a yazar
  ve "alındı" cevabı döner. Kesin onay verir. Risk: büyük paketlerde gönderi boyutu (resmî sınır bulunamadı; dosya dosya
  gönderilerek aşılır) ve gizli anahtar yönetimi.

**Kestirme hataları:** internet yoksa (A) Drive kuyruğa alır; (B) "gönderilemedi, tekrar dene" der, hiçbir şey kaybolmaz.

## 5. Parça 2 — Drive klasör düzeni (masaüstü = çizilecek projeler)

Kullanıcının isteği (8 Kasım 2026): **masaüstünde yalnız çizilecek projeler** görünsün. Masaüstü bir iş kuyruğudur;
bütün müşteri arşivi değil.

```
AGY Evrak/
  0-Gelen/                      kestirmenin bıraktığı ham paketler (işlenince 9-Arşiv'e taşınır)
  Çizilecek Projeler/           ◄── MASAÜSTÜNDEKİ KISAYOL BURAYI AÇAR
    01 · HAZIR · 2026-11-03 · AHMET YILMAZ – <iş adı>/
    02 · HAZIR · 2026-11-05 · …
    03 · EKSİK EVRAK · 2026-11-06 · …/
    _LİSTE.txt                  sıra, bekleme günü, eksikler (bir bakışta durum)
    ✔ Bitti/                    çizimi biten iş klasörü buraya sürüklenir
  Tamamlanan Projeler/          "Bitti"ye bırakılanlar program tarafından buraya taşınır (masaüstünden kalkar)
  8-Kontrol Et/                 müşterisi/türü belirsiz evrak (sebebiyle)
  9-Arşiv/                      işlenmiş ham paketler
  Kayıt.csv · kurallar.json

İş klasörünün içi (her iki yerde aynı):
  Tapu.pdf  Kimlik.pdf  Vekaletname.pdf  …   düzeltilmiş, aranabilir PDF'ler
  Tümü.pdf                                   (isteğe bağlı) dağıtım şirketine tek dosya
  _orijinal/                                 gelen dosyaların değişmemiş kopyası
  _bilgi.txt                                 okunan bilgiler, eksik evrak, müşteriye hazır mesaj
```

- **Sıra:** en eski iş en üstte (öne konan 01, 02… numarası evrakın ilk geliş tarihine göre). Bekleme günü `_LİSTE.txt`de;
  X günü geçen iş için uyarı (gecikmeyi önlemek için).
- **Durum** klasör adının başında: `HAZIR` (iş türünün gerekli evrakı tamam) · `EKSİK EVRAK` (eksikler `_bilgi.txt`de,
  müşteriye hazır mesajla) · `KONTROL` (çelişki/bulanık evrak). Yeni evrak gelince durum ve ad kendiliğinden güncellenir.
- **Kimlik:** program klasörü adından değil, içindeki gizli `.is-kimligi` dosyasından tanır; kullanıcı klasör adını
  değiştirse de evrak doğru klasöre gider ve kullanıcının verdiği ad korunur (yalnız durum öneki güncellenir — karar).
- **Bitti:** kullanıcı klasörü `✔ Bitti`ye sürükler → program `Tamamlanan Projeler/<yıl>/`e taşır. Tamamlanan işe yeni evrak
  gelirse (revizyon) iş yeniden `Çizilecek Projeler`e döner ve "REVİZYON" öneki alır.
- Masaüstüne yalnız `Çizilecek Projeler` klasörünün kısayolu konur; Drive eşitlemesi sayesinde PC'de dosya taşımak/silmek
  Drive'a da yansır.

Klasör adı kuralları: Türkçe büyük harf (i→İ, ı→I doğru), Windows'ta yasak karakterler (`\ / : * ? " < > |`) temizlenir,
yol uzunluğu 200 karakteri geçmez, aynı ad varsa ` (2)` eklenir — hiçbir dosyanın üstüne yazılmaz.

## 6. Parça 3 — PC Evrak İşleyici (adım adım)

Windows açılınca kendiliğinden başlar, saatin yanında küçük simgeyle durur (çalışıyor / işliyor / hata).
Yerel çalışır; internete yalnız Drive eşitlemesi çıkar (o da Google'ın kendi uygulaması).

1. **Bekleme:** `0-Gelen`deki paket, `paket.json` gelip bütün dosyaların boyutu 10 saniye sabit kalınca işlenir
   (eşitleme yarıda kalmışken işlemez).
2. **Tanıma:** JPG/PNG/HEIC/WEBP fotoğraf · PDF (metinli mi, taranmış mı) · Word/Excel/diğer · ZIP (açılır).
3. **Kalite (yalnız fotoğraf ve taranmış PDF sayfası):**
   - Bulanıklık ve çözünürlük ölçülür. Okunamayacak kadar kötüyse işlenir ama "Kontrol et — müşteriden yeniden iste" işareti alır.
   - Kenar bulma + perspektif düzeltme (sayfa düz dikdörtgene açılır); kenar bulunamazsa kırpılmadan bırakılır.
   - Yön düzeltme (yan/ters sayfa döndürülür).
   - Gölge ve sarılık giderme, kontrast; **renk kararı:** renkli içerik (mühür, imza, kimlik, fotoğraf) varsa renkli,
     yoksa gri. Siyah-beyaz yalnız kurala göre (dağıtım şirketi isterse).
   - Hedef: A4, 300 dpi eşdeğeri; dosya boyutu sınırı ayarlanabilir (ör. sayfa başı ≤ 1 MB).
   - **Zaten düzgün olana dokunulmaz:** CamScanner/müşteri PDF'i ve metinli PDF olduğu gibi kalır (yalnız okunur).
4. **Okuma (OCR):** Türkçe. Adaylar: Tesseract (tur) ve Windows'un kendi OCR'ı — Faz 0'da gerçek evraklarla ikisi
   karşılaştırılıp iyi okuyan seçilir. Çıktı **aranabilir PDF** olur (PDF içinde Ctrl+F ile ad, ada, parsel aranır).
5. **Tür bulma:** `kurallar.json`daki anahtar kelimeler + güven puanı. Başlangıç listesi: Kimlik, Tapu, Vekaletname,
   İmar durumu, Aplikasyon/Kroki, Yapı ruhsatı, İskan, Abonelik/Sözleşme, Fatura, Muvafakatname, Vergi levhası,
   İmza sirküleri, Ticaret sicil, Proje/Çizim, Diğer. Güven düşükse "Kontrol et".
6. **Bilgi çıkarma:** ad-soyad, TC kimlik no (11 hane + resmî kontrol algoritması), il/ilçe/mahalle, ada/parsel,
   tesisat/abone no, tarih. Bunlar iş adını kurmak ve kontrol için kullanılır, `_bilgi.txt`ye yazılır.
7. **Kontroller (uyarı verir, engellemez):** tapudaki malik ↔ seçilen müşteri; kimlikteki ad ↔ müşteri; vekaletname
   tarihi; aynı işte farklı ada/parsel; kimlik süresi geçmiş mi.
8. **Birleştirme:** aynı türdeki sayfalar tek PDF (tapunun önü/arkası). Sayfa sırası = paylaşım sırası. İsteğe bağlı `Tümü.pdf`.
9. **Adlandırma:** klasör `MÜŞTERİ ADI – <iş adı>`; dosya `<Tür>.pdf` (ikinci gelirse `<Tür> (2).pdf`).
   İş adının neyden kurulacağı kullanıcıdan öğrenilecek (bkz. 13. bölüm, soru 1).
10. **Yerleştirme:** iş klasörüne (yeni işse `Çizilecek Projeler`de açılır; tamamlanmış işse REVİZYON olarak geri gelir);
    orijinaller `_orijinal/`e; ham paket `9-Arşiv/`e; `_LİSTE.txt` ve klasör önekleri (sıra, durum) güncellenir.
11. **Tekrar kontrolü:** aynı dosya (özet değeri) ya da yeniden sıkıştırılmış aynı fotoğraf (görsel benzerlik) ikinci kez
    gelirse yeni kopya oluşturulmaz, kayda "tekrar" yazılır.
12. **Eksik evrak:** iş türüne göre gerekli liste (`kurallar.json`) ile karşılaştırılır; `_bilgi.txt`de eksikler ve
    bulanık evraklar için **müşteriye atılacak hazır WhatsApp mesajı** ("Tapunuzun arka yüzü ve kimliğinizin net bir
    fotoğrafı eksik…") yazılır.
13. **Kayıt:** `Kayıt.csv` — tarih, müşteri, iş, tür, kaynak dosya, güven, durum, uyarı.
14. **Bildirim:** Windows bildirimi ("AHMET YILMAZ: 4 evrak işlendi, 1 tanesi kontrol bekliyor"). Telefona bildirim
    isteğe bağlı (ücretsiz yol: şirket e-postasına kısa özet) — karar.
15. **Öğrenme:** kullanıcı bir dosyanın adını/klasörünü elle değiştirirse işleyici bunu fark eder, "düzeltmeler"
    dosyasına yalnız *tür ve kelime* bilgisini yazar (kişisel veri yazmaz). Bu dosyadan kurallar güncellenir.
16. **Güncelleme:** kurallar `kurallar.json` ile (Drive'dan okunur, program yeniden kurulmaz). Program güncellemesi
    yeni sürüm dosyasıyla.

## 7. Güvenlik ve KVKK

- Kimlik, tapu gibi kişisel veriler yalnız: kullanıcının iPhone'u → şirket Google Drive'ı → kullanıcının PC'si.
  Üçüncü bir hizmete, yapay zekâya, bu depoya gönderilmez. OCR yerel çalışır.
- Şirket Google hesabında iki adımlı doğrulama açık olmalı; `AGY Evrak` klasörü kimseyle paylaşılmaz.
- (B) yolunda kestirme gizli bir anahtarla gönderir; anahtar yalnız kullanıcının telefonunda ve Apps Script'te durur.
- Saklama süresi: iş bitince ne kadar tutulacağı şirket kararı (KVKK: amaç için gerekli süre). İşleyici istenirse
  "iş kapandı" işaretli klasörleri X ay sonra arşive/silmeye aday listeler — otomatik silmez.
- Program kayıtlarında (log) kişisel veri tutulmaz; yalnız dosya kodları ve durum.
- Test ve ayar için kullanılacak örnek evraklar maskelenmiş olmalı ve depoya girmez.

## 8. Uç durumlar ve hatalar

| Durum | Davranış |
|---|---|
| PC kapalı | Paket Drive'da bekler; PC açılınca sırayla işlenir |
| Eşitleme yarıda | Boyutlar sabitlenene kadar beklenir |
| Kullanıcı iş klasörünün adını değiştirdi | Gizli kimlik dosyasıyla tanınır, yeni evrak yine oraya gider |
| Bitmiş işe yeni evrak geldi | REVİZYON olarak Çizilecek Projeler'e döner |
| Aynı müşteri, iki ayrı iş | İş seçimiyle ayrılır; "Bilmiyorum" seçilirse ada/parsel'e göre önerilir, emin değilse Kontrol et |
| Müşteri adı yazım farkı (Ahmet Yilmaz / AHMET YILMAZ) | Türkçe büyük harfe ve sadeleştirilmiş karşılaştırmaya göre aynı sayılır |
| Bir pakette iki farklı kişinin evrakı (ör. malik + vekil) | Hepsi seçilen işin klasörüne; kişi adları `_bilgi.txt`ye |
| Bulanık / karanlık / parmak kapatan fotoğraf | İşlenir + Kontrol et + hazır "yeniden gönderin" mesajı |
| Şifreli PDF | Olduğu gibi konur, "şifreli" uyarısı |
| Çok sayfalı karışık PDF (tek dosyada tapu+kimlik) | Bölünmez (orijinal korunur), türü "Karma", sayfa listesi `_bilgi.txt`de |
| Video, ses, konum | Yok sayılır, kayda not düşülür |
| Çok büyük dosya | İşlenir; PDF boyut sınırı aşarsa kalite kademeli düşürülür, orijinal saklı |
| Kural yanlış tür verdi | Kullanıcı düzeltir → öğrenme dosyası → kural güncellenir |
| İşleyici çöktü | Paket `0-Gelen`de kalır (taşınmamıştır), yeniden başlayınca tekrar dener; 3 denemede olmazsa Kontrol et |
| Drive dolu (15 GB) | Uyarı; `9-Arşiv` temizliği önerilir |
| iOS / WhatsApp güncellemesi kestirmeyi bozdu | Kestirme tek parça, yeniden kurulumu 1 dakika; işleyici etkilenmez |

## 9. Kurulum (onaydan sonra)

| Kim | Ne | Süre |
|---|---|---|
| Kullanıcı | Şirket Google hesabında `AGY Evrak` klasörünü açmak (ya da işleyiciye açtırmak) | 1 dk |
| Kullanıcı | PC'de Drive masaüstü uygulamasına şirket hesabını **2. hesap** olarak eklemek (4 hesaba kadar destekleniyor; her hesap ayrı sürücü harfi) | 5 dk |
| Kullanıcı | iPhone'a Google Drive uygulaması (A yolu) ve kestirmeyi bağlantıdan eklemek | 3 dk |
| Benim | Kestirme, işleyici programı (tek kurulum dosyası), `kurallar.json`, kurulum rehberi (ekran görüntülü) | — |
| Kullanıcı | İşleyiciyi kurmak; masaüstüne `AGY Evrak` kısayolu | 5 dk |

Not: imzasız kurulum dosyasında Windows "SmartScreen" uyarısı çıkabilir ("Yine de çalıştır"). Rehberde gösterilecek.

## 10. Test planı ve kabul

- **Faz 0 doğrulamaları (kurmadan önce, kullanıcının telefonunda 10 dakikalık deneme):**
  1. WhatsApp'ta karışık seçim (fotoğraf + PDF) paylaşımı kestirmeye **orijinal dosya** olarak geliyor mu, sırası korunuyor mu?
  2. A yolu: kestirmeden Google Drive'a (şirket hesabı) kaydetme güvenilir ve hızlı mı? Değilse B yolu.
  3. HD / belge olarak gelen fotoğrafla normal fotoğrafın çözünürlük farkı.
- **Kalite denemesi:** kullanıcının (maskelenmiş) 15–20 gerçek evrakı: bulanık fotoğraf, gölgeli fotoğraf, eğik çekim,
  kimlik ön/arka, tapu, CamScanner PDF'i, müşteri PDF'i, ekran görüntüsü. Her biri için önce/sonra karşılaştırması
  kullanıcıya gösterilir; ayarlar onaylanır.
- **OCR karşılaştırması:** aynı evraklarda Tesseract ve Windows OCR; Türkçe karakterlerle doğruluk.
- **Kabul:** 0. bölümdeki ölçütler; bir hafta gerçek kullanımda kayıp sıfır, Kontrol et oranı düşüyor.

## 11. Fazlar

| Faz | İçerik | Çıktı |
|---|---|---|
| 0 | Doğrulamalar + örnek evraklarla kalite/OCR denemesi | Seçilen kayıt yolu, onaylı kalite ayarı |
| 1 | Kestirme + Drive düzeni + işleyicinin çekirdeği (tanı, kalite, PDF, yerleştir, kayıt) | Evraklar masaüstüne düzgün PDF olarak düşer |
| 2 | OCR, tür bulma, bilgi çıkarma, iş adı, tekrar kontrolü | Doğru ad ve klasör |
| 3 | Kontroller, eksik evrak listesi + hazır mesajlar, bildirimler | Gecikmeleri önleyen uyarılar |
| 4 | Öğrenme (düzeltmeleri izleme), kural güncellemeleri | Zamanla sıfır düzeltme |
| İleride | Tam otomatik giriş (12. bölüm) | Paylaşım adımı da kalkar |

## 12. İleride tam otomatik

Kendi Tech Provider başvurusu (ücretsiz görünüyor; şirket doğrulaması + Meta incelemesi) onaylanırsa aynı numara
coexistence ile Cloud API'ye bağlanır; gelen evrak bir web kancasıyla doğrudan `0-Gelen`e paket olarak düşer
(gönderenin adı ve numarası `paket.json`a). Parça 2 ve 3 hiç değişmez. Başvuru ayrıca araştırılacak.

## 13. Kullanıcıdan beklenen kararlar

1. **İş adı** neyden kurulsun? (ada/parsel · tesisat/abone no · mahalle/adres · iş türü) — örnek bir klasör adı.
2. **Masaüstü kuyruğu:** (a) iş ilk evrak gelir gelmez mi kuyruğa girsin (EKSİK EVRAK önekiyle), yoksa yalnız evrak
   tamamlanınca mı? (b) Sıra en eski iş üstte mi, yoksa elle öncelik verilebilsin mi? (c) Kaç gün bekleyen iş uyarı versin?
   (d) "Bitti" işareti klasörü `✔ Bitti`ye sürüklemek mi olsun? (e) Tamamlananlar yıl / iş türüne göre mi ayrılsın?
3. **Tümü.pdf** (dağıtım şirketine tek dosya) gerekli mi? Dağıtım şirketinin dosya boyutu / renk / format şartı var mı?
4. **İş türüne göre gerekli evrak listeleri** (BHP için hangi evraklar, iç tesisat için hangileri…).
5. Şirket hesabı **Google Workspace** mi (alan adlı e-posta) yoksa Gmail mi? (Workspace'te yönetici kısıtı kontrolü)
6. `9-Arşiv` ve kapanan işler ne kadar saklansın?
7. Telefona bildirim istenir mi (e-posta özeti)?
8. Faz 0 için maskelenmiş 15–20 örnek evrak.

## Araştırma notları (dayanaklar)

- Coexistence yalnız Solution Partner / Tech Provider üzerinden: Meta, *Onboard WhatsApp Business app users* (developers.facebook.com).
- Cloud API'de kullanıcının başlattığı (gelen) mesajlar ücretsiz: üçüncü taraf fiyat rehberleri (Meta fiyat sayfası ayrıca kontrol edilecek).
- Resmî olmayan kütüphanelerde numara kapanma riski: whatsmeow-node SSS ve benzeri.
- Drive masaüstü uygulaması 4 hesaba kadar, her hesap ayrı sürücü harfi: Google Drive yardım (answer 10838124).
- Apps Script `doPost` için resmî gönderi boyutu sınırı bulunamadı (topluluk: ~50 MB; doğrulanmadı) → B yolunda dosya dosya gönderim.
- Apps Script web uygulaması POST'a 302 yönlendirmesiyle cevap verir; kestirme yönlendirmeyi izler (Faz 0'da denenecek).
- WhatsApp'ta "belge" olarak gönderilen fotoğraf sıkıştırılmaz; HD orijinal değildir: üçüncü taraf rehberler.
- Türkçe OCR: Tesseract `tur` verisi var; Windows OCR'ın Türkçe desteği ve doğruluğu kaynakla doğrulanamadı → Faz 0'da ölçülecek.
