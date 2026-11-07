# Devir notu: yeni oturum buradan devam etsin

## Kullanıcı
- Elektrik mühendisi (proje: iç tesisat, branşman, trafo). Türkçe konuşur; yazılım konusunda acemi.
- **Sade Türkçe**, teknik yazılım terimi yok. Adım adım; **bir iş tamamen bitmeden diğerine geçilmez.**
- Karmaşıklık istemez: sadece gerekli alanlar, kendi hesap yöntemi, kendi katsayıları.
- Değerlerin **doğru ve kaynaklı** olmasını ister (firma katalogları). Çizimlerin **mühendise yakışır, teknik** görünmesini ister.
- AutoCAD 2022 (tam sürüm) kullanır. Telefondan da bakar.

## Nerede ne var
- Depo: `aibyensar/projeisleri` (eski adı deneme). Bütün iş **`claude/laughing-dijkstra-5c7tbv`** dalında, **main'e henüz birleştirilmedi**.
  Yeni oturumda kullanıcıya sorup bu dalı main'e birleştirin (PR açıp onayla birleştirme).
- Yayındaki web uygulaması (claude.ai artifact, özel): https://claude.ai/artifact/7ozTZyAZtsX2Yng1KXgvk5
  Yayın kopyası oturumun geçici klasöründeydi; yeni oturumda depodan aynı yapıyla yeniden kurulup aynı URL'ye yayınlanmalı
  (`index.html` artifact iskeletine uygun: doctype/html/head/body etiketsiz; diğer dosyalar `files` ile).
- Ortam ağ izinleri (Bigchef ortamı): oznurkablo.com.tr, hes.com.tr, borsan, prysmian, ti-soft, topcable, megep.meb.gov.tr, insaatim.com.

```
index.html                 Ana sayfa (araç kartları)
araclar/kablo-kesiti.html  Branşman kablo kesiti (TAMAM)
araclar/ic-tesisat.html    İç tesisat hesabı; AutoCAD komutunu tarayıcıda çalıştırır (TAMAM)
autocad/kaynak/gerilimdusumu-kaynak.lsp   AutoCAD komutunun kaynağı (bunu düzenleyin)
autocad/olustur.js         → autocad/GERILIMDUSUMU.lsp ve ortak/gerilimdusumu-lsp.js üretir
autocad/test/calistir.js   Komutu örnek cevaplarla dener (3 senaryo)
autocad/test/onizleme.js   Çizimi PNG önizleme olarak üretir (ekran + kâğıt)
autocad/KURULUM.md         Kullanıcı için kurulum/kullanım
ortak/autolisp.js          Küçük AutoLISP yorumlayıcısı (Node + tarayıcı)
ortak/cizim-svg.js         Yorumlayıcının nesnelerini SVG'ye çevirir
veri/katalog.js            Öznur Kablo tabloları birebir (tüm sütunlar, dipnotlar)
veri/kablolar.js           Hesapta kullanılan akım değerleri (katalog.js'ten üretilir)
veri/KAYNAKLAR.md          Kaynaklar ve şartlar
```

Komutlar:
```
node autocad/olustur.js && node autocad/test/calistir.js && node autocad/test/onizleme.js <klasör>
```
Komutu değiştirince **mutlaka** üçünü çalıştırın ve önizleme PNG'sine bakın. Kullanıcıya önizleme resmi + yeni .lsp dosyası gönderilir.

## Kullanıcının hesap yöntemi (değiştirmeyin)
- Gerilim düşümü: `%e = c · N · L / S`; c = 100/(κ·U²) üç fazlı, 200/(κ·U²) tek fazlı; U 380/220 V, κ Cu 56, Al 35.
  Katsayılar 10⁻⁴ biriminde yuvarlanır: 0,0000124 (3~ Cu), 0,0000198 (3~ Al), 0,000074 (1~ Cu), 0,000118 (1~ Al).
- Sınırlar: normal tesisat %1,5, motor %3, trafo %5.
- Akım: In = Nt / (√3 · U · cos φ), cos φ 0,8 (iç tesisat). Iz firma kataloğundan, yeraltı/havai seçimine göre.
- Trifazede 16 mm²'ye kadar 4x, üstünde nötrü küçültülmüş 3x../.. (3x25/16 …) kullanılır.
- Faz kesitten: 2x, 3x (/'suz), tek damar linyede → monofaze; 4x, 5x, 3x25/16 → trifaze.
- Talep gücünü kullanıcı kendisi hesaplar (işlem yazabilir: `(16220*0,45)+5000`).
- İç tesisat: %e1 branşman hattı, %e2 kolon hattı, %e3 linye hattı; toplam ≤ %1,5. Branşman mevcut / yok iki durum.
- Kablo adları küçük x ile: `4x6 mm² NYY`, `3x2,5 mm² NYA`, `3x25/16 mm² NYY`.

## Kablo verisi
Öznur Kablo katalogları (Kasım 2026): NYY, N2XY, N2XH, NYM, NYA, NAYY, NA2XY; 2/3/4/5 damar ve 3x../.. tabloları.
Hes Kablo, Besav/Hanif, Koç Kablo ile karşılaştırıldı (fark %2–5). Firma tablosu ekranda birebir gösterilir.

## AutoCAD komutu GERILIMDUSUMU (ayar: GDAYAR)
- Soru sırası: Genel (branşman mevcut mu, kurulu güç, talep güç) → Branşman (kesit, tür, döşeme Yeralti/Havai, uzunluk, faz)
  veya Bağlantı fazı → hat sayısı → her hat (güç, kesit, tür, uzunluk, faz) → yazı yüksekliği, nokta.
  Her grup `──── KOLON HATTI (%e2) ────` başlığıyla. Sayılar noktayla girilir (AutoCAD virgül almaz).
- Çizim: katmanlar GD-CERCEVE 0,50 / GD-TABLO 0,18 / GD-YAZI / GD-BASLIK / GD-SONUC / GD-UYARI / GD-SEMA 0,35 / GD-DOLGU;
  çift çerçeve, başlık (sağ üstte mevcut branşman kablosu), 1. akım, 2. gerilim düşümü çizelgesi + formüller,
  3. tek hat şeması (Şebeke → branşman → AT sayaç panosu [kalın çerçeve, içinde AT] → kolon → TN1 [ışık tali dağıtım
  tablosu, alt yarısı dolu] → linye → yük oku), sonuç satırı.
- Gerçek AutoCAD'de bulunan hata: boş listede `nth` → "consp nil". Yorumlayıcı artık bu konuda katı; `=` yerine `eq`/`equal`.
- Hata olursa komut `HATA (adım): ...` yazar; kullanıcıdan F2 ekran görüntüsü istenir.

## Sırada (yol haritası, README.md)
Kullanıcı iç tesisat aracını henüz "tamam" demedi; son değişikliği (web aracının AutoCAD'le aynı olması) denemesi bekleniyor.
Sonra sırayla: kompanzasyon, trafo gücü seçimi, aydınlatma; teklif hazırlayıcı, keşif/metraj, hakediş; proje takip,
müşteri listesi, periyodik kontrol hatırlatıcı. Her yeni araçta önce kullanıcının kendi yöntemini/örneğini isteyin.

## Bağlantı hattı projesi (BHP) aracı — ilk sürüm yayında, kullanıcının denemesi bekleniyor (7 Kasım 2026)
Süreç: iç tesisat onayı → GDZ'ye başvuru → GDZ "Bağlantı Görüşü" PDF'i → kullanıcı BHP çizer. Araç bunu hızlandırır.
- Web: `araclar/baglanti-hatti.html`. Yüklenenler: GDZ görüşü PDF + iç tesisat PDF + TKGM ekran görüntüsü.
  Kullanıcı Bakır/Alüminyum seçer (kendi isteği), araç en küçük uygun kesiti önerir (en küçük kesit: Cu 6, Al 10 — kullanıcının kuralı, 7 Kasım 2026)
  İndirilen .zip: BHP-<başvuruNo>.dxf + 2 resim (aynı klasörde durmalı).
- Ortak kod: `ortak/bhp.js` (PDF yazılarından okuma, kablo seçimi, hesap, şablon doldurma). Tarayıcı ve Node aynı kodu kullanır.
- Şablon: `baglanti-hatti/BHP-SABLON.dxf`, kullanıcının kendi çiziminden (harmandalı_BHP.dxf, depoda YOK: kişisel bilgi)
  `baglanti-hatti/sablon-olustur.py` (ezdxf) ile üretilir. Değişen yazılar `{{ANAHTAR}}`; Excel/resim (OLE) nesneleri silindi,
  yerine çizgi+yazı: gerilim düşümü hesabı, güç dağılım tablosu, sayaç panosu içi. Uydu ve vaziyet resmi IMAGE (.\dosya.jpg).
  Resim boyutları sabit: uydu 2000x1087, vaziyet 2000x1056 (web aracı resmi kırpıp bu boyuta sığdırır).
  Yayında şablon `baglanti-hatti/BHP-SABLON.txt` adıyla durur (dxf web türü değil).
- Deneme: `node baglanti-hatti/test/dene.mjs <gdz.pdf> <ic.pdf> <klasör> al 16` (pdfjs-dist@4.10.38 gerekir, PDFJS ortam değişkeni).
  Önizleme için ezdxf + pymupdf ile DXF→PDF çizdirildi.
- Denenen: Faruk Erdoğan (20247913, geçici tesis/şantiye, 246/154, KARAALİ TR-1 C-23, 4 m, 8500 W) → 4x16 mm² NAYY, %0,04, 16,1 A < 78 A.
  Semih Işık (20254622, eski GDZ düzeni) GDZ okuması doğru.
- Okunamayanlar: iç tesisat PDF'inde sayaç tipi ve güç dağılım tablosu resim → varsayılan 3x10, "AT"; kullanıcı düzeltebilir.
- Bilinen eksikler: vaziyet planındaki direk/kablo/ada-parsel yazıları eski yerinde kalır, kullanıcı taşır. Havai hat yok
  (kullanıcı "yeraltı çiz" dedi). Tek bağımsız bölüm satırı. Monofaze bağlantı yok.
- 2. SÜRÜM (7 Kasım 2026, kullanıcı isteğiyle "en iyisini çıkaralım"):
  * Şablon iki kaynaktan: `python3 sablon-olustur.py <direkli harmandalı_BHP.dxf> <boxlu BHP.dxf> BHP-SABLON.dxf`.
    Direk ve box detayı blok olarak (BHP_DETAY_DIREK / BHP_DETAY_BOX); web aracı kullanılmayanın yerleşimini siler.
    Eski iç tesisat sembol listesi, eski tek hat şeması ve vaziyet lejantı silindi; bağlantı hattına özel 15 satırlık
    SEMBOL LİSTESİ çizildi. Dosya başında `999 BHP {...}` açıklaması: model alanı tutamacı ve bölgeler.
  * `ortak/bhp-cizim.js`: tek hat şeması (direk/box, korumalar sırayla, n sayaç), gerilim düşümü + akım hesabı (formül ve
    katalog kaynağı notlu), çok satırlı güç dağılım tablosu, MALZEME LİSTESİ. Aynı çizim DXF varlıklarına ve SVG önizlemeye çevrilir.
    HATCH yolunda 92=3 (dış sınır) olmalı, yoksa dolgu görünmez.
  * GDZ "Bağlantı Şekli" (Direk Bağlantısı / Box Çıkışı) okunur. Uzunluk = parsel dışı + parsel içi.
  * Başka mühendislerin iç tesisat PDF'lerinde yazılar çizgi olabilir → okunamaz; araç uyarır, kullanıcı elle girer.
    Güç dağılım tablosu için "daire sayısı + güç + ortak" ile satır üretme var.
  * Denenen: Ayşe Çelenk (20247911, box C-06, 15 BB, 57839 W, 12 m) → bakırda 3x25/16 mm² NYY (133 A), %0,34.
- İNDİRME: claude.ai içinde sayfa kendi başına dosya indiremiyor. Bağlantı hattı aracı AYRI artifact olarak yayında:
  https://claude.ai/artifact/Q1x2gsmhUeXconHbgmPmoK (`downloads` izniyle; claude.use("downloads").save). Yayın kopyası
  araclar/baglanti-hatti.html'den yollar düzeltilerek (../ → kök) üretilir; ana sitedeki kart bu adrese gider.
- RESİMDEN OKUMA (kullanıcı: "GDZ'den her türlüsü gelebilir, hepsini okuyabilmeli"): yazısı çizgi olan PDF'lerde
  "resimden oku" düğmesi → claude.use("sample") ile 2 adım: (1) küçük sayfa resimlerinde antet / güç dağılım tablosu /
  sayaç panosu bölgelerini bul, (2) o bölgeleri yüksek çözünürlükte kesip değerleri JSON olarak oku. Resimden okunan kutular
  turuncu kenarlı. GDZ yazısı için de aynı düğme var. Yayın: `python3 baglanti-hatti/yayin-hazirla.py <klasör>`;
  capabilities {downloads: true, sample: {images: true}}. Gerçek claude.ai'de henüz denenmedi (burada sahte yardımcıyla denendi).
- LOGO: kullanıcının yeni logosu `baglanti-hatti/logo/` (lacivert zeminli asıl + beyaz zeminli baskı hali). Henüz paftaya konmadı.
- PAFTA DÜZENİ: kullanıcı "proje düzensiz/karışık" dedi. Taslak önerildi (numaralı çerçeveli bölümler). Kullanıcı:
  kâğıt boyutu ve antetin (kapak) yeri kendi örneklerindeki gibi kalsın (antet sol altta), gerisini ben düzenleyeyim;
  ayrıca bir örnek yapıp gönderecek → örnek gelince paftayı yeniden düzenle.
- Sıradaki: kullanıcının örneğini bekle; kullanıcı Faruk Erdoğan ve Ayşe Çelenk işleriyle dener (AutoCAD'de açılıyor mu, resimler görünüyor mu, düzen doğru mu); geri bildirime göre düzelt.
  Sonra havai hat (kullanıcıdan havai BHP örneği istenecek).
