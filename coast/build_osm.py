# Bygger js/data.js från OpenStreetMaps landpolygoner (coast/aland.geojson, coast/region.geojson)
import json, math, base64, io, os, sys
import numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage
LAT0, LON0 = 60.2, 20.0
KX = 111320*math.cos(math.radians(LAT0)); KZ = 110574.0
def xy(lat, lon): return ((lon-LON0)*KX, -(lat-LAT0)*KZ)
def polys_of(path):
    d = json.load(open(path)); out = []
    def walk(g):
        if not g: return
        t = g['type']
        if t == 'Polygon': out.append(g['coordinates'])
        elif t == 'MultiPolygon': out.extend(g['coordinates'])
        elif t == 'GeometryCollection':
            for x in g['geometries']: walk(x)
    for f in d['features']: walk(f['geometry'])
    return out
def raster(polys, X0, Z0, S, NX, NZ, ss=1):
    # ss: översampling för att små öar inte ska försvinna i kantutjämningen
    W, H = NX*ss, NZ*ss
    img = Image.new('L', (W, H), 0); dr = ImageDraw.Draw(img)
    def pp(ring): return [(((lon-LON0)*KX - X0)/S*ss, ((-(lat-LAT0)*KZ) - Z0)/S*ss) for lon, lat in ring]
    for p in polys:
        if len(p[0]) > 2: dr.polygon(pp(p[0]), fill=255)
    for p in polys:
        for h in p[1:]:
            if len(h) > 2: dr.polygon(pp(h), fill=0)
    a = np.asarray(img, dtype=np.float32) / 255.0
    if ss > 1: a = a.reshape(NZ, ss, NX, ss).mean(axis=(1, 3))
    return a > 0.5
def png_uri(arr):
    b = io.BytesIO(); Image.fromarray((arr*255).astype(np.uint8)).convert('1').save(b, 'PNG', optimize=True)
    return 'data:image/png;base64,' + base64.b64encode(b.getvalue()).decode()

# ---- kärnan: Åland 72 x 72 km, 4096 px ----
N, HALF = 4096, 36000.0; S = 2*HALF/N
core = raster(polys_of('aland.geojson'), -HALF, -HALF, S, N, N, ss=2)
print('core land', core.mean())
# ---- regionen: 275 x 167 km, 50 m ----
X0, X1, Z0, Z1, C = -135000, 140000, -62000, 105000, 50.0
NX, NZ = int((X1-X0)/C), int((Z1-Z0)/C)
reg = raster(polys_of('region.geojson'), X0, Z0, C, NX, NZ, ss=2)
# Åland i regionen från den detaljerade datan (samma kust i båda nivåerna)
print('region land', reg.mean())
Image.fromarray((core*255).astype(np.uint8)).resize((1024, 1024)).save('core_prev.png')
Image.fromarray((reg*255).astype(np.uint8)).resize((1100, 668)).save('reg_prev.png')
# ---- Degerby: hamnläge på vattnet för postuppdraget (minst 80 m från land) ----
dw = ndimage.distance_transform_edt(~core) * S
best = None
tx, tz = xy(60.0315, 20.385)
for j in range(-60, 61):
    for i in range(-60, 61):
        x, z = tx + i*20, tz + j*20
        px, pz = int((x+HALF)/S), int((z+HALF)/S)
        if dw[pz, px] > 80:
            d = math.hypot(x-tx, z-tz)
            if best is None or d < best[0]: best = (d, round(x), round(z))
print('degerby', best)
tiles = [png_uri(core[i*2048:(i+1)*2048, j*2048:(j+1)*2048]) for i in range(2) for j in range(2)]
TX, TZ = 4, 2; tw, th = NX//TX, NZ//TZ
rtiles = [png_uri(reg[j*th:(j+1)*th, i*tw:(i+1)*tw]) for j in range(TZ) for i in range(TX)]
js = ['// Genererad fil: land/vatten-masker från OpenStreetMaps landpolygoner (© OpenStreetMap-bidragsgivare, ODbL).',
      '// core: Åland 72 x 72 km i 4 rutor à 2048 px (17,6 m/px). region: Ålands hav-regionen i 4 x 2 rutor (50 m/px).',
      'const ALAND_DATA = {', '  N: 4096, HALF: 36000, LAT0: 60.2, LON0: 20.0,', '  mask: [']
js += ["    '" + t + "'" + (',' if k < 3 else '') for k, t in enumerate(tiles)]
js += ['  ],', f'  region: {{ x0: {X0}, x1: {X1}, z0: {Z0}, z1: {Z1}, cell: 50, nx: {NX}, nz: {NZ}, tx: {TX}, tz: {TZ}, tiles: [']
js += ["    '" + t + "'" + (',' if k < len(rtiles)-1 else '') for k, t in enumerate(rtiles)]
js += ['  ] },', f'  degerby: [{best[1]}, {best[2]}]', '};', "if (typeof module !== 'undefined' && module.exports) module.exports = ALAND_DATA;", '']
open('data.js', 'w').write('\n'.join(js))
print('data.js', os.path.getsize('data.js'))
