/* All displayed statistics, filters, source rows and exports share this snapshot. */
(() => {
'use strict';
const D=window.RACING_DATA,$=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)];
if(!D||!window.d3){document.body.insertAdjacentHTML('afterbegin','<p>The dashboard data could not load. Please reload the page.</p>');return;}
const BLUE='#1F4FD8',NAVY='#0A1F44',ORANGE='#C65A00',GRAY='#6B7280';
const rows=D.rows.map(r=>Object.fromEntries(D.columns.map((c,i)=>[c,r[i]])));
const fmt=d3.format(','),pct=v=>d3.format('.1%')(v),pp=v=>(v>=0?'+':'')+(v*100).toFixed(1)+' pts';
const cash=v=>(v<0?'−':'')+'$'+Math.abs(v).toFixed(2),esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let selectedBand='3–5',mode='curve',filtered=rows,stats=[],chosenHorse=3,progress=0,playing=false,replayTimer;
function wilson(w,n){if(!n)return[0,0];const z=1.96,p=w/n,den=1+z*z/n,c=(p+z*z/(2*n))/den,h=z*Math.sqrt(p*(1-p)/n+z*z/(4*n*n))/den;return[c-h,c+h];}
function summarize(rs,band){const n=rs.length,w=d3.sum(rs,r=>r.won),expected=d3.mean(rs,r=>r.fair_implied)||0,payout=d3.sum(rs,r=>r.odds*r.won),actual=n?w/n:0,ci=wilson(w,n);return{band,n,w,expected,actual,payout,roi:n?payout/n-1:0,gap:actual-expected,lo:ci[0],hi:ci[1]};}
function grouped(rs){return D.bands.map(b=>summarize(rs.filter(r=>r.band===b),b));}
function tip(event,title,items){const t=$('#tooltip');t.innerHTML='<b>'+esc(title)+'</b>'+items.map(([k,v])=>'<div><span>'+esc(k)+'</span><span>'+esc(v)+'</span></div>').join('');t.style.opacity=1;const rect=event.currentTarget.getBoundingClientRect(),x=event.clientX||rect.x,y=event.clientY||rect.y;t.style.left=Math.max(8,Math.min(x+16,innerWidth-275))+'px';t.style.top=Math.max(8,Math.min(y+14,innerHeight-t.offsetHeight-12))+'px';}
function hideTip(){$('#tooltip').style.opacity=0;}
function activate(sel,fn){sel.on('click',(e,d)=>fn(d)).on('keydown',(e,d)=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();fn(d);}});}
function svgFor(id,height,margin){const el=$(id),width=Math.max(250,el.clientWidth);d3.select(el).selectAll('*').remove();const svg=d3.select(el).append('svg').attr('viewBox',`0 0 ${width} ${height}`).attr('role','img');return{svg,g:svg.append('g').attr('transform',`translate(${margin.left},${margin.top})`),width,height,w:width-margin.left-margin.right,h:height-margin.top-margin.bottom};}
function drawCalibration(){
 const {svg,g,w,h}=svgFor('#calibration',365,{left:48,right:25,top:24,bottom:50});
 svg.attr('aria-label',mode==='curve'?'Observed horse win rates compared with market probabilities. Dashed line shows perfect agreement.':'Win rate minus market probability for each odds band.');
 const visible=stats.filter(d=>d.n),max=Math.max(.15,d3.max(visible,d=>Math.max(d.hi,d.expected))||.5)*1.12;
 if(mode==='curve'){
  const x=d3.scaleLinear().domain([0,max]).range([0,w]),y=d3.scaleLinear().domain([0,max]).range([h,0]);
  g.append('g').attr('class','grid').call(d3.axisLeft(y).ticks(5).tickSize(-w).tickFormat(''));
  g.append('path').attr('d',`M0,${h}L${w},0`).attr('stroke',GRAY).attr('stroke-dasharray','5 5').attr('fill','none');
  g.append('text').attr('x',w*.62).attr('y',h*.25).attr('fill',GRAY).style('font-size','9px').text('Perfect agreement');
  g.append('g').attr('class','axis').attr('transform',`translate(0,${h})`).call(d3.axisBottom(x).ticks(5).tickFormat(d3.format('.0%')));
  g.append('g').attr('class','axis').call(d3.axisLeft(y).ticks(5).tickFormat(d3.format('.0%')));
  g.append('text').attr('class','axis-label').attr('x',w/2).attr('y',h+40).attr('text-anchor','middle').text('CHANCE THE MARKET GAVE EACH HORSE');
  g.append('text').attr('class','axis-label').attr('transform','rotate(-90)').attr('x',-h/2).attr('y',-35).attr('text-anchor','middle').text('HOW OFTEN THEY ACTUALLY WON');
  const line=d3.line().x(d=>x(d.expected)).y(d=>y(d.actual));g.append('path').datum([...visible].sort((a,b)=>a.expected-b.expected)).attr('d',line).attr('stroke',BLUE).attr('stroke-opacity',.25).attr('stroke-width',2).attr('fill','none');
  visible.forEach(d=>{const cx=x(d.expected);g.append('line').attr('x1',cx).attr('x2',cx).attr('y1',y(d.lo)).attr('y2',y(d.hi)).attr('stroke',BLUE);[d.lo,d.hi].forEach(v=>g.append('line').attr('x1',cx-4).attr('x2',cx+4).attr('y1',y(v)).attr('y2',y(v)).attr('stroke',BLUE));});
  const dots=g.selectAll('.band-dot').data(visible).join('circle').attr('class','band-dot').attr('cx',d=>x(d.expected)).attr('cy',d=>y(d.actual)).attr('r',d=>5+Math.sqrt(d.n/d3.max(visible,v=>v.n))*8).attr('fill',d=>d.band===selectedBand?BLUE:'#b5c6f8').attr('stroke',d=>d.band===selectedBand?NAVY:'#fff').attr('stroke-width',d=>d.band===selectedBand?2:1.5).attr('tabindex',0).attr('role','button').attr('aria-label',d=>`${d.band} odds: ${pct(d.actual)} won, ${pct(d.expected)} expected. Inspect this band.`).style('cursor','pointer');
  activate(dots,d=>selectBand(d.band));dots.on('pointermove',(e,d)=>tip(e,d.band+' decimal odds',[['Horse starts',fmt(d.n)],['Expected',pct(d.expected)],['Actually won',pct(d.actual)],['Difference',pp(d.gap)]])).on('pointerleave',hideTip).on('focus',(e,d)=>tip(e,d.band+' decimal odds',[['Expected',pct(d.expected)],['Actually won',pct(d.actual)]])).on('blur',hideTip);
 }else{
  const x=d3.scaleBand().domain(D.bands).range([0,w]).padding(.35),limit=Math.max(.025,d3.max(visible,d=>Math.abs(d.gap))*1.3),y=d3.scaleLinear().domain([-limit,limit]).range([h,0]);
  g.append('g').attr('class','grid').call(d3.axisLeft(y).ticks(5).tickSize(-w).tickFormat(''));g.append('line').attr('x2',w).attr('y1',y(0)).attr('y2',y(0)).attr('stroke',NAVY);
  g.append('g').attr('class','axis').call(d3.axisLeft(y).ticks(5).tickFormat(v=>(v*100).toFixed(0)+' pts'));g.append('g').attr('class','axis').attr('transform',`translate(0,${h})`).call(d3.axisBottom(x));
  g.append('text').attr('class','axis-label').attr('x',w/2).attr('y',h+40).attr('text-anchor','middle').text('DECIMAL ODDS BANDS · LOWER TO HIGHER ODDS');
  const bars=g.selectAll('rect').data(visible).join('rect').attr('x',d=>x(d.band)).attr('y',d=>y(Math.max(0,d.gap))).attr('width',x.bandwidth()).attr('height',d=>Math.max(2,Math.abs(y(d.gap)-y(0)))).attr('rx',3).attr('fill',d=>d.gap>=0?BLUE:ORANGE).attr('opacity',d=>d.band===selectedBand?1:.55).attr('tabindex',0).attr('role','button').attr('aria-label',d=>`${d.band} odds: ${pp(d.gap)}. Inspect this band.`).style('cursor','pointer');activate(bars,d=>selectBand(d.band));bars.on('pointermove',(e,d)=>tip(e,d.band+' odds',[['Difference',pp(d.gap)],['Horse starts',fmt(d.n)]])).on('pointerleave',hideTip);
 }
}
function selectBand(b){selectedBand=b;drawCalibration();drawDetail();drawReturns();hideTip();}
function drawDetail(){
 const d=stats.find(d=>d.band===selectedBand);$('#band-buttons').innerHTML=D.bands.map(b=>`<button data-band="${b}" class="${b===selectedBand?'on':''}" aria-pressed="${b===selectedBand}">${b}</button>`).join('');$$('#band-buttons button').forEach(b=>b.addEventListener('click',()=>selectBand(b.dataset.band)));
 $('#band-title').textContent=(d.band==='40+'?'40+':d.band)+' DECIMAL ODDS';$('#band-kind').textContent=d.band==='40+'?'The longest shots: least likely to win.':D.bands.indexOf(d.band)<3?'Shorter odds: the market’s more likely winners.':'Higher odds: a lower chance and a bigger potential payout.';
 $('#detail-expected').textContent=pct(d.expected);$('#detail-actual').textContent=pct(d.actual);const scale=Math.max(d.expected,d.actual,.001)*1.25;$('#actual-fill').style.width=(d.actual/scale*100)+'%';$('#expected-tick').style.left=(d.expected/scale*100)+'%';
 $('#detail-gap').textContent=pp(d.gap)+' '+(d.gap>=0?'above':'below')+' market expectation';
 $('#detail-rows').innerHTML=[['Horse starts',fmt(d.n)],['Wins',fmt(d.w)],['95% range for win rate',pct(d.lo)+'–'+pct(d.hi)],['Net return per $100 bet',cash(d.roi*100)]].map(([k,v])=>`<div><span>${k}</span><b>${v}</b></div>`).join('');
 $('#detail-verdict').textContent=d.n===0?'No horse starts in this selection.':d.expected>=d.lo&&d.expected<=d.hi?'The market’s expectation sits inside the win-rate uncertainty range. This sample does not clearly separate the two.':'The market’s expectation sits outside the win-rate uncertainty range. This is a historical difference to investigate, not proof of a future advantage.';
}
function drawReturns(){
 const {svg,g,w,h}=svgFor('#returns',320,{left:49,right:64,top:20,bottom:35});svg.attr('aria-label','Net historical return per 100 dollars staked, by odds band.');
 const x=d3.scaleLinear().domain([Math.min(-10,d3.min(stats,d=>d.roi*100))*1.14,Math.max(10,d3.max(stats,d=>d.roi*100))*1.16]).range([0,w]);const y=d3.scaleBand().domain(D.bands).range([0,h]).padding(.39);
 g.append('g').attr('class','grid').attr('transform',`translate(0,${h})`).call(d3.axisBottom(x).ticks(4).tickSize(-h).tickFormat(''));g.append('line').attr('x1',x(0)).attr('x2',x(0)).attr('y2',h).attr('stroke',NAVY);
 g.append('g').attr('class','axis').call(d3.axisLeft(y).tickSize(0));g.append('g').attr('class','axis').attr('transform',`translate(0,${h})`).call(d3.axisBottom(x).ticks(4).tickFormat(v=>(v<0?'−':'')+'$'+Math.abs(v)));
 const bars=g.selectAll('.roi').data(stats.filter(d=>d.n)).join('rect').attr('x',d=>x(Math.min(0,d.roi*100))).attr('y',d=>y(d.band)).attr('width',d=>Math.abs(x(d.roi*100)-x(0))).attr('height',y.bandwidth()).attr('rx',3).attr('fill',d=>d.roi>=0?BLUE:ORANGE).attr('opacity',d=>d.band===selectedBand?1:.7).attr('tabindex',0).attr('role','button').attr('aria-label',d=>`${d.band} odds: ${cash(d.roi*100)} net per $100. ${fmt(d.n)} horse starts. Select this band.`).style('cursor','pointer');activate(bars,d=>selectBand(d.band));
 bars.on('pointermove',(e,d)=>tip(e,d.band+' decimal odds',[['Net per $100',cash(d.roi*100)],['Horse starts',fmt(d.n)]])).on('pointerleave',hideTip).on('focus',(e,d)=>tip(e,d.band+' decimal odds',[['Net per $100',cash(d.roi*100)],['Horse starts',fmt(d.n)]])).on('blur',hideTip);
 g.selectAll('.roi-value').data(stats.filter(d=>d.n)).join('text').attr('x',d=>d.roi<0?x(0)+8:x(d.roi*100)+6).attr('y',d=>y(d.band)+y.bandwidth()/2+3).style('font-size','10px').attr('fill',NAVY).text(d=>cash(d.roi*100));
}
function drawHeatmap(){
 const {svg,g,w,h}=svgFor('#heatmap',320,{left:65,right:8,top:45,bottom:50});svg.attr('aria-label','Differences between actual win rates and adjusted market chances by track and odds band.');
 const tracks=$('#track').value==='all'?['HV','ST']:[$('#track').value],x=d3.scaleBand().domain(D.bands).range([0,w]).padding(.08),y=d3.scaleBand().domain(tracks).range([0,Math.min(h,tracks.length*80)]).padding(.10);const minimum=+$('#min-sample').value;
 const cells=tracks.flatMap(t=>D.bands.map(b=>({...summarize(filtered.filter(r=>r.venue===t&&r.band===b),b),track:t})));
 const max=Math.max(.025,d3.max(cells.filter(d=>d.n>=minimum),d=>Math.abs(d.gap))||.025),color=d3.scaleLinear().domain([-max,0,max]).range([ORANGE,'#f0f3fa',BLUE]);
 g.append('g').attr('class','axis').attr('transform',`translate(0,-8)`).call(d3.axisTop(x).tickSize(0));g.append('g').attr('class','axis').attr('transform','translate(-5,0)').call(d3.axisLeft(y).tickSize(0).tickFormat(t=>t==='HV'?'Happy Valley':'Sha Tin'));g.selectAll('.domain').remove();
 const cell=g.selectAll('.heat-cell').data(cells).join('g').attr('class','heat-cell').attr('tabindex',0).attr('role','button').attr('aria-label',d=>`${D.tracks[d.track]}, ${d.band} odds: ${d.n>=minimum?pp(d.gap):'Below minimum sample'}, ${fmt(d.n)} horse starts. Filter to this track.`).style('cursor','pointer');
 cell.append('rect').attr('x',d=>x(d.band)).attr('y',d=>y(d.track)).attr('width',x.bandwidth()).attr('height',y.bandwidth()).attr('rx',5).attr('fill',d=>d.n>=minimum?color(d.gap):'#f2f4f8').attr('stroke','#e2e7f0');
 cell.append('text').attr('x',d=>x(d.band)+x.bandwidth()/2).attr('y',d=>y(d.track)+y.bandwidth()/2+3).attr('text-anchor','middle').style('font-size',w<330?'8px':'10px').style('fill',d=>d.n>=minimum&&Math.abs(d.gap)>max*.55?'#fff':NAVY).text(d=>d.n>=minimum?(d.gap>=0?'+':'')+(d.gap*100).toFixed(1):'—');
 activate(cell,d=>{$('#track').value=d.track;selectedBand=d.band;render();});cell.on('pointermove',(e,d)=>tip(e,D.tracks[d.track]+' · '+d.band,[['Horse starts',fmt(d.n)],['Actual minus expected',d.n>=minimum?pp(d.gap):'Below sample threshold']])).on('pointerleave',hideTip);
 g.append('text').attr('x',w/2).attr('y',Math.min(h,tracks.length*80)+28).attr('text-anchor','middle').attr('class','axis-label').text('ODDS BANDS · VALUES IN PERCENTAGE POINTS');
}
function render(){
 const track=$('#track').value,year=$('#year').value;filtered=rows.filter(r=>(track==='all'||r.venue===track)&&(year==='all'||r.date.startsWith(year)));stats=grouped(filtered);
 const races=d3.group(filtered,r=>r.race_key),all=summarize(filtered,'all');let favoriteWins=0;
 races.forEach(rs=>{const best=d3.min(rs,r=>r.odds);favoriteWins+=rs.some(r=>r.odds===best&&r.won)?1:0;});
 const fv=races.size?favoriteWins/races.size:0;
 $('#scope-note').textContent=`Showing ${track==='all'?'Happy Valley + Sha Tin':D.tracks[track]} · ${year==='all'?'2016–2018':year} · Each horse start is one horse in one race. All figures below follow these filters.`;
 const metrics=[['HORSE STARTS',fmt(filtered.length),'One horse, one race'],['COMPLETE RACES',fmt(races.size),'Date + track + race number'],['NET PER $100 STAKED',cash(all.roi*100),'Betting equally on every horse'],['FAVORITE WIN RATE',pct(fv),'Races won by a lowest-odds horse']];
 $('#metrics').innerHTML=metrics.map(([k,v,s],i)=>`<div class="metric"><p class="mini-label">${k}</p><strong class="${i===2&&all.roi<0?'negative':''}">${v}</strong><small>${s}</small></div>`).join('');
 drawCalibration();drawDetail();drawReturns();drawHeatmap();
 const overlap=stats.filter(d=>d.n&&d.expected>=d.lo&&d.expected<=d.hi).length,total=stats.filter(d=>d.n).length,losses=stats.filter(d=>d.n&&d.roi<0).length;
 $('#findings-cards').innerHTML=`<article class="finding"><p class="mini-label">01 / EXPECTATION VS. REALITY</p><div class="big">${overlap}<span class="small-num"> / ${total}</span></div><h3>Odds bands overlap expectation.</h3><p>The adjusted market chance sits inside these bands’ 95% win-rate ranges. Overlap is not proof that prices are perfectly calibrated.</p></article><article class="finding"><p class="mini-label">02 / LIKELY DOESN’T MEAN CERTAIN</p><div class="big">${pct(fv)}</div><h3>The favorite’s share of wins.</h3><p>A favorite is the horse with the lowest odds. Even the most likely winner can lose. Tied favorites count if any of them wins.</p></article><article class="finding"><p class="mini-label">03 / PROBABILITY ISN’T PROFIT</p><div class="big">${cash(all.roi*100)}</div><h3>Net return for every $100 bet.</h3><p>${losses} of ${total} odds bands lost money when betting equally on every horse. A negative number is money lost after paying for the bets.</p></article>`;
}
$('#hero-runners').textContent=fmt(D.meta.rows_analyzed);$('#hero-races').textContent=fmt(D.meta.races);
$('#audit-note').textContent=`${fmt(D.meta.audit.catalog_races)} catalog races checked; ${fmt(D.meta.races)} retained and ${fmt(D.meta.audit.excluded_races)} excluded. The reviewed sample contains ${fmt(D.meta.rows_analyzed)} horse starts. Source files are fingerprinted in the snapshot, and the build is reproducible with analysis.py.`;
$('#regression-note').textContent=`Full reviewed sample, before filters: fitted calibration slope ${D.meta.slope.estimate.toFixed(2)} (race-clustered 95% interval ${D.meta.slope.ci_low.toFixed(2)}–${D.meta.slope.ci_high.toFixed(2)}). A perfectly calibrated logistic relationship has intercept 0 and slope 1; slope alone cannot establish calibration.`;
['#track','#year'].forEach(s=>$(s).addEventListener('change',()=>{hideTip();render();}));$('#min-sample').addEventListener('change',drawHeatmap);$('#reset').addEventListener('click',()=>{$('#track').value='all';$('#year').value='all';$('#min-sample').value='300';selectedBand='3–5';mode='curve';$$('#chart-mode button').forEach(b=>{b.classList.toggle('on',b.dataset.mode===mode);b.setAttribute('aria-pressed',String(b.dataset.mode===mode));});render();});
$$('#chart-mode button').forEach(b=>b.addEventListener('click',()=>{mode=b.dataset.mode;$$('#chart-mode button').forEach(x=>{x.classList.toggle('on',x===b);x.setAttribute('aria-pressed',String(x===b));});drawCalibration();}));
$('#download').addEventListener('click',()=>{const cell=v=>'"'+String(v).replace(/"/g,'""')+'"';const csv=[D.columns.map(cell).join(','),...filtered.map(r=>D.columns.map(c=>cell(r[c])).join(','))].join('\r\n');const url=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'})),a=document.createElement('a');a.href=url;a.download=`racing-${$('#track').value}-${$('#year').value}.csv`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);});
// US story: six recorded running positions, not simulated result data.
const calls=['quarter','half','three_quarters','mile','stretch','finish'],callNames=['At the quarter-mile','At the half-mile','At three-quarter mile','At one mile','Into the home stretch','At the finish'],distances=['¼ mile','½ mile','¾ mile','1 mile','Home stretch','Finish'];
const us=[...D.us].sort((a,b)=>a.finish-b.finish),colors=h=>h.program===chosenHorse?'#90abff':h.program===3?'#1F4FD8':h.program===17?'#d48648':'#58739a';
$('#us-winner-chance').textContent=pct(us[0].fair_implied);
$('#horse-select').innerHTML=us.map(h=>`<option value="${h.program}">${esc(h.horse)}</option>`).join('');
$('#us-table').innerHTML=us.map(h=>`<tr><td>${h.finish}</td><td>${esc(h.horse)}</td><td>${h.odds_to_one.toFixed(2)} to 1</td><td>${h.market_rank}</td><td>${pct(h.fair_implied)}</td></tr>`).join('');
function ordinal(n){return n+(n%100>=11&&n%100<=13?'th':({1:'st',2:'nd',3:'rd'}[n%10]||'th'));}
function currentRank(h){const j=Math.min(4,Math.floor(progress)),f=progress-j;return h[calls[j]]*(1-f)+h[calls[j+1]]*f;}
let replayDrawing;
function drawReplay(){
 const {svg,g,w,h}=svgFor('#race-replay',410,{left:110,right:22,top:30,bottom:32});svg.attr('aria-label','Schematic running positions for all 20 horses at six recorded race calls, from back of field on the left to leader on the right.');
 const x=d3.scaleLinear().domain([20,1]).range([25,w-15]),y=d3.scaleBand().domain(us.map(h=>h.program)).range([0,h]).padding(.24);
 g.append('g').attr('class','grid').call(d3.axisBottom(x).ticks(5).tickSize(h).tickFormat(''));g.selectAll('.grid text').remove();
 g.append('text').attr('x',0).attr('y',-14).style('font-size','8px').text('BACK OF THE FIELD');g.append('text').attr('x',w).attr('y',-14).attr('text-anchor','end').style('font-size','8px').text('LEADER →');
 const lanes=g.selectAll('.horse-lane').data(us).join('g').attr('class','horse-lane').attr('transform',d=>`translate(0,${y(d.program)})`).attr('tabindex',0).attr('role','button').attr('aria-label',d=>`Follow ${d.horse}, finished ${ordinal(d.finish)}`).style('cursor','pointer');
 lanes.append('line').attr('x2',w).attr('y1',y.bandwidth()/2).attr('y2',y.bandwidth()/2).attr('stroke','#ffffff09');
 lanes.append('text').attr('x',-10).attr('y',y.bandwidth()/2+3).attr('text-anchor','end').style('font-size','9px').text(d=>d.horse.replace(' (JPN)','').length>15?d.horse.slice(0,13)+'…':d.horse.replace(' (JPN)',''));
 const icons=lanes.append('g').attr('class','horse-icon');icons.append('path').attr('d','M-10,1L-14,-3L-16,-2L-14,2L-10,3L-8,7L-5,7L-6,2L1,2L4,7L7,7L4,1L7,-4L10,-3L12,-5L8,-8L5,-7L2,-3L-6,-4Z').attr('stroke','#ffffff25').attr('stroke-width',.5);icons.append('circle').attr('cx',-2).attr('cy',-7).attr('r',2).attr('fill','#fff');
 const ranks=lanes.append('text').attr('class','rank-label').attr('y',y.bandwidth()/2+3).style('font-size','8px');
 activate(lanes,h=>chooseHorse(h.program));lanes.on('pointermove',(e,h)=>tip(e,h.horse,[['Recorded final odds',h.odds_to_one.toFixed(2)+' to 1'],['Official finish',ordinal(h.finish)]])).on('pointerleave',hideTip);
 replayDrawing={icons,lanes,ranks,x,y};updateReplay();
}
function updateReplay(){
 if(!replayDrawing)return;const {icons,lanes,ranks,x,y}=replayDrawing;
 icons.attr('transform',h=>`translate(${x(currentRank(h))},${y.bandwidth()/2})`).select('path').attr('fill',colors);
 lanes.select('text').style('fill',h=>h.program===chosenHorse?'#fff':'#9db0d0');
 ranks.attr('x',h=>Math.max(8,x(currentRank(h))-21)).attr('text-anchor','end').style('fill',h=>h.program===chosenHorse?'#fff':'#9db0d0').text(h=>Math.round(currentRank(h)));
 const idx=Math.round(progress),leader=[...us].sort((a,b)=>currentRank(a)-currentRank(b))[0];$('#call-label').textContent=callNames[idx];$('#race-distance').textContent=distances[idx];$('#leader-label').textContent=(progress>=5?'Winner: ':'Leader: ')+leader.horse;
 $('#race-progress').value=progress;
}
function chooseHorse(program){chosenHorse=+program;$('#horse-select').value=chosenHorse;const h=us.find(h=>h.program===chosenHorse);$('.silk-large').textContent=h.program;$('.silk-large').style.background=h.program===17?ORANGE:BLUE;$('#horse-title').textContent=h.horse;$('#horse-sub').textContent='Program '+h.program+' · '+ordinal(h.finish)+' at the finish';
 $('#horse-stats').innerHTML=[['Final odds',h.odds_to_one.toFixed(2)+' to 1'],['Rank by odds',ordinal(h.market_rank)+' of 20'],['Adjusted chance to win',pct(h.fair_implied)],['Actual finish',ordinal(h.finish)]].map(([k,v])=>`<div><span>${k}</span><b>${v}</b></div>`).join('');
 const {svg,g,w}=svgFor('#horse-path',85,{left:12,right:12,top:15,bottom:10}),x=d3.scaleLinear().domain([0,5]).range([0,w]),y=d3.scaleLinear().domain([20,1]).range([50,4]);
 g.append('path').datum(calls.map(c=>h[c])).attr('d',d3.line().x((d,i)=>x(i)).y(y)).attr('fill','none').attr('stroke','#8eabff').attr('stroke-width',2);calls.forEach((c,i)=>{g.append('circle').attr('cx',x(i)).attr('cy',y(h[c])).attr('r',3).attr('fill','#fff');g.append('text').attr('x',x(i)).attr('y',y(h[c])-8).attr('text-anchor','middle').text(h[c]);});
 $('#horse-story').textContent=h.program===3?'Eighth after a quarter-mile. First at the wire. Mystik Dan paid $39.22 for a $2 winning bet. That one outcome does not tell us whether 18.61-to-1 was a good price.':h.program===17?'Fierceness had the lowest odds and was the crowd’s favorite. He finished 15th. “Most likely” means a higher chance than any one rival—not a guaranteed win.':`${h.horse} was the market’s ${ordinal(h.market_rank)} choice and finished ${ordinal(h.finish)}. The path above connects the recorded positions; a lower number means closer to the lead.`;
 updateReplay();
}
function stopReplay(){playing=false;cancelAnimationFrame(replayTimer);$('#replay').textContent='▶ Play the race';}
$('#horse-select').addEventListener('change',e=>chooseHorse(e.target.value));$('#race-progress').addEventListener('input',e=>{stopReplay();progress=+e.target.value;updateReplay();});
$('#replay').addEventListener('click',()=>{if(playing){stopReplay();return;}if(progress>=5)progress=0;playing=true;$('#replay').textContent='Ⅱ Pause replay';let last=performance.now();function tick(now){if(!playing)return;progress=Math.min(5,progress+(now-last)/2200);last=now;updateReplay();if(progress>=5){stopReplay();return;}replayTimer=requestAnimationFrame(tick);}replayTimer=requestAnimationFrame(tick);});
new IntersectionObserver(([e])=>{if(!e.isIntersecting&&playing)stopReplay();}).observe($('#derby'));
const sections=$$('main>section');function scrollUpdate(){const denom=document.documentElement.scrollHeight-innerHeight;$('.scroll-progress').style.width=(denom?scrollY/denom*100:0)+'%';let current=sections[0].id;sections.forEach(s=>{if(s.getBoundingClientRect().top<innerHeight*.45)current=s.id;});$$('.pillnav a').forEach(a=>a.classList.toggle('on',a.hash==='#'+current));}addEventListener('scroll',scrollUpdate,{passive:true});
let resizeTimer;addEventListener('resize',()=>{clearTimeout(resizeTimer);resizeTimer=setTimeout(()=>{render();drawReplay();chooseHorse(chosenHorse);},160);});
render();drawReplay();chooseHorse(3);scrollUpdate();
window.RacingDashboard={getState:()=>({track:$('#track').value,year:$('#year').value,rows:filtered.length,races:new Set(filtered.map(r=>r.race_key)).size,selectedBand,stats,progress,horse:chosenHorse}),wilson};
})();
