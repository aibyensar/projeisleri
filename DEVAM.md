# Devir notu: yeni oturum buradan devam etsin

## Kullanıcı
- Elektrik mühendisi (proje: iç tesisat, branşman, trafo). Türkçe konuşur; yazılım konusunda acemi.
- **Sade Türkçe**, teknik yazılım terimi yok. Adım adım; **bir iş tamamen bitmeden diğerine geçilmez.**
- Karmaşıklık istemez: sadece gerekli alanlar, kendi hesap yöntemi, kendi katsayıları.
- Değerlerin **doğru ve kaynaklı** olmasını ister (firma katalogları). Çizimlerin **mühendise yakışır, teknik** görünmesini ister.
- AutoCAD 2022 (tam sürüm) kullanır. Proje işlerini (BHP aracı) yalnız bilgisayardan yapar; telefon düzeni gerekmez.

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
baglanti-hatti/test/               dene.mjs (PDF → DXF), tarayici.js (eski), isaretle-dene.js + sahte-ic.py, onizleme.sh (DXF → PNG; ezdxf+pymupdf+pdftoppm,
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
- Resimden okuma: kullanıcı bölümleri sırayla işaretler (1d); işaretlenen yer 2400 px okunur. Güç tablosu: bantlariNumarala() yatay çizgileri piksel
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
1c. SİGORTA OKUMA — YAPILDI (7 Kasım 2026): kullanıcı "ana kesiciyi (branşmanın girdiği; cinsi projeden projeye değişir) ve bağımsız
   bölüm sayaçlarının önündeki kesicileri yanlış okuyor" dedi. Yeni istem (PANO_ISTEM): enerji yolu şebeke → branşman → ANA KESİCİ (en çok 2
   cihaz: sigorta / TMŞ / TMŞ+YKŞ / ayrı K.A.R) → bara → SAYAÇ ÖNÜ → sayaç; sayaç arkası, daire tabloları ve linye sigortaları sayılmaz.
   Sayaçlar tek tek ({no, tablo, onu}) okunur, satırlara tablo adıyla / sırayla eşlenir. 2 okuma (farklıysa 3), değer değer çoğunluk;
   tutmayanlar kırmızı (k1..k2, sayaç; tabloda onu hücresi). 3. bölümde pano kutusu: panonun resmi + "karşılaştırdım, doğru" (panoOnay,
   işaretlenmeden indirilmez) + "Sigortaları tekrar oku" + "Panonun yerini resimde ben göstereyim" (güç tablosuyla ortak seçim alanı, GS.hedef).
   Kullanıcıdan istenecek: yanlış okunan bir projenin kolon şeması / sayaç panosu (ekran görüntüsü) — istemi gerçek örnekle ayarlamak için.
1d. SIRAYLA İŞARETLEME — YAPILDI (7 Kasım 2026; 1b/1c'deki kendiliğinden bulma ve "ben göstereyim" düğmelerinin YERİNE geçti):
   kullanıcı "projeyi yükleyeyim, sırayla kapak (antet), güç dağıtım tablosu ve kolon şemasını ben işaretleyeyim, o okusun; yaklaşıp
   uzaklaşabileyim; güç tablosu olmayan projede elle gireyim" dedi. İç tesisat yüklenince (claude.ai'de) 1. bölümde gPanel: adım düğmeleri
   (1. Antet / 2. Güç dağıtım tablosu / 3. Kolon şeması; ✓, (yok), !), sayfa seçimi, − / + / Sayfayı sığdır, ▭ Çerçevele / ✋ Kaydır;
   iki parmakla yaklaş-kaydır, tekerlekle yaklaş; yakınlaşınca görünen yer keskin yeniden çizilir (gDetay). "Çerçevelediğim yeri okut ve
   devam et" yalnız o yeri okur (antetOku, gucOkuUygula, panoOku) ve sıradaki adıma geçer; adıma geri dönülünce eski çerçeve görünür.
   "Bu projede güç dağıtım tablosu yok, elle gireceğim": satırlar antetteki bağımsız bölüm sayısından boş açılır (sayaç önü korunur),
   resim onayı istenmez. PDF yazısından okunanlar önceliklidir (D.icYazi). Otomatik bölüm arama (bolumBul) KALDIRILDI.
   Deneme: test/sahte-ic.py (sahte PDF) + test/isaretle-dene.js (sahte cevaplar). Gerçek claude.ai'de kullanıcı henüz denemedi.
1e. SAYAÇ ÖNÜ — DÜZELTİLDİ (7 Kasım 2026): kullanıcı "sayaç önlerini okuyamadı, elle girecek yer de yok; ana kesiciyi okuyor" dedi.
   Sebep: okunan sayaçlar güç tablosu satırlarına ad/sayı tutmayınca boş bırakılıyordu. Şimdi eşleme: ad (boşluk/nokta/tire yok sayılır) →
   sıra (sayılar eşitse) → onuOrtak → tek değer → sırayla/en çok geçen (kırmızı işaretli). İstemde sayaç önü ayrıntılı tarif edildi
   (ana kesiciden farklı, sayaç sembolünün önünde, HER sayaç ayrı, onuOrtak, sayacSayisi). Hiç bulunamazsa ONU_ISTEM ile yalnız sayaçlara
   bakan 2 ek okuma. Elle giriş: 3. bölüm korumalar grubunda "Sayaç önü sigorta (bütün sayaçlara…)" kutusu (a-onuHepsi) bütün satırlara
   yazar, kırmızıları kaldırır; farklıysa 4. bölüm tablosunda tek tek. Deneme: SENARYO=A|B|C node test/isaretle-dene.js.
1f. GÜÇ TABLOSU SADE (7 Kasım 2026): kullanıcı "güç dağılımda sayaç önü sigortaları girmeye gerek yok, onlar yalnız tek hat şemasında
   lazım" dedi. 4. bölüm tablosundan "Sayaç önü" sütunu ve satır üretmedeki sayaç önü kutuları kaldırıldı (SUTUN'da onu yok; veri satırda
   r.onu olarak durur, tek hat şeması kullanır). Sayaç önü yalnız 3. bölümde: "Sayaç önü sigorta (bütün sayaçlara)" + açılır "sayaç sayaç"
   listesi (onuListe; farklıysa / kırmızı varsa kendiliğinden açılır). Kırmızılar ayrı sayılır (D.gucFark güç, D.onuFark sayaç önü).
   Paftadaki güç dağıtım tablosunda zaten sayaç önü sütunu yoktu.
1g. BİLGİSAYAR DÜZENİ + ONAY (7 Kasım 2026): kullanıcı "3. bölümde kontrol için resme yaklaşabilmeliyim; doğru dediğim halde indir
   açılmıyor; tasarım karmaşık; bu iş HİÇ telefondan yapılmayacak, hep PC" dedi. → Telefon düzeni gerekmez. main 1400 px; 1. bölümde 3
   yükleme yan yana; işaretleme paneli solda adımlar + okut düğmesi, sağda büyük görüntü (74vh; tekerlek yaklaş, sürükle çerçeve, sağ tuş
   kaydır). 3. ve 4. bölüm iki sütun (.iki): solda alanlar / tablo, sağda .kontrol kutusu; kontrol resimleri yakinKur() ile yakınlaştırılır
   (tekerlek, sürükle, çift tık / Sığdır). İndir: "doğru" kutusu işaretlenince gucKontrol hataları ve kırmızılar kilitlemez, "Dikkat" olur
   (gucOnay artık 4. bölümde tablonun altında, hata/kırmızı/resim varsa görünür). Eksikler 7. bölümde madde madde. Bölümler: 1-5, 6 Vaziyet,
   7 İndir (malzeme/notlar gizli). Test görüntüsü 1440 px.
1h. SAYFA YAPISI (7 Kasım 2026): kullanıcı "kontrol resmi değerlerle aynı hizada, yan yana olsun; gereksiz şeyleri gösterme; ileride havai
   hat eklenecek, önce GDZ yüklensin, havaiyse havai sayfası, yeraltıysa yeraltı sayfası açılsın (havai şimdilik boş)" dedi.
   Düzen: 1. GDZ (yükleme + hat türü seçimi #hatTur, GDZ'deki hatTipi'ne göre seçilir, değiştirilebilir) → #sayfaHavai (boş, "hazırlanıyor")
   ya da #sayfaYeralti: 2. İç tesisat (yükleme + işaretleme paneli) · 3. Okunan bilgileri kontrol: üç blok, her biri solda değerler sağda
   yakınlaştırılabilir resim (Antet → alan-antet + antetResim [yeni], Güç tablosu → tablo + gucResim, Sayaç panosu → alan-pano + onuListe +
   panoResim) · 4. Bağlantı hattı (alan-gdz: GDZ alanları) ve kablo + hesap + açılır çizim önizlemesi · 5. Vaziyet (TKGM yükleme burada;
   uydu seçimi yalnız bulunamazsa) · 6. İndir. ALANLAR grupları HEDEF ile kutulara dağıtılır. Toplu satır üretme açılır kutuda
   (tablo yoksa kendiliğinden açılır). HAVAİ HAT: sayfaHavai'yi doldurmak sıradaki büyük iş (örnek proje istenecek).
1i. ANA KESİCİ – KABLO UYUMU (7 Kasım 2026; kullanıcı: "125 A ana kesicili yere Iz 118 A kablo koyarsan ne olur?"): kural I ≤ In ≤ Iz.
   bhp.js anaKesiciA(korumalar): sigorta/TMŞ/TMŞ+YKŞ değerinden A (K.A.R sayılmaz, birden çoksa en küçük); hesap(k,N,L,In) → kUygun
   (In ≤ Iz), ibUygun (I ≤ In); uygun = %e ≤ 1,5 ve I ≤ Iz ve In ≤ Iz; kabloOner In ile. Web: "Koruma uyumu" satırı; ana kesici yoksa ya da
   Iz < In ise indirilmez; In < I uyarı. DXF hesap çizelgesi: "Ana kesici anma akımı In" satırı + "3. KORUMA UYUMU" adımı + sonuç cümlesi.
1j. GDZ KONTROL PANELİ: 1. bölümde GDZ okununca solda hat türü + "GDZ yazısından okunanlar" (alan-gdz: başvuru no [dosya adı], enerji
   alınan yer, faz, direk/box, parsel dışı/içi, proje tarihi) + gdzOnay; sağda GDZ sayfası (yakınlaştırılır, sayfa düğmeleri). gdzOnay
   olmadan indirilmez. 4. bölüm artık "Kablo seçimi ve hesap". Deneme: test/sahte-gdz.py (yazılı sahte GDZ; havai için 2. argüman) +
   isaretle-dene.js <tmp> <ic.pdf> <gdz.pdf> [havai-gdz.pdf] → indirme ve zip içeriği dahil.
   AÇIK (kullanıcının 7 Kasım listesi): 1) tasarım daha iyi olabilir, 3) semboller özellikle tek hatta istediği gibi değil, 4) pafta düzeni
   iyileştirilmeli — üçü için kullanıcıdan ayrıntı / örnek istendi.
1k. TEK HAT SEMBOLLERİ (kullanıcının fotoğrafları, 7 Kasım 2026): YKŞ ve K.A.R → kutu içinde iki uç, açık bıçak, açma üçgeni + ×,
   basamaklı mandal (sembol.ykş); sigorta → hat üzerinde kutu, kutup sayısı kadar dikey çizgi, çapraz ok (sembol.sigorta); TMŞ → IEC
   devre kesici (×). Kurallar: YERALTI KABLOSU KESİK ÇİZGİ; YKŞ/K.A.R etiketi "YKŞ / 4x63A / 300 mA" (her zaman 300 mA); kesiciler ve
   sayaç önleri "10kA / 4x40A" (her zaman 10kA); KABLO, SİGORTA vb. YAZILARDA x HER ZAMAN KÜÇÜK (kesiciEtiket()). Bazı işlerde YKŞ yerine
   kesici + K.A.R gelir (iki koruma sırayla çizilir). Tek hat standart çerçevede, 300x118 sanal kutuda çizilip büyütülür.
1l. PAFTA DÜZENİ: baglanti-hatti/pafta-duzen.py (kapak-ekle.py'den sonra, bir kez; 999 json'a "duzen": 1). Sol sütun (x -267.8..13):
   açıklamalar / uydu / vaziyet (+ geçiş uyarısı) / güç tablosu + vaziyet sembolleri / kapak + PVC tablosu; orta (18..388): montaj detayı /
   kablo kanalı / tek hat / hesap / semboller (0,824 ölçek); sağ: TEDAŞ metni. Her bölüm aynı çerçeve (kalın) + 7 birim başlık şeridi
   (blok() hem python'da hem bhp-cizim.js'te). Montaj detayı eski çizimi donustur ile çerçeveye büyütülür.
   AÇIK: 1) web aracının tasarımı (kullanıcı: "kalabalık, renkler cansız, daha modern, proje sayfası gibi, beni etkile").
1m. KESİCİ KURALLARI (kurum): TRİFAZEDE KESİCİ HER ZAMAN 4 KUTUP (iç tesisatta 3x25A yazsa bile projede 4x25A), MONOFAZEDE 2 KUTUP;
   sigortalar (ana kesici de sayaç önü de) HER ZAMAN 10kA; YKŞ / K.A.R HER ZAMAN 300 mA. bhp.js kesiciDuzelt(deger, tur, faz) → "4x25A 10kA";
   web: okunan değerler ve elle girilen kutular (change) düzeltilir, faz değişince hepsi yeniden yazılır; bhp-cizim kesiciEtiket(k, faz).
   GDZ kontrolü: bütün sayfalar değil, yalnız gerekli kısımlar (gdzKirpBul: bilgi tablosu etiketleri, enerji noktası + alt satırı,
   AG bağlantı hattı satırı + başlığı; 70 pt'den uzak kümeler ayrı parça) alt alta tek resim; yazı yoksa 1. sayfa.
2. Kullanıcı gerçek işlerde deneyip eksikleri bildirecek (iç tesisat okuma sonuçları, "sembollerde hâlâ hata" — hangileri olduğu sorulmadı/
   gelmedi).
3. Havai hat çizimi yok (örnek istenecek). 4. Dal (claude/laughing-dijkstra-5c7tbv) main'e birleştirilmedi (kullanıcıya sorulmadı/cevapsız).

**Yeni oturumda ilk iş:** bu dosyayı okuyun; kullanıcıya kısaca durumu söyleyin; kapak için kullanıcının görüşünü alın (1. madde).
Değişiklikten sonra: şablon (gerekirse) → on.cjs benzeri örnekle DXF üret → onizleme.sh ile PNG'ye BAKIN → web tarayıcı denemesi →
yayin-hazirla.py → publish → commit/push → DEVAM.md güncelle → kullanıcıya önizleme + örnek zip.
