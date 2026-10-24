"""Reproducible source PNG → semantic masks → VTracer paths → animated SVG.

Run with the temporary venv described in README.md. No raster is embedded in SVG.
"""
from pathlib import Path
import json, math, xml.etree.ElementTree as ET
import numpy as np
from PIL import Image, ImageDraw, ImageFilter
import vtracer

# Inline HTML parses unprefixed SVG children in the surrounding SVG namespace.
# ElementTree's default ns0:path spelling is XML-valid but fails when inserted
# through HTML innerHTML, so preserve the SVG default namespace explicitly.
ET.register_namespace('', 'http://www.w3.org/2000/svg')

HERE = Path(__file__).resolve().parent
SOURCE = HERE.parents[1] / 'public/charactar/PM-1.png'
im = Image.open(SOURCE).convert('RGBA')
W, H = im.size
work = HERE / 'work'
work.mkdir(exist_ok=True)
im.save(HERE / 'source.png')

# A hand-authored semantic cut ends inside the cuff. The source has no skeleton.
# The torso/cuff remain fixed. This complementary cut needs visual seam review;
# it does not reconstruct the anatomy hidden behind a large arm movement.
mask = Image.new('L', im.size)
d = ImageDraw.Draw(mask)
d.polygon([(60,450),(280,450),(280,725),(215,770),(207,855),
           (204,899),(173,912),(128,914),(90,901),(80,885),
           (88,845),(105,790),(113,760),(92,715),(65,670)], fill=255)
rgba = np.array(im)
# Remove detached alpha speckles from the original transparent export. Keep the
# main connected character plus a two-pixel margin for antialiased edge pixels.
connected = im.getchannel('A').point(lambda x: 255 if x >= 128 else 0)
ImageDraw.floodfill(connected, (600,1000), 128)
connected = connected.point(lambda x: 255 if x == 128 else 0).filter(ImageFilter.MaxFilter(5))
rgba[:,:,3] = np.minimum(rgba[:,:,3], np.array(connected))
hand = rgba.copy()
hand[:,:,3] = np.minimum(hand[:,:,3], np.array(mask))
base = rgba.copy()
base[:,:,3] = np.where(np.array(mask)>0,0,base[:,:,3])

# Reconstruct skin behind the baked smile using nearby unoccluded skin samples.
# This is an explicit local reconstruction, not automatic anatomical recognition.
yy, xx = np.mgrid[:H,:W]
angle = math.radians(-16)
u = (xx-576)*math.cos(angle)+(yy-529)*math.sin(angle)
v = -(xx-576)*math.sin(angle)+(yy-529)*math.cos(angle)
r = np.sqrt((u/98)**2+(v/44)**2)
samples = (r>1.05)&(r<1.38)&(yy<565)&(xx>475)&(xx<680)&(rgba[:,:,0]>220)&(rgba[:,:,1]>150)
features = np.stack([np.ones_like(xx), (xx-576)/100, (yy-529)/100],axis=-1)
coef = np.linalg.lstsq(features[samples],rgba[:,:,:3][samples],rcond=None)[0]
skin = np.clip(features@coef,0,255)
blend = np.clip((1-r)/.15,0,1)[...,None]
base[:,:,:3] = (base[:,:,:3]*(1-blend)+skin*blend).astype('uint8')
Image.fromarray(base).save(work/'body.png')
Image.fromarray(hand).save(work/'arm.png')

def trace(name):
    path = work / f'{name}.svg'
    vtracer.convert_image_to_svg_py(str(work/f'{name}.png'), str(path),
        colormode='color', hierarchical='stacked', mode='spline',
        filter_speckle=6, color_precision=7, layer_difference=8,
        corner_threshold=60, length_threshold=4.0, max_iterations=10,
        splice_threshold=45, path_precision=2)
    root = ET.parse(path).getroot()
    return ''.join(ET.tostring(child,encoding='unicode') for child in root), len(list(root))

body, nb = trace('body')
arm, na = trace('arm')
svg = f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}" role="img" aria-label="Layered traced programmer host">
<title>PNG traced into vector paths, with hand-authored animation controls</title>
<g id="body">{body}</g>
<g id="pointing-arm" data-pivot="147 894">{arm}</g>
<g id="eyelids" fill="#FFD0A0" stroke="#342821" stroke-width="5" stroke-linecap="round" visibility="hidden">
  <g transform="rotate(-13 477 429)"><ellipse cx="477" cy="429" rx="36" ry="34" stroke="none"/><path d="M445 429 Q476 447 507 429" fill="none"/></g>
  <g transform="rotate(-13 639 399)"><ellipse cx="639" cy="399" rx="37" ry="33" stroke="none"/><path d="M607 399 Q638 417 670 399" fill="none"/></g>
</g>
<g id="mouth" transform="translate(578 521) rotate(-16)">
  <g id="mouth-closed"><path d="M-64 -4 Q0 17 65 -4" fill="none" stroke="#221B18" stroke-width="7" stroke-linecap="round"/></g>
  <g id="mouth-small" visibility="hidden"><path d="M-54 -3 Q0 38 55 -3 Q0 14 -54 -3" fill="#422522" stroke="#241B18" stroke-width="4"/><path d="M-42 1 Q0 12 42 1 L30 11 Q0 17 -30 11Z" fill="#FFF9ED"/></g>
  <g id="mouth-open" visibility="hidden"><path d="M-54 -3 Q0 74 55 -3 Q0 12 -54 -3" fill="#3B2020" stroke="#241B18" stroke-width="4"/><path d="M-44 1 Q0 12 44 1 L33 14 Q0 21 -33 14Z" fill="#FFF9ED"/><path d="M-18 31 Q0 15 21 31 Q0 43 -18 31Z" fill="#DD807B"/></g>
  <g id="mouth-round" visibility="hidden"><ellipse cx="0" cy="10" rx="18" ry="25" fill="#422522" stroke="#241B18" stroke-width="4"/></g>
</g>
</svg>'''
(HERE/'character.svg').write_text(svg)
stats = {'source':str(SOURCE.relative_to(HERE.parents[1])), 'width':W,'height':H,
         'body_paths':nb,'arm_paths':na,'svg_bytes':len(svg.encode()),
         'trace_settings':{'color_precision':7,'layer_difference':8,'filter_speckle':6},
         'manual_work':['forearm semantic polygon','skin reconstruction behind smile','four vector mouths','two vector eyelids','wrist pivot']}
(HERE/'build-info.json').write_text(json.dumps(stats,indent=2))
print(json.dumps(stats,indent=2))
