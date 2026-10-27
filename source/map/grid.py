import numpy as np, json, math
from scipy.interpolate import RectBivariateSpline
from PIL import Image, ImageDraw
Z=np.load('Z.npy'); lons=json.load(open('meta.json'))['lons']
LAT0,LON0=50.708,4.360
MLON=111320*math.cos(math.radians(50.673)); MLAT=111230
xs=(np.array(lons)-LON0)*MLON; ys=np.linspace(0,0.07*MLAT,100)
Zc=Z.copy()
# remove Lion's Mound (built 1823-26): column 4.405, rows 41-43 -> interpolate rows 40..44
c=lons.index(4.405)
for r in (41,42,43): Zc[r,c]=Zc[40,c]+(Zc[44,c]-Zc[40,c])*(r-40)/4
S=RectBivariateSpline(ys,xs,Zc,kx=3,ky=3,s=0)
CELL=50
nx=int(xs[-1]//CELL)+1; ny=int(ys[-1]//CELL)+1
gx=np.arange(nx)*CELL; gy=np.arange(ny)*CELL
H=S(gy,gx)
print('grid',nx,ny,H.min(),H.max())
np.save('H50.npy',H)
# hillshade for inspection at 50m, upscale
dzdx=np.gradient(H,CELL,axis=1); dzdy=np.gradient(H,CELL,axis=0)
az=math.radians(315); alt=math.radians(40)
slope=np.arctan(np.hypot(dzdx,dzdy)*2.0); aspect=np.arctan2(-dzdx,dzdy)
hs=np.sin(alt)*np.cos(slope)+np.cos(alt)*np.sin(slope)*np.cos(az-aspect)
img=(np.clip(hs,0,1)*200+40).astype(np.uint8)
# tint by elevation
t=(H-H.min())/(H.max()-H.min())
rgb=np.stack([img*(0.75+0.25*t),img*(0.8+0.15*t),img*(0.7+0.1*t)],-1).clip(0,255).astype(np.uint8)
im=Image.fromarray(rgb).resize((nx*4,ny*4),Image.BILINEAR)
d=ImageDraw.Draw(im)
def P(la,lo): return ((lo-LON0)*MLON/CELL*4,(LAT0-la)*MLAT/CELL*4)
# contours every 5 m via marching on upscaled? simple: mark cells crossing 5m levels
Hu=np.array(Image.fromarray(H.astype(np.float32)).resize((nx*4,ny*4),Image.BILINEAR))
lv=np.floor(Hu/5)
edge=(lv!=np.roll(lv,1,0))|(lv!=np.roll(lv,1,1))
a=np.array(im); a[edge]=(a[edge]*0.55).astype(np.uint8); im=Image.fromarray(a); d=ImageDraw.Draw(im)
L=[('MSJ farm',50.685861,4.4099194),('Hougoumont',50.6706306,4.3948),('Lion',50.67833,4.40472),('Crossroads',50.6801611,4.4116889),('LHS',50.67806,4.4118528),('Papelotte',50.68028,4.43389),('La Haye',50.6804306,4.4362194),('Smohain',50.6807306,4.4425194),('Frischermont',50.6776306,4.4449),('Belle Alliance',50.668333,4.413611),('Plancenoit',50.6606611,4.4295111),('Rossomme',50.65675,4.4133306),('Le Caillou',50.6461,4.4207694),('Ohain',50.700,4.467),('Braine-l\'A',50.683,4.367),('Lasne',50.683,4.483)]
for n,la,lo in L:
    x,y=P(la,lo); d.ellipse([x-5,y-5,x+5,y+5],fill=(200,0,0)); d.text((x+7,y-6),n,fill=(120,0,0))
im.save('hillshade.png'); print(im.size)
