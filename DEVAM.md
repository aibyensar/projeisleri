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

## Bağlantı hattı projesi (BHP) aracı — 3. sürüm yayında, kullanıcı AutoCAD'de deniyor (son güncelleme 7 Kasım 2026)
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
Son gönderilen zip'ler: v6 (tek pafta).

**AÇIK KONULAR (sıradaki)**
1. Kullanıcının AutoCAD görüntüsünde güç dağılım tablosunda yalnız 2 satır vardı (14 ve ORTAK, toplam 32040 W): nasıl doldurduğu
   soruldu (resimden oku mu, satır üret mi). Cevaba göre resimden okumayı sağlamlaştır.
2. Kullanıcı v6 zip'lerini AutoCAD'de kontrol edecek; geri bildirimlere göre düzelt.
3. Kapaktaki küçük GDZ logosu okunamadı (OLE) — kullanıcı resim olarak gönderirse eklenecek.
4. Havai hat çizimi yok (kullanıcıdan havai BHP örneği istenecek).
5. Kullanıcının "örnek yapıp atacağım" dediği şey gelmedi.
6. Dal (claude/laughing-dijkstra-5c7tbv) hâlâ main'e birleştirilmedi; kullanıcıya sade dille sorulacak.
