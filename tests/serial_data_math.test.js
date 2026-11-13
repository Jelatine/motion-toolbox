const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
/* The tool is a single HTML file; evaluate its pure-math script block as a CommonJS module. */
const M=(()=>{const html=fs.readFileSync(path.join(__dirname,'../tools/serial_data_tool.html'),'utf8');const m={exports:{}};new Function('module',html.match(/<script id=serial-math>([\s\S]*?)<\/script>/)[1])(m);return m.exports;})();
const hex=s=>M.parseHex(s);
const ascii=s=>Array.from(Buffer.from(s));

test('parseHex accepts common notations and rejects junk',()=>{
  assert.deepEqual(hex('01 02 03'),[1,2,3]);
  assert.deepEqual(hex('010203'),[1,2,3]);
  assert.deepEqual(hex('0x01,0x02, 0XFF'),[1,2,255]);
  assert.deepEqual(hex('1 a\nB'),[1,10,11]);
  assert.throws(()=>hex('012'),/奇数/);
  assert.throws(()=>hex('01 zz'),/非法/);
});

test('parseAscii handles UTF-8 and escapes',()=>{
  assert.deepEqual(M.parseAscii('AT\\r\\n'),[65,84,13,10]);
  assert.deepEqual(M.parseAscii('\\x02a\\\\'),[2,97,92]);
  assert.deepEqual(M.parseAscii('中'),[0xE4,0xB8,0xAD]);
});

test('formatHex styles',()=>{
  assert.equal(M.formatHex([1,0xab]),'01 AB');
  assert.equal(M.formatHex([1,0xab],'compact'),'01AB');
  assert.equal(M.formatHex([1,0xab],'c'),'0x01, 0xAB');
});

test('every CRC in the catalog matches its reveng check value for "123456789"',()=>{
  const crcs=M.ALGORITHMS.filter(a=>a.params);
  assert.ok(crcs.length>=10);
  for(const a of crcs) assert.equal(a.calc(ascii('123456789')),a.check,a.name);
});

test('simple checksums',()=>{
  const by=id=>M.ALGORITHMS.find(a=>a.id===id);
  const d=[0x01,0x03,0x00,0x00,0x00,0x0A];
  assert.equal(by('sum8').calc(d),0x0E);
  assert.equal(by('lrc').calc(d),0xF2);            // Modbus ASCII ":01030000000AF2"
  assert.equal(by('sum8not').calc(d),0xF1);
  assert.equal(by('xor').calc(d),0x08);
  assert.equal(by('sum16').calc(new Array(300).fill(0xFF)),(300*255)&0xFFFF);
});

test('valueBytes byte order',()=>{
  assert.deepEqual(M.valueBytes(0xCDC5,16,true),[0xC5,0xCD]);
  assert.deepEqual(M.valueBytes(0xCBF43926,32,false),[0xCB,0xF4,0x39,0x26]);
  assert.deepEqual(M.valueBytes(0xCBF43926,32,true),[0x26,0x39,0xF4,0xCB]);
});

test('Modbus read holding registers: 01 03 00 00 00 0A C5 CD',()=>{
  const r=M.buildModbus({slave:'1',fc:3,start:'0',qty:'10'});
  assert.equal(M.formatHex(r.bytes),'01 03 00 00 00 0A C5 CD');
  assert.equal(r.responseLength,25);
});

test('Modbus write single register / coil',()=>{
  assert.equal(M.formatHex(M.buildModbus({slave:1,fc:6,start:'1',value:'3'}).bytes),'01 06 00 01 00 03 98 0B');
  assert.equal(M.formatHex(M.buildModbus({slave:1,fc:6,start:'1',value:'-1',valueType:'i16'}).bytes).slice(0,17),'01 06 00 01 FF FF');
  assert.equal(M.formatHex(M.buildModbus({slave:1,fc:5,start:'0x00AC',coil:'1'}).bytes).slice(0,17),'01 05 00 AC FF 00');
});

test('Modbus write multiple coils packs LSB first (spec example)',()=>{
  const r=M.buildModbus({slave:'0x11',fc:15,start:'19',values:'1 0 1 1 0 0 1 1 1 0'});
  assert.equal(M.formatHex(r.bytes.slice(0,-2)),'11 0F 00 13 00 0A 02 CD 01');
  const c=M.crc16modbus(r.bytes.slice(0,-2));
  assert.deepEqual(r.bytes.slice(-2),[c&0xFF,c>>8]);
});

test('Modbus write multiple registers with 32-bit types and word order',()=>{
  assert.equal(M.formatHex(M.buildModbus({slave:1,fc:16,start:'1',values:'0x000A, 258'}).bytes.slice(0,-2)),'01 10 00 01 00 02 04 00 0A 01 02');
  assert.deepEqual(M.encodeValue('1.5','f32'),[0x3FC0,0x0000]);
  assert.deepEqual(M.encodeValue('1.5','f32','cdab'),[0x0000,0x3FC0]);
  assert.deepEqual(M.encodeValue('-2','i32'),[0xFFFF,0xFFFE]);
  assert.deepEqual(M.encodeValue('0x12345678','u32','cdab'),[0x5678,0x1234]);
  assert.throws(()=>M.encodeValue('70000','u16'));
  assert.throws(()=>M.encodeValue('1.5','i32'));
});

test('Modbus builder validates ranges',()=>{
  assert.throws(()=>M.buildModbus({slave:'248',fc:3,start:'0',qty:'1'}),/从站地址/);
  assert.throws(()=>M.buildModbus({slave:'1',fc:3,start:'0',qty:'126'}),/数量/);
  assert.throws(()=>M.buildModbus({slave:'1',fc:3,start:'65535',qty:'2'}),/超出/);
  assert.throws(()=>M.buildModbus({slave:'1',fc:15,start:'0',values:'1 2'}),/0 或 1/);
});

test('parseModbus round-trips requests and decodes responses',()=>{
  const req=M.parseModbus(hex('01 03 00 00 00 0A C5 CD'));
  assert.equal(req.kind,'request');assert.ok(req.crcOk);
  const resp=M.parseModbus(M.withCrc(hex('01 03 04 00 0A 01 02')));
  assert.equal(resp.kind,'response');assert.ok(resp.crcOk);assert.deepEqual(resp.registers,[10,258]);
  const ex=M.parseModbus(M.withCrc(hex('01 83 02')));
  assert.equal(ex.kind,'exception');assert.match(ex.fields[1][1],/非法数据地址/);
  const bad=M.parseModbus(hex('01 03 00 00 00 0A C5 CE'));
  assert.equal(bad.crcOk,false);assert.equal(bad.crcCalc,0xCDC5);
  const wc=M.buildModbus({slave:'0x11',fc:15,start:'19',values:'1 0 1 1 0 0 1 1 1 0'});
  const p=M.parseModbus(wc.bytes);
  assert.equal(p.kind,'request');assert.deepEqual(p.coils,[1,0,1,1,0,0,1,1,1,0]);
  const wr=M.parseModbus(M.withCrc(hex('01 10 00 01 00 02')));
  assert.equal(wr.kind,'response');
});
