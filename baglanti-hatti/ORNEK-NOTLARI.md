# Onaylı havai bağlantı hattı örnekleri: notlar (13 Kasım 2026)

Kullanıcı 5 onaylı proje (PDF) gönderdi. "Kesin kabul etme" dedi: bazı yerlerde hata ya da birbirini tutmayan kabuller var.
Müşteri adı, adres ve parsel bilgisi buraya yazılmadı. Örnekler numarayla anılıyor.

## Örneklerin özeti

| No | Hat | Yeni direk | İniş / bina girişi | Cer hesabı |
|---|---|---|---|---|
| 1 | ALPEK 3x25+35, 20+25+25 = 70 m | 3 (K1, 8I, 8I) | NYY 4x6, 10 m | Tam (vektör şemaları, 4 direk) |
| 2 | NYY 4x6 havai, 15 m | 1 (10I) | NYY 4x6, 10 m | Yalnız D1: "NYY 4x6 400 kg çeker", 10I 500 kg (rüzgarlı) |
| 3 | ALPEK 3x25+35, 40 m | 1 (10I) | NAYY 3x25+16, 25 m (yeraltı) | Yalnız D1: "AER 3x25+35 400 kg çeker" |
| 4 | NYY 4x6 havai, 10 m | YOK: mevcut direkten binadaki dam direğine | Duvardan panoya | Yok |
| 5 | NYY 4x6 havai, 28 m | 1 (8I), pano direk dibinde | Kablo direkten iner | Yok |

## İşe yarayan kabuller (araçla uyumlu ya da eklenecek)

- **Hesap yöntemi araçla aynı:** %e₁ = c·N·L/S, c Al 0,0000198, Cu 0,0000124. Toplam %e = %e₁ + %e₂ < 1,5. "KULLANILAN KESİTLER UYGUNDUR" yazılır.
- **Akım:** I = N / 526 (bazı örneklerde 527). Talep (bağlantı) gücüyle hesaplanır.
- **NYY'nin Iz değeri HAVADA alınıyor:** 4x6 için 43 A. Bu, iniş ve havai kısım için örnek 1, 2, 4 ve 5'te aynı. Araç şu an iniş kısmında
  toprak değerini (59 A) kullanıyor; havada değerin (küçük olanın) alınması daha güvenli ve örneklerle uyumlu.
- **Kısa mesafe (örnek 4):** direk eklenmeden, mevcut direkten binaya NYY çekiliyor. Binada "dam direği" var: Ø40 siyah çelik boru,
  3 mm et kalınlığı, h = 2,5 m, izolatörlü. Kablo duvarda tespit kroşeleriyle panoya iniyor. Araç şu an en az bir yeni direk istiyor;
  bu durum için ayrı bir seçenek gerekecek.
- **Askı teli / kroşe aralığı:** örnek 3 ve 4'teki "A kesiti" detayında NYY kablo 20 cm arayla "tandır kroşe" ile asılı. Duvarda da
  20 cm arayla tespit kroşesi var. Araçta varsayılan 50 cm; 20 cm'ye çekilmeli (kullanıcı onayıyla).
- **NYY askı telli hattın çekmesi:** örnek 2'de 400 kg alınmış. Dayanağı belli değil.
- **Pano tarafı:**
  - pano altında PVC hortum, muhafaza borusu 150 cm ve 3 boru tespit kelepçesi;
  - topraklama: Ø20 mm elektrolitik bakır çubuk, 80 cm derinlik, elektrolitik zift;
  - tek hatta "CU. ÇUBUK 1.5 M".
- **Örnek 5'teki direk ve topraklama:**
  - mevcut direkte kablo başlığı;
  - topraklama 25 mm² NYA, 30x3,5 mm galvaniz şerit, 65x65x7 L=2 m galvaniz kazık, "en az 60 cm";
  - yeni direkte "kablo koruma".
- **Tek hat şeması:** HAVAİ yazısı + kablo + boy, direk kutusu (D1 / tip), iniş üçgeni (kablo başlığı) + "İNİŞ İLETKENİ". Sigorta 4x40A
  10 kA ve K.A.R 4x40A 300 mA kesikli "mühürlenebilir alan" kutusunda. Yanında "İÇ TESİSAT PROJESİ … tarih … sayı ile onaylanmıştır" kutusu.
- **Diğer pafta öğeleri:**
  - vaziyet: üstte uydu görüntüsü, altta parsel (TKGM) üzerinde güzergah;
  - "GEREKLİ GEÇİŞ İZİNLERİ ALINMADAN KABLO ÇEKİLMEYECEKTİR" notu;
  - "KABLO ÇEKME İŞLEMİ TEDAŞ YÖNETMELİĞİNE UYGUN YAPILACAKTIR" notu;
  - GDZ güç dağılım tablosu (BB no, tablo, kurulu, bağlantı gücü, sayaç tipi, kullanım amacı, tesisat no).

## Birbirini tutmayan / şüpheli noktalar

1. **ALPEK 3x25+35 çekmesi:** örnek 1'de 390 kg, örnek 3'te 400 kg. Araç σ = 12 kg/mm² × 35 = 420 kg alıyor.
2. **ALPEK 3x25+35 Iz:** örnek 1'de 90 A (Konen tablosu), örnek 3'te 100 A.
3. **Cer hesabı yok:** örnek 4 ve 5'te cer hesabı yok. Örnek 5'te yeni bir 8I direk var.
4. **Muhafaza borusu boyu:** örneklerde pano tarafında 150 cm, araçta direk inişinde 3 m.
5. **Topraklama:**
   - örnek 5: 25 mm² NYA, galvaniz kazık;
   - örnek 3 ve 4: Ø20 bakır çubuk;
   - araç: 1x16 Cu ve galvaniz kazık.
6. **Askı teli görünmüyor:** örnek 2 ve 5'te askı teli çizilmemiş. Kablo direkten direğe doğrudan gidiyor gibi.

## Kullanıcının kararları (13 Kasım 2026) ve yapılanlar

- **Kısa mesafe:** üç durum var: cephe, dam direği, A direk. Araçta "Kısa mesafe: dam direği" ve "Kısa mesafe: cephe" (yeni direk yok,
  cer hesabı yok, açıklık elle girilir, aynı kablo binada duvardan panoya iner). A direk = yeni direk → "Direkli hat" (cer aracı).
- **İniş kablosu Iz:** "gerçekte neyse". İnişte kablonun bir kısmı havada, bir kısmı toprakta → katalogdaki iki değerin küçüğü
  (kablolar(…, 'inis')). 4x6 NYY → 43 A (örneklerle aynı).
- **Kroşe/kelepçe aralığı:** şimdilik 50 cm kalsın.
- **Pano altı:** PVC hortum yok, artık çelik spiral.
- **"İç tesisat projesi … onaylanmıştır" kutusu:** gerek yok; koruma elemanları iç tesisattan alınır (yeraltıdaki gibi).
- **ALPEK çekmesi:** "kitapta ne yazıyorsa". Alpek El Kitabı: T = askı teli kesiti × 12 kg/mm² → 3x25+35: 420 kg (Konen kopma yükü 1050
  kgf = 30 kg/mm²). Örneklerdeki 390/400 kg kitapla tutmuyor; araç 420 kg kullanıyor.
- **ALPEK 3x25+35 Iz:** 90 A (Konen).
- **NYY askı telli çekme:** "doğrusu nasıl" → aynı yöntem: askı teli kesiti × 12 kg/mm² (araçta kesit girilir, T otomatik).
  EKAT: çekme zorlanması kopma dayanımının %45'ini geçmez (web aramasıyla görüldü; resmî metin bu oturumdan açılamadı).
- **Bakırsa askı teli olur:** NYY havai hat her zaman askı telli.
- **Yeni direk varsa cer hesabı her zaman.**
- **Muhafaza borusu / topraklama:** "kitap kural ne diyorsa". TEDAŞ pozu: 65x65x7 mm, L = 2 m galvaniz köşebent kazık
  (birim fiyat 85.790.1203); topraklama iletkeni en az 16 mm² Cu. Direk inişindeki koruma borusu boyu için yazılı kaynak bulunamadı
  (araç 3 m, kullanıcının onaylı direk bağlantı detayından). Kullanıcı: direk inişinde 3 m kalsın (pano altında çelik spiral).
