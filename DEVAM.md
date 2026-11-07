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

## Bağlantı hattı projesi (BHP) aracı — v8.5 (son güncelleme 8 Kasım 2026)
Süreç: iç tesisat onayı → GDZ'ye başvuru → GDZ "Bağlantı Görüşü" PDF'i → kullanıcı BHP çizer. Araç bunu hızlandırır.
Kullanıcı artık aracı **gerçek işlerde kullanıp eksikleri zamanla bildirecek**; her geri bildirimi tek tek, onay alarak düzeltin.

**Yayın:** https://claude.ai/artifact/Q1x2gsmhUeXconHbgmPmoK (capabilities `downloads`, `sample: {images: true}`; claude.ai içinde indirme
`claude.use("downloads").save`, resimden okuma `claude.use("sample")`). Yayın: `python3 baglanti-hatti/yayin-hazirla.py <klasör>` →
Artifact publish (url aynı; değişen dosyalar `files` ile: ortak/bhp.js, ortak/bhp-cizim.js, baglanti-hatti/BHP-SABLON.txt, baglanti-hatti/logo/agy-kapak.png). Yayında
okunmamış dosyayı değiştirirken önce `read` + `path` gerekir.

**Dosyalar**
```
araclar/baglanti-hatti.html        Web aracı (iç tesisat okuma, güç tablosu, vaziyet işaretleme, indirme)
ortak/bhp.js                       PDF yazılarından okuma (GDZ, iç tesisat antet, gucTablosuOku), kontrol (gucKontrol, bbSayisi), kablo/hesap
ortak/bhp-cizim.js                 Her işte değişen çizimler: tekHat, detay (montaj), hesap, gucTablosu, vaziyet → DXF + SVG önizleme
baglanti-hatti/sablon-olustur.py   Şablonu kurar: python3 baglanti-hatti/sablon-olustur.py box.json direk.json baglanti-hatti/BHP-SABLON.dxf
baglanti-hatti/araclar/dwg-oku.mjs DWG → JSON (@mlightcad/libredwg-web; npm i ile, node_modules'ın olduğu klasörde çalıştırılır)
baglanti-hatti/araclar/json-dxf.py JSON → DXF (ezdxf; dwg2dxf derlemeye izin verilmedi)
baglanti-hatti/BHP-SABLON.dxf      Üretilmiş şablon; 1-2. satır `999 / BHP {json}` (model tutamacı, bölgeler, resim kutuları)
baglanti-hatti/test/               dene.mjs (PDF → DXF), tarayici.js (eski), guc-tekrar-dene.js, onizleme.sh (DXF → PNG; ezdxf+pymupdf+pdftoppm,
                                   ~/.fonts/arial.ttf + arialbd.ttf = Liberation), resimden-oku-dene.js (sahte cevaplarla okuma akışı)
```
Kaynak DWG'ler (kullanıcının GDZ'den onaylı boxlu ve direkli BHP'si) ve iç tesisat örnek PDF'leri depoda YOK (kişisel bilgi) — gerekince
kullanıcıdan istenir. Depoya müşteri adı/kişisel bilgi YAZMAYIN (bir commit bu yüzden reddedildi).

**Şablon (pafta):** kullanıcının onaylı BOXLU projesinin DWG'si temel (kâğıt -269.5..684.6 x 5393.6..6293.6, 954x900 mm). Sabit kısımlar
kullanıcının çiziminden: elektrik tesisatı açıklamaları, PVC boru çapı tablosu (vektör, şablonda çizildi), kablo kanalı detayı + uyarı yazısı,
kuvvetli/zayıf akım sembol tabloları, vaziyet sembol kutusu, "geçiş izinleri" uyarısı, antet (AGY), TEDAŞ "Enerji kabloları uygulama usul ve
esasları" (doğru sırayla birleştirilip iki eşit sütuna dizildi; alıntı altta çerçeveli). Sadeleştirme: bloklar/ölçüler çizgiye açık, tek yazı
tipi Arial (BHP / BHP-K), renkler katmandan (7), çizgi tipleri yalnız BHP-KESIK / BHP-GIZLI, taramaların sınır bayrağı (f & 2) | 1
(yoksa AutoCAD "HATCH expected group code 47 — drawing discarded" verir; AutoCAD hatasında kullanıcıdan F2 ekranı isteyin).
Bölgeler (999 json): tekhat [18,5714,386,5841], hesap [18,5847,386,5986], detay [68,6141,386,6290], guc [-267.5,5673,-79,5803];
resimler uydu ve vaziyet aynı boyut 277x150 mm, web resmi boşluksuz doldurur (cover), 2000x1083 px. Malzeme listesi / genel notlar / yük
cetveli paftada YOK (kullanıcı istemedi).

**Kullanıcı kuralları (çizim):** box KÜÇÜK KARE, direk ÇEMBER (vaziyet, tek hat, hesap şeması); sayaç panosu vaziyette iki dolu üçgen ve
işaretlenen parsel sınırına paralel; sayaçlar baradan YUKARI (bara → sayaç önü 3~ W otomat → 3~ sayaç → iç tesisat); semboller kullanıcının
sembol tablosundan (TMŞ/YKŞ IEC); pano topraklaması pano gövdesinin sağ alt köşesinden; topraklama iletkeni faz ≤35 mm² → 1x16 NYY, üstü
≥ S/2 standart kesit; "Trifaze 380 V" yazılmaz; gri başlık dolgusu yok; "20 °C" yazılmaz; montaj detayı ölçüleri (kablo 100 cm, pano alt
kotu 1 m, kazık L=2 m) onaylı. Hesap: bakır/alüminyumu kullanıcı seçer; en küçük Cu 6, Al 10 mm²; trifaze 16'ya kadar 4x, üstü 3x../..;
monofaze 3 damar; c 0,0000124/0,0000198 (3~), 0,000074/0,000118 (1~); I = N/527 (3~), N/176 (1~); Iz Öznur katalog, toprak; hat YERALTI.

**İç tesisat okuma (EN ÖNEMLİ KONU; kullanıcı "yanlışsız olmalı" dedi; DWG yolu REDDEDİLDİ, yalnız PDF):**
- Kullanıcının örneklerinde güç tablosu PDF'te yazı DEĞİL (çizgi/OLE), bazı PDF'lerde hiç yazı yok, sayfalar çok geniş (8300x1644 pt).
- Yazı varsa: icTesisatOku (sagindaki ilk yazı öbeğinde durur), gucTablosuOku (sütun başlıklarının ortası; ı/i için büyük harf).
- Resimden okuma (b-ro-ic, yazıdan okunamayan bilgi varsa kendiliğinden başlar): 1) sayfa en/boy oranına göre parçalar → antet / güç / pano
  yeri; 2) %35 pay ile yakınlaşıp kesin sınır; 3) her bölüm 2400 px ayrı okunur. Güç tablosu: bantlariNumarala() yatay çizgileri piksel
  taramasıyla bulur, bantlara kırmızı numara yazar; 2 okuma (farklıysa 3), bant numarasıyla eşleşip hücre çoğunluğu; şüpheli hücre kırmızı;
  W/kW kararı antet kurulu güçle; "tablo yükleme cetveli / yük dağılımı" güç tablosu sayılmaz; tek BB'de satır antetten.
- gucKontrol: Σkurulu = antet, satır sayısı = BB, bağlantı ≤ kurulu → hata varsa İNDİR kapalı; resimden okunduysa tablonun numaralı resmi
  gösterilir ve "karşılaştırdım, doğru" kutusu (gucOnay) işaretlenmeden indirilmez. PDF yazısından gelen antet değerleri önceliklidir.
- Gerçek claude.ai'de (sample) kullanıcı HENÜZ DENEMEDİ; dene.mjs/ resimden-oku-dene.js yalnız akışı sahte cevaplarla dener.

**AÇIK KONULAR (sıradaki)**
1. KAPAK — YAPILDI (7 Kasım 2026, kullanıcı henüz "tamam" demedi): kullanıcı KAPAK.dxf'i (DXF AC1021, 61 MB, rar içinde) gönderdi.
   `baglanti-hatti/kapak-ekle.py KAPAK.dxf BHP-SABLON.dxf` antetin yerine koyar (sablon-olustur.py'den sonra; KAPAK.dxf depoda YOK,
   gerekirse kullanıcıdan istenir). Kapak 1/5 ölçekle antet kutusuna (-267.83..-78.14 x 5394.67..5670.91) oturur; sığsın diye yalnız boş
   yerler kısaltıldı (imza/EMO kutusu, alttaki 3 onay kutusu, arsa satırı ile güç tablosu arasındaki boş şerit). Yazılar Arial, hücre
   ortalı (mühendis/yapı tablosunda sola dayalı), ODA SİCİL / BÜRO düzeltildi. Yer tutucular: MALSAHIBI KULLANIM ADRES IL ILCE BELEDIYE
   MAHALLE PAFTA ADA PARSEL KURULUW TALEPW (yalnız sayı, başlıkta (W) var) BB KAT ALAN YAPISINIFI. Üstteki logo şeridi DWG'de gömülü
   resim (OLE → EMF+ içinde PNG); çıkarılıp lacivert zemin + logo (gerçek oranında; kullanıcının AutoCAD'inde yatay gerilmişti) +
   iletişim bilgileri olarak `logo/agy-kapak.png` yazılır, DXF'e {{LOGO}} resmi olarak bağlanır; web aracı zip'e ekler (4 dosya).
   Kullanıcıya sorulacak: logo şeridi böyle uygun mu, kısaltılan kutular yeterli mi.
1b. GÜÇ TABLOSU TEKRAR OKUMA — YAPILDI (7 Kasım 2026): kullanıcı gerçek işte "güç tablosunu çekemedi, tıkanıp kalmayalım" dedi.
   4. bölümde (iç tesisat yüklenince, claude.ai'de) kutu: "Güç tablosunu tekrar oku" (yalnız tablo; bilinen yer varsa orası, yoksa yalnız
   tablo aranır; diğer alanlara dokunmaz, sayaç önü sigortalar eski satırlardan korunur) ve "Tabloyu resimde ben göstereyim" (sayfa seç,
   sürükleyerek alan seç, Yakınlaştır / Bütün sayfa, "Seçtiğim alanı oku"). Kod: bolumBul, gucTablosunuOku, gucYenidenOku (html).
   Antet/pano okuma hatası artık bütün okumayı durdurmaz. Deneme: baglanti-hatti/test/guc-tekrar-dene.js (sahte cevaplar).
   Kullanıcıya sorulacak: önceki denemede ekranda ne yazıyordu (neden okunamadığı bilinmiyor); yeni düğmelerle deneyip sonucu bildirsin.
2. Kullanıcı gerçek işlerde deneyip eksikleri bildirecek (iç tesisat okuma sonuçları, "sembollerde hâlâ hata" — hangileri olduğu sorulmadı/
   gelmedi).
3. Havai hat çizimi yok (örnek istenecek). 4. Dal (claude/laughing-dijkstra-5c7tbv) main'e birleştirilmedi (kullanıcıya sorulmadı/cevapsız).

**Yeni oturumda ilk iş:** bu dosyayı okuyun; kullanıcıya kısaca durumu söyleyin; kapak için kullanıcının görüşünü alın (1. madde).
Değişiklikten sonra: şablon (gerekirse) → on.cjs benzeri örnekle DXF üret → onizleme.sh ile PNG'ye BAKIN → web tarayıcı denemesi →
yayin-hazirla.py → publish → commit/push → DEVAM.md güncelle → kullanıcıya önizleme + örnek zip.
