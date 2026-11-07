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

## Bağlantı hattı projesi (BHP) aracı — v6 (tek pafta) yayında, kullanıcı AutoCAD'de deniyor (son güncelleme 7 Kasım 2026)
Süreç: iç tesisat onayı → GDZ'ye başvuru → GDZ "Bağlantı Görüşü" PDF'i → kullanıcı BHP çizer. Araç bunu hızlandırır.

**Yayın:** ayrı artifact https://claude.ai/artifact/Q1x2gsmhUeXconHbgmPmoK (capabilities: `downloads: true`, `sample: {images: true}`).
claude.ai içinde sayfa izinsiz dosya indiremez; indirme `claude.use("downloads").save` ile. Ana sitedeki kart bu adrese gider.
Yayın klasörü: `python3 baglanti-hatti/yayin-hazirla.py <klasör>` (yolları ../ → kök yapar, şablonu .txt adıyla koyar), sonra publish.

**Dosyalar**
```
araclar/baglanti-hatti.html         Web aracı (depodaki hali ../ yollu; yayın kopyası yayin-hazirla.py ile)
ortak/bhp.js                        PDF yazılarından okuma (GDZ görüşü, iç tesisat), kablo seçimi, hesap, notlar, malzeme, yer tutucular
ortak/bhp-cizim.js                  Her işte değişen çizimler → DXF varlıkları + SVG önizleme (tek hat, hesap, güç dağılım,
                                    malzeme, notlar, vaziyet işaretleri); dxfeEkle() şablona ekler, kullanılmayan detayı siler
baglanti-hatti/sablon-olustur.py    Şablonu kurar (ezdxf, yeni boş R2018 DXF)
baglanti-hatti/BHP-SABLON.dxf       Üretilmiş şablon; başında `999 BHP {json}` (model tutamacı, bölgeler, resim kutuları)
baglanti-hatti/kapak.json           Kullanıcının KAPAK.dwg'si (araclar/dwg-oku.mjs, @mlightcad/libredwg-web convert())
baglanti-hatti/logo/agy-logo.png    Kullanıcının logosu (beyaz zeminli baskı hali; logo-lacivert.png asıl)
baglanti-hatti/test/dene.mjs        Node denemesi: node dene.mjs <gdz.pdf> <ic.pdf> <klasör> cu|al <enküçük> [elle.json]
                                    (PDFJS ortam değişkeni = pdfjs-dist/legacy/build/pdf.mjs yolu; npm i pdfjs-dist@4.10.38 jszip)
baglanti-hatti/test/tarayici.js     Playwright ile sayfayı baştan sona doldurur, indir butonunu dener, zip indirir
                                    (yollar eski oturuma göre; önce kökte python3 -m http.server 8765; cdnjs node_modules'tan verilir)
baglanti-hatti/test/onizleme.sh     DXF → PNG önizleme (onizleme-ciz.py, ezdxf+pymupdf+pdftoppm). Çizimi değiştirince MUTLAKA bakın.
baglanti-hatti/yayin-hazirla.py     Yayın klasörü kurar
```
Şablon üretimi: `python3 baglanti-hatti/sablon-olustur.py <harmandalı_BHP.dxf> <boxlu BHP.dxf> baglanti-hatti/kapak.json baglanti-hatti/logo/agy-logo.png baglanti-hatti/BHP-SABLON.dxf`
Kaynak DXF'ler (kullanıcının direkli ve boxlu projeleri) depoda YOK (kişisel bilgi); yeni oturumda gerekirse kullanıcıdan tekrar istenir.

**Pafta:** TEK PAFTA (1 / 1). Kullanıcının kâğıdı 954 x 900 mm, antet (kapak) sol altta. Bölüm başlıklarında NUMARA YOK
(kullanıcı istemedi). Bölümler: vaziyet (TKGM), GDZ krokisi, bağlantı detayı (direk/box), kablo kanalı detayı, tek hat,
gerilim düşümü + akım, güç dağılım, malzeme, sembol listesi, genel notlar (8 madde + kazı izni), şerit. Sağ sütunda
TEDAŞ "Enerji Kabloları Uygulama Usul ve Esasları" metni aynen, 2 sütun. Tek yazı tipi Arial, siyah baskı.
**Sayaç önü sigorta:** satırlarda "onu" alanı; tek hatta her sayaç grubu baradan inen dal: sigorta → sayaç → iç tesisat;
malzemede "Sayaç önü sigorta ..." adetli. Birden çok satır varsa ve biri boşsa İNDİR kapalı ("İndirmek için eksik: ...").
Resimler eksikse yalnız uyarı (indir açık, zip'e konmaz).
Zip: BHP-<no>.dxf + <no>-uydu.jpg + <no>-vaziyet.jpg + agy-logo.png — kullanıcı zip'i AYIKLAYIP açmalı (içinden açınca salt okunur).

**Kullanıcı kuralları:** bakır/alüminyumu kullanıcı seçer; en küçük kesit Cu 6, Al 10 mm²; trifaze 16'ya kadar 4x, üstü 3x../..;
monofaze 3 damarlı, c 0,000074/0,000118, I = N/176; trifaze I = N/527. Iz: Öznur katalog, toprak. Hat şimdilik hep YERALTI.

**Özellikler:** GDZ "Bağlantı Şekli" (Direk/Box Çıkışı) okunur; uzunluk = parsel dışı + içi; çok bağımsız bölüm (satır üretme);
yazısı çizgi olan PDF'ler için "resimden oku" (claude.use("sample"), 2 adım: bölge bul → kesip oku; turuncu kutular;
gerçek claude.ai'de HENÜZ DENENMEDİ); vaziyet planında TKGM resmine tıklayarak direk/box, sayaç panosu, dönüş noktaları →
paftaya sembol + güzergâh + etiket (etiketlerde GDZ'deki direk/box adı; çakışmasın diye boş yer arar); notlar ve malzeme düzenlenebilir.

**Teknik dersler:** HATCH yolu 92=3 olmalı; yeni DXF'te msp.dxf.extmin/extmax + set_modelspace_vport yoksa AutoCAD boş görünür;
DIMENSION içe alınırken kaybolur → önce explode(); katalogda "1.5" sayi() ile 15 okunuyordu → parseFloat; yazı genişliği
genislik() (AutoCAD yüksekliği büyük harf yüksekliği); önizleme için ~/.fonts/arial.ttf = Liberation Sans + `python3 -m ezdxf --fonts`.
Tarayıcı denemesinde cdnjs erişilemiyor → playwright route ile node_modules'tan verilir.

**Denenen işler:** Faruk Erdoğan (20247913, direk KARAALİ TR-1 C-23, 4 m, 8500 W) ; Ayşe Çelenk (20247911, box MURADİYE TR-5
(BELEDİYE KABİN) C-06, 12 m, 15 BB, 57839 W, iç tesisatı Talha Kır çizmiş, yazıları çizgi) ; Semih Işık (20254622, eski düzen).
Son gönderilen zip'ler: v6 (tek pafta). Kullanıcının yüklediği PDF/resimler yeni oturumda YOK; deneme için tekrar istenir.
Ayşe işinde elle girilenler: 14 adet D1..D14 (kurulu 12820 W, bağlantı 6728 W, sayaç önü 4x32A 10kA) + ORTAK (19220 W, 4x40A 10kA),
talep 57839 W, kurulu 198700 W, koruma TMŞ+YKŞ 4x125A 300mA, KONUT, SIĞ+Z+3, 922 m², 14+1 BB.

**Son istekte (v6) yapılanlar:** tüm bölümler tek paftada (pafta 2 kalktı, şartname sağ sütuna); başlık numaraları kaldırıldı;
sayaç önü sigortaları tabloda, tek hatta (her grup ayrı kol: sigorta → sayaç → iç tesisat) ve malzemede; indir butonu yalnız
gerçek eksikte kapanır ve altında "İndirmek için eksik: …" yazar. Kullanıcının uyarısı: "eksik olursa revize gelir, eksiksiz olmalı".

**8 Kasım oturumu (v7 — onaylı proje düzeni, yayında sürüm 9):** kullanıcı "çizimler amatörce, montaj detayı eksik, pano parsel
çizgisine paralel olmalı" dedi ve GDZ'den onaylı iki projesini (boxlu: Aslı İnan, direkli: Semih Işık; PDF + DWG) gönderdi.
- Şablon artık kullanıcının onaylı boxlu DWG'sinin kendisi (aynı kâğıt -269.5..684.6 x 5393.6..6293.6). Kurulum:
  `node baglanti-hatti/araclar/dwg-oku.mjs X.dwg X.json` (npm i @mlightcad/libredwg-web, araclar klasöründe çalıştırılır) →
  `python3 baglanti-hatti/sablon-olustur.py box.json direk.json baglanti-hatti/BHP-SABLON.dxf`.
  `baglanti-hatti/araclar/json-dxf.py` libredwg JSON'unu DXF'e çevirir (dwg2dxf derlemek izin verilmedi). DWG/JSON'lar depoda YOK (kişisel bilgi).
- DWG'deki Excel tabloları ve resimler OLE olduğu için gelmez: boru çapı tablosu şablonda çizildi; güç dağıtım tablosu, yük dağılımı
  cetveli (yeni, BHPCizim.cetvel), gerilim düşümü, tek hat (kullanıcının düzeni: daire/box, kesikli kablo + ok, kesikli "mühürlenebilir alan")
  bhp-cizim.js ile 999 bölgelerine çizilir. Montaj detayı: boxlu ve direkli projeden ayrı bloklar (kullanılmayan silinir).
- Malzeme listesi ve genel notlar paftadan çıktı (onaylı projelerde yok); web sayfasında o kartlar gizli. Zip'te logo yok (3 dosya).
- Vaziyette "3. Parsel sınırı (2 nokta)": pano bu çizgiye paralel; pano sembolü kullanıcının sembol tablosundaki gibi (iki dolu üçgen),
  güzergâh kırmızı kesikli. Çizgi tipleri BHP-KESIK / BHP-GIZLI (kullanıcının DASHED'i çok sık).
- v7.1: kullanıcı "açınca PC donuyor, içerik yok, yazı boyutu/şekli toparla" dedi. Şablonda sadeleştirme: bloklar ve ölçüler çizgiye
  açıldı, elips → çoklu çizgi, nokta/boş yazı silindi, bütün yazılar Arial (BHP/BHP-K), MTEXT biçim kodları temizlendi, renkler katmandan
  (hepsi 7), çizgi tipleri yalnız BHP-KESIK/BHP-GIZLI, kullanılmayan blok/çizgi tipi/stil silindi, taşan tablo yazıları daraltıldı.
  Asıl neden bulundu (kullanıcının F2 ekranı): "HATCH ... expected group code 47 — drawing discarded". Kullanıcının DWG'sindeki taramaların
  sınır bayrağında "türetilmiş" (4) biti vardı; AutoCAD o zaman 47 kodunu bekliyor. json-dxf.py ve sablon-olustur.py bayrağı (f & 2) | 1 yapar.
  AutoCAD hatası olursa: kullanıcıdan F2 ekranı iste (satır no + kod verir).
- v7.2: hesap bölümü yeniden: solda "hesapta kullanılan değerler" tablosu, sağda hat şeması + 1. gerilim düşümü, 2. akım kontrolü (uygunluk
  kutuları) + sonuç satırı. Tek hatta "TEK HAT ŞEMASI" başlığı, yazı boyları sadeleştirildi.
- Eşzamanlılık katsayısı satırı konmadı (onaylı projedeki 0,43 hesapla tutmuyor); kullanıcıya sorulacak.

**v8 (yayında sürüm 12) — kullanıcının 12 maddelik geri bildirimi:**
1. Güç dağıtım tablosu: BHP.gucTablosuOku (PDF yazısından, sütun başlıklarının ortasına göre; ı/i için büyük harfe çevirerek),
   resimden okumada tablo 2. kez okunup karşılaştırılır (D.gucFark), BHP.gucKontrol (Σkurulu = antet, satır = BB adedi, bağlantı ≤ kurulu)
   hata varsa İNDİR kapalı. Gerçek iç tesisat PDF'iyle HENÜZ DENENMEDİ (kullanıcıdan örnek istendi).
2. Resimler eşit (277x150 mm), web kirpVeSigdir "cover" (boşluksuz, ortadan kırpar); RESIM 2000x1083.
3/7. Semboller: tek hatta kullanıcının sembol tablosundaki 3~ W otomat, 3~ buşonlu, 3~ sayaç, topraklama; TMŞ/YKŞ IEC.
   KULLANICI KURALI: box küçük KARE, direk ÇEMBER (vaziyet, tek hat, hesap şeması). Pano = iki üçgen (kendi lejantı); etiketler dolgusuz, altı çizili.
   Montaj detayı ölçüleri (kablo 100 cm, pano alt kotu 1 m, kazık L=2 m) kullanıcı tarafından onaylandı.
4. Montaj detayı JS'de (BHPCizim.detay) baştan: box/direk, beton kaide, pano, Ø100 PVC boru, ikaz şeridi, kum yatağı, 100 cm,
   parsel sınırı, parsel dışı/içi ölçüleri, topraklama iletkeni + kazığı. Şablondaki eski detay blokları kullanılmıyor.
5. Yük dağılımı cetveli kaldırıldı. 6. "20 °C" kaldırıldı. 8. Sayaçlar baradan YUKARI. 9. topraklamaKesit: ≤35 → 16, üstü ≥ S/2 standart.
10. Gri başlık dolguları kaldırıldı. 12. Usul ve esaslar: metin sırası (sağ sütun → sol alt [Madde 4..6] → k) MTEXT → sol üst [Madde 7..])
   birleştirilip paragraflara ayrıldı, gerçek Arial ölçüsüyle (ezdxf.fonts) iki eşit sütuna dizildi, alıntı altta çerçeveli.

**AÇIK KONULAR (sıradaki)**
0. v7'yi kullanıcı AutoCAD'de görecek; montaj detayına ne eklenmesini istediği soruldu (onaylı projelerdeki detay aynen kondu).
1. Kullanıcının AutoCAD görüntüsünde güç dağılım tablosunda yalnız 2 satır vardı (14 ve ORTAK, toplam 32040 W): nasıl doldurduğu
   soruldu (resimden oku mu, satır üret mi). Cevaba göre resimden okumayı sağlamlaştır.
2. Kullanıcı v6 zip'lerini (tek pafta, sayaç önü sigortalı) AutoCAD'de kontrol edecek; geri bildirimlere göre düzelt.
3. Kapaktaki küçük GDZ logosu okunamadı (OLE) — kullanıcı resim olarak gönderirse eklenecek.
4. Havai hat çizimi yok (kullanıcıdan havai BHP örneği istenecek).
5. Kullanıcının "örnek yapıp atacağım" dediği şey gelmedi.
6. Dal (claude/laughing-dijkstra-5c7tbv) hâlâ main'e birleştirilmedi; kullanıcıya sade dille soruldu, cevap bekleniyor.
7. Gerçek claude.ai'de "resimden oku" (sample) ve indirme (downloads) akışı kullanıcı tarafından henüz doğrulanmadı.

**Yeni oturumda ilk iş:** kullanıcıya v6'yı AutoCAD'de açıp açmadığını ve gördüğü eksikleri sorun (ekran görüntüsü isteyin);
1 ve 6 numaralı soruların cevabını alın. Değişiklikten sonra: dene.mjs + tarayici.js + onizleme.sh → bak → yayin-hazirla.py →
aynı URL'ye publish (files: ortak/bhp.js, ortak/bhp-cizim.js, baglanti-hatti/BHP-SABLON.txt; capabilities korunur) → commit/push
→ DEVAM.md güncelle → kullanıcıya önizleme PNG + zip gönder.
