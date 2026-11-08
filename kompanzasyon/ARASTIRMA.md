# Reaktif güç kompanzasyonu — araştırma notları (8 Kasım 2026)

Kompanzasyon aracının (araclar/kompanzasyon.html) dayandığı kurallar ve sayılar. Her maddenin kaynağı yanında.
"Resmî" = Resmî Gazete metni okundu; "kılavuz" = üretici / uluslararası mühendislik kılavuzu; "ikincil" = başka sitenin
aktardığı, birincil metin okunamadı.

## 1. Reaktif enerji bedeli (ceza) — EPDK

Dayanak: *Dağıtım Lisansı Sahibi Tüzel Kişiler ve Görevli Tedarik Şirketlerinin Tarife Uygulamalarına İlişkin Usul ve Esaslar*,
madde 13. Güncel hâli EPDK Kurulu 28.04.2022 tarih ve 10961 sayılı karar, RG 30.04.2022 / 31825 (Resmî, Lexpera'dan okundu).

- **Muaf olanlar:** mesken, aydınlatma, tek fazla beslenen tüketiciler ve **kurulu gücü 15 kW'a (dahil) kadar** olanlar.
  (İlk metinde "bağlantı gücü 9 kW" idi; 2022 değişikliğiyle 15 kW kurulu güç oldu.)
- **Kurulu gücü 50 kVA altı:** reaktif tüketim (endüktif) aktif enerjinin **%33**'ünü, verilen reaktif (kapasitif) **%20**'sini aşarsa bedel öder.
- **Kurulu gücü 50 kVA ve üstü:** endüktif **%20**, kapasitif **%15**.
- Sınır aşılırsa **ölçülen reaktif enerjinin tamamı** faturalanır (yalnız aşan kısım değil).
- İki sınır birden aşılırsa en yüksek değeri kaydeden reaktif sayacın tamamı faturalanır.
- **Takvim yılındaki ilk ihlal** faturada gösterilir ama aynı faturada tenzil edilir (affedilir); sonraki her ihlal faturalanır.
- 35 günü aşan okumalarda bedel 35 günle sınırlı uygulanır.
- Reaktif sayaçların ikisi de kullanıcı kusuruyla sıfır yazarsa aktif enerjinin 0,90 katı reaktif üzerinden fatura edilir.
- Oran, tüketime ve/veya üretime esas aktif enerjiye göre hesaplanır (GES'li tesislerde şebekeden çekilen aktif azaldığı için
  oran büyür; bu tesislerde kompanzasyon üretimi de hesaba katmalı, 4 bölgeli ölçüm yapan röle kullanılmalı).
- Reaktif birim bedeli (TL/kVArh) EPDK tarife tablolarında dönem dönem değişir; araçta kullanıcı girer.

Sınırların cos φ karşılığı: tan φ = Q/P → %20 ⇒ cos φ ≥ 0,981; %33 ⇒ cos φ ≥ 0,950; kapasitif %15 ⇒ cos φ (kap.) ≥ 0,989.

## 2. Kompanzasyon zorunluluğu ve hedef — Bakanlık tebliği

- Elektrik İç Tesisleri Yönetmeliği md. 51/m (Resmî): AG kompanzasyon tesisleri *"Elektrik Projelerinin Hazırlanması ve Elektrik
  Tesislerinin Gerçekleştirilmesi Sürecinde Güç Faktörünün İyileştirilmesi İle İlgili Tebliğ"* hükümlerine göre kurulur.
- Tebliğ (RG 01.12.1988 / 20006; değişiklik RG 17.02.2000 / 23967) (ikincil): **50 kVA ve üstü tesislerde kompanzasyon zorunlu**;
  kondansatör gücü, güç katsayısını **0,95 (dahil) ile 1,0 arasına** çıkaracak şekilde hesaplanır (md. 6.1.1). Önce yerinde (bireysel),
  gerekirse merkezi kompanzasyon.
- Elektrik İç Tesisleri Proje Hazırlama Yönetmeliği (Resmî): uygulama projesinde kompanzasyon için *kompanzasyon hesabı,
  harmonikli yükler için toplam yük akımı hesabı, rezonans frekansı hesabı ve reaktör/kapasitör oranı, kompanzasyon panosu tek hat
  şeması, yerleşim/kesit/görünüş* istenir.
- Pratik hedef: ceza sınırı %20 (cos φ 0,981) olduğu için hedef **cos φ 0,98–0,99** alınır; kapasitife düşmemek için 1,00 hedeflenmez.
- Not: EMO'nun sitesi otomatik erişime kapalı olduğu için tebliğin tam metni okunamadı; madde numarası ikincil kaynaktan.

## 3. Hesap yöntemleri (kılavuz: Schneider Electric, Electrical Installation Guide, bölüm L)

- **Temel bağıntı:** Qc = P · (tan φ1 − tan φ2). Gerilimden bağımsızdır.
- **Proje aşaması:** P = kurulu güç × eşzamanlılık; ölçüm yoksa cos φ1 ≈ 0,80 kabul edilir (kılavuzun basit yöntemi).
- **Faturadan:** en yüklü ayın faturası seçilir; Qc = (endüktif kVArh) / (o ayın yüklü çalışma saati). Daha doğrusu
  P = kWh / saat, tan φ1 = kVArh / kWh, sonra temel bağıntı. Seçilen batarya hesaplanandan biraz büyük alınır.
- **kW başına kVAr tablosu** (L16): ör. 0,80 → 0,95 için 0,421 kVAr/kW; 0,75 → 0,93 için 0,487.
- Geri ödeme süresi tipik olarak ~18 ay.

## 4. Trafo kompanzasyonu (kılavuz, L20–L22)

- Mıknatıslanma (boşta) reaktif gücü yükten bağımsız, yaklaşık **%1,8 × Sn** → sabit kondansatörle karşılanır.
- Kaçak reaktansın tükettiği: yükün karesiyle orantılı, tam yükte ≈ uk × Sn (ör. 630 kVA, %4 → 25,2 kVAr).
- 20 kV primerli dağıtım trafoları için kompanze edilecek reaktif güç (kVAr), boşta / tam yük:
  100: 2,5/6,1 · 160: 3,7/9,6 · 250: 5,3/14,7 · 315: 6,3/18,4 · 400: 7,6/22,9 · 500: 9,5/28,7 · 630: 11,3/35,7 ·
  800: 20/54,5 · 1000: 23,9/72,4 · 1250: 27,4/94,5 · 1600: 31,9/126 · 2000: 37,8/176.
- OG ölçümlü tesiste trafonun reaktifi de cezaya girer → trafo boşta gücü kadar **sabit kademe** (trafo tarafında, sürekli devrede).

## 5. Harmonikler ve kondansatör seçimi (kılavuz, L29–L34; IEC 60831-1/2)

- IEC 60831: kapasite toleransı −5/+10 % (≤100 kVAr); sürekli akım **1,3 × In**; gerilim 1,1 × Un (8 saat/gün) … ;
  **deşarj: 3 dakikada 75 V'a**.
- Harmonik üreten yük gücü Gh (sürücü, UPS, doğrultucu, LED sürücüleri…; yalnız kW biliniyorsa cos φ 0,7 ile kVA'ya çevir),
  trafo gücü Sn (≤ 2 MVA için basit kural):
  - Gh ≤ 0,10 Sn → standart kondansatör
  - 0,10 Sn < Gh ≤ 0,20 Sn → ağır hizmet (heavy duty) ya da %10 yüksek gerilimli kondansatör
  - 0,20 Sn < Gh ≤ 0,50 Sn → ağır hizmet / %20 yüksek gerilimli kondansatör **+ harmonik filtre reaktörü (detuned)**
  - Gh > 0,50 Sn → harmonik filtre (aktif/pasif) etüdü gerekir
- **Trafosuz AG abonesi** (kendi trafosu olmayan, dağıtım şebekesinden AG'den beslenen tesis): kaynaktaki kural trafo gücüne göre
  verilmiş; trafo bilinmediği için araç Gh'yi tesisin **kurulu gücüne (kVA)** oranlar. Bu bir mühendislik uyarlamasıdır ve daha
  temkinlidir (kurulu güç trafodan küçük olduğu için oran büyük çıkar). Trafosuz tesiste trafo sabit kademesi eklenmez; EPDK
  sınırları ve tebliğin 50 kVA zorunluluğu aynen geçerlidir.
- Reaktör oranı p: **%5,7 (210 Hz), %7 (189–190 Hz), %14 (135 Hz)**. 5. harmonik baskınsa %7, 3. harmonik baskınsa %14.
  Rezonans frekansı fr = 50 / √p.
- Reaktörlü kademede kondansatör gerilimi yükselir: Uc = U / (1 − p) → 400 V şebekede **480 V** kondansatör kullanılır.
- Kondansatör gücü gerilimin karesiyle değişir: Q = QN · (U / UN)². Reaktörlü kademenin şebekeye verdiği net güç:
  Qnet = QN · (U / UN)² / (1 − p). Ör. 480 V, %7: Qnet ≈ 0,747 · QN (EMO örneği: 2 × 33,3 kVAr 480 V + 50 kVAr reaktör).
- Harmonik varken reaktörsüz kondansatör rezonansla harmonikleri büyütür (paralel rezonans).

## 6. Koruma, kontaktör, kablo (kılavuz L37–L39; Entes)

- Kademe anma akımı In = Q / (√3 · U).
- Şalter uzun gecikme ayarı (aşırı yük) = In × (IMP/IN): standart 1,5 · ağır hizmet 1,8 · %5,7 reaktörlü 1,31 · %7 reaktörlü 1,19 ·
  %14 reaktörlü 1,12. Kısa gecikme (kısa devre) 10 × In (ilk anahtarlama akımına duyarsız).
- Sigorta ve kablolar 1,3–1,5 × In'e göre boyutlandırılır.
- Kondansatör bataryası besleme kablosu (Cu / Al, 400 V, mm²): 10 kVAr 2,5/16 · 20: 4/16 · 30: 6/16 · 40: 10/16 · 50: 16/25 ·
  60: 25/35 · 80: 35/50 · 100: 50/70 · 120: 70/95 · 140: 95/120 · 180: 120/185 · 200: 150/240 · 240: 185/2×95 ·
  250: 240/2×120 · 300: 2×95/2×150 · 360: 2×120/2×185 · 420: 2×150/2×240 · 480: 2×185/2×300 · 540: 2×240/3×185 ·
  600: 2×300/3×240 · 660: 3×150/3×240 · 720: 3×185/3×300 (havada, 30 °C, düzeltme katsayısız).
- Kumanda kabloları en az 1,5 mm², akım trafosu sekonderi en az 2,5 mm².
- Kondansatör ilk anahtarlama akımı anma akımının 30 katına çıkabilir → **kompanzasyon kontaktörü** (ön şarj/sönümleme dirençli)
  kullanılır; standart motor kontaktörü kontakları yapışır. Kontaktör kVAr değeri kademe gücünden küçük olmamalı.
- Kademe yeniden devreye girmeden önce kondansatör boşalmış olmalı (yüklü kondansatöre kapama 3 kata varan gerilim darbesi yapar).

## 7. Röle ve kademe düzeni (Entes RG3/RGA kılavuzları; akademik çalışmalar)

- Röle her kademenin gücünü ve bağlı olduğu fazı tanır (eski rölelerde **C/k = 1. kademe kVAr / AT oranı** elle girilir).
- **Referans (1.) kademe mutlaka üç fazlı kondansatör** olur; şönt reaktörler referans dışındaki kademelere bağlanır.
- Tek fazlı (dengesiz) yükler varsa üç akım trafolu, tek fazlı kondansatör/reaktör kademesi yönetebilen röle.
- Kademe düzenleri: 1-1-1-1, 1-2-2-2, 1-2-4-4, 1-1-2-2-4-4, 1-2-4-8 (ikili). İkili düzen en çok kombinasyonu verir
  (10-20-40-80 kVAr ile 15 adım). Pratikte 8–16 kademe yeterli. Kademe gücü kendinden önceki kademelerin toplamını aşmamalı.
- Ayarlar: hedef cos φ (fabrika +1,000), çekme/bırakma gecikmesi (fabrika 10 s), deşarj süresi (fabrika 14 s, 1–1800 s;
  deşarj bobini yoksa kondansatörün deşarj süresi), aşırı kompanzasyon alarmı (ör. −%5 Q/P), düşük kompanzasyon alarmı (ör. +%5).
- Kapasitif tüketim (uzun kablolar, LED, UPS, boşta çalışan tesis) → **şönt reaktör** (kapasitör + reaktör programı).
- Hızlı değişen yük (punto kaynak, vinç, asansör) → tristörlü / statik (SVC) kompanzasyon.

## 8. Motor bireysel kompanzasyonu (kılavuz L25–L26)

- Kendi kendine uyarmayı önlemek için motor uçlarına bağlanacak en büyük güç Qc ≤ 0,9 · √3 · Un · I0 (I0 boşta akım).
  Tablo (400 V, kVAr; 3000/1500/1000/750 d/d): 22 kW 6/8/9/10 · 30: 7,5/10/11/12,5 · 37: 9/11/12,5/16 · 45: 11/13/14/17 ·
  55: 13/17/18/21 · 75: 17/22/25/28 · 90: 20/25/27/30 · 110: 24/29/33/37 · 132: 31/36/38/43 · 160: 35/41/44/52 ·
  200: 43/47/53/61 · 250: 52/57/63/71 · 280: 57/63/70/79 · 355: 67/76/86/98 · 400: 78/82/97/106 · 450: 87/93/107/117.
- Kompanzasyon sonrası motor aşırı akım rölesi ayarı küçültülür: 750 d/d 0,88 · 1000: 0,90 · 1500: 0,91 · 3000: 0,93.

## 9. Proje aşamasında yük listesi (eşzamanlılık ve tipik cos φ)

- Elektrik İç Tesisleri Yönetmeliği, 1995 değişikliği (RG 22479; Resmî, Lexpera) eşzamanlılık tablosu:
  daire ilk 8 kW %60, kalanı %40 · bina (daire sayısı) 3–5 %45, 5–10 %43, 11–15 %41, 16–20 %39, 21–25 %36, 26–30 %34, 31–35 %31,
  36–40 %29, 41–45 %28, 46–50 %26, 51–55 %25, 56–61 %24, ≥62 %23; konutta eşzamanlı yük en az 2 kW · işyeri/idari/sosyal/sağlık:
  mekanik (kış-yaz büyüğü) %100, mutfak %70 · aydınlatma: hastane ilk 50 kVA %40 kalan %20; otel ilk 20 kVA %50, 20–100 kVA %40,
  kalan %30; depo ilk 12,5 kVA %100 kalan %50; diğer %100 · priz: ilk 10 kVA %100, kalan %50 · asansör: büro/otel %100,
  okul/hastane %85, apartman/diğer %55.
- Aynı yönetmelik: deşarj lambası, klima, motor vb. cihazlarda güç katsayısı en az 0,90 olacak şekilde yerel kompanzasyon.
- Tipik cos φ (Schneider EIG Fig. L7): asenkron motor yükü %0/25/50/75/100 → 0,17/0,55/0,73/0,80/0,85; akkor ve rezistif 1,0;
  floresan kompanzasyonsuz 0,5, kompanzasyonlu 0,93; deşarj lambası 0,4–0,6; endüksiyon fırını (komp.) 0,85; dielektrik 0,85;
  direnç kaynak 0,8–0,9; tek fazlı ark kaynak 0,5; motor-generatör kaynak 0,7–0,9; trafo-doğrultucu kaynak 0,7–0,8; ark ocağı 0,8.
- Araçta LED (0,90), sürücü girişi (0,95), UPS (0,99), priz (0,90), klima (0,85) değerleri **kabul**dür (üretici tipik), kaynaklı değildir.
- Harmonik yük önerisi: harmonik üreten grupların kurulu kW'ı ÷ 0,7 ≈ kVA.

## 10. Rezonans frekansı (Schneider EIG, Risk of resonance)

- Paralel rezonans mertebesi h0 = √(Ssc / Q); trafo beslemede Ssc ≈ Sn / uk (üst şebeke empedansı ihmal edilir → gerçek h0 biraz daha düşük).
- Kılavuz örneği: 630 kVA, uk %6 → Ssc ≈ 10 MVA; Q = 350 kVAr → h0 ≈ 5,5 (275 Hz): 5. harmoniğe çok yakın, tehlikeli. Araç 5,48 / 274 Hz buluyor.
- Kademeli bataryada h0 devredeki güçle değişir; araç bütün kademe birleşimlerini kontrol eder, ±%7 bandında yakınlık işaretler.
  Uyarı yalnız 5. ve 7. (baskın 3. ise 3.) için verilir; 11. ve 13. bilgi olarak gösterilir (genlikleri küçük).
- Tipik uk: ≤630 kVA %4, üstü %6 (EN 50464-1 değerleri; trafo etiketinden girilmesi esas).
- Reaktörlü kademede (p) paralel rezonans ayar frekansının (50/√p) altına iner; 5. ve üstü harmoniklerle çakışmaz.

## 11. Faydalar (Schneider EIG, Why improve the power factor; L18)

- Aynı kW için kablo kesit katsayısı cos φ 1 / 0,8 / 0,6 / 0,4 → 1 / 1,25 / 1,67 / 2,5. Akım %10 düşerse kayıp ≈ %20 düşer.
- Trafo örneği: 630 kVA, 450 kW cos 0,8 + 100 kW cos 0,7 → trafo değiştirmemek için en az ≈132 kVAr.
- Kompanzasyon kWh tüketimini yalnız kayıp kadar azaltır; "elektrik tasarrufu" satış iddiaları yanıltıcıdır.
- Kurulum yeri: merkezi (ucuz, kablolar rahatlamaz), grup, bireysel (en etkili, pahalı). Bireysel motor kompanzasyonu ≈ motor kW'ının %25'i;
  adımlı, ters çevrilen, kesik çalışan motorlar uçtan kompanze edilmez.

## 12. Kondansatör, kontaktör, bakım

- IEC 60831 (EIG Fig. L37): tolerans −5/+10 % (≤100 kVAr), −5/+5 % (>100 kVAr); sıcaklık sınıfı en düşük −50…+5 °C, en yüksek +40…+55 °C;
  akım 1,3 × In; gerilim 1,1 × Un 8 saat/24 saat, 1,15 × Un 30 dk, 1,2 × Un 5 dk, 1,3 × Un 1 dk; deşarj 3 dk'da 75 V.
- Sıcaklık sınıfı D: en yüksek 55 °C, 24 saat ortalaması 45 °C, yıllık ortalama 35 °C (üretici veri sayfası, IEC 60831 sınıf tablosu).
- Self-healing film ve basınca duyarlı ayırıcı (iç arızada kapak şişer, bağlantı kopar) — EIG L35–L36.
- Ani akım: back-to-back anahtarlamada kademe anma akımının 100 katına kadar (ABB); kompanzasyon kontaktörü (sönümleme dirençli, AC-6b);
  ABB: Ue ≤ 440 V'ta 250 000 elektriksel çevrim. Reaktörsüz kontaktörlü pano için yıllık anahtarlama sayısı sınırlı (üretici).
- Değişim eşiği için standartta yüzde bulunamadı; sahada kademe akımı ölçülüp etiketle karşılaştırılır (uygulama bilgisi, doğrulanmadı).
- Pano sıcaklığı: ENTES RGA rölesinde sıcaklık alarmı ve fan rölesi (fan çalışma/kapanma 30–70 °C ayarlı).

## 13. Röle bağlantısı, jeneratör, GES, modern çözümler

- AT ana şalterden sonra, bütün yükler ve kompanzasyon panosu altında. Tek fazlı rölede gerilim AT'nin fazından; fazlar arası
  bağlantılı rölede AT'nin olmadığı iki faz arasından (EMO / KTÜ ders notu). AT + röle + kablo yükü AT anma gücünün %25–120'si arasında.
  Sekondere seri ampermetre vb. devreyi keserse röle kör kalır.
- Jeneratör: ENTES RGA "jeneratör girişi" (110–250 V AC sinyal): pasif ya da jeneratör hedef cos φ. Sinyal şebeke hattına jeneratör
  bağlantısından sonra alınmalı. Kapasitif yük jeneratör AVR'sini uyarmayı kısmaya zorlar; uyarma kaybı ve gerilim yükselmesi (Cummins PT-6001).
- GES / üretici: md. 13 oranları "tüketime esas ve/veya üretime esas aktif enerji"ye göre; üretici sisteme enerji verirken verdiği
  reaktif faturalanmaz; üretici aktif verirken kapasitif reaktif çekerse reaktif tarifesi uygulanır (Usul ve Esaslar, Resmî).
  Öz tüketimli tesiste şebekeden çekilen kWh azalırken reaktif ihtiyaç kalır → oran büyür (mühendislik değerlendirmesi, kaynakta doğrudan yok).
  2026'da lisanssız üretimde saatlik mahsuplaşmaya geçildi (Bloomberg HT, Nisan–Mayıs 2026); reaktif hükmünde değişiklik görülmedi.
- Sayaç kodları (ikincil): 1.8.0 çekilen aktif, 5.8.0 endüktif reaktif, 8.8.0 kapasitif reaktif.
- Hızlı / sürekli değişen yük: tristörlü kompanzasyon; SVG (IGBT, kademesiz, iki yönlü) tepki ~5–20 ms (Circutor <20 ms, TDK PQvar <15 ms;
  üretici beyanı); kontaktörlü panoda kademe arası onlarca saniye. Gh/Sn > %50: aktif filtre etüdü.
- Sürücü (VFD) çıkışına kondansatör konmaz; sürücü girişinin temel bileşen cos φ'si ≈ 0,95, düşük olan harmonik kaynaklı gerçek güç
  faktörüdür; kondansatör onu düzeltmez, rezonans riski doğurur.
- OG kondansatörler IEC 60871 kapsamındadır; çoğu tesiste AG kompanzasyon tercih edilir.

## 14. Harmonikli toplam yük akımı (Proje Hazırlama Yön. istenen ii. kalem)

- Schneider EIG (Definition of harmonics / THD): Irms = I1 · √(1 + THDi²); THDi %40 → Irms ≈ 1,08 I1.
- Araç: I1 = P / (√3 · 400 · cos φ2); Ih = (Gh kVA → A) × THDi; Irms = √(I1² + Ih²). Tesis THDi ≈ Ih / I1.
- Tipik sürücü THDi (üretici): 6 darbeli, şoksuz %80–115 (Schneider kaynaklı) ya da %35–45 (Fuji); DC şok / %3 hat reaktörü ile %25–40.
  Kesin değer ölçüm ya da katalogdan. Araç varsayılanı %40.
- Projede ayrıca istenen (araç çizmez): kondansatör / pano yerleşim, kesit, görünüş; kablo güzergâhlarında EMU uyarıları.


- EPDK Usul ve Esaslar ve değişiklikleri (Resmî Gazete metinleri): lexpera.com.tr/resmi-gazete/metin/… (5999-3; 10961; 5037)
- Elektrik İç Tesisleri Yönetmeliği ve Proje Hazırlama Yönetmeliği: lexpera.com.tr/mevzuat/yonetmelikler/…
- Schneider Electric, Electrical Installation Guide, Power Factor Correction: electrical-installation.org/enwiki/…
- ENTES RGA&RGSR ve RG3 reaktif güç kontrol rölesi kullanım kılavuzları: entes.com.tr
- Tebliğ maddeleri ve 50 kVA zorunluluğu için ikincil kaynak: isguvenligi.net'teki tebliğ kopyası (arama özeti)
- İç Tesisler Yönetmeliği 1995 değişikliği (RG 22479, eşzamanlılık tablosu): lexpera.com.tr
- ABB, Contactors for capacitor switching (1SBC101140C0203); NITK back-to-back inrush çalışması
- Cummins PT-6001 Impact of Power Factor Loads; Circutor SVG; TDK EPCOS PQvar; Bloomberg HT (saatlik mahsuplaşma, 2026)
- Soru-cevap rehberi: araclar/kompanzasyon-rehber.html
