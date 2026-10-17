/* Original low-poly horse models; no stock imagery or paid assets. */
(() => {
  const mount = document.querySelector('#racetrack');
  const motion = document.querySelector('#motion-toggle');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  let paused = reduced, visible = true;
  const fallback = () => {
    mount.innerHTML = `<svg viewBox="0 0 800 500" role="img" aria-label="Illustrated oval racing track"><defs><linearGradient id="track-shade" x2="0" y2="1"><stop stop-color="#6283c9"/><stop offset="1" stop-color="#1F4FD8"/></linearGradient></defs><ellipse cx="400" cy="310" rx="340" ry="160" fill="#071329"/><ellipse cx="400" cy="275" rx="340" ry="155" fill="url(#track-shade)"/><ellipse cx="400" cy="275" rx="245" ry="98" fill="#0a1f44"/><ellipse cx="400" cy="275" rx="291" ry="125" fill="none" stroke="#fff" stroke-opacity=".55" stroke-dasharray="8 12"/><path d="M400 373V430" stroke="#fff" stroke-width="14"/><path d="M400 373V430" stroke="#0a1f44" stroke-width="7" stroke-dasharray="7 7"/><text x="210" y="320" font-size="85">🏇</text><text x="420" y="185" font-size="70">🏇</text><text x="550" y="350" font-size="90">🏇</text></svg>`;
    motion.hidden = true;
  };
  if (!window.THREE) { fallback(); return; }
  try {
    const T = THREE;
    const scene = new T.Scene();
    const camera = new T.PerspectiveCamera(35,1,.1,150);
    const renderer = new T.WebGLRenderer({antialias:true,alpha:true});
    renderer.setPixelRatio(Math.min(devicePixelRatio,2));
    renderer.shadowMap.enabled = true; renderer.shadowMap.type = T.PCFSoftShadowMap;
    renderer.outputColorSpace = T.SRGBColorSpace;
    renderer.setClearColor(0,0); mount.appendChild(renderer.domElement);
    const ambient = new T.HemisphereLight(0xe5edff,0x172541,2.2); scene.add(ambient);
    const key = new T.DirectionalLight(0xffffff,3.8); key.position.set(-8,16,10); key.castShadow = true;
    key.shadow.mapSize.set(2048,2048); key.shadow.camera.left=-15;key.shadow.camera.right=15;key.shadow.camera.top=12;key.shadow.camera.bottom=-12;
    key.shadow.normalBias=.035; scene.add(key);
    const rim=new T.DirectionalLight(0x779fff,2.2);rim.position.set(7,6,-10);scene.add(rim);
    const world = new T.Group();scene.add(world);
    const material = (color,roughness=.85) => new T.MeshStandardMaterial({color,roughness});
    const mats={navy:material(0x0a1f44),edge:material(0x0c234a),blue:material(0x1f4fd8),lane:material(0x50668d),white:material(0xf1f4ff),gray:material(0x97a5be),orange:material(0xc65a00),dark:material(0x35445f)};
    function box(w,h,d,mat,x=0,y=0,z=0,parent=world){const o=new T.Mesh(new T.BoxGeometry(w,h,d),mat);o.position.set(x,y,z);o.castShadow=true;o.receiveShadow=true;parent.add(o);return o;}
    function ball(xr,yr,zr,mat,x,y,z,parent){const o=new T.Mesh(new T.SphereGeometry(1,10,8),mat);o.scale.set(xr,yr,zr);o.position.set(x,y,z);o.castShadow=true;parent.add(o);return o;}
    function ellipse(a,b,depth,mat,y){const s=new T.Shape();s.absellipse(0,0,a,b,0,Math.PI*2,false);const m=new T.Mesh(new T.ExtrudeGeometry(s,{depth,bevelEnabled:true,bevelSegments:2,steps:1,bevelSize:.1,bevelThickness:.07,curveSegments:96}),mat);m.rotation.x=-Math.PI/2;m.position.y=y;m.castShadow=true;m.receiveShadow=true;world.add(m);return m;}
    ellipse(9.2,5.5,.55,mats.edge,-.65);ellipse(8.95,5.22,.12,mats.white,-.08);ellipse(8.65,4.95,.13,mats.lane,.06);ellipse(5.85,2.14,.07,mats.navy,.20);
    function ovalLine(a,b,y,color,opacity=1){const pts=[];for(let i=0;i<=160;i++){const t=i/160*Math.PI*2;pts.push(new T.Vector3(a*Math.cos(t),y,b*Math.sin(t)));}const line=new T.Line(new T.BufferGeometry().setFromPoints(pts),new T.LineBasicMaterial({color,transparent:true,opacity}));world.add(line);}
    [0,1,2,3,4].forEach(i=>ovalLine(5.95+i*.65,2.22+i*.65,.23,0xdce6ff,i===0||i===4?.8:.35));
    // Raised inner and outer rails, with small physical fence posts.
    for(let i=0;i<80;i++){const t=i/80*Math.PI*2;[0,1].forEach(k=>{const a=k?8.85:5.82,b=k?5.12:2.12;box(.045,.32,.045,mats.white,a*Math.cos(t),.37,b*Math.sin(t));});}
    ovalLine(8.85,5.12,.55,0xffffff,.8);ovalLine(5.82,2.12,.55,0xffffff,.8);
    // Infield sculpture.
    for(let i=-3;i<=3;i++){const strip=box(8.2,.018,.18,mats.blue,0,.31,i*.42);strip.material = new T.MeshStandardMaterial({color:0x193d78,roughness:1});}
    const finishAngle=.78;const fx=Math.cos(finishAngle),fz=Math.sin(finishAngle);
    // Miniature grandstand outside the outer rail, facing the track at the finish line as on a real homestretch.
    // Local z points outward along the track's normal; seating rows rise away from the rail.
    const stand=new T.Group();const nx=fx/9.2,nz=fz/5.5,nl=Math.hypot(nx,nz);
    stand.position.set(9.2*fx+nx/nl*1.05,0,5.5*fz+nz/nl*1.05);stand.rotation.y=Math.atan2(nx,nz);world.add(stand);
    box(4.1,.9,1.9,mats.edge,0,-.2,.1,stand);
    box(3.4,.35,1.15,mats.edge,0,.43,0,stand);for(let r=0;r<3;r++){box(3.2,.18,.35,r===2?mats.white:mats.gray,0,.6+r*.18,-.15+r*.24,stand);for(let c=0;c<12;c++)box(.17,.18,.18,c%4===0?mats.orange:mats.blue,-1.45+c*.26,.74+r*.18,-.15+r*.24,stand);}
    const roof=box(3.8,.12,1.75,mats.white,0,1.7,.02,stand);roof.rotation.z=.04;
    [-1.5,1.5].forEach(x=>box(.07,1.1,.07,mats.gray,x,1.13,-.55,stand));
    // Finish gantry and checker stripe.
    const gantry=new T.Group();gantry.position.set((5.82+8.85)/2*fx,0,(2.12+5.12)/2*fz);
    // Local z spans the vector from the inner rail to the outer rail.
    gantry.rotation.y=Math.atan2((8.85-5.82)*fx,(5.12-2.12)*fz);world.add(gantry);
    [-1.65,1.65].forEach(z=>box(.10,1.8,.10,mats.white,0,1.1,z,gantry));box(.15,.32,3.45,mats.orange,0,2.0,0,gantry);
    for(let i=0;i<13;i++)for(let j=0;j<2;j++)box(.17,.014,.24,(i+j)%2?mats.navy:mats.white,-.15+j*.17,.285,-1.55+i*.245,gantry);
    // Low-poly cypress-like trees with green foliage.
    const trunk=material(0x6b4a2b),leaves=material(0x2f8a3e);
    [[-4.4,1],[4.3,-.8],[3.3,-1.15],[-4.8,-.6]].forEach(([x,z])=>{box(.1,.6,.1,trunk,x,.52,z);const tree=new T.Mesh(new T.ConeGeometry(.38,1.1,5),leaves);tree.position.set(x,1.18,z);tree.castShadow=true;world.add(tree);});
    const canvas=document.createElement('canvas');canvas.width=1024;canvas.height=256;const ctx=canvas.getContext('2d');ctx.fillStyle='#0a1f44';ctx.fillRect(0,0,1024,256);ctx.fillStyle='#819bd2';ctx.font='bold 100px Arial';ctx.textAlign='center';ctx.fillText('ODDS  /  REALITY',512,160);const tex=new T.CanvasTexture(canvas);tex.colorSpace=T.SRGBColorSpace;
    const lettering=new T.Mesh(new T.PlaneGeometry(6.3,1.57),new T.MeshBasicMaterial({map:tex}));lettering.rotation.x=-Math.PI/2;lettering.position.set(.6,.33,0);world.add(lettering);
    const ARM_REST=.96,ARM_RAISED=2.84,CELEBRATE=.9;
    // 0 at rest, 1 with arms raised: snaps up on crossing the finish, eases down over the next stretch of track.
    function celebration(t){const since=((t-finishAngle)%(Math.PI*2)+Math.PI*2)%(Math.PI*2);return since<CELEBRATE?Math.min(1,since/.08,(CELEBRATE-since)/.2):0;}
    function horse(color,cloth,number){
      const h=new T.Group(),skin=material(color),saddle=material(cloth),mane=material(0x17243b);
      ball(1.05,.48,.4,skin,0,1.15,0,h);ball(.45,.4,.38,skin,-.65,1.14,0,h);
      const neck=ball(.34,.68,.28,skin,.80,1.63,0,h);neck.rotation.z=-.55;
      ball(.49,.24,.25,skin,1.23,2.04,0,h);ball(.3,.2,.23,skin,1.55,1.97,0,h);
      const ear1=new T.Mesh(new T.ConeGeometry(.09,.30,4),skin);ear1.position.set(1.04,2.35,.16);h.add(ear1);const ear2=ear1.clone();ear2.position.z=-.16;h.add(ear2);
      ball(.035,.035,.025,mats.navy,1.39,2.12,.23,h);ball(.035,.035,.025,mats.navy,1.39,2.12,-.23,h);
      for(let n=0;n<5;n++)ball(.1,.18,.27,mane,.57+n*.075,1.7+n*.12,0,h);
      const tail=new T.Group();tail.position.set(-.98,1.35,0);const hair=ball(.17,.6,.16,mane,-.26,-.1,0,tail);hair.rotation.z=-1.05;h.add(tail);
      const limbs=[];[[-.65,.26],[-.65,-.26],[.65,.26],[.65,-.26]].forEach(([x,z],i)=>{const root=new T.Group();root.position.set(x,1.08,z);h.add(root);box(.16,.62,.17,skin,0,-.28,0,root);const knee=new T.Group();knee.position.y=-.57;root.add(knee);box(.11,.55,.13,skin,0,-.24,0,knee);box(.2,.12,.21,mane,.04,-.54,0,knee);limbs.push({root,knee,phase:i%2*Math.PI+(i<2?1.3:0)});});
      box(.82,.18,.87,saddle,-.08,1.57,0,h);
      // The jockey crouches forward: boots, bent torso, arms, helmet.
      [-.43,.43].forEach(z=>{const leg=box(.14,.58,.14,mats.navy,.08,1.38,z,h);leg.rotation.z=.45;box(.32,.12,.17,mats.navy,.21,1.09,z,h);});
      const torso=ball(.26,.39,.25,saddle,.12,1.99,0,h);torso.rotation.z=-.9;
      ball(.24,.25,.23,mats.white,.48,2.30,0,h);ball(.27,.17,.27,saddle,.48,2.47,0,h);
      // Arms pivot at the shoulder so they can swing from the reins up into a celebration.
      const arms=[-.24,.24].map(z=>{const shoulder=new T.Group();shoulder.position.set(.42,2.1,z);h.add(shoulder);box(.10,.60,.10,saddle,0,-.3,0,shoulder);shoulder.rotation.z=ARM_REST;return {shoulder,side:Math.sign(z)};});
      h.userData={limbs,tail,arms,torso};h.scale.setScalar(.45);return h;
    }
    const horses=[];[0xd5ddeb,0x5f6d86,0xa9b6cc,0x243954,0x9a5a34,0x4a3222].forEach((color,i)=>{const h=horse(color,[0x1f4fd8,0xc65a00,0xc8283c,0xe0b020,0x7b3fc4,0xe05a9c][i],i+1);world.add(h);horses.push(h);});
    let yaw=-.28,drag=false,lastX=0,time=0,last=0;
    function cameraUpdate(){camera.position.set(13*Math.sin(yaw),13.5,20*Math.cos(yaw));camera.lookAt(0,.2,0);}
    cameraUpdate();
    mount.addEventListener('pointerdown',e=>{drag=true;lastX=e.clientX;mount.setPointerCapture(e.pointerId);});
    mount.addEventListener('pointermove',e=>{if(drag){yaw+=(lastX-e.clientX)*.004;lastX=e.clientX;cameraUpdate();}});
    mount.addEventListener('pointerup',()=>drag=false);mount.addEventListener('pointercancel',()=>drag=false);
    function updateMotion(){motion.textContent=paused?'Resume motion':'Pause motion';motion.setAttribute('aria-pressed',String(paused));}
    updateMotion();motion.addEventListener('click',()=>{paused=!paused;updateMotion();});
    new IntersectionObserver(([entry])=>visible=entry.isIntersecting).observe(mount);
    function resize(){const w=mount.clientWidth,h=mount.clientHeight;renderer.setSize(w,h);camera.aspect=w/h;camera.updateProjectionMatrix();}new ResizeObserver(resize).observe(mount);resize();
    function frame(now){requestAnimationFrame(frame);const dt=Math.min((now-last)/1000,.05);last=now;if(!visible||document.hidden)return;if(!paused)time+=dt;
      horses.forEach((h,i)=>{const t=time*(.18+i*.008)+i*1.05;const a=6.2+i*.47,b=2.47+i*.47;h.position.set(a*Math.cos(t),.27+Math.sin(time*12+i)*.045,b*Math.sin(t));h.rotation.y=Math.atan2(-b*Math.cos(t),-a*Math.sin(t));h.rotation.z=Math.sin(time*12+i)*.025;
        h.userData.limbs.forEach(({root,knee,phase})=>{root.rotation.z=Math.sin(time*12+phase+i)*.75;knee.rotation.z=Math.max(0,Math.sin(time*12+phase+i+1))*.9;});h.userData.tail.rotation.x=Math.sin(time*10+i)*.18;
        const joy=celebration(t);h.userData.torso.rotation.z=-.9+.45*joy;
        h.userData.arms.forEach(({shoulder,side})=>{shoulder.rotation.z=ARM_REST+(ARM_RAISED-ARM_REST)*joy+joy*Math.sin(time*9+i+side)*.18;shoulder.rotation.x=side*.35*joy;});});
      renderer.render(scene,camera);
    }requestAnimationFrame(frame);
    mount.addEventListener('webglcontextlost',e=>{e.preventDefault();fallback();},{once:true});
  }catch(error){fallback();}
})();
