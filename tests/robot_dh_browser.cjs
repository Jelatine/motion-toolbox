// Usage: node tests/robot_dh_browser.cjs [path to an installed playwright module]
const {chromium}=require(process.argv[2]||'playwright');
const {pathToFileURL}=require('node:url');
const path=require('node:path');
const os=require('node:os');
const assert=require('node:assert/strict');
(async()=>{
  const browser=await chromium.launch({headless:true});
  try{
    const page=await browser.newPage({viewport:{width:1440,height:1100}}),errors=[];
    page.on('pageerror',e=>errors.push(e.message));
    await page.goto(pathToFileURL(path.resolve(__dirname,'../tools/robot_dh_modeler.html')).href);
    assert.equal(await page.locator('#convention').inputValue(),'MDH');
    assert.equal(await page.locator('#angle-unit').inputValue(),'deg');
    assert.equal(await page.locator('#length-unit').inputValue(),'mm');
    assert.equal(await page.locator('[data-key="d"]').first().inputValue(),'300');
    const initial=await page.evaluate(()=>model.end.slice());
    await page.selectOption('#length-unit','m');
    assert.equal(await page.locator('[data-key="d"]').first().inputValue(),'0.3');
    await page.selectOption('#angle-unit','rad');
    assert.deepEqual(await page.evaluate(()=>model.end),initial);
    await page.selectOption('#length-unit','mm');await page.selectOption('#angle-unit','deg');
    assert.deepEqual(await page.evaluate(()=>model.end),initial);
    const q=page.locator('[data-q="number"][data-index="2"]');
    await q.fill('150');await q.press('Tab');
    assert.equal(await page.evaluate(()=>rows[2].q),0.15);
    assert.notDeepEqual(await page.evaluate(()=>model.end),initial);
    await q.fill('301');await q.press('Tab');
    assert.equal(await page.evaluate(()=>rows[2].q),0.15);
    assert.match(await page.locator('#error').innerText(),/范围/);
    const minimum=page.locator('[data-key="min"]').first();await minimum.fill('200');await minimum.press('Tab');
    assert.equal(await minimum.inputValue(),'-180');
    await page.click('#add');assert.equal(await page.locator('#parameter-body tr').count(),5);
    await page.locator('[data-delete="4"]').click();assert.equal(await page.locator('#parameter-body tr').count(),4);
    await page.selectOption('[data-key="type"][data-index="0"]','P');
    assert.equal(await page.evaluate(()=>rows[0].type),'P');assert.equal(await page.evaluate(()=>rows[0].q),0);
    await page.click('#example');await page.click('#zero');assert.ok(await page.evaluate(()=>rows.every(r=>r.q===0)));
    await page.click('#play');await page.waitForTimeout(200);await page.click('#play');
    assert.ok(await page.evaluate(()=>rows.some(r=>r.q!==0)));assert.ok(await page.evaluate(()=>rows.every(r=>r.q>=r.min&&r.q<=r.max)));
    const paused=await page.evaluate(()=>rows.map(r=>r.q));await page.waitForTimeout(100);assert.deepEqual(await page.evaluate(()=>rows.map(r=>r.q)),paused);
    const mdh=await page.evaluate(()=>model.end.slice());await page.selectOption('#convention','SDH');assert.notDeepEqual(await page.evaluate(()=>model.end),mdh);
    await page.selectOption('#convention','MDH');await page.click('#example');
    const scene=page.locator('#scene'),box=await scene.boundingBox(),before=await scene.evaluate(c=>c.toDataURL());
    await page.mouse.move(box.x+200,box.y+200);await page.mouse.down();await page.mouse.move(box.x+260,box.y+240);await page.mouse.up();
    assert.notEqual(await scene.evaluate(c=>c.toDataURL()),before);
    await page.mouse.wheel(0,150);await page.click('#fit');await page.click('#home-view');
    // Screen basis (right, up, toward viewer) must form a right-handed frame, otherwise rotations look mirrored.
    for(const view of [[0.75,0.48],[2.6,-0.3],[-1.2,1.2]]){
      const det=await page.evaluate(([yaw,pitch])=>{camera.yaw=yaw;camera.pitch=pitch;const o=project([0,0,0]);
        const [x,y,z]=[[1,0,0],[0,1,0],[0,0,1]].map(e=>{const p=project(e);return [(p[0]-o[0])/camera.scale,(o[1]-p[1])/camera.scale,p[2]-o[2]];});
        return x[0]*(y[1]*z[2]-y[2]*z[1])-x[1]*(y[0]*z[2]-y[2]*z[0])+x[2]*(y[0]*z[1]-y[1]*z[0]);},view);
      assert.ok(Math.abs(det-1)<1e-9,`view ${view} is not right-handed: det=${det}`);
    }
    // Looking down +Z, a positive J1 rotation must turn the arm counter-clockwise on screen.
    const ccw=await page.evaluate(()=>{camera.yaw=0.75;camera.pitch=1.5;const angleOf=()=>{const o=project(M.origin(model.joints[0])),p=project(M.origin(model.joints[1]));return Math.atan2(o[1]-p[1],p[0]-o[0]);};
      const r=rows[0],q0=r.q,a=angleOf();r.q=q0+0.2;update();const b=angleOf();r.q=q0;update();return Math.atan2(Math.sin(b-a),Math.cos(b-a));});
    assert.ok(ccw>0.15&&ccw<0.25,`J1 +0.2 rad turned ${ccw} rad on screen`);
    await page.click('#home-view');
    await page.screenshot({path:path.join(os.tmpdir(),'motion_toolbox_robot_dh_desktop.png'),fullPage:true});
    await page.setViewportSize({width:390,height:844});await page.click('#fit');
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
    await page.screenshot({path:path.join(os.tmpdir(),'motion_toolbox_robot_dh_mobile.png'),fullPage:true});
    await page.goto(pathToFileURL(path.resolve(__dirname,'../index.html')).href);await page.fill('#search','MDH');
    assert.equal(await page.locator('.tool-card').count(),1);assert.equal(await page.locator('.tool-card').getAttribute('href'),'tools/robot_dh_modeler.html');
    assert.deepEqual(errors,[]);console.log('Browser checks passed: defaults, units, motion, limits, conventions, camera, responsive layout, navigation.');
  }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
