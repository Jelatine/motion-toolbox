const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
/* The tool is a single HTML file; evaluate its pure-math script block as a CommonJS module. */
const M=(()=>{const html=fs.readFileSync(path.join(__dirname,'../tools/joint_angle_offset_calculator.html'),'utf8');const m={exports:{}};new Function('module',html.match(/<script id=offset-math>([\s\S]*?)<\/script>/)[1])(m);return m.exports;})();
const PPR=131072,N=101;
const sign=c=>c.invert?1:-1;
const toAngle=(pulse,c)=>sign(c)*((pulse-c.offset)/(PPR*N)*360+c.angleOffset);
const toPulse=(angle,c)=>(angle*sign(c)-c.angleOffset)/360*(PPR*N)+c.offset;
const near=(a,b,eps=1e-9)=>assert.ok(Math.abs(a-b)<eps,`${a} != ${b}`);

test('board swap: new angle_offset restores the pre-swap reading at the same pulse',()=>{
  for(const invert of [true,false]){
    const oldBoard={offset:1000,invert,angleOffset:12.5},newBoard={offset:-523344,invert,angleOffset:-3};
    const before=toAngle(4567890,oldBoard);
    const pulseOnNewBoard=4567890+777777;        // encoder zero differs on the new board, joint did not move
    const current=toAngle(pulseOnNewBoard,newBoard);
    const {angleOffset}=M.offsetFor(newBoard.angleOffset,before,current,invert);
    near(toAngle(pulseOnNewBoard,{...newBoard,angleOffset}),before);
  }
});

test('wall alignment: commanding the old teach point reaches the adjusted pose',()=>{
  for(const invert of [true,false]){
    const c={offset:2048,invert,angleOffset:0.75};
    const teach=37.25;
    const adjustedPulse=toPulse(teach,c)+3210;   // operator jogs the joint to the parallel pose
    const adjusted=toAngle(adjustedPulse,c);
    const {angleOffset,delta}=M.offsetFor(c.angleOffset,teach,adjusted,invert);
    near(delta,teach-adjusted);
    near(toPulse(teach,{...c,angleOffset}),adjustedPulse);
  }
});

test('field board swap: joint_invert=false joint takes −Δ (values verified on the robot)',()=>{
  const invert=[true,true,false,true,true,true],offset=[1.4,0,0,0,0,0];
  const target=[12.86,24.87,99.88,-2.43,5.94,-45.71];
  const current=[-76.064599609375,419.3769836425781,108.74954223632813,130.67825317382813,211.54998779296875,12.814178466796875];
  const deployed=[90.3246,-394.506984,8.869542,-133.108253,-205.609988,-58.524178];
  const out=M.compute(invert.map((v,i)=>({invert:v,angleOffset:offset[i],target:target[i],current:current[i]})));
  out.forEach((r,i)=>near(r.angleOffset,deployed[i],1e-6));
});

test('compute maps rows and unchanged joints keep their offset',()=>{
  const out=M.compute([{invert:true,angleOffset:5,target:10,current:10},{invert:true,angleOffset:-2,target:90,current:89.5},{invert:false,angleOffset:5,target:10,current:9}]);
  assert.deepEqual(out,[{delta:0,angleOffset:5},{delta:0.5,angleOffset:-1.5},{delta:1,angleOffset:4}]);
});

test('parseList accepts common separators',()=>{
  assert.deepEqual(M.parseList(' 1, -2.5\t3；4，5\n6 '),[1,-2.5,3,4,5,6]);
  assert.ok(Number.isNaN(M.parseList('1,a')[1]));
});

test('parseInvert accepts true/false and 1/0, rejects anything else',()=>{
  assert.deepEqual(M.splitList('true, TRUE false，1 0').map(M.parseInvert),[true,true,false,true,false]);
  for(const v of ['','yes','-1','2']) assert.equal(M.parseInvert(v),null);
});
