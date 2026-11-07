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

## Yeni iş: Bağlantı hattı projesi (BHP) aracı — başlandı (7 Kasım 2026)
Süreç: iç tesisat onayı → GDZ'ye başvuru → GDZ "Bağlantı Görüşü" PDF'i → kullanıcı BHP çizer. Amaç: PDF'leri yükle, BHP hazır çizilsin.
- Örnek: GDZ görüşü 20254622 (Semih Işık, 106/9, YENİ HARMANDALI TR-2 A-21, yeraltı AG 10 m, kurulu 31,56 kW, talep 14,22 kW)
  ve kullanıcının çizimi harmandalı_BHP (DWG okunamadı; PDF'i incelendi). Dosyalar depoda yok (kişisel bilgi).
- GDZ PDF'inden okunacaklar: başvuru no, sahibi, adres, ada/parsel, kullanım, hat tipi/uzunluk (parsel dışı/içi), kurulu/talep güç,
  bağımsız bölüm, bağlantı noktası (direk adı), bağlantı şekli; 8. sayfadaki uydu görüntüsü (projede üstte kullanılıyor).
- BHP paftası: sabit kısımlar (açıklamalar, kesit-sigorta tablosu, şartname yazıları, kablo kanalı detayı, kablo başlığı detayı,
  sembol tabloları, "geçiş izinleri" notu, AGY Mühendislik anteti) + değişenler (antet yapı/arsa/güç bilgileri, güç dağılım tablosu,
  gerilim düşümü hesabı [A.G. PANOSU (GDZ) → ADP, %e1 = c·N·L/S], akım kontrolü [N/527], tek hat şeması [direk → kablo → sayaç
  panosu: 10kA 4x63A sigorta, K.A.R 4x63A 300mA, elektronik 3x10A sayaç, 1x16 pano topraklama], vaziyet planı [TKGM ekran görüntüsü]).
- Kullanıcı cevapları: sigorta/KAR/sayaç değerleri iç tesisat projesinden gelir (iç tesisat PDF'i yükleyebilir);
  vaziyet planı görüntüsü TKGM'den; havai hat projeleri de var (farklılıklar olur, sonra ele alınacak); kablo adı küçük x.
- Sıradaki: kullanıcıdan aynı binanın iç tesisat proje PDF'ini istemek → önce yeraltı için web aracı → onay → AutoCAD komutu.
