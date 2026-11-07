#!/bin/bash
# DXF önizleme resmi: baglanti-hatti/test/onizleme.sh <klasör> <başvuru no> <çıkış adı (uzantısız)>
# Gerekli: pip ezdxf pymupdf, poppler (pdftoppm); Arial yerine: cp LiberationSans-Regular.ttf ~/.fonts/arial.ttf && python3 -m ezdxf --fonts
D=$(cd "$(dirname "$0")" && pwd)
cd $1 && sed "s#\.\\\\$2#$1/$2#g; s#\.\\\\agy-kapak.png#$1/agy-kapak.png#" BHP-$2.dxf > on.dxf && python3 -I $D/onizleme-ciz.py on.dxf on.pdf && pdftoppm -r 40 -png -singlefile on.pdf $3
