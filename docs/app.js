/* USA-only evidence: the 2024 Kentucky Derby at Churchill Downs. */
(() => {
'use strict';
const D=window.RACING_DATA,$=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)];
if(!D||!window.d3)return;
const BLUE='#1F4FD8',NAVY='#0A1F44',ORANGE='#C65A00',GRAY='#6B7280';
const rows=D.us,pct=v=>d3.format('.1%')(v),cash=v=>(v<0?'−':'')+'$'+Math.abs(v).toFixed(2),esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let filtered=rows,chosenHorse=3,progress=0,playing=false,replayTimer;
function tip(event,title,items){const t=$('#tooltip');t.innerHTML='<b>'+esc(title)+'</b>'+items.map(([k,v])=>'<div><span>'+esc(k)+'</span><span>'+esc(v)+'</span></div>').join('');t.style.opacity=1;const rect=event.currentTarget.getBoundingClientRect(),x=event.clientX||rect.x,y=event.clientY||rect.y;t.style.left=Math.max(8,Math.min(x+16,innerWidth-275))+'px';t.style.top=Math.max(8,Math.min(y+14,innerHeight-t.offsetHeight-12))+'px';}
function hideTip(){$('#tooltip').style.opacity=0;}
function activate(sel,fn){sel.on('click',(e,d)=>fn(d)).on('keydown',(e,d)=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();fn(d);}});}
function svgFor(id,height,margin){const el=$(id),width=Math.max(220,el.clientWidth);d3.select(el).selectAll('*').remove();const svg=d3.select(el).append('svg').attr('viewBox',`0 0 ${width} ${height}`).attr('role','img');return{svg,g:svg.append('g').attr('transform',`translate(${margin.left},${margin.top})`),width,height,w:width-margin.left-margin.right,h:height-margin.top-margin.bottom};}
function drawRank(){
 const {svg,g,w,h}=svgFor('#rank-chart',filtered.length*28+70,{left:105,right:24,top:36,bottom:34});svg.attr('aria-label','Rank by betting odds versus actual finish for Kentucky Derby horses.');
 const x=d3.scaleLinear().domain([1,20]).range([0,w]),y=d3.scaleBand().domain(filtered.map(d=>d.program)).range([0,h]).padding(.4);
 g.append('g').attr('class','axis').attr('transform','translate(0,-12)').call(d3.axisTop(x).tickValues(w<300?[1,5,10,15,20]:[1,3,5,7,10,13,15,17,20]).tickFormat(d3.format('d')));
 const marks=g.selectAll('.rank-row').data(filtered).join('g').attr('class','rank-row').attr('transform',d=>`translate(0,${y(d.program)+y.bandwidth()/2})`).attr('tabindex',0).attr('role','button').attr('aria-label',d=>`${d.horse}, rank by odds ${d.market_rank}, actual finish ${d.finish}. Inspect this horse.`).style('cursor','pointer');
 marks.append('rect').attr('x',-103).attr('y',-13).attr('width',w+120).attr('height',26).attr('rx',4).attr('fill',d=>d.program===chosenHorse?'#edf2ff':'transparent');
 marks.append('text').attr('x',-9).attr('y',3).attr('text-anchor','end').style('font-size','9px').text(d=>d.horse.replace(' (JPN)','').length>15?d.horse.slice(0,13)+'…':d.horse.replace(' (JPN)',''));
 marks.append('line').attr('x1',d=>x(d.market_rank)).attr('x2',d=>x(d.finish)).attr('stroke',d=>d.program===chosenHorse?BLUE:'#b6c3da').attr('stroke-width',2);
 marks.append('circle').attr('cx',d=>x(d.market_rank)).attr('r',4).attr('fill',GRAY);
 marks.append('circle').attr('cx',d=>x(d.finish)).attr('r',6).attr('fill',BLUE).attr('stroke','#fff').attr('stroke-width',1.5);
 activate(marks,d=>chooseHorse(d.program));marks.on('pointermove',(e,d)=>tip(e,d.horse,[['Rank by odds',ordinal(d.market_rank)],['Actual finish',ordinal(d.finish)],['Final odds',d.odds_to_one.toFixed(2)+' to 1']])).on('pointerleave',hideTip);
 g.append('text').attr('class','axis-label').attr('x',w/2).attr('y',h+23).attr('text-anchor','middle').text('1 = FIRST · 20 = LAST');
}
function drawChances(){
 const {svg,g,w,h}=svgFor('#chances',filtered.length*23+65,{left:112,right:46,top:28,bottom:32});svg.attr('aria-label','Market implied chances from final odds, adjusted across all 20 Kentucky Derby horses.');
 const x=d3.scaleLinear().domain([0,.22]).range([0,w]),y=d3.scaleBand().domain(filtered.map(d=>d.program)).range([0,h]).padding(.3);
 g.append('g').attr('class','grid').call(d3.axisTop(x).ticks(4).tickSize(-h).tickFormat(''));
 g.append('g').attr('class','axis').attr('transform',`translate(0,${h})`).call(d3.axisBottom(x).ticks(4).tickFormat(d3.format('.0%')));
 g.append('g').attr('class','axis').call(d3.axisLeft(y).tickSize(0).tickFormat(id=>{const h=rows.find(r=>r.program===id);return h.horse.replace(' (JPN)','');})).select('.domain').remove();
 const bars=g.selectAll('.chance-bar').data(filtered).join('rect').attr('class','chance-bar').attr('x',0).attr('y',d=>y(d.program)).attr('width',d=>x(d.fair_implied)).attr('height',y.bandwidth()).attr('rx',3).attr('fill',d=>d.program===chosenHorse?BLUE:'#b5c6f8').attr('tabindex',0).attr('role','button').attr('aria-label',d=>`${d.horse}: ${pct(d.fair_implied)} adjusted chance. Inspect this horse.`).style('cursor','pointer');activate(bars,d=>chooseHorse(d.program));
 g.selectAll('.chance-label').data(filtered).join('text').attr('class','chance-label').attr('x',d=>x(d.fair_implied)+6).attr('y',d=>y(d.program)+y.bandwidth()/2+3).text(d=>pct(d.fair_implied));
}
function drawInspector(){
 const h=rows.find(h=>h.program===chosenHorse);$('#evidence-horse').value=h.program;$('#evidence-name').textContent=h.horse;
 $('#evidence-stats').innerHTML=[['Odds at race time',h.odds_to_one.toFixed(2)+' to 1'],['Adjusted chance to win',pct(h.fair_implied)],['Rank by odds',ordinal(h.market_rank)+' of 20'],['Official finish',ordinal(h.finish)]].map(([k,v])=>`<div><span>${k}</span><b>${v}</b></div>`).join('');
 $('#evidence-story').textContent=h.finish===1?'Six horses had lower odds, but Mystik Dan won. A low chance is still a real chance.':h.market_rank===1?'The favorite finished 15th. “Most likely” was never the same as “certain.”':`${h.horse} ranked ${ordinal(h.market_rank)} by odds and finished ${ordinal(h.finish)}. A single outcome cannot establish whether the odds were fair.`;
 const stake=+$('#stake').value,payout=h.finish===1?stake*h.decimal_odds:0;$('#stake-value').textContent=stake;
 $('#bet-result').innerHTML=`<span>TOTAL RETURNED</span><strong>${cash(payout)}</strong><p>Net ${payout-stake>=0?'profit':'loss'}: <b>${cash(payout-stake)}</b></p>`;
}
function render(){
 const group=$('#field-filter').value,order=$('#field-order').value;filtered=rows.filter(h=>group==='all'||(group==='favorites'?h.market_rank<=5:h.odds_to_one>=15)).sort((a,b)=>order==='market'?a.market_rank-b.market_rank:a.finish-b.finish);
 $('#scope-note').textContent=`2024 Kentucky Derby · ${filtered.length} of 20 horses shown. Charts and download follow your selection. Horse inspectors can follow any starter; chances remain adjusted over the full race.`;
 $('#metrics').innerHTML=[['HORSES IN THIS RACE','20','Churchill Downs · Louisville, USA'],['FAVORITE’S FINISH','15th','Fierceness · lowest odds'],['WINNER’S ODDS','18.61–1','Mystik Dan · seventh by odds'],['RETURN ON A $2 WIN BET','$39.22','For a winning bet on Mystik Dan']].map(([k,v,s])=>`<div class="metric"><p class="mini-label">${k}</p><strong>${v}</strong><small>${s}</small></div>`).join('');
 drawRank();drawChances();drawInspector();
}
$('#evidence-horse').innerHTML=rows.map(h=>`<option value="${h.program}">${esc(h.horse)}</option>`).join('');$('#evidence-horse').addEventListener('change',e=>chooseHorse(e.target.value));$('#stake').addEventListener('input',drawInspector);
['#field-filter','#field-order'].forEach(s=>$(s).addEventListener('change',()=>{hideTip();render();}));$('#reset').addEventListener('click',()=>{$('#field-filter').value='all';$('#field-order').value='market';$('#stake').value='2';chosenHorse=3;render();chooseHorse(3);});
$('#download').addEventListener('click',()=>{const columns=Object.keys(rows[0]),cell=v=>'"'+String(v).replace(/"/g,'""')+'"',csv=[columns.map(cell).join(','),...filtered.map(h=>columns.map(c=>cell(h[c])).join(','))].join('\r\n');const url=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'})),a=document.createElement('a');a.href=url;a.download='kentucky-derby-2024-'+$('#field-filter').value+'.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);});
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
 drawInspector();drawRank();drawChances();updateReplay();
}
function stopReplay(){playing=false;cancelAnimationFrame(replayTimer);$('#replay').textContent='▶ Play the race';}
$('#horse-select').addEventListener('change',e=>chooseHorse(e.target.value));$('#race-progress').addEventListener('input',e=>{stopReplay();progress=+e.target.value;updateReplay();});
$('#replay').addEventListener('click',()=>{if(playing){stopReplay();return;}if(progress>=5)progress=0;playing=true;$('#replay').textContent='Ⅱ Pause replay';let last=performance.now();function tick(now){if(!playing)return;progress=Math.min(5,progress+(now-last)/2200);last=now;updateReplay();if(progress>=5){stopReplay();return;}replayTimer=requestAnimationFrame(tick);}replayTimer=requestAnimationFrame(tick);});
new IntersectionObserver(([e])=>{if(!e.isIntersecting&&playing)stopReplay();}).observe($('#derby'));
const sections=$$('main>section');function scrollUpdate(){const denom=document.documentElement.scrollHeight-innerHeight;$('.scroll-progress').style.width=(denom?scrollY/denom*100:0)+'%';let current=sections[0].id;sections.forEach(s=>{if(s.getBoundingClientRect().top<innerHeight*.45)current=s.id;});$$('.pillnav a').forEach(a=>a.classList.toggle('on',a.hash==='#'+current));}addEventListener('scroll',scrollUpdate,{passive:true});
let resizeTimer;addEventListener('resize',()=>{clearTimeout(resizeTimer);resizeTimer=setTimeout(()=>{render();drawReplay();chooseHorse(chosenHorse);},160);});
render();drawReplay();chooseHorse(3);scrollUpdate();
window.RacingDashboard={getState:()=>({track:'Churchill Downs',country:'USA',year:'2024',rows:filtered.length,races:1,programs:filtered.map(h=>h.program),progress,horse:chosenHorse})};
})();
