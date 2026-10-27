import numpy as np, heapq, json, math
from PIL import Image, ImageDraw
H=np.load('H50.npy'); ny,nx=H.shape; CELL=50
# priority-flood fill with epsilon so flats drain
F=H.copy(); seen=np.zeros_like(H,bool); pq=[]
for r in range(ny):
    for c in (0,nx-1): heapq.heappush(pq,(F[r,c],r,c)); seen[r,c]=True
for c in range(nx):
    for r in (0,ny-1):
        if not seen[r,c]: heapq.heappush(pq,(F[r,c],r,c)); seen[r,c]=True
N8=[(-1,-1),(-1,0),(-1,1),(0,-1),(0,1),(1,-1),(1,0),(1,1)]
while pq:
    z,r,c=heapq.heappop(pq)
    for dr,dc in N8:
        rr,cc=r+dr,c+dc
        if 0<=rr<ny and 0<=cc<nx and not seen[rr,cc]:
            seen[rr,cc]=True
            if F[rr,cc]<=z: F[rr,cc]=z+1e-3
            heapq.heappush(pq,(F[rr,cc],rr,cc))
print('filled cells',(F-H>0.05).sum())
# D8
down=-np.ones((ny,nx,2),int)
for r in range(ny):
    for c in range(nx):
        best=0;b=None
        for dr,dc in N8:
            rr,cc=r+dr,c+dc
            if 0<=rr<ny and 0<=cc<nx:
                s=(F[r,c]-F[rr,cc])/math.hypot(dr,dc)
                if s>best: best=s;b=(rr,cc)
        if b: down[r,c]=b
order=np.argsort(-F,axis=None)
acc=np.ones((ny,nx))
for k in order:
    r,c=divmod(k,nx)
    if down[r,c,0]>=0: acc[down[r,c,0],down[r,c,1]]+=acc[r,c]
np.save('acc.npy',acc)
for T in (80,150,300):
    print(T,(acc>=T).sum())
T=300
mask=acc>=T
# trace from heads
up=np.zeros((ny,nx),int)
for r in range(ny):
    for c in range(nx):
        if mask[r,c] and down[r,c,0]>=0 and mask[down[r,c,0],down[r,c,1]]: up[down[r,c,0],down[r,c,1]]+=1
lines=[];done=np.zeros((ny,nx),bool)
heads=[(r,c) for r in range(ny) for c in range(nx) if mask[r,c] and up[r,c]==0]
starts=list(heads)
while starts:
    r,c=starts.pop()
    pts=[(int(c),int(r))];accs=[float(acc[r,c])]
    while True:
        if down[r,c,0]<0: break
        rr,cc=down[r,c]
        pts.append((int(cc),int(rr)));accs.append(float(acc[rr,cc]))
        if done[rr,cc]: break
        done[rr,cc]=True
        r,c=rr,cc
    lines.append({'p':pts,'acc':accs,'a':float(max(accs))})
print('lines',len(lines))
im=Image.open('hillshade.png').convert('RGB'); d=ImageDraw.Draw(im)
for L in lines:
    w=1 if L['a']<400 else 2 if L['a']<1500 else 3
    d.line([(x*4+2,y*4+2) for x,y in L['p']],fill=(30,80,200),width=w)
im.save('streams.png')
json.dump(lines,open('streams.json','w'))
