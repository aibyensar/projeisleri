;;; ===========================================================================
;;; GERILIMDUSUMU - İç tesisat akım kontrolü ve gerilim düşümü hesabı
;;; Proje İşleri - AutoCAD 2021 ve sonrası (AutoLISP, UTF-8)
;;;
;;; Komutlar:
;;;   GERILIMDUSUMU  Hesabı sorar, yazıları ve tek hat şemasını çizer
;;;   GDAYAR         Gerilim, k, cos fi, düşüm sınırı ayarları
;;;
;;; Bu dosya autocad/olustur.js ile üretilir. Kablo değerleri veri/katalog.js
;;; içindeki Öznur Kablo tablolarından gelir. Elle değiştirmeyin; kaynak
;;; dosyayı (autocad/kaynak/gerilimdusumu-kaynak.lsp) değiştirip yeniden üretin.
;;; ===========================================================================

(vl-load-com)

;;@@VERI@@

;;; ---------------------------------------------------------------- ayarlar
(defun ict:ayar (k d / v)
  (setq v (getenv (strcat "ICT_" k)))
  (if (and v (/= v "")) (atof v) d))
(defun ict:ayar-yaz (k v) (setenv (strcat "ICT_" k) (rtos v 2 8)))

;;; ---------------------------------------------------------------- yazı biçimi
(defun ict:rep (s a b / i bas)
  (setq bas 0)
  (while (setq i (vl-string-search a s bas))
    (setq s (strcat (substr s 1 i) b (substr s (+ i 1 (strlen a))))
          bas (+ i (strlen b))))
  s)
(defun ict:trim0 (s)
  (if (vl-string-search "." s)
    (vl-string-right-trim "." (vl-string-right-trim "0" s))
    s))
(defun ict:n2 (x) (ict:rep (rtos x 2 2) "." ","))              ; 0,38
(defun ict:n0 (x) (rtos x 2 0))                                 ; 12299
(defun ict:ns (x) (ict:rep (ict:trim0 (rtos x 2 8)) "." ","))   ; 0,0000124

;;; Katsayı: trifaze 100/(k·U²), monofaze 200/(k·U²).
;;; 10⁻⁴ biriminde elle hesaptaki gibi yuvarlanır: 0,1237→0,124 ; 0,7379→0,74
(defun ict:katsayi (faz il / k u ham)
  (setq k (if (= il "cu") (ict:ayar "KCU" 56.0) (ict:ayar "KAL" 35.0))
        u (if (= faz "3") (ict:ayar "U3" 380.0) (ict:ayar "U1" 220.0))
        ham (* (/ (if (= faz "3") 100.0 200.0) (* k u u)) 1e4))
  (/ (atof (rtos ham 2 (if (>= ham 0.5) 2 3))) 1e4))

;;; ---------------------------------------------------------------- işlem çözücü
;;; "(16220 * 0,45) + 5000" gibi yazıları hesaplar. + - * / ( ) destekler.
(defun ict:ch ()
  (if (<= *ict-p* (strlen *ict-s*)) (substr *ict-s* *ict-p* 1) ""))
(defun ict:ilerle () (setq *ict-p* (1+ *ict-p*)))
(defun ict:bosluk () (while (= (ict:ch) " ") (ict:ilerle)))
(defun ict:rakam-mi (c) (and (/= c "") (or (wcmatch c "#") (= c "."))))
(defun ict:sayi (/ bas)
  (ict:bosluk)
  (setq bas *ict-p*)
  (while (ict:rakam-mi (ict:ch)) (ict:ilerle))
  (if (> *ict-p* bas) (atof (substr *ict-s* bas (- *ict-p* bas))) nil))
(defun ict:carpan (/ v c)
  (ict:bosluk)
  (setq c (ict:ch))
  (cond
    ((= c "(")
     (ict:ilerle)
     (setq v (ict:ifade))
     (ict:bosluk)
     (if (and v (= (ict:ch) ")")) (progn (ict:ilerle) v) nil))
    ((= c "-") (ict:ilerle) (if (setq v (ict:carpan)) (- v) nil))
    (T (ict:sayi))))
(defun ict:terim (/ v w c)
  (setq v (ict:carpan))
  (while (and v (progn (ict:bosluk) (member (setq c (ict:ch)) '("*" "/" "x" "X"))))
    (ict:ilerle)
    (setq w (ict:carpan)
          v (cond ((null w) nil)
                  ((= c "/") (if (zerop w) nil (/ v w)))
                  (T (* v w)))))
  v)
(defun ict:ifade (/ v w c)
  (setq v (ict:terim))
  (while (and v (progn (ict:bosluk) (member (setq c (ict:ch)) '("+" "-"))))
    (ict:ilerle)
    (setq w (ict:terim)
          v (if w (if (= c "+") (+ v w) (- v w)) nil)))
  v)
(defun ict:coz (s / v)
  (setq s (vl-string-right-trim " =" s))
  (setq *ict-s* (ict:rep s "," ".") *ict-p* 1 v (ict:ifade))
  (ict:bosluk)
  (if (and v (> *ict-p* (strlen *ict-s*))) (float v) nil))
(defun ict:sadece-sayi-mi (s / i ok c)
  (setq i 1 ok (> (strlen s) 0))
  (while (and ok (<= i (strlen s)))
    (setq c (substr s i 1)
          ok (or (wcmatch c "#") (member c '("." "," " " "=")))
          i (1+ i)))
  ok)
;;; Yazılan işlemi projedeki gibi biçimler: (16220 * 0,45) + 5000
(defun ict:islem-yaz (s / i c r)
  (setq s (vl-string-right-trim " =" s) i 1 r "")
  (while (<= i (strlen s))
    (setq c (substr s i 1))
    (if (member c '("x" "X")) (setq c "*"))
    (cond ((member c '("+" "-" "*" "/")) (setq r (strcat (vl-string-right-trim " " r) " " c " ")))
          ((= c " "))
          (T (setq r (strcat r c))))
    (setq i (1+ i)))
  (ict:rep (vl-string-trim " " r) "." ","))
(defun ict:parantezli (s)
  (if (and (or (vl-string-search "+" s) (vl-string-search "-" s))
           (not (and (= (substr s 1 1) "(") (= (substr s (strlen s) 1) ")"))))
    (strcat "(" s ")")
    s))

;;; ---------------------------------------------------------------- sorular
(defun ict:sor-kw (msg kws def / v)
  (initget kws)
  (setq v (getkword (strcat "\n" msg " [" (ict:rep kws " " "/") "] <" def ">: ")))
  (if v v def))
(defun ict:sor-real (msg def / v)
  (initget 4)
  (setq v (getreal (strcat "\n" msg " <" (ict:ns def) ">: ")))
  (if v v def))
(defun ict:sor-int (msg def / v)
  (initget 6)
  (setq v (getint (strcat "\n" msg " <" (itoa def) ">: ")))
  (if v v def))
(defun ict:sor-str (msg def / v)
  (setq v (getstring T (strcat "\n" msg (if (/= def "") (strcat " <" def ">") "") ": ")))
  (cond ((= v "") def) ((= v ".") "") (T v)))

(defun ict:tipler () (mapcar 'car *ict-kablolar*))
(defun ict:tip-kw () (vl-string-trim " " (apply 'strcat (mapcar '(lambda (x) (strcat x " ")) (ict:tipler)))))
(defun ict:kablo (tip) (assoc tip *ict-kablolar*))
(defun ict:normal (s)
  (ict:rep (ict:rep (ict:rep (strcase s T) " " "") "," ".") "*" ""))
(defun ict:sor-satir (tip def / satirlar e r)
  (setq satirlar (cadddr (ict:kablo tip)))
  (if (not (assoc def satirlar)) (setq def (car (car satirlar))))
  (while (not r)
    (setq e (ict:normal (ict:sor-str (strcat tip " kesit (örnek 4x6, 3x25/16, 2.5)") def))
          r (assoc e satirlar))
    (if (not r)
      (progn
        (princ (strcat "\n" tip " tablosunda \"" e "\" yok. Olanlar: "))
        (foreach x satirlar (princ (strcat (car x) " "))))))
  r)
(defun ict:kablo-adi (tip etiket faz / et)
  (setq et (strcase (ict:rep etiket "." ",")))
  (if (not (vl-string-search "X" et)) (setq et (strcat (if (= faz "3") "5X" "3X") et)))
  (strcat et " mm² " tip))

;;; Döşeme adları: katalogdaki toprak/hava/boru → Yeralti/Havai/Boru
(defun ict:doseme-kw (d) (cond ((= d "toprak") "Yeralti") ((= d "hava") "Havai") (T "Boru")))
(defun ict:doseme-kod (k) (cond ((= k "Yeralti") "toprak") ((= k "Havai") "hava") (T "boru")))

;;; İç hat adı: son hat linye, öncekiler kolon hattı
(defun ict:hat-ismi (i n)
  (cond ((= i (1- n)) "LİNYE HATTI")
        ((> n 2) (strcat "KOLON HATTI " (itoa (1+ i))))
        (T "KOLON HATTI")))

;;; Kablodan faz tahmini: 2x, 3x (nötrü küçültülmemiş) ve tek damar → monofaze;
;;; 4x, 5x, 3x25/16 gibi → trifaze. Kullanıcı Enter ile kabul eder veya değiştirir.
(defun ict:faz-tahmin (etiket)
  (cond ((wcmatch etiket "2x*") "Monofaze")
        ((and (wcmatch etiket "3x*") (not (vl-string-search "/" etiket))) "Monofaze")
        ((not (vl-string-search "x" etiket)) "Monofaze")
        (T "Trifaze")))

;;; ---------------------------------------------------------------- çizim
;; Çizilen her şeyin sınırı (en sonda o alana yakınlaştırmak için) ve sayısı
(setq *ict-stil* "ICT_ARIAL")
(defun ict:sinir-sifirla () (setq *ict-sinir* nil *ict-adet* 0 *ict-hata* 0))
(defun ict:sinir (x y)
  (setq *ict-sinir*
    (if *ict-sinir*
      (list (min x (nth 0 *ict-sinir*)) (min y (nth 1 *ict-sinir*))
            (max x (nth 2 *ict-sinir*)) (max y (nth 3 *ict-sinir*)))
      (list x y x y))))
(defun ict:p3 (p) (ict:sinir (car p) (cadr p)) (list (float (car p)) (float (cadr p)) 0.0))
(defun ict:say (e) (if e (setq *ict-adet* (1+ *ict-adet*)) (setq *ict-hata* (1+ *ict-hata*))) e)
(defun ict:stil ()
  (if (not (tblsearch "STYLE" *ict-stil*))
    (entmake (list '(0 . "STYLE") '(100 . "AcDbSymbolTableRecord") '(100 . "AcDbTextStyleTableRecord")
                   (cons 2 *ict-stil*) '(70 . 0) '(40 . 0.0) '(41 . 1.0) '(50 . 0.0) '(71 . 0)
                   '(42 . 2.5) '(3 . "arial.ttf") '(4 . ""))))
  ;; Stil oluşturulamadıysa çizimdeki Standard stille yaz
  (if (not (tblsearch "STYLE" *ict-stil*)) (setq *ict-stil* "Standard")))
(defun ict:yazi (p str h renk hiza / e v)
  ;; hiza: 1 sol üst, 2 orta üst, 4 sol orta, 5 orta, 8 orta alt
  (setq p (ict:p3 p))
  (ict:sinir (+ (car p) (* (strlen str) h 0.8)) (- (cadr p) (* 2.0 h)))
  (setq v (list '(0 . "MTEXT") '(100 . "AcDbEntity") (cons 62 renk) '(100 . "AcDbMText")
                (cons 10 p) (cons 40 h) '(41 . 0.0) (cons 71 hiza) (cons 1 str)))
  (setq e (entmakex (append v (list (cons 7 *ict-stil*)))))
  (if (not e) (setq e (entmakex v)))     ; stil sorunu varsa stilsiz dene
  (ict:say e))
(defun ict:cizgi (p1 p2 renk)
  (ict:say (entmakex (list '(0 . "LINE") (cons 62 renk) (cons 10 (ict:p3 p1)) (cons 11 (ict:p3 p2))))))
(defun ict:dortgen (x1 y1 x2 y2 renk)
  (ict:sinir x1 y1) (ict:sinir x2 y2)
  (ict:say (entmakex (list '(0 . "LWPOLYLINE") '(100 . "AcDbEntity") (cons 62 renk) '(100 . "AcDbPolyline")
                  '(90 . 4) '(70 . 1)
                  (list 10 (float x1) (float y1)) (list 10 (float x2) (float y1))
                  (list 10 (float x2) (float y2)) (list 10 (float x1) (float y2))))))
(defun ict:ucgen (p1 p2 p3 renk)
  (ict:say (entmakex (list '(0 . "SOLID") (cons 62 renk) (cons 10 (ict:p3 p1)) (cons 11 (ict:p3 p2))
                           (cons 12 (ict:p3 p3)) (cons 13 (ict:p3 p3))))))
;; Dolu dikdörtgen (SOLID: köşe sırası sol-üst, sağ-üst, sol-alt, sağ-alt)
(defun ict:bant (x1 y1 x2 y2 renk)
  (ict:say (entmakex (list '(0 . "SOLID") (cons 62 renk)
                           (cons 10 (ict:p3 (list x1 y1))) (cons 11 (ict:p3 (list x2 y1)))
                           (cons 12 (ict:p3 (list x1 y2))) (cons 13 (ict:p3 (list x2 y2)))))))
;; MTEXT biçimleri: kalın ve renkli yazı
(defun ict:kalin (s) (strcat "{\\fArial|b1;" s "}"))
(defun ict:renkli (s r) (strcat "{\\C" (itoa r) ";" s "}"))
;; Pano (dağıtım tablosu): çerçeve, yarısı dolu
(defun ict:pano (x y h / w v)
  (setq w (* 1.6 h) v (* 1.1 h))
  (ict:ucgen (list (- x w) (- y v)) (list (+ x w) (- y v)) (list (+ x w) (+ y v)) 140)
  (ict:dortgen (- x w) (- y v) (+ x w) (+ y v) 7)
  (ict:cizgi (list (- x w) (- y v)) (list (+ x w) (+ y v)) 7))
;; Şebeke bağlantı noktası: dolu küçük kare
(defun ict:nokta (x y h / r)
  (setq r (* 0.45 h))
  (ict:bant (- x r) (+ y r) (+ x r) (- y r) 7))
;; Yük: aşağı inen çizgi ve dolu ok
(defun ict:yuk (x y h guc)
  (ict:cizgi (list x y) (list x (- y (* 2.2 h))) 7)
  (ict:ucgen (list (- x (* 0.8 h)) (- y (* 2.2 h))) (list (+ x (* 0.8 h)) (- y (* 2.2 h))) (list x (- y (* 3.6 h))) 7)
  (ict:yazi (list x (- y (* 4.2 h))) (ict:kalin (strcat (ict:n0 guc) " W")) h 2 2))
;; Kablo üzerinde damar sayısı kadar çentik
(defun ict:centik (x y n h / i)
  (setq i 0)
  (while (< i n)
    (ict:cizgi (list (+ x (* i 0.55 h) (* -0.3 h)) (- y (* 0.6 h))) (list (+ x (* i 0.55 h) (* 0.3 h)) (+ y (* 0.6 h))) 7)
    (setq i (1+ i))))
(defun ict:damar (ad / i)
  (if (setq i (vl-string-search "X" ad)) (atoi (substr ad 1 i)) 1))
;; Kesikli çizgi
(defun ict:kesikli (x1 x2 y renk h / x)
  (setq x x1)
  (while (< x x2)
    (ict:cizgi (list x y) (list (min x2 (+ x (* 1.2 h))) y) renk)
    (setq x (+ x (* 2.0 h)))))
;; Şemada bir kablo parçası: çizgi, çentik, üstte %e ve kablo adı, altta uzunluk
(defun ict:parca (x1 x2 y h no ad L / m)
  (setq m (/ (+ x1 x2) 2.0))
  (ict:cizgi (list x1 y) (list x2 y) 7)
  (ict:centik (+ x1 (* 2.0 h)) y (ict:damar ad) h)
  (ict:yazi (list m (+ y (* 0.7 h))) (strcat (ict:renkli (ict:kalin (strcat "%e" (itoa no))) 4) "  " ad) (* 0.9 h) 7 8)
  (ict:yazi (list m (- y (* 0.7 h))) (strcat (ict:ns L) " m") (* 0.9 h) 254 2))
(defun ict:parca-genislik (ad h) (max (* 17.0 h) (+ (* (+ (strlen ad) 5) h 0.58) (* 5.0 h))))

;;; ---------------------------------------------------------------- komut
(defun c:GERILIMDUSUMU (/ *error* eski-dz eski-ce mevcut bfaz bfk u y0 m g kurulu-s kurulu talep-s nt
                      btip bk bsatir bdos bdos-kw bL n i hat hatlar faz tip satir L P ad
                      h pt x0 y u3 cosfi limit bolen In Iz akim-ok liste no c e eY toplam
                      adlar degerler px seg ilk-pano son hat-ad)
  (defun *error* (m)
    (if eski-dz (setvar "DIMZIN" eski-dz))
    (if eski-ce (setvar "CMDECHO" eski-ce))
    (if *ict-undo* (command-s "_.UNDO" "_E"))
    (setq *ict-undo* nil)
    (if (not (member m '("Function cancelled" "quit / exit abort" "İşlev iptal edildi")))
      (princ (strcat "\nHATA (" (if *ict-adim* *ict-adim* "?") "): " m
                     "\nBu satırı Proje İşleri'ne iletin.")))
    (princ))
  (setq eski-dz (getvar "DIMZIN") eski-ce (getvar "CMDECHO") *ict-adim* "başlangıç" *ict-undo* nil)
  (setvar "DIMZIN" 0)
  (setvar "CMDECHO" 0)

  ;; --- sorular
  (setq mevcut (= (setq *ict-mod* (ict:sor-kw "Branşman mevcut mu?" "Evet Hayir" (if *ict-mod* *ict-mod* "Evet"))) "Evet"))

  (setq kurulu nil)
  (while (progn
           (setq kurulu-s (ict:sor-str "Kurulu güç (W) - sayı veya işlem, yazılmayacaksa ." (if *ict-kurulu* *ict-kurulu* "")))
           (and (/= kurulu-s "") (not (setq kurulu (ict:coz kurulu-s)))))
    (princ "\nOkunamadı. Sayı veya + - * / ( ) ile işlem yazın."))
  (setq *ict-kurulu* kurulu-s)

  (while (progn
           (setq talep-s (ict:sor-str "Talep güç (W) - sayı veya işlem, örnek (16220*0,45)+5000" (if *ict-talep* *ict-talep* "")))
           (not (setq nt (ict:coz talep-s))))
    (princ "\nOkunamadı. Sayı veya + - * / ( ) ile işlem yazın."))
  (setq *ict-talep* talep-s)

  (if mevcut
    (progn
      (setq btip (ict:sor-kw "Branşman kablo tipi" (ict:tip-kw) (if *ict-btip* *ict-btip* "NYY"))
            *ict-btip* btip
            bk (ict:kablo btip)
            bsatir (ict:sor-satir btip (if *ict-bsatir* *ict-bsatir* "4x6"))
            *ict-bsatir* (car bsatir)
            bdos-kw (vl-string-trim " " (apply 'strcat (mapcar '(lambda (d) (strcat (ict:doseme-kw d) " ")) (caddr bk))))
            bdos (ict:sor-kw "Branşman döşeme" bdos-kw (if (and *ict-bdos* (vl-string-search *ict-bdos* bdos-kw)) *ict-bdos* (if (vl-string-search "Havai" bdos-kw) "Havai" (ict:doseme-kw (car (caddr bk))))))
            *ict-bdos* bdos
            bdos (vl-position (ict:doseme-kod bdos) (caddr bk))
            bL (ict:sor-real "Branşman uzunluğu (m)" (if *ict-bL* *ict-bL* 15.0))
            *ict-bL* bL
            bfaz (ict:sor-kw (strcat "Branşman " (strcase (ict:rep (car bsatir) "." ",")) " " btip " faz") "Trifaze Monofaze" (ict:faz-tahmin (car bsatir)))))
    (setq bfaz (ict:sor-kw "Bağlantı faz" "Trifaze Monofaze" (if *ict-sfaz* *ict-sfaz* "Trifaze"))
          *ict-sfaz* bfaz))
  (setq bfk (if (= bfaz "Trifaze") "3" "1"))

  (setq *ict-adim* "iç hat sayısı")
  (setq n (ict:sor-int "İç hat sayısı (kolon + linye)" (if *ict-n* *ict-n* 2)) *ict-n* n
        hatlar '() i 0)
  (while (< i n)
    (setq *ict-adim* (strcat (ict:hat-ismi i n) " soruları")
          hat (if (and (eq (type *ict-hatlar*) 'LIST) (< i (length *ict-hatlar*))) (nth i *ict-hatlar*)))
    (if (not (eq (type hat) 'LIST)) (setq hat nil))
    (princ (strcat "\n--- " (ict:hat-ismi i n) " (%e" (itoa (+ i 2)) ") ---"))
    (setq faz (ict:sor-kw "Faz" "Trifaze Monofaze" (if hat (nth 0 hat) (if (= i (1- n)) "Monofaze" "Trifaze")))
          tip (ict:sor-kw "Kablo tipi" (ict:tip-kw) (if hat (nth 1 hat) (if (= faz "Monofaze") "NYA" "NYM")))
          satir (ict:sor-satir tip (if hat (nth 2 hat) (if (= tip "NYA") "2.5" "5x6")))
          L (ict:sor-real "Uzunluk (m)" (if hat (nth 3 hat) 5.0))
          P (ict:sor-real "Güç (W)" (if hat (nth 4 hat) 2500.0))
          ad (ict:sor-str "Açıklama (yoksa Enter, silmek için .)" (if hat (nth 5 hat) "")))
    (setq hatlar (append hatlar (list (list faz tip satir L P ad))))
    (setq i (1+ i)))
  (setq *ict-hatlar* (mapcar '(lambda (x) (list (nth 0 x) (nth 1 x) (car (nth 2 x)) (nth 3 x) (nth 4 x) (nth 5 x))) hatlar))

  (setq *ict-adim* "yazı yüksekliği ve nokta")
  (setq h (ict:sor-real "Yazı yüksekliği (çizim birimi)" (if *ict-h* *ict-h* (getvar "TEXTSIZE"))) *ict-h* h)
  (setq pt (getpoint "\nHesabın yerleşeceği nokta (sol üst köşe): "))
  (if (not pt) (exit))
  (setq pt (trans pt 1 0))

  ;; --- hesap
  (setq *ict-adim* "hesap")
  (setq u (if (= bfk "3") (ict:ayar "U3" 380.0) (ict:ayar "U1" 220.0))
        cosfi (ict:ayar "COSFI" 0.8) limit (ict:ayar "LIMIT" 1.5)
        bolen (* (if (= bfk "3") (sqrt 3.0) 1.0) u cosfi)
        In (/ nt bolen)
        bolen (atof (rtos bolen 2 3)))

  ;; --- hat listesi: (no faz-kodu iletken S L P nt? açıklama kablo-adı hat-adı)
  (setq liste '() no (if mevcut 1 2))
  (if mevcut
    (setq liste (list (list no bfk (cadr bk) (cadr bsatir) bL nt T "" (ict:kablo-adi btip (car bsatir) bfk) "BRANŞMAN HATTI"))
          no (1+ no)))
  (setq i 0)
  (foreach x hatlar
    (setq liste (append liste (list (list no (if (= (nth 0 x) "Trifaze") "3" "1") (cadr (ict:kablo (nth 1 x)))
                                          (cadr (nth 2 x)) (nth 3 x) (nth 4 x) nil (nth 5 x)
                                          (ict:kablo-adi (nth 1 x) (car (nth 2 x)) (if (= (nth 0 x) "Trifaze") "3" "1"))
                                          (ict:hat-ismi i (length hatlar)))))
          no (1+ no) i (1+ i)))
  (setq toplam 0.0 adlar "" degerler "")
  (foreach x liste
    (setq eY (atof (rtos (/ (* (ict:katsayi (nth 1 x) (nth 2 x)) (nth 5 x) (nth 4 x)) (nth 3 x)) 2 2))
          toplam (+ toplam eY)
          adlar (strcat adlar (if (= adlar "") "" " + ") "%e" (itoa (nth 0 x)))
          degerler (strcat degerler (if (= degerler "") "" " + ") (ict:n2 eY))))
  (setq toplam (atof (rtos toplam 2 2)))
  (if mevcut (setq Iz (nth bdos (caddr bsatir)) akim-ok (and Iz (<= In Iz))) (setq akim-ok T))

  ;; --- çizim
  (setq *ict-adim* "çizim")
  (command "_.UNDO" "_BE")
  (setq *ict-undo* T)
  (ict:sinir-sifirla)
  (ict:stil)
  (setq x0 (car pt) y (cadr pt) y0 y m (* 2.0 h))
  ;; çerçeve genişliği: şemaya ve en uzun satıra göre
  (setq g (+ (* 5.0 h) (if mevcut 0.0 (* 21.0 h))))
  (foreach x liste (setq g (+ g (ict:parca-genislik (nth 8 x) h) (* 3.2 h))))
  (setq g (max (* 66.0 h) (+ g (* 8.0 h))))
  (defun ict:satir (str renk) (ict:yazi (list (+ x0 m) y) str h renk 1) (setq y (- y (* 1.75 h))))
  (defun ict:bos () (setq y (- y (* 0.9 h))))
  (defun ict:ayrac () (ict:cizgi (list (+ x0 m) y) (list (- (+ x0 g) m) y) 251) (setq y (- y (* 1.2 h))))
  (defun ict:bolum (str)
    (setq y (- y (* 0.6 h)))
    (ict:bant x0 y (+ x0 g) (- y (* 2.6 h)) 250)
    (ict:bant x0 y (+ x0 (* 0.6 h)) (- y (* 2.6 h)) 30)
    (ict:yazi (list (+ x0 m) (- y (* 1.3 h))) (ict:kalin str) (* 1.05 h) 7 4)
    (setq y (- y (* 3.8 h))))
  (defun ict:bilgi (etiket deger)
    (ict:yazi (list (+ x0 m) y) etiket h 254 1)
    (ict:yazi (list (+ x0 (* 17.0 h)) y) deger h 7 1)
    (setq y (- y (* 1.9 h))))

  ;; üst başlık
  (ict:bant x0 y (+ x0 g) (- y (* 4.2 h)) 160)
  (ict:yazi (list (+ x0 (/ g 2.0)) (- y (* 2.1 h))) (ict:kalin "GERİLİM DÜŞÜMÜ VE AKIM HESABI") (* 1.45 h) 7 5)
  (setq y (- y (* 5.6 h)))

  ;; güç bilgileri
  (if kurulu (ict:bilgi "Kurulu güç" (strcat (ict:n0 kurulu) " W")))
  (ict:bilgi "Talep güç (Nt)"
             (strcat (if (ict:sadece-sayi-mi talep-s) "" (strcat (ict:islem-yaz talep-s) " = "))
                     (ict:kalin (strcat (ict:n0 nt) " W"))))
  (ict:bilgi "Sistem" (strcat (if (= bfk "3") "Trifaze " "Monofaze ") (ict:ns u) " V · cos φ " (ict:ns cosfi)))

  ;; akım
  (if mevcut
    (progn
      (ict:bolum "AKIM YÖNÜNDEN KONTROL")
      (ict:satir (strcat "In = Nt / (" (if (= bfk "3") "√3 x " "") "U x CosQ) = " (ict:n0 nt) " W / " (ict:ns bolen)
                         " = " (ict:renkli (ict:kalin (strcat (ict:n2 In) " A")) 2)
                         (if akim-ok " < " " > ") (if Iz (ict:ns Iz) "-") " A") 7)
      (ict:satir (ict:kalin (strcat "MEVCUT BRANŞMAN " (ict:kablo-adi btip (car bsatir) bfk)
                                    (if akim-ok " UYGUNDUR." " UYGUN DEĞİLDİR."))) (if akim-ok 3 1)))
    (progn
      (ict:bolum "AKIM YOĞUNLUĞU HESABI")
      (ict:satir (strcat "In = Nk / (" (if (= bfk "3") "√3 x " "") "U x CosQ) = "
                         (if (ict:sadece-sayi-mi talep-s) (ict:n0 nt) (ict:parantezli (ict:islem-yaz talep-s)))
                         " / " (ict:ns bolen) " = " (ict:renkli (ict:kalin (strcat (ict:n2 In) " A")) 2)) 7)
      (ict:satir (ict:kalin "BAĞLANTI HATTI İLERİDE PROJELENDİRİLECEKTİR.") 30)))

  ;; gerilim düşümü, hat hat
  (ict:bolum "GERİLİM DÜŞÜMÜ HESABI")
  (setq i 0)
  (foreach x liste
    (setq c (ict:katsayi (nth 1 x) (nth 2 x))
          eY (atof (rtos (/ (* c (nth 5 x) (nth 4 x)) (nth 3 x)) 2 2)))
    (ict:satir (strcat (ict:renkli (ict:kalin (strcat "%e" (itoa (nth 0 x)) "   " (nth 9 x))) 4)
                       "    " (nth 8 x) " · " (ict:ns (nth 4 x)) " m · " (if (nth 6 x) "Nt" "N") " = " (ict:n0 (nth 5 x)) " W"
                       (if (/= (nth 7 x) "") (strcat " · " (nth 7 x)) "")) 7)
    (ict:satir (strcat "%e" (itoa (nth 0 x)) " = " (ict:ns c) " x " (if (nth 6 x) "Nt" "N") " x L / S") 254)
    (ict:satir (strcat "%e" (itoa (nth 0 x)) " = " (ict:ns c) " x " (ict:n0 (nth 5 x)) " x " (ict:ns (nth 4 x)) " / " (ict:ns (nth 3 x))
                       " = " (ict:renkli (ict:kalin (ict:n2 eY)) 2)) 7)
    (setq i (1+ i))
    (ict:ayrac))

  ;; tek hat şeması
  (ict:yazi (list (+ x0 m) y) (ict:kalin "TEK HAT ŞEMASI") (* 0.85 h) 254 1)
  (setq y (- y (* 6.0 h)) px (+ x0 (* 5.0 h)))
  (ict:nokta px y h)
  (ict:yazi (list px (+ y (* 1.4 h))) "ŞEBEKE" (* 0.8 h) 254 8)
  (if (not mevcut)
    (progn
      (ict:kesikli (+ px (* 0.5 h)) (+ px (* 18.0 h)) y 30 h)
      (ict:yazi (list (+ px (* 9.0 h)) (+ y (* 0.7 h))) "BAĞLANTI HATTI" (* 0.8 h) 30 8)
      (ict:yazi (list (+ px (* 9.0 h)) (- y (* 0.7 h))) "ileride projelendirilecek" (* 0.8 h) 30 2)
      (setq px (+ px (* 18.0 h) (* 1.6 h)))
      (ict:pano px y h)
      (ict:yazi (list px (+ y (* 1.6 h))) (ict:kalin "AT") (* 0.9 h) 7 8)
      (ict:yazi (list px (- y (* 1.6 h))) (strcat "Nt = " (ict:n0 nt) " W") (* 0.8 h) 254 2)
      (setq px (+ px (* 1.6 h))))
    (setq px (+ px (* 0.5 h))))
  (setq i 0)
  (foreach x liste
    (setq seg (ict:parca-genislik (nth 8 x) h)
          son (= i (1- (length liste))))
    (ict:parca px (+ px seg) y h (nth 0 x) (nth 8 x) (nth 4 x))
    (setq px (+ px seg))
    (if son
      (ict:yuk px y h (nth 5 x))
      (progn
        (setq px (+ px (* 1.6 h)))
        (ict:pano px y h)
        (ict:yazi (list px (+ y (* 1.6 h)))
                  (ict:kalin (cond ((nth 6 x) "AT") ((= i (if mevcut 1 0)) "TN") (T (strcat "TN" (itoa (- i (if mevcut 0 -1))))))) (* 0.9 h) 7 8)
        (ict:yazi (list px (- y (* 1.6 h)))
                  (strcat (if (nth 6 x) "Nt" "N") " = " (ict:n0 (nth 5 x)) " W") (* 0.8 h) 254 2)
        (setq px (+ px (* 1.6 h)))))
    (setq i (1+ i)))
  (setq y (- y (* 6.0 h)))

  ;; sonuç
  (ict:bolum "SONUÇ")
  (ict:satir (strcat adlar " = " degerler " = " (ict:renkli (ict:kalin (ict:n2 toplam)) 2)
                     (if (<= toplam limit) " < " " > ") (ict:ns limit)) 7)
  (setq y (- y (* 0.4 h)))
  (ict:yazi (list (+ x0 m) y)
            (ict:kalin (cond ((not akim-ok) "BRANŞMAN AKIM YÖNÜNDEN UYGUN DEĞİLDİR.")
                             ((> toplam limit) "GERİLİM DÜŞÜMÜ UYGUN DEĞİLDİR.")
                             (mevcut "UYGUNDUR.")
                             (T "KULLANILAN TÜM KESİTLER UYGUNDUR.")))
            (* 1.3 h) (if (and akim-ok (<= toplam limit)) 3 1) 1)
  (setq y (- y (* 3.2 h)))
  ;; dış çerçeve
  (ict:dortgen x0 y0 (+ x0 g) y 253)

  (command "_.UNDO" "_E")
  (setq *ict-undo* nil)
  ;; çizilen alana yakınlaştır
  (if *ict-sinir*
    (command "_.ZOOM" "_W"
             (trans (list (- (nth 0 *ict-sinir*) (* 3 h)) (- (nth 1 *ict-sinir*) (* 3 h)) 0.0) 0 1)
             (trans (list (+ (nth 2 *ict-sinir*) (* 3 h)) (+ (nth 3 *ict-sinir*) (* 3 h)) 0.0) 0 1)))
  (princ (strcat "\n" (itoa *ict-adet*) " nesne çizildi."
                 (if (> *ict-hata* 0) (strcat " " (itoa *ict-hata*) " nesne çizilemedi!") "")))
  (setvar "DIMZIN" eski-dz)
  (setvar "CMDECHO" eski-ce)
  (princ (strcat "\nToplam gerilim düşümü %" (ict:n2 toplam)
                 (if (and akim-ok (<= toplam limit)) " - UYGUN." " - UYGUN DEĞİL.")))
  (princ))

;;; ---------------------------------------------------------------- ayar komutu
(defun c:GDAYAR (/ v)
  (setq v (ict:sor-real "Trifaze gerilim (V)" (ict:ayar "U3" 380.0))) (ict:ayar-yaz "U3" v)
  (setq v (ict:sor-real "Monofaze gerilim (V)" (ict:ayar "U1" 220.0))) (ict:ayar-yaz "U1" v)
  (setq v (ict:sor-real "Bakır k" (ict:ayar "KCU" 56.0))) (ict:ayar-yaz "KCU" v)
  (setq v (ict:sor-real "Alüminyum k" (ict:ayar "KAL" 35.0))) (ict:ayar-yaz "KAL" v)
  (setq v (ict:sor-real "cos fi" (ict:ayar "COSFI" 0.8))) (ict:ayar-yaz "COSFI" v)
  (setq v (ict:sor-real "Toplam düşüm sınırı (%)" (ict:ayar "LIMIT" 1.5))) (ict:ayar-yaz "LIMIT" v)
  (princ (strcat "\nKatsayılar: trifaze bakır " (ict:ns (ict:katsayi "3" "cu"))
                 ", trifaze alüminyum " (ict:ns (ict:katsayi "3" "al"))
                 ", monofaze bakır " (ict:ns (ict:katsayi "1" "cu"))
                 ", monofaze alüminyum " (ict:ns (ict:katsayi "1" "al"))))
  (princ))

(princ "\nProje İşleri yüklendi. Komutlar: GERILIMDUSUMU (hesap), GDAYAR (ayarlar).")
(princ)
