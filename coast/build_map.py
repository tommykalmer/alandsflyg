# Bygger spelets kartdata (data/*.bin) från grenen "geodata":
#   marktäcke (ESA WorldCover + OSM), höjder (Copernicus DEM), vägar och byggnader (OSM).
# Körs lokalt: python3 coast/build_map.py <mapp med geodata> <repo>
import sys, os, gzip, json, math, struct, collections, zlib
import numpy as np, tifffile, cv2
from PIL import Image, ImageDraw
from scipy import ndimage

SRC, REPO = sys.argv[1], sys.argv[2]
OUT = os.path.join(REPO, 'data'); os.makedirs(OUT, exist_ok=True)
import shutil
for d in ('b', 't'):
    if os.path.isdir(os.path.join(OUT, d)): shutil.rmtree(os.path.join(OUT, d))
os.makedirs(os.path.join(OUT, 't'), exist_ok=True)
for f in ('roads.bin',):
    if os.path.exists(os.path.join(OUT, f)): os.remove(os.path.join(OUT, f))
LAT0, LON0 = 60.2, 20.0
KX = 111320 * math.cos(math.radians(LAT0)); KZ = 110574.0
T = 72000; TH = T / 2
REG = dict(x0=-135000, x1=140000, z0=-62000, z1=105000)
CH = 9000  # terrängrutornas storlek

def xz(lon, lat): return ((lon - LON0) * KX, -(lat - LAT0) * KZ)

def features(path):
    with gzip.open(path, 'rt') as f:
        for line in f:
            line = line.strip().lstrip('\x1e')
            if line: yield json.loads(line)

def polys(g):
    if g['type'] == 'Polygon': return [g['coordinates']]
    if g['type'] == 'MultiPolygon': return g['coordinates']
    return []

def gz(name, data):
    p = os.path.join(OUT, name)
    with open(p, 'wb') as f: f.write(gzip.compress(data, 9, mtime=0))
    print(f'{name}: {len(data)} -> {os.path.getsize(p)} bytes')

# ---------------- rasterisering ----------------
class Canvas:
    def __init__(s, X0, Z0, cell, NX, NZ, ss=2):
        s.X0, s.Z0, s.c, s.NX, s.NZ, s.ss = X0, Z0, cell, NX, NZ, ss
    def new(s): return Image.new('L', (s.NX * s.ss, s.NZ * s.ss), 0)
    def pts(s, ring):
        out = []
        for lon, lat in ring:
            x, z = xz(lon, lat)
            out.append(((x - s.X0) / s.c * s.ss, (z - s.Z0) / s.c * s.ss))
        return out
    def poly(s, d, p, v=255):
        d.polygon(s.pts(p[0]), fill=v)
        for h in p[1:]: d.polygon(s.pts(h), fill=0)
    def done(s, im, thr=0.5):
        a = np.asarray(im, np.float32) / 255
        if s.ss > 1: a = a.reshape(s.NZ, s.ss, s.NX, s.ss).mean(axis=(1, 3))
        return a >= thr

# WorldCover → spelets klasser
# 1 skog, 2 buskmark/hed, 3 gräs/äng, 4 åker, 5 tät bebyggelse, 6 berg/häll, 7 sjö, 8 våtmark,
# 9 villaområde (trädgårdar), 10 industri/asfaltytor, 11 sand
WC = {10: 1, 20: 2, 30: 3, 40: 4, 50: 5, 60: 6, 70: 3, 80: 7, 90: 8, 95: 8, 100: 2}
def wc_classes(a):
    out = np.zeros(a.shape, np.uint8)
    for k, v in WC.items(): out[a == k] = v
    return out

def mode2(a):
    # 2×2-block → vanligaste klassen (bebyggelse och vatten vinner oavgjort)
    H, W = a.shape[0] // 2, a.shape[1] // 2
    b = a[:H * 2, :W * 2].reshape(H, 2, W, 2).transpose(0, 2, 1, 3).reshape(H, W, 4)
    best = b[..., 0].copy(); bestn = np.zeros((H, W), np.int8)
    for k in range(4):
        v = b[..., k]; n = (b == v[..., None]).sum(-1)
        pri = (v == 5) | (v == 7)
        upd = (n > bestn) | ((n == bestn) & pri)
        best[upd] = v[upd]; bestn[upd] = n[upd]
    return best

def land_mask(path, cv):
    im = cv.new(); d = ImageDraw.Draw(im)
    for f in features_plain(path):
        for p in polys(f): cv.poly(d, p)
    return cv.done(im)

def features_plain(path):
    d = json.load(gzip.open(path, 'rt'))
    for f in d['features']: yield f['geometry']

# ================= ÅLAND (kärnan, 20 m) =================
N = 3600; CELL = T / N
cv = Canvas(-TH, -TH, CELL, N, N, ss=2)
print('core land mask')
land = land_mask(os.path.join(REPO, 'coast/aland.geojson.gz'), cv)
wc = wc_classes(tifffile.imread(os.path.join(SRC, 'landcover_core.tif')))
lc = mode2(wc)
print('osm overlays')
lay = {k: cv.new() for k in ['water', 'farm', 'rock', 'wet', 'res', 'ind', 'sand', 'grass']}
drw = {k: ImageDraw.Draw(v) for k, v in lay.items()}
farm_im = Image.new('I', (N, N), 0); farm_d = ImageDraw.Draw(farm_im)
nfarm = 0
LANDUSE = {'residential': 'res', 'industrial': 'ind', 'commercial': 'ind', 'retail': 'ind', 'farmland': 'farm', 'meadow': 'grass',
           'grass': 'grass', 'orchard': 'grass', 'allotments': 'grass', 'quarry': 'sand', 'construction': 'sand'}
NATURAL = {'water': 'water', 'bare_rock': 'rock', 'wetland': 'wet', 'sand': 'sand', 'beach': 'sand', 'shingle': 'rock', 'grassland': 'grass', 'heath': 'grass'}
osm_core = list(features(os.path.join(SRC, 'osm_aland.geojsonseq.gz')))
for f in osm_core:
    p = f['properties']; ps = polys(f['geometry'])
    if not ps: continue
    k = None
    if 'building' in p: continue
    if p.get('natural') in NATURAL: k = NATURAL[p['natural']]
    elif p.get('landuse') in LANDUSE: k = LANDUSE[p['landuse']]
    elif p.get('amenity') == 'parking' or p.get('aeroway') in ('apron', 'runway', 'taxiway'): k = 'ind'
    elif p.get('leisure') in ('golf_course', 'pitch', 'park'): k = 'grass'
    if not k: continue
    for pp in ps:
        cv.poly(drw[k], pp)
        if k == 'farm':
            nfarm += 1
            farm_d.polygon([(x / 2, z / 2) for x, z in cv.pts(pp[0])], fill=nfarm)
M = {k: cv.done(v) for k, v in lay.items()}
notree = lc != 1
lc[M['grass'] & notree & (lc != 5)] = 3
lc[M['farm'] & np.isin(lc, [2, 3, 4, 8])] = 4
lc[M['wet'] & np.isin(lc, [2, 3, 4])] = 8
lc[M['rock'] & notree & (lc != 5)] = 6
lc[M['sand'] & notree] = 11
lc[M['res'] & np.isin(lc, [1, 2, 3, 4, 6])] = 9
lc[M['ind'] & (lc != 7)] = 10
# WorldCovers vatten räknas som sjö bara om det inte hänger ihop med havet (annars är det strandkant)
sea_d = ndimage.binary_dilation(~land, iterations=2)
wl, nw = ndimage.label((lc == 7) & land)
touch = np.unique(wl[sea_d & (wl > 0)])
shore = np.isin(wl, touch[touch > 0])
lc[shore] = 6
lc[M['water']] = 7
# havet bestäms av kustlinjen; WorldCovers vatten på land blir sjö, annat land utan klass blir gräs
lc[~land] = 0
lc[land & (lc == 0)] = 3
# åkrarnas skiften: varje OSM-skifte (eller en Voronoi-cell där det saknas) får en egen ton 0–15
farm = np.asarray(farm_im, np.int64)
rs = np.random.RandomState(7)
seeds = rs.rand(int(T * T / (190 * 190)), 2) * N
vor = np.zeros((N, N), np.int64)
# Voronoi via avståndstransform över slumpade frön
seedimg = np.ones((N, N), np.uint8); si = seeds.astype(int).clip(0, N - 1)
seedimg[si[:, 1], si[:, 0]] = 0
_, idx = ndimage.distance_transform_edt(seedimg, return_indices=True)
vor = idx[0].astype(np.int64) * N + idx[1]
pid = np.where(farm > 0, farm * 7919, vor)
tone = ((pid * 2654435761) >> 7) & 15
fieldish = np.isin(lc, [3, 4])
lc_out = lc.copy()
lc_out[fieldish] |= (tone[fieldish].astype(np.uint8) << 4)
# häll i skog: ljusare skog där OSM säger häll
rf = M['rock'] & (lc == 1)
lc_out[rf] |= (1 << 4)
print('core classes', {int(k): round(float(v), 4) for k, v in zip(*np.unique(lc, return_counts=True)) if True})
gz('lc_core.bin', lc_out.tobytes())

# ---------------- höjder (kärnan) ----------------
print('core heights')
dem = tifffile.imread(os.path.join(SRC, 'dem_core.tif')).astype(np.float32)  # 3600², 20 m
treeF = (wc.reshape(N, 2, N, 2) == 10).mean(axis=(1, 3)).astype(np.float32)
bldF = (wc.reshape(N, 2, N, 2) == 50).mean(axis=(1, 3)).astype(np.float32)
treeF = ndimage.gaussian_filter(treeF, 3); bldF = ndimage.gaussian_filter(bldF, 2)
# ytmodellen innehåller träd och hus: dra av en uppskattad trädhöjd och jämna ut lokala toppar
g = dem - treeF * TREE_OFF if (TREE_OFF := float(os.environ.get('TREE_OFF', '11'))) else dem
g = g - bldF * 5
g = np.minimum(g, ndimage.grey_opening(g, size=(5, 5)) + 2.5)
g = ndimage.gaussian_filter(g, 1.0)
g[~land] = 0
g[land] = np.maximum(g[land], 0.6)
# sjöar: platt yta på sjöns lägsta nivå (10:e percentilen)
lake = (lc == 7) & land
lab, nl = ndimage.label(lake)
if nl:
    lv = ndimage.labeled_comprehension(g, lab, np.arange(1, nl + 1), lambda v: np.percentile(v, 10), np.float32, 0)
    g[lake] = np.maximum(lv[lab[lake] - 1], 0.6)
# kustnära land får inte ligga under havsytan
HN = 1024
h1 = cv2.resize(g, (HN, HN), interpolation=cv2.INTER_AREA)
land1 = cv2.resize(land.astype(np.float32), (HN, HN), interpolation=cv2.INTER_AREA)
h1[land1 < 0.02] = 0
print('core height range', float(h1.min()), float(h1.max()))
def enc_h(h, q):
    # höjd i steg om q meter, kodad som skillnad mot prediktionen vänster + upp − upp-vänster (int8)
    a = np.clip(np.round(h / q), 0, 30000).astype(np.int32)
    p = np.zeros_like(a); p[1:, 1:] = a[1:, :-1] + a[:-1, 1:] - a[:-1, :-1]; p[0, 1:] = a[0, :-1]; p[1:, 0] = a[:-1, 0]
    d = a - p
    assert np.abs(d).max() < 128, np.abs(d).max()
    return d.astype(np.int8).tobytes()
gz('h_core.bin', enc_h(h1, 0.25))

# ================= REGIONEN (50 m marktäcke, 100 m höjder) =================
print('region')
RX, RZ = 5500, 3340
cvr = Canvas(REG['x0'], REG['z0'], 50, RX, RZ, ss=1)
rland = land_mask(os.path.join(REPO, 'coast/region.geojson.gz'), Canvas(REG['x0'], REG['z0'], 50, RX, RZ, ss=2))
rwc = wc_classes(tifffile.imread(os.path.join(SRC, 'landcover_region.tif')))
rlc = rwc.copy()
rlc[~rland] = 0
rlc[rland & (rlc == 0)] = 3
sea_d = ndimage.binary_dilation(~rland, iterations=1)
wl, nw = ndimage.label(rlc == 7)
touch = np.unique(wl[sea_d & (wl > 0)])
rlc[np.isin(wl, touch[touch > 0])] = 6
rs2 = np.random.RandomState(3)
seeds = rs2.rand(int(RX * RZ * 2500 / (220 * 220)), 2) * [RX, RZ]
seedimg = np.ones((RZ, RX), np.uint8); si = seeds.astype(int); si[:, 0] = si[:, 0].clip(0, RX - 1); si[:, 1] = si[:, 1].clip(0, RZ - 1)
seedimg[si[:, 1], si[:, 0]] = 0
_, idx = ndimage.distance_transform_edt(seedimg, return_indices=True)
pid = idx[0].astype(np.int64) * RX + idx[1]
tone = ((pid * 2654435761) >> 7) & 15
fi = np.isin(rlc, [3, 4])
rout = rlc.copy(); rout[fi] |= (tone[fi].astype(np.uint8) << 4)
gz('lc_reg.bin', rout.tobytes())
rdem = tifffile.imread(os.path.join(SRC, 'dem_region.tif')).astype(np.float32)  # 2750×1670, 100 m
rtree = cv2.resize((rwc == 10).astype(np.float32), (2750, 1670), interpolation=cv2.INTER_AREA)
rbld = cv2.resize((rwc == 50).astype(np.float32), (2750, 1670), interpolation=cv2.INTER_AREA)
rl1 = cv2.resize(rland.astype(np.float32), (2750, 1670), interpolation=cv2.INTER_AREA)
rg = rdem - ndimage.gaussian_filter(rtree, 1) * 11 - rbld * 5
rg = ndimage.gaussian_filter(rg, 0.9)
rlake = cv2.resize((rlc == 7).astype(np.float32), (2750, 1670), interpolation=cv2.INTER_AREA) > 0.5
lab, nl = ndimage.label(rlake)
if nl:
    lv = ndimage.labeled_comprehension(rg, lab, np.arange(1, nl + 1), lambda v: np.percentile(v, 10), np.float32, 0)
    rg[rlake] = lv[lab[rlake] - 1]
rg[rl1 < 0.02] = 0
rg[rl1 >= 0.02] = np.maximum(rg[rl1 >= 0.02], 0.6)
print('region height range', float(rg.min()), float(rg.max()))
gz('h_reg.bin', enc_h(rg, 0.5))

# ================= VÄGAR =================
print('roads')
RCLS = {'motorway': 1, 'trunk': 1, 'motorway_link': 2, 'trunk_link': 2, 'primary': 2, 'primary_link': 3, 'secondary': 3, 'secondary_link': 4,
        'tertiary': 4, 'unclassified': 5, 'residential': 5, 'living_street': 5, 'service': 6, 'track': 7, 'cycleway': 8}
CORE_BB = (-TH, -TH, TH, TH)
def in_core(x, z): return -TH < x < TH and -TH < z < TH
def dp(pts, eps):
    if len(pts) < 3: return pts
    a = np.array(pts, np.float32).reshape(-1, 1, 2)
    return cv2.approxPolyDP(a, eps, False).reshape(-1, 2).tolist()
roads = []
def add_road(f, from_core):
    p = f['properties']; g = f['geometry']
    c = RCLS.get(p.get('highway')) or (9 if p.get('aeroway') == 'taxiway' else None)
    if not c or g['type'] != 'LineString': return
    if p.get('service') in ('parking_aisle', 'drive-through'): return
    pts = [xz(lo, la) for lo, la in g['coordinates']]
    mid = pts[len(pts) // 2]
    if from_core != in_core(*mid): return
    br = 1 if p.get('bridge') not in (None, 'no') else 0
    tun = 1 if p.get('tunnel') not in (None, 'no') else 0
    if tun: return
    pts = dp(pts, 1.5)
    roads.append((c | (br << 4), pts))
for f in osm_core: add_road(f, True)
osm_reg = list(features(os.path.join(SRC, 'osm_region.geojsonseq.gz')))
for f in osm_reg: add_road(f, False)
def enc_roads(L):
  buf = bytearray(struct.pack('<I', len(L)))
  for c, pts in L:
    # långa vägar delas så att deltan ryms i int16
    x0, z0 = round(pts[0][0]), round(pts[0][1])
    seg = [(x0, z0)]
    for x, z in pts[1:]:
        x, z = round(x), round(z)
        while abs(x - seg[-1][0]) > 32000 or abs(z - seg[-1][1]) > 32000:
            seg.append(((x + seg[-1][0]) // 2, (z + seg[-1][1]) // 2))
        seg.append((x, z))
    buf += struct.pack('<BHii', c, len(seg), seg[0][0], seg[0][1])
    for k in range(1, len(seg)): buf += struct.pack('<hh', seg[k][0] - seg[k - 1][0], seg[k][1] - seg[k - 1][1])
  return bytes(buf)
print('roads', len(roads))
r_core = [r for r in roads if in_core(*r[1][len(r[1]) // 2])]
r_major = [r for r in roads if not in_core(*r[1][len(r[1]) // 2]) and ((r[0] & 15) <= 4 or (r[0] & 15) == 9)]
r_minor = [r for r in roads if not in_core(*r[1][len(r[1]) // 2]) and 4 < (r[0] & 15) < 9]
gz('roads_core.bin', enc_roads(r_core))
gz('roads_reg.bin', enc_roads(r_major))
troads = collections.defaultdict(list)
for r in r_minor:
    xs = [p[0] for p in r[1]]; zs = [p[1] for p in r[1]]
    for ci in range(math.floor(min(xs) / CH), math.floor(max(xs) / CH) + 1):
        for cj in range(math.floor(min(zs) / CH), math.floor(max(zs) / CH) + 1): troads[(ci, cj)].append(r)

# ================= PUNKTER: fyrar, kraftledningar, orter, färjor =================
pois = {'lighthouse': [], 'power': [], 'place': [], 'ferry': []}
seen = set()
for f in osm_core + osm_reg:
    p = f['properties']; g = f['geometry']
    if g['type'] == 'Point':
        x, z = xz(*g['coordinates'])
        key = (round(x), round(z))
        if key in seen: continue
        seen.add(key)
        if p.get('man_made') == 'lighthouse': pois['lighthouse'].append([round(x), round(z)])
        elif p.get('power') == 'tower': pois['power'].append([round(x), round(z)])
        elif p.get('place') in ('city', 'town', 'village') and p.get('name'):
            pois['place'].append([p['name'], p['place'][0], round(x), round(z)])
    elif p.get('route') == 'ferry' and g['type'] == 'LineString':
        pts = dp([xz(lo, la) for lo, la in g['coordinates']], 30)
        if len(pts) > 1: pois['ferry'].append([[round(a), round(b)] for a, b in pts])
for k, v in pois.items(): print(k, len(v))
with open(os.path.join(OUT, 'pois.json'), 'w') as f: json.dump(pois, f, separators=(',', ':'), ensure_ascii=False)

# ================= BYGGNADER (rutor om 9 km som laddas vid behov) =================
print('buildings')
KIND = {'house': 1, 'detached': 1, 'semidetached_house': 1, 'terrace': 2, 'residential': 1, 'cabin': 3, 'bungalow': 1, 'farm': 1,
        'barn': 4, 'farm_auxiliary': 4, 'shed': 3, 'garage': 3, 'garages': 3, 'boathouse': 3, 'hut': 3, 'greenhouse': 5,
        'apartments': 6, 'commercial': 7, 'retail': 7, 'office': 7, 'hotel': 6, 'industrial': 8, 'warehouse': 8, 'hangar': 8,
        'church': 9, 'chapel': 9, 'cathedral': 9, 'school': 7, 'hospital': 7, 'public': 7, 'civic': 7, 'university': 7, 'kindergarten': 7,
        'sports_hall': 8, 'service': 3, 'transformer_tower': 3, 'roof': 3}
def bheight(p, kind, area):
    for k in ('height', 'building:height'):
        if k in p:
            try: return float(str(p[k]).replace('m', '').replace(',', '.').split(';')[0])
            except: pass
    if 'building:levels' in p:
        try: return float(str(p['building:levels']).split(';')[0].replace(',', '.')) * 3.0 + 1.5
        except: pass
    return {1: 6.5, 2: 9, 3: 3.2, 4: 7.5, 5: 3.5, 6: 16, 7: 11, 8: 9, 9: 16}.get(kind, 6.5 if area < 160 else 9 if area < 700 else 12)
tiles = collections.defaultdict(list)
nb = 0
for f in features(os.path.join(SRC, 'osm_region_buildings.geojsonseq.gz')):
    p = f['properties']; ps = polys(f['geometry'])
    if not ps: continue
    if p.get('building') in ('no', 'construction', 'ruins') or p.get('location') == 'underground': continue
    ring = ps[0][0]
    pts = np.array([xz(lo, la) for lo, la in ring], np.float32)
    if len(pts) < 4: continue
    cx, cz = pts.mean(0)
    if not (REG['x0'] < cx < REG['x1'] and REG['z0'] < cz < REG['z1']): continue
    area = abs(cv2.contourArea(pts))
    if area < 12: continue
    kind = KIND.get(p.get('building'), 0)
    if kind == 0: kind = 1 if area < 220 else 7 if area < 1500 else 8
    if kind == 1 and area > 450: kind = 7
    h = max(2.5, min(bheight(p, kind, area), 120))
    (rx, rz), (rw, rl), ra = cv2.minAreaRect(pts)
    fill = area / max(rw * rl, 1)
    ci, cj = math.floor(cx / CH), math.floor(cz / CH)
    if fill > 0.82 or len(pts) > 40:
        # enkel byggnad: rektangel (med sadeltak för småhus)
        tiles[(ci, cj)].append(('r', rx - ci * CH, rz - cj * CH, rw, rl, ra, h, kind))
    else:
        sp = dp(pts[:-1].tolist(), 0.6)
        if len(sp) < 3 or len(sp) > 60:
            tiles[(ci, cj)].append(('r', rx - ci * CH, rz - cj * CH, rw, rl, ra, h, kind))
        else:
            tiles[(ci, cj)].append(('p', [(x - ci * CH, z - cj * CH) for x, z in sp], h, kind))
    nb += 1
print('buildings kept', nb, 'tiles', len(tiles))
U = 9000 / 65535
index = {}
total = 0
for key in set(tiles) | set(troads):
    ci, cj = key; L = tiles.get(key, [])
    L.sort(key=lambda r: (r[1] if r[0] == 'r' else r[1][0][0]))
    buf = bytearray(enc_roads(troads.get(key, [])))
    buf += struct.pack('<I', len(L))
    for r in L:
        if r[0] == 'r':
            _, x, z, w, l, a, h, k = r
            buf += struct.pack('<BHHHHBBB', 0, int(np.clip(x / U, 0, 65535)), int(np.clip(z / U, 0, 65535)),
                               int(min(w * 10, 65535)), int(min(l * 10, 65535)), int(round((a % 180) / 180 * 255)) & 255, int(min(h * 2, 255)), k)
        else:
            _, pts, h, k = r
            buf += struct.pack('<BBBB', 1, len(pts), int(min(h * 2, 255)), k)
            x0, z0 = pts[0]
            buf += struct.pack('<HH', int(np.clip(x0 / U, 0, 65535)), int(np.clip(z0 / U, 0, 65535)))
            px, pz = round(x0 * 4), round(z0 * 4)
            for x, z in pts[1:]:
                qx, qz = round(x * 4), round(z * 4)
                buf += struct.pack('<hh', max(-32768, min(32767, qx - px)), max(-32768, min(32767, qz - pz))); px, pz = qx, qz
    name = f'{ci}_{cj}.bin'
    data = gzip.compress(bytes(buf), 9, mtime=0)
    open(os.path.join(OUT, 't', name), 'wb').write(data)
    index[f'{ci},{cj}'] = [len(L), len(troads.get(key, [])), len(data)]
    total += len(data)
with open(os.path.join(OUT, 't', 'index.json'), 'w') as f: json.dump(index, f, separators=(',', ':'))
print('tiles', len(index), 'total bytes', total)
