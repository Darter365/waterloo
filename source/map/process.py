import os
import numpy as np, json, base64, math
from scipy.interpolate import RectBivariateSpline
from scipy.ndimage import median_filter
D = os.path.dirname(os.path.abspath(__file__)) + '/'
lons=[];cols=[]
for line in open(D+'dem_cols.txt'):
    k,v=line.strip().split('|'); lons.append(float(k)); cols.append([float(t) for t in v.split(',')])
Z=np.array(cols).T   # rows N->S (100), cols W->E (48)
LAT0,LAT1,LON0=50.708,50.638,4.360
MLON=111320*math.cos(math.radians(50.673)); MLAT=111230
xs=(np.array(lons)-LON0)*MLON
ys=np.linspace(0,(LAT0-LAT1)*MLAT,100)
print('extent m',xs[-1],ys[-1],'dx',xs[1]-xs[0],'dy',ys[1]-ys[0])
print('min/max',Z.min(),Z.max())
# spike check vs 3x3 median
med=median_filter(Z,size=3,mode='nearest'); d=Z-med
idx=np.argwhere(np.abs(d)>7)
print('spikes >7m:',len(idx))
for r,c in idx[:40]:
    print(f'  lat {LAT0-r*0.07/99:.4f} lon {lons[c]:.3f} z {Z[r,c]} med {med[r,c]:.1f}')
# leave-one-out at 4.411 (col 17)
c=lons.index(4.411)
keep=[i for i in range(48) if i!=c]
s=RectBivariateSpline(ys,xs[keep],Z[:,keep],kx=3,ky=3,s=0)
pred=s(ys,[xs[c]])[:,0]; err=pred-Z[:,c]
print('LOO 4.411 rms %.2f max %.2f'%(np.sqrt((err**2).mean()),np.abs(err).max()))
# validation column 4.4118
val=[109.3,109.7,108.3,109.2,110.3,111.7,112.8,112.9,112.3,109.5,109.6,112.5,115.7,117.5,118.7,118.6,116.6,116.1,116.5,117.3,120.1,124.4,126.9,126.2,123.5,121.8,121.2,121.7,121.7,121.8,121.1,119.9,118.5,117.6,118.0,121.5,122.7,123.4,125.6,129.0,128.8,125.8,123.7,120.8,119.2,118.8,119.3,120.2,121.3,123.8,127.9,130.6,130.5,131.4,133.6,134.1,131.0,128.7,129.3,131.7,134.4,136.5,134.6,134.1,132.6,130.3,128.8,128.4,130.2,131.6,132.6,133.1,133.5,135.3,138.3,142.0,141.5,138.3,135.9,136.0,138.9,139.2,137.1,133.5,129.0,126.4,125.2,126.1,127.1,127.9,128.3,131.4,135.2,137.6,135.7,134.9,135.3,136.7,138.7,140.1]
S=RectBivariateSpline(ys,xs,Z,kx=3,ky=3,s=0)
pv=S(ys,[(4.4118-LON0)*MLON])[:,0]; e2=pv-np.array(val)
print('val 4.4118 rms %.2f max %.2f'%(np.sqrt((e2**2).mean()),np.abs(e2).max()))
# point checks
for nm,la,lo,z in [('Belle Alliance',50.668333,4.413611,133.97),('MSJ farm',50.685861,4.4099194,123.94),('Rossomme',50.65675,4.4133306,139.39),('Le Caillou',50.6461,4.4207694,136.38)]:
    print(nm, round(float(S((LAT0-la)*MLAT,(lo-LON0)*MLON)[0,0]),1), 'vs', z)
np.save(D+'Z.npy',Z); json.dump({'lons':lons},open(D+'meta.json','w'))
