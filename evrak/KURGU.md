# Evrak Toplayıcı — kurgu (sürüm 3, 8 Kasım 2026)

WhatsApp'tan (ve PC'deki WhatsApp'tan, kağıt taramadan) gelen evrakı en az el işiyle kaliteli PDF yapıp masaüstündeki
**Çizilecek Projeler** listesine doğru adla koymak. Bu belge kurgudur; onaylanmadan kurulum yapılmaz.
Müşteri bilgisi bu depoya hiçbir zaman yazılmaz (örnek evraklar dahil).

---

## 0. Kullanıcı kararları (8 Kasım 2026)

| Konu | Karar |
|---|---|
| WhatsApp | Normal WhatsApp, kendi numarası; ayrı hat yok; ücretsiz; kural dışı program yok |
| Telefon / PC | iPhone · Windows |
| Google | Şirket hesabı **normal Gmail** (Workspace değil). PC'deki şahsi Drive yedeklemesine dokunulmaz |
| Gönderen | **Yalnız kullanıcı** (tek iPhone) |
| Diğer kanallar | **PC'deki WhatsApp** ve **kağıt / tarama** (tarayıcı ya da CamScanner) |
| Evrak türleri | Her çeşit: fotoğraf, müşteri PDF'i, CamScanner PDF'i, Word/Excel. Kalite şart |
| Masaüstü | Yalnız **çizilecek projeler** görünür |
| Listeye giriş | **İlk evrak gelince** (eksikse EKSİK EVRAK durumuyla) |
| Kestirmenin sorduğu | **Elektrikçi adı, proje adı, proje türü — üçünü de kullanıcı yazar** (ör. tür: İç Tesisat · Bağlantı Hattı · İç Tesisat + Bağlantı Hattı) |
| Klasör adı | **Tarih · ELEKTRİKÇİ – Proje adı · Proje türü · Durum** |
| Sıra | En eski en üstte; **ACİL** işaretli iş en üstte |
| Gecikme uyarısı | **3 gün** |
| PDF çıktısı | Her evrak türü **ayrı PDF + tek birleşik Tümü.pdf** |
| İş bitince | Kullanıcı klasörü **masaüstündeki kendi proje klasörüne taşır**; listeden kalkar. Ayrı aşama takibi yok |
| Bildirim | **Her paket** işlenince telefona özet |
| PC açık kalma | Düzensiz; sabit saat yok |

## 1. Başarı ölçütleri

| Ölçüt | Hedef |
|---|---|
| Telefonda süre | Paket başına ≤ 10 saniye (seç → paylaş → işi seç) |
| PC'de süre | Sıfır; yalnız KONTROL durumundaki işlere bakılır |
| Masaüstüne düşme | PC açıksa ≤ 2 dakika; kapalıysa açıldıktan sonra ≤ 2 dakika |
| Tür doğruluğu | İlk ay ≥ %90, kurallar öğrendikçe ≥ %97 |
| Kalite | Okunaklı, düz, gölgesiz; renkli evrak renkli; orijinal her zaman saklı |
| Kayıp | Sıfır: hiçbir dosya silinmez, üstüne yazılmaz; emin olunamayan KONTROL'e |
| Ücret | Sıfır |

## 2. Neden bu yol (özet)

Aynı numarayla tam otomatik resmî yol yalnız ücretli aracı firma ya da Meta onaylı Tech Provider ile mümkün; resmî
olmayan programlar numara riskli. Bu yüzden: **iPhone Kestirmesi (tek paylaşım) + Google Drive + PC'de işleyici**.
Görüntü işleme (belge taraması) ücretsiz bulut servislerinde yapılamadığı için PC'de.

| Yol | Ücret | Aynı numara | Otomatiklik | Risk | Karar |
|---|---|---|---|---|---|
| Meta Cloud API, ayrı hat | 0 | Hayır | Tam | Yok | Kullanıcı istemedi |
| Meta + aracı firma (coexistence) | Aylık | Evet | Tam | Yok | Ücretli |
| Kendin Tech Provider ol | 0 (görünüşe göre) | Evet | Tam | Onay belirsiz, haftalar | İleride |
| Resmî olmayan WhatsApp Web programı | 0 | Evet | Tam | Numara kapanabilir | Reddedildi |
| Sohbeti dışa aktar → Drive | 0 | Evet | Yarı | Yok | Bütün sohbeti taşır |
| Telegram botu | 0 | Evet | Yarı | Yok | Ek uygulama; kestirme daha kısa |
| **iPhone Kestirmesi + Drive + PC işleyici** | **0** | **Evet** | **Yarı (tek paylaşım)** | **Yok** | **Seçilen** |

## 3. Mimari

```
 GİRİŞLER                                  GOOGLE DRIVE (şirket Gmail)               PC (Windows)
 ─────────                                 ──────────────────────────               ─────────────
 iPhone: WhatsApp / CamScanner / Dosyalar   AGY Evrak/
   → Paylaş → "AGY Evrak" kestirmesi  ──►     0-Gelen/<paket>/ + paket.json  ──►   Evrak İşleyici
 PC: WhatsApp masaüstü, tarayıcı, e-belge                                          (arka planda, açılışta başlar)
   → masaüstündeki "Evrak Bırak"  ─────►      (PC girişi de buraya paket bırakır)      │
     ya da sağ tık → Gönder → AGY Evrak                                                 ▼
                                             Çizilecek Projeler/  ◄──────────────  PDF, okuma, tür, birleştirme,
                                               ! ACİL · 2026-11-07 · … · HAZIR            adlandırma, yerleştirme
                                               2026-11-03 · … · EKSİK EVRAK         Telefona özet e-postası
                                               _LİSTE.txt                            Windows bildirimi
                                             8-Kontrol Et/ · 9-Arşiv/
                                             Kayıt.csv · kurallar.json

 Masaüstü: "Çizilecek Projeler" kısayolu · "Evrak Bırak" kısayolu
 İş bitince: kullanıcı iş klasörünü kendi proje klasörüne sürükler → listeden kalkar, Kayıt.csv'ye "bitti" yazılır
```

## 4. Giriş 1 — iPhone Kestirmesi "AGY Evrak"

**Nereden:** WhatsApp (mesajlara basılı tut → Seç → işaretle → Paylaş), CamScanner (Paylaş), Dosyalar, Mail eki.

**Sorular (kullanıcının kararı: üçünü de kendisi yazar):**
1. **Elektrikçi adı** (yazılır)
2. **Proje adı** (yazılır)
3. **Proje türü** (yazılır; ör. İç Tesisat · Bağlantı Hattı · İç Tesisat + Bağlantı Hattı)
4. **ACİL mi?** (Evet / Hayır)
5. Not (isteğe bağlı)

Hız için tek kolaylık: kestirme açılınca önce **"Son iş: <ELEKTRİKÇİ> – <Proje>'ye mi eklensin?"** diye sorar; aynı işe
art arda evrak atarken üç alanı yeniden yazmak gerekmez. "Hayır" denince üç soru gelir.

**Aynı işi tanıma (yazım farkına karşı):** program elektrikçi + proje adını Türkçe büyük harfe çevirip boşluk ve
noktalama farklarını yok sayarak karşılaştırır ("Ahmet usta / ahmet  USTA" aynı). Birebir aynıysa mevcut işe ekler.
Çok benziyor ama aynı değilse (ör. tek harf farkı) yeni iş açmaz: mevcut işe ekler ve `_bilgi.txt` + özet e-postasında
"yazım farkı: '<yazılan>' → '<mevcut>' işine eklendi" der; kullanıcı yanlışsa paketi elle taşır. Hiç benzemiyorsa yeni iş.
Bitmiş (listeden kalkmış) bir işle aynı ad yazılırsa iş REVİZYON olarak açılır.

**Proje türü:** yazılan metin sadeleştirilip tanınan türlerle eşleştirilir (İÇ TESİSAT, BAĞLANTI HATTI, KOMPANZASYON…;
"+" ile birleşik türler). Gerekli evrak listesi tanınan türlerin birleşimidir (İç Tesisat + Bağlantı Hattı = ikisinin
listeleri toplamı). Tanınmayan tür klasör adına yazıldığı gibi girer, durum YENİ olur (gerekli evrak bilinmediği için).

**Yaptığı:** dosyaları **olduğu gibi** (yeniden sıkıştırmadan) `0-Gelen/<tarih_saat_kod>/`e kaydeder, yanına `paket.json`
(elektrikçi, proje adı, proje türü, acil, not, dosya sırası, telefon saati) yazar, "N evrak gönderildi" bildirimi verir.

**Kaydetme yolu (Faz 0'da denenip biri seçilecek):** (A) *Dosyalar* içindeki Google Drive konumuna doğrudan; (B) şirket
hesabındaki küçük Apps Script web uygulamasına gönderim (kesin "alındı" onayı; dosya dosya). İnternet yoksa A kuyruğa
alır, B "gönderilemedi, tekrar dene" der; hiçbir şey kaybolmaz.

## 5. Giriş 2 — PC: "Evrak Bırak"

PC'deki WhatsApp'tan sürüklenen dosyalar, tarayıcıdan çıkan PDF'ler, e-Devlet / e-posta belgeleri için:
- Masaüstündeki **Evrak Bırak** simgesine dosyaları sürükle **ya da** dosyalara sağ tık → *Gönder* → *AGY Evrak*.
- Küçük bir pencere açılır: telefondaki aynı sorular (elektrikçi adı, proje adı, proje türü, ACİL, not; açık işler
  listesinden tıklayarak da doldurulabilir). Tamam → dosyalar paket olarak
  `0-Gelen`e kopyalanır (asıl dosyalara dokunulmaz) ve aynı işlemden geçer.
- Tarayıcı yazılımının kayıt klasörü istenirse `Evrak Bırak` klasörü yapılır; yeni tarama gelince pencere kendiliğinden açılır.

## 6. Drive klasör düzeni

```
AGY Evrak/
  0-Gelen/                          ham paketler (işlenince 9-Arşiv'e taşınır)
  Çizilecek Projeler/               ◄── MASAÜSTÜ KISAYOLU
    ! ACİL · 2026-11-07 · <ELEKTRİKÇİ> – <Proje adı> · <Proje türü> · HAZIR/
    2026-11-03 · <ELEKTRİKÇİ> – <Proje adı> · <Proje türü> · EKSİK EVRAK/
    2026-11-05 · <ELEKTRİKÇİ> – <Proje adı> · <Proje türü> · KONTROL/
    _LİSTE.txt                      sıra, bekleme günü (3 gün uyarısı), eksikler — bir bakışta
  8-Kontrol Et/                     hiçbir işe bağlanamayan evrak (sebebiyle)
  9-Arşiv/                          işlenmiş ham paketler = orijinallerin ikinci kopyası (saklama süresi: karar)
  Kayıt.csv                         her evrak bir satır: tarih, iş, tür, kaynak, durum, bitiş tarihi
  kurallar.json                     iş türleri, gerekli evrak listeleri, tür anahtar kelimeleri, adlandırma

İş klasörünün içi:
  Kimlik.pdf  Tapu.pdf  Vekaletname.pdf  …   düzeltilmiş, aranabilir (Ctrl+F) PDF'ler
  Tümü.pdf                                   hepsi tek dosyada, kurallardaki sırayla
  _orijinal/                                 gelen dosyaların değişmemiş kopyası
  _bilgi.txt                                 iş bilgisi, evrak listesi, eksikler, müşteriye hazır mesaj, uyarılar
  .is-kimligi                                gizli; program işi bununla tanır
```

**Adlandırma ve sıralama — sık ad değiştirme hatasına karşı:**
- Sıra **tarih önekiyle** sağlanır (Windows ad sırası = en eski üstte); `! ACİL` öneki en üste çıkar. Numara (01, 02…)
  kullanılmaz; numara kullanılsaydı her iş bitişinde bütün klasörlerin adı değişirdi.
- Bekleme günü ve 3 gün uyarısı **klasör adına yazılmaz** (her gün ad değişirdi); `_LİSTE.txt`, Windows bildirimi ve
  telefon özetinde gösterilir.
- Durum (HAZIR / EKSİK EVRAK / KONTROL) **sonda**; yalnız durum değişince güncellenir. Klasörde açık dosya varsa
  (Windows adı değiştirmeye izin vermez) değişiklik ertelenir, sonra tekrar denenir; hata vermez, işi bozmaz.
- Kullanıcı adı elle değiştirirse program gizli `.is-kimligi`nden tanır; kullanıcının verdiği ad korunur, yalnız sondaki
  durum sözcüğü güncellenir.
- Türkçe büyük harf doğru (i→İ, ı→I); Windows'ta yasak karakterler temizlenir; yol ≤ 200 karakter; aynı ad varsa ` (2)`.

**İş bitince:** kullanıcı klasörü kendi proje klasörüne sürükler. Drive açısından klasör Drive'dan çıkar (Drive çöpüne
düşer, 30 gün sonra silinir); kalıcı kopya kullanıcının proje klasöründedir (şahsi Drive yedeklemesi o klasörü kapsıyorsa
onunla yedeklenir — kontrol edilecek). Orijinallerin ikinci kopyası `9-Arşiv`de saklama süresi boyunca durur.
Program klasörün kalktığını fark eder, `Kayıt.csv`ye bitiş tarihini yazar.

**Revizyon:** listeden kalkmış bir işe yeni evrak gelirse (kestirmede eski işler "Bitenler" altında aranabilir), iş
`… · REVİZYON` olarak yeniden açılır; içinde yalnız yeni evrak olur, `_bilgi.txt` "önceki evrak kendi proje
klasörünüzde" der.

## 7. PC Evrak İşleyici (adım adım)

Windows açılınca kendiliğinden başlar (saat yanında simge: çalışıyor / işliyor / hata). Yerel çalışır.
PC uzun süre kapalı kaldıysa açılışta biriken paketleri **geliş sırasıyla** işler; bekleme günleri telefonun gönderim
saatine göre hesaplanır (PC'nin açıldığı saate göre değil).

1. **Bekleme:** `paket.json` geldi ve dosya boyutları 10 saniye sabit → işle (eşitleme yarıdayken işlemez).
2. **Tanıma:** fotoğraf (JPG/PNG/HEIC/WEBP) · PDF (metinli / taranmış) · Word/Excel/diğer · ZIP (açılır). Video/ses atlanır (kayda not).
3. **Kalite** (fotoğraf ve taranmış PDF sayfası):
   - bulanıklık / çözünürlük ölçümü → okunamayacak kadar kötüyse işlenir ama KONTROL + "yeniden gönderin" hazır mesajı;
   - kenar bulma + perspektif düzeltme (bulunamazsa kırpmadan bırakır); yön düzeltme;
   - gölge / sarılık giderme, kontrast; **renk:** mühür, imza, kimlik, fotoğraf varsa renkli, yoksa gri;
   - A4, 300 dpi eşdeğeri; dosya boyutu sınırı ayarlanabilir;
   - **zaten düzgün olana dokunulmaz:** CamScanner / müşteri PDF'i, metinli PDF, temiz ekran görüntüsü olduğu gibi kalır.
4. **Okuma (OCR, Türkçe, yerel):** Tesseract `tur` ya da Windows OCR — Faz 0'da gerçek evrakla karşılaştırılıp seçilir.
   Çıktı aranabilir PDF.
5. **Tür bulma:** `kurallar.json` anahtar kelimeleri + güven puanı. Başlangıç: Kimlik, Tapu, Vekaletname, İmar durumu,
   Aplikasyon/Kroki, Yapı ruhsatı, İskan, Abonelik/Sözleşme, Fatura, Muvafakatname, Vergi levhası, İmza sirküleri,
   Ticaret sicil, Proje/Çizim, Diğer. Güven düşükse dosya adı `Belirsiz-1.pdf`, iş durumu KONTROL.
6. **Bilgi çıkarma (kontrol için):** ad-soyad, TC no (11 hane + resmî kontrol algoritması), il/ilçe/mahalle, ada/parsel,
   tesisat/abone no, tarihler → `_bilgi.txt`.
7. **Kontroller (uyarı, engel değil):** aynı işte farklı ada/parsel; tapu maliki ↔ kimlik / vekaletname uyumu;
   kimlik süresi; vekaletnamenin tarihi.
8. **Birleştirme:** aynı türdeki sayfalar tek PDF (tapu ön/arka), sıra = paylaşım sırası; `Tümü.pdf` kurallardaki sırayla
   (her yeni evrakta yeniden üretilir).
9. **Yerleştirme:** iş klasörüne; orijinaller `_orijinal/`e; ham paket `9-Arşiv/`e. Aynı türden ikinci evrak gelirse
   eskisi silinmez: `Tapu (2).pdf` (KONTROL notu: "iki tapu var, doğru olan hangisi?").
10. **Tekrar kontrolü:** aynı dosya (özet değeri) ya da yeniden sıkıştırılmış aynı fotoğraf (görsel benzerlik) tekrar
    eklenmez; kayda "tekrar" yazılır.
11. **Durum:** iş türünün gerekli evrak listesi tamam ve KONTROL sebebi yok → HAZIR; eksik varsa EKSİK EVRAK
    (eksikler + müşteriye hazır WhatsApp mesajı `_bilgi.txt`de); bulanık / belirsiz / çelişki → KONTROL.
12. **Liste:** `_LİSTE.txt` güncellenir (ACİL'ler, sonra en eski; bekleme günü; 3 günü geçenler işaretli).
13. **Kayıt:** `Kayıt.csv`.
14. **Bildirim (her paket):** Windows bildirimi + şirket Gmail'inden kullanıcının telefonuna kısa özet e-postası
    ("<Elektrikçi> – <Proje>: 4 evrak işlendi · durum HAZIR · 3 günü geçen 2 iş var"). E-posta Google içinde kalır;
    üçüncü bir bildirim servisine kişisel veri gitmez. (Gönderim için şirket Gmail'inde "uygulama şifresi" gerekir.)
15. **Öğrenme:** kullanıcı bir dosyanın adını değiştirirse (ör. `Belirsiz-1.pdf` → `İmar durumu.pdf`) program bunu
    fark eder, yalnız tür + anahtar kelime bilgisini `duzeltmeler.txt`ye yazar (kişisel veri yok); kurallar buna göre güncellenir.
16. **Güncelleme:** kurallar `kurallar.json` ile (Drive'dan okunur); program yeni sürüm dosyasıyla.

## 8. Güvenlik ve KVKK

- Kişisel veri yalnız: kullanıcının iPhone'u → şirket Google Drive'ı → kullanıcının PC'si (+ özet e-postası aynı Gmail).
  OCR yerel; yapay zekâya, üçüncü servise, bu depoya gönderilmez.
- Şirket Gmail'inde **iki adımlı doğrulama** açık olmalı (uygulama şifresi için de şart); `AGY Evrak` kimseyle paylaşılmaz.
- B yolunda kestirme gizli anahtarla gönderir; anahtar yalnız telefonda ve Apps Script'te.
- Program kayıtlarında (log) kişisel veri yok.
- `9-Arşiv` saklama süresi şirket kararı; program süresi dolanı **silmez**, yalnız listeler.
- Faz 0 örnek evrakları maskeli olmalı, depoya girmez.

## 9. Uç durumlar

| Durum | Davranış |
|---|---|
| PC günlerce kapalı | Paketler Drive'da bekler; açılınca geliş sırasıyla işlenir; bekleme günü telefon saatine göre |
| PC kapalıyken aynı iş için iki paket | Aynı elektrikçi + proje adı yazıldığı için işleyici ikisini aynı işe koyar |
| Elektrikçi / proje adında yazım farkı | Çok benziyorsa mevcut işe eklenir ve bildirilir; hiç benzemiyorsa yeni iş |
| Tanınmayan proje türü | Yazıldığı gibi kullanılır; durum YENİ (gerekli evrak listesi yok) |
| Eşitleme yarıda | Boyutlar sabitlenene kadar beklenir |
| Klasörde dosya açıkken durum değişti | Ad değişikliği ertelenir, tekrar denenir |
| Kullanıcı klasör adını değiştirdi | Gizli kimlikle tanınır; ad korunur |
| Kullanıcı klasörü taşıdı / sildi | "Bitti" sayılır; Kayıt.csv'ye yazılır; orijinaller 9-Arşiv'de |
| Bitmiş işe yeni evrak | REVİZYON olarak yeniden açılır |
| Aynı türden iki evrak | İkisi de saklanır, KONTROL |
| Bir pakette iki kişinin evrakı (malik + vekil) | Hepsi aynı işe; kişiler `_bilgi.txt`de |
| Bulanık / karanlık / parmak | İşlenir + KONTROL + hazır "yeniden gönderin" mesajı |
| Şifreli PDF | Olduğu gibi konur, uyarı |
| Tek PDF'te karışık evrak | Bölünmez; tür "Karma", sayfa listesi `_bilgi.txt`de |
| Video / ses / konum | Atlanır, kayda not |
| Çok büyük dosya | PDF boyutu sınırı aşarsa kalite kademeli düşer; orijinal saklı |
| İşleyici çöktü | Paket 0-Gelen'de kalır; yeniden başlayınca dener; 3 denemede olmazsa 8-Kontrol Et |
| Drive dolu (Gmail 15 GB, Gmail + Fotoğraflar ile ortak) | Uyarı; 9-Arşiv temizliği önerilir |
| E-posta gönderilemedi (internet yok) | Kuyrukta bekler, sonra gönderilir |
| iOS / WhatsApp güncellemesi kestirmeyi bozdu | Kestirme 1 dakikada yeniden kurulur; işleyici etkilenmez |
| Windows SmartScreen uyarısı | İmzasız program; kurulum rehberinde "yine de çalıştır" gösterilir |

## 10. Kurulum (onaydan sonra)

| Kim | Ne | Süre |
|---|---|---|
| Kullanıcı | Şirket Gmail'inde iki adımlı doğrulama + uygulama şifresi (özet e-postası için) | 5 dk |
| Kullanıcı | PC'de Drive masaüstü uygulamasına şirket hesabını **2. hesap** olarak eklemek (4 hesaba kadar; ayrı sürücü harfi) | 5 dk |
| Kullanıcı | iPhone'a Google Drive uygulaması (A yolu) + kestirmeyi bağlantıdan eklemek | 3 dk |
| Benim | Kestirme, işleyici (tek kurulum dosyası), Evrak Bırak penceresi, `kurallar.json`, ekran görüntülü rehber | — |
| Kullanıcı | İşleyiciyi kurmak; masaüstüne iki kısayol (Çizilecek Projeler, Evrak Bırak) | 5 dk |

## 11. Test ve kabul

- **Faz 0 (kurmadan önce, kullanıcının telefonunda ~10 dk):** WhatsApp'ta karışık seçim (fotoğraf + PDF) kestirmeye
  orijinal dosya olarak ve sırayla geliyor mu · A yolu (Drive'a doğrudan kayıt) hızlı ve güvenilir mi, değilse B ·
  HD / belge / normal fotoğraf çözünürlük farkı · PC'deki WhatsApp'tan sürükle-bırak.
- **Kalite denemesi:** maskeli 15–20 gerçek evrak (bulanık, gölgeli, eğik, kimlik ön/arka, tapu, CamScanner PDF'i,
  müşteri PDF'i, ekran görüntüsü, tarayıcı çıktısı); önce/sonra karşılaştırması kullanıcıya gösterilir, ayar onaylanır.
- **OCR karşılaştırması:** Tesseract ↔ Windows OCR, Türkçe karakterlerle.
- **Kabul:** 1. bölüm ölçütleri; bir hafta gerçek kullanımda kayıp sıfır, KONTROL oranı düşüyor.

## 12. Fazlar

| Faz | İçerik |
|---|---|
| 0 | Doğrulamalar + kalite / OCR denemesi |
| 1 | Kestirme + Evrak Bırak + Drive düzeni + işleyici çekirdeği (tanı, kalite, PDF, yerleştir, liste, kayıt, bildirim) |
| 2 | OCR, tür bulma, birleştirme, Tümü.pdf, tekrar kontrolü |
| 3 | Gerekli evrak → HAZIR / EKSİK, hazır mesajlar, kontroller, 3 gün uyarısı |
| 4 | Öğrenme ve kural güncellemeleri |
| İleride | Tam otomatik giriş (Tech Provider onayı) — yalnız giriş değişir |

## 13. Kullanıcıdan beklenenler (kalan)

1. ~~Proje adı örnekleri~~ — kullanıcı her seferinde kendisi yazıyor; gerek kalmadı.
2. **Proje türleri (İç Tesisat, Bağlantı Hattı, …) ve her biri için gerekli evrak listesi** (HAZIR / EKSİK kararı buna bağlı). Liste gelene kadar durum
   yalnız YENİ / KONTROL olur.
3. **Faz 0 için maskeli 15–20 örnek evrak.**
4. `9-Arşiv`deki orijinaller ne kadar saklansın? (öneri: 1 yıl)
5. Kendi proje klasörün nerede ve şahsi Drive yedeklemesi o klasörü kapsıyor mu? (iş bitince tek kopya orada kalır)

## Araştırma notları (dayanaklar)

- Coexistence yalnız Solution Partner / Tech Provider üzerinden: Meta, *Onboard WhatsApp Business app users*.
- Cloud API'de gelen (kullanıcının başlattığı) mesajlar ücretsiz: üçüncü taraf fiyat rehberleri.
- Resmî olmayan kütüphanelerde numara kapanma riski: whatsmeow-node SSS ve benzeri.
- Drive masaüstü uygulaması 4 hesaba kadar, her hesap ayrı sürücü harfi: Google Drive yardım (answer 10838124).
- Apps Script `doPost` resmî gönderi sınırı bulunamadı (topluluk ~50 MB) → B yolunda dosya dosya gönderim; POST'a
  302 yönlendirmesiyle cevap verir (Faz 0'da denenecek).
- WhatsApp'ta "belge" olarak gönderilen fotoğraf sıkıştırılmaz; HD orijinal değildir: üçüncü taraf rehberler.
- Türkçe OCR: Tesseract `tur` var; Windows OCR Türkçe doğruluğu doğrulanamadı → Faz 0.
