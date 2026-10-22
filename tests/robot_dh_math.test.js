const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
/* The tool is a single HTML file; evaluate its pure-math script block as a CommonJS module. */
const M=(()=>{const html=fs.readFileSync(path.join(__dirname,'../tools/robot_dh_modeler.html'),'utf8');const m={exports:{}};new Function('module',html.match(/<script id="dh-math">([\s\S]*?)<\/script>/)[1])(m);return m.exports;})();
const row=(overrides={})=>({type:'R',a:0,alpha:0,d:0,theta:0,q:0,...overrides});
function near(actual,expected){assert.equal(actual.length,expected.length);actual.forEach((v,i)=>assert.ok(Math.abs(v-expected[i])<1e-10,`${i}: ${v} != ${expected[i]}`));}
test('SDH planar two-link robot reaches analytic endpoint',()=>{
  const result=M.forward([row({a:2,q:Math.PI/2}),row({a:1,q:-Math.PI/2})],'SDH');
  near(M.origin(result.end),[1,2,0]);near(result.end.slice(0,3),[1,0,0]);
});
test('MDH x offset precedes joint rotation',()=>{
  const r=row({a:2,q:Math.PI/2});
  near(M.origin(M.forward([r],'MDH').end),[2,0,0]);
  near(M.origin(M.forward([r],'SDH').end),[0,2,0]);
});
test('prismatic q follows the correct local axis and includes d offset',()=>{
  const r=row({type:'P',alpha:Math.PI/2,a:0.2,d:0.3,q:0.4,theta:Math.PI/3});
  near(M.origin(M.forward([r],'MDH').end),[0.2,-0.7,0]);
  near(M.origin(M.forward([r],'SDH').end),[0.1,Math.sqrt(3)*0.1,0.7]);
});
test('both conventions agree with closed-form homogeneous matrices',()=>{
  for(const convention of ['SDH','MDH'])for(const type of ['R','P'])for(let i=0;i<25;i++){
    const r=row({type,a:i*0.03-0.2,alpha:i*0.17,d:i*0.02,theta:i*0.23,q:-i*0.013});
    const th=r.theta+(type==='R'?r.q:0),d=r.d+(type==='P'?r.q:0),c=Math.cos(th),s=Math.sin(th),ca=Math.cos(r.alpha),sa=Math.sin(r.alpha);
    const expected=convention==='SDH'?[c,-s*ca,s*sa,r.a*c,s,c*ca,-c*sa,r.a*s,0,sa,ca,d,0,0,0,1]:[c,-s,0,r.a,s*ca,c*ca,-sa,-d*sa,s*sa,c*sa,ca,d*ca,0,0,0,1];
    near(M.forward([r],convention).end,expected);
  }
});
test('unit factors normalize degrees, radians, metres and millimetres',()=>{
  near([180*M.factor('angle','deg','mm'),Math.PI*M.factor('angle','rad','m'),300*M.factor('length','deg','mm'),0.3*M.factor('length','rad','m')],[Math.PI,Math.PI,0.3,0.3]);
});
