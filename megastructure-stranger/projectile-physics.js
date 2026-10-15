(() => {
 'use strict';
 function circle(start,end,target,radius=0){
   const dx=end.x-start.x,dy=end.y-start.y,fx=start.x-target.x,fy=start.y-target.y,r=(target.radius||0)+radius;
   const a=dx*dx+dy*dy,c=fx*fx+fy*fy-r*r;if(c<=0)return 0;if(!a)return null;
   const b=2*(fx*dx+fy*dy),d=b*b-4*a*c;if(d<0)return null;
   const t=(-b-Math.sqrt(d))/(2*a);return t>=0&&t<=1?t:null;
 }
 function box(start,end,wall,radius=0){
   let lo=0,hi=1;
   for(const [axis,size] of [['x','width'],['y','height']]){
     const delta=end[axis]-start[axis],min=wall[axis]-radius,max=wall[axis]+wall[size]+radius;
     if(Math.abs(delta)<1e-9){if(start[axis]<min||start[axis]>max)return null;continue;}
     const a=(min-start[axis])/delta,b=(max-start[axis])/delta;lo=Math.max(lo,Math.min(a,b));hi=Math.min(hi,Math.max(a,b));if(lo>hi)return null;
   }return lo;
 }
 function trace(bullet,end,walls,targets){
   let best=null;const choose=(t,kind,target)=>{if(t!==null&&(!best||t<best.t))best={t,kind,target,x:bullet.x+(end.x-bullet.x)*t,y:bullet.y+(end.y-bullet.y)*t};};
   for(const wall of walls)choose(box(bullet,end,wall,bullet.radius||0),'wall',wall);
   for(const target of targets)if(target.health>0)choose(circle(bullet,end,target,bullet.radius||0),'target',target);
   return best;
 }
 function distanceToSegment(start,end,target){const dx=end.x-start.x,dy=end.y-start.y,l=dx*dx+dy*dy,t=l?Math.max(0,Math.min(1,((target.x-start.x)*dx+(target.y-start.y)*dy)/l)):0;return Math.hypot(target.x-start.x-dx*t,target.y-start.y-dy*t);}
 function falloff(travelled,range=1000){const fraction=Math.max(0,travelled)/Math.max(1,range);return Math.max(.65,1-Math.max(0,fraction-.55)*.7);}
 window.ProjectilePhysics={circle,box,trace,distanceToSegment,falloff};
})();
