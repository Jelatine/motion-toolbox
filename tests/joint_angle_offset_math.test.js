const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
/* The tool is a single HTML file; evaluate its pure-math script block as a CommonJS module. */
const M=(()=>{const html=fs.readFileSync(path.join(__dirname,'../tools/joint_angle_offset_calculator.html'),'utf8');const m={exports:{}};new Function('module',html.match(/<script id=offset-math>([\s\S]*?)<\/script>/)[1])(m);return m.exports;})();
const PPR=131072,N=101;
const toAngle=(pulse,c)=>(pulse-c.offset)/(PPR*N)*360*c.dir+c.angleOffset;
const toPulse=(angle,c)=>(angle-c.angleOffset)/360*(PPR*N)*c.dir+c.offset;
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-9,`${a} != ${b}`);

test('board swap: new angle_offset restores the pre-swap reading at the same pulse',()=>{
  for(const dir of [1,-1]){
    const oldBoard={offset:1000,dir,angleOffset:12.5},newBoard={offset:-523344,dir,angleOffset:-3};
    const before=toAngle(4567890,oldBoard);
    const pulseOnNewBoard=4567890+777777;        // encoder zero differs on the new board, joint did not move
    const current=toAngle(pulseOnNewBoard,newBoard);
    const {angleOffset}=M.offsetFor(newBoard.angleOffset,before,current);
    near(toAngle(pulseOnNewBoard,{...newBoard,angleOffset}),before);
  }
});

test('wall alignment: commanding the old teach point reaches the adjusted pose',()=>{
  for(const dir of [1,-1]){
    const c={offset:2048,dir,angleOffset:0.75};
    const teach=37.25;
    const adjustedPulse=toPulse(teach,c)+3210;   // operator jogs the joint to the parallel pose
    const adjusted=toAngle(adjustedPulse,c);
    const {angleOffset,delta}=M.offsetFor(c.angleOffset,teach,adjusted);
    near(delta,teach-adjusted);
    near(toPulse(teach,{...c,angleOffset}),adjustedPulse);
  }
});

test('compute maps rows and unchanged joints keep their offset',()=>{
  const out=M.compute([{angleOffset:5,target:10,current:10},{angleOffset:-2,target:90,current:89.5}]);
  assert.deepEqual(out,[{delta:0,angleOffset:5},{delta:0.5,angleOffset:-1.5}]);
});

test('parseList accepts common separators',()=>{
  assert.deepEqual(M.parseList(' 1, -2.5\t3；4，5\n6 '),[1,-2.5,3,4,5,6]);
  assert.ok(Number.isNaN(M.parseList('1,a')[1]));
});
