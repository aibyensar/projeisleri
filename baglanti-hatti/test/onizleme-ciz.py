import ezdxf, sys
from ezdxf.addons.drawing import RenderContext, Frontend, pymupdf, layout, config
d=ezdxf.readfile(sys.argv[1]); m=d.modelspace()
be=pymupdf.PyMuPdfBackend()
cfg=config.Configuration(background_policy=config.BackgroundPolicy.WHITE, image_policy=config.ImagePolicy.DISPLAY)
Frontend(RenderContext(d), be, config=cfg).draw_layout(m)
page=layout.Page(0,0, layout.Units.mm)
open(sys.argv[2],'wb').write(be.get_pdf_bytes(page, settings=layout.Settings(fit_page=True)))
