/* Row-major homogeneous transforms; internal units are radians and metres. */
(function (root) {
  'use strict';
  const identity = () => [1,0,0,0, 0,1,0,0, 0,0,1,0, 0,0,0,1];
  function multiply(a,b) {
    const out = Array(16).fill(0);
    for(let r=0;r<4;r++) for(let c=0;c<4;c++) for(let k=0;k<4;k++) out[r*4+c]+=a[r*4+k]*b[k*4+c];
    return out;
  }
  const tx = a => [1,0,0,a, 0,1,0,0, 0,0,1,0, 0,0,0,1];
  const tz = d => [1,0,0,0, 0,1,0,0, 0,0,1,d, 0,0,0,1];
  const rx = a => {const c=Math.cos(a),s=Math.sin(a);return [1,0,0,0, 0,c,-s,0, 0,s,c,0, 0,0,0,1];};
  const rz = a => {const c=Math.cos(a),s=Math.sin(a);return [c,-s,0,0, s,c,0,0, 0,0,1,0, 0,0,0,1];};
  const origin = t => [t[3],t[7],t[11]];
  const point = (t,p) => [0,1,2].map(r=>t[r*4]*p[0]+t[r*4+1]*p[1]+t[r*4+2]*p[2]+t[r*4+3]);
  function forward(rows, convention) {
    let t=identity();
    const frames=[t], joints=[], paths=[];
    for(const row of rows) {
      const theta=row.theta+(row.type==='R'?row.q:0),d=row.d+(row.type==='P'?row.q:0);
      const path=[origin(t)];
      if(convention==='MDH') {
        t=multiply(multiply(t,rx(row.alpha)),tx(row.a));
        path.push(origin(t)); joints.push(t);
        t=multiply(multiply(t,rz(theta)),tz(d));
        path.push(origin(t));
      } else {
        joints.push(t);
        t=multiply(multiply(t,rz(theta)),tz(d));
        path.push(origin(t));
        t=multiply(multiply(t,tx(row.a)),rx(row.alpha));
        path.push(origin(t));
      }
      frames.push(t);paths.push(path);
    }
    return {frames,joints,paths,end:t};
  }
  const factor = (kind,angle,length) => kind==='angle'?(angle==='deg'?Math.PI/180:1):(length==='mm'?0.001:1);
  const api={identity,multiply,rx,rz,tx,tz,origin,point,forward,factor};
  if(typeof module!=='undefined'&&module.exports) module.exports=api;
  else root.DHMath=api;
})(globalThis);
