# DWG'den (araclar/dwg-oku.mjs ile) çıkarılmış JSON'u DXF'e çevirir.
# Kullanım: python3 json-dxf.py <cizim.json> <cikis.dxf> [x0,y0,x1,y1 (yalnız bu bölgedeki nesneler)]
# Model alanındaki bütün nesneler ve kullandıkları bloklar alınır. OLE nesneleri (gömülü resimler) atlanır.
import json, math, sys
import ezdxf
from ezdxf.math import Vec2

LW = [0, 5, 9, 13, 15, 18, 20, 25, 30, 35, 40, 50, 53, 60, 70, 80, 90, 100, 106, 120, 140, 158, 200, 211]


def lw(i):
    if i is None: return -1
    if 0 <= i < len(LW): return LW[i]
    return {29: -1, 30: -2, 31: -3}.get(i, -1)


def cevir(kaynak, cikis, bolge=None):
    d = json.load(open(kaynak, encoding='utf8'))
    doc = ezdxf.new('R2018', setup=True)
    doc.header['$INSUNITS'] = 4
    T = d['tables']
    for s in T['STYLE']['entries']:
        ad = s.get('name') or ''
        if not ad or ad in doc.styles: continue
        try: doc.styles.add(ad, font=s.get('font') or 'arial.ttf').dxf.width = s.get('widthFactor') or 1
        except Exception: pass
    for l in T['LTYPE']['entries']:
        ad = l.get('name') or ''
        if not ad or ad.upper() in ('BYLAYER', 'BYBLOCK', 'CONTINUOUS') or ad in doc.linetypes: continue
        desen = [e['elementLength'] for e in l.get('pattern', []) if e.get('elementTypeFlag', 0) == 0]
        try: doc.linetypes.add(ad, pattern=[sum(abs(x) for x in desen)] + desen if desen else [0.0], description=l.get('description', ''))
        except Exception: pass
    for l in T['LAYER']['entries']:
        ad = l.get('name') or ''
        if not ad or ad in doc.layers: continue
        k = doc.layers.add(ad, color=abs(l.get('colorIndex') or 7) or 7)
        lt = l.get('lineType') or ''
        if lt and lt in doc.linetypes: k.dxf.linetype = lt
        w = lw(l.get('lineweight'))
        if w >= 0: k.dxf.lineweight = w
        if l.get('off') or (l.get('colorIndex') or 0) < 0: k.off()
        if l.get('frozen'): k.freeze()
    bloklar = {b['name']: b for b in T['BLOCK_RECORD']['entries'] if b.get('name')}
    model = bloklar['*Model_Space']
    yapilan = {}

    def blok(ad):
        if ad in yapilan: return yapilan[ad]
        b = bloklar.get(ad)
        if b is None: return None
        yeni = ad
        if ad.startswith('*'): yeni = 'K_' + ad[1:]          # anonim bloklar adlandırılır
        yapilan[ad] = yeni
        if yeni in doc.blocks: return yeni
        bp = b.get('basePoint') or {'x': 0, 'y': 0}
        yer = doc.blocks.new(yeni, base_point=(bp['x'], bp['y']))
        for e in b.get('entities', []): ekle(yer, e)
        return yeni

    def ozellik(e):
        a = {'layer': e.get('layer') or '0'}
        c = e.get('colorIndex')
        if c is not None and 0 <= c <= 256: a['color'] = c
        lt = e.get('lineType') or ''
        if lt and lt in doc.linetypes: a['linetype'] = lt
        elif lt.upper() == 'BYBLOCK': a['linetype'] = 'BYBLOCK'
        if e.get('lineTypeScale') not in (None, 1): a['ltscale'] = e['lineTypeScale']
        w = lw(e.get('lineweight'))
        if w != -1: a['lineweight'] = w
        if a['layer'] not in doc.layers: doc.layers.add(a['layer'])
        return a

    def p(v): return (v['x'], v['y'])

    def ekle(yer, e):
        t = e['type']; a = ozellik(e)
        try:
            if t == 'LINE': yer.add_line(p(e['startPoint']), p(e['endPoint']), dxfattribs=a)
            elif t == 'CIRCLE': yer.add_circle(p(e['center']), e['radius'], dxfattribs=a)
            elif t == 'ARC':
                yer.add_arc(p(e['center']), e['radius'], math.degrees(e['startAngle']), math.degrees(e['endAngle']), dxfattribs=a)
            elif t == 'ELLIPSE':
                yer.add_ellipse(p(e['center']), major_axis=p(e['majorAxisEndPoint']), ratio=min(1.0, e['axisRatio']) or 1e-6,
                                start_param=e['startAngle'], end_param=e['endAngle'], dxfattribs=a)
            elif t == 'POINT': yer.add_point(p(e['position']), dxfattribs=a)
            elif t == 'LWPOLYLINE':
                pts = [(v['x'], v['y'], v.get('startWidth', 0) or 0, v.get('endWidth', 0) or 0, v.get('bulge', 0) or 0) for v in e['vertices']]
                pl = yer.add_lwpolyline(pts, format='xyseb', close=bool(e.get('flag', 0) & 1), dxfattribs=a)
                if e.get('constantWidth'): pl.dxf.const_width = e['constantWidth']
            elif t == 'TEXT':
                a.update(height=e['textHeight'], rotation=math.degrees(e.get('rotation') or 0), style=e.get('styleName') or 'Standard',
                         width=e.get('xScale') or 1, oblique=math.degrees(e.get('obliqueAngle') or 0))
                if a['style'] not in doc.styles: a['style'] = 'Standard'
                x = yer.add_text(e.get('text', ''), dxfattribs=a)
                x.dxf.insert = p(e['startPoint'])
                h, v = e.get('halign', 0) or 0, e.get('valign', 0) or 0
                if h or v:
                    x.dxf.halign = h; x.dxf.valign = v
                    x.dxf.align_point = p(e['endPoint'])
                    if h in (3, 5): pass
            elif t == 'MTEXT':
                a.update(char_height=e['textHeight'], attachment_point=e.get('attachmentPoint') or 1, style=e.get('styleName') or 'Standard')
                if a['style'] not in doc.styles: a['style'] = 'Standard'
                if e.get('rectWidth'): a['width'] = e['rectWidth']
                x = yer.add_mtext(e.get('text', ''), dxfattribs=a)
                x.dxf.insert = p(e['insertionPoint'])
                if e.get('directionVector'): x.dxf.text_direction = (e['directionVector']['x'], e['directionVector']['y'], 0)
                elif e.get('rotation'): x.dxf.rotation = math.degrees(e['rotation'])
            elif t == 'INSERT' or t == 'DIMENSION':
                ad = blok(e['name'])
                if not ad: return
                if t == 'DIMENSION':
                    yer.add_blockref(ad, (0, 0), dxfattribs=a)
                else:
                    a.update(xscale=e.get('xScale') or 1, yscale=e.get('yScale') or 1, zscale=e.get('zScale') or 1,
                             rotation=math.degrees(e.get('rotation') or 0))
                    yer.add_blockref(ad, p(e['insertionPoint']), dxfattribs=a)
            elif t == 'HATCH':
                h = yer.add_hatch(dxfattribs=a)
                if e.get('solidFill'): h.set_solid_fill(color=a.get('color', 256))
                else:
                    try: h.set_pattern_fill(e.get('patternName') or 'ANSI31', scale=e.get('patternScale') or 1,
                                            angle=math.degrees(e.get('patternAngle') or 0), color=a.get('color', 256))
                    except Exception: h.set_pattern_fill('ANSI31', scale=e.get('patternScale') or 1, color=a.get('color', 256))
                for yol in e.get('boundaryPaths', []):
                    f0 = yol.get('boundaryPathTypeFlag', 1)
                    # yalnız "dış" ve "çoklu çizgi" bitleri kalır: "türetilmiş" (4) vb. bitler AutoCAD'de
                    # 47 kodunu (piksel boyu) bekletir ve çizim "drawing discarded" ile açılmaz
                    f = (f0 & 2) | 1
                    if f0 & 2:
                        h.paths.add_polyline_path([(v['x'], v['y'], v.get('bulge', 0) or 0) for v in yol['vertices']], is_closed=True, flags=f)
                    else:
                        ep = h.paths.add_edge_path(flags=1)
                        for k in yol.get('edges', []):
                            if k['type'] == 1: ep.add_line(p(k['start']), p(k['end']))
                            elif k['type'] == 2:
                                ep.add_arc(p(k['center']), k['radius'], math.degrees(k['startAngle']), math.degrees(k['endAngle']), ccw=bool(k.get('isCCW', 1)))
                            elif k['type'] == 3:
                                ep.add_ellipse(p(k['center']), p(k['end']), k.get('lengthOfMinorAxis', 1), math.degrees(k['startAngle']),
                                               math.degrees(k['endAngle']), ccw=bool(k.get('isCCW', 1)))
                            elif k['type'] == 4:
                                ep.add_spline(control_points=[p(q) for q in k.get('controlPoints', [])], knot_values=k.get('knots'),
                                              degree=k.get('degree', 3))
        except Exception as x:
            print('atlandı', t, e.get('handle'), x)

    msp = doc.modelspace()
    for e in model.get('entities', []):
        if e['type'] in ('OLE2FRAME', 'IMAGE'): continue
        ekle(msp, e)
    if bolge:                                    # pafta dışında kalanları sil
        from ezdxf import bbox as _b
        x0, y0, x1, y1 = bolge
        for e in list(msp):
            k = _b.extents([e])
            if not k.has_data or k.extmax.x < x0 or k.extmin.x > x1 or k.extmax.y < y0 or k.extmin.y > y1: msp.delete_entity(e)
    from ezdxf import bbox
    b = bbox.extents(msp)
    doc.header['$EXTMIN'] = b.extmin; doc.header['$EXTMAX'] = b.extmax
    doc.set_modelspace_vport(height=b.size.y * 1.05, center=b.center)
    doc.saveas(cikis)
    print('yazıldı', cikis, len(msp))


if __name__ == '__main__':
    cevir(sys.argv[1], sys.argv[2], [float(v) for v in sys.argv[3].split(',')] if len(sys.argv) > 3 else None)
