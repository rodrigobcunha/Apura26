/*
 * APURA 26 — v2.3
 * Criado por Rodrigo Bahiense — 2026
 *
 * Central independente de acompanhamento eleitoral.
 * Fonte dos resultados: Tribunal Superior Eleitoral (TSE).
 */

import {
  STATES, REGIONS, OFFICES, TSE_META,
  getResult, getStateSnapshot, getMunicipalities,
  aggregateRegions, buildPhotoUrl, partyColor, stateMeta
} from './tse-api.js';

const $ = (s, root=document) => root.querySelector(s);
const $$ = (s, root=document) => [...root.querySelectorAll(s)];
const fmtInt = new Intl.NumberFormat('pt-BR');
const fmt1 = new Intl.NumberFormat('pt-BR',{minimumFractionDigits:1,maximumFractionDigits:1});
const fmt2 = new Intl.NumberFormat('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2});
const fmtCompact = new Intl.NumberFormat('pt-BR',{notation:'compact',maximumFractionDigits:1});
const pct = v => `${fmt2.format(Number(v||0))}%`;
const clamp = (v,a,b) => Math.max(a,Math.min(b,v));
const sleep = ms => new Promise(r=>setTimeout(r,ms));

const GEOJSON_URL = 'https://raw.githubusercontent.com/codeforamerica/click_that_hood/master/public/data/brazil-states.geojson';
const FLAG_BASE = 'https://raw.githubusercontent.com/akagabi/bandeira-dos-estados-do-brasil/master';

const state = {
  officeView: localStorage.getItem('apura26:v2:officeView') || 'president',
  subview: localStorage.getItem('apura26:v2:subview') || 'estados',
  selectedUf: localStorage.getItem('apura26:selectedUf') || 'rj',
  selectedMunicipality:null,
  selectedForeign:null,
  current:null,
  foreignTotal:null,
  snapshots:{},
  snapshotBusy:{},
  geo:null,
  municipalConfig:null,
  history:loadHistory(),
  events:[],
  lastSignatures:{},
  autoRotate:false,
  autoTimer:null,
  refreshBusy:false,
  mapCandidateId:null,
  mapRendered:false
};

const els = {
  liveLabel:$('#liveLabel'), headerUpdate:$('#headerUpdate'), liveDot:$('.live-dot'),
  themeBtn:$('#themeBtn'), shareBtn:$('#shareBtn'), fullscreenBtn:$('#fullscreenBtn'),
  officeTabs:$$('.office-tab'), subnav:$('#subnav'), subtabs:$$('.subtab'), scopeSelect:$('#scopeSelect'), candidateMapSelect:$('#candidateMapSelect'),
  raceTitle:$('#raceTitle'), scopeEyebrow:$('#scopeEyebrow'), progressHero:$('#progressHero'), sectionsHero:$('#sectionsHero'),
  candidateGrid:$('#candidateGrid'), candidateTotal:$('#candidateTotal'), electorateTotal:$('#electorateTotal'), resetScopeBtn:$('#resetScopeBtn'),
  historyChart:$('#historyChart'), historyStart:$('#historyStart'),
  mapStage:$('#mapStage'), municipalityStage:$('#municipalityStage'), senateStage:$('#senateStage'), chamberStage:$('#chamberStage'), internationalStage:$('#internationalStage'),
  mapSvg:$('#brazilMapSvg'), mapLoading:$('#mapLoading'), mapLegend:$('#mapLegend'), mapTooltip:$('#mapTooltip'),
  municipalityUf:$('#municipalityUf'), municipalitySelect:$('#municipalitySelect'), loadMunicipalityBtn:$('#loadMunicipalityBtn'), municipalityResult:$('#municipalityResult'),
  senateGrid:$('#senateGrid'), chamberUf:$('#chamberUf'), chamberTitle:$('#chamberTitle'), chamberPartySeats:$('#chamberPartySeats'), chamberCandidates:$('#chamberCandidates'),
  foreignLocations:$('#foreignLocations'), foreignSearch:$('#foreignSearch'),
  contextTitle:$('#contextTitle'), contextSubtitle:$('#contextSubtitle'), regionList:$('#regionList'), updatesList:$('#updatesList'), refreshNowBtn:$('#refreshNowBtn'),
  metricVotes:$('#metricVotes'), metricTurnout:$('#metricTurnout'), metricAbstention:$('#metricAbstention'), metricBlankNull:$('#metricBlankNull'),
  timelineTime:$('#timelineTime'), timelineProgress:$('#timelineProgress'), timelineKnob:$('#timelineKnob'), autoRotateBtn:$('#autoRotateBtn'),
  globalSearch:$('#globalSearch'), searchResults:$('#searchResults')
};

function escapeHtml(v='') { return String(v).replace(/[&<>'"]/g, c=>({ '&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;' }[c])); }
function initials(name='') { return name.split(/\s+/).filter(Boolean).slice(0,2).map(x=>x[0]).join('').toUpperCase(); }
function formatClock(){ return new Date().toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'}); }
function hexToRgba(hex, alpha=.6){
  const h=String(hex||'#64748b').replace('#','');
  const full=h.length===3?h.split('').map(x=>x+x).join(''):h.padEnd(6,'0');
  const n=parseInt(full.slice(0,6),16);
  return `rgba(${(n>>16)&255},${(n>>8)&255},${n&255},${alpha})`;
}
function normalizeText(v=''){ return String(v).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase(); }
function scopeName(uf){ if(uf==='br') return 'Brasil'; if(uf==='zz') return 'Exterior'; return stateMeta(uf).name; }

function toast(title, detail='', type=''){
  const host=$('#toastHost');
  const el=document.createElement('div'); el.className=`toast ${type}`;
  el.innerHTML=`<strong>${escapeHtml(title)}</strong>${detail?`<p>${escapeHtml(detail)}</p>`:''}`;
  host.append(el); setTimeout(()=>el.remove(),4200);
}

function setLive(mode='loading', label='Atualizando'){
  els.liveLabel.textContent=label;
  els.liveDot.classList.toggle('is-loading',mode==='loading');
  els.liveDot.classList.toggle('is-error',mode==='error');
}

function addUpdate(title, detail=''){
  state.events.unshift({time:formatClock(),title,detail});
  state.events=state.events.slice(0,12);
  renderUpdates();
}
function renderUpdates(){
  if(!state.events.length){
    els.updatesList.innerHTML=`<div class="update-empty"><div class="empty-icon">▤</div><strong>Conectando aos dados oficiais</strong><p>As atualizações relevantes da totalização aparecerão aqui.</p></div>`;
    return;
  }
  els.updatesList.innerHTML=state.events.map(e=>`<div class="update-item"><div><time>${e.time}</time><strong>${escapeHtml(e.title)}</strong></div><p>${escapeHtml(e.detail)}</p></div>`).join('');
}

function loadHistory(){ try{return JSON.parse(localStorage.getItem('apura26:v2:history')||'{}')}catch{return{}} }
function historyKey(result){ return `${result.officeKey}:${result.scope}:${result.municipalityCode||''}`; }
function saveHistory(result){
  if(!result) return;
  const key=historyKey(result); const list=state.history[key]||[];
  const signature=`${result.generationId}|${result.progress}|${result.time}`;
  if(list.at(-1)?.signature===signature) return;
  list.push({signature,ts:Date.now(),time:result.time||formatClock(),progress:result.progress,candidates:result.candidates.slice(0,4).map(c=>({id:c.sqcand,name:c.name,party:c.party,percent:c.percent,color:c.color}))});
  state.history[key]=list.slice(-220);
  try{localStorage.setItem('apura26:v2:history',JSON.stringify(state.history))}catch{}
}

function candidateTile(c, result, index){
  const photo=buildPhotoUrl(c,result.officeKey,result.scope);
  return `<div class="candidate-tile" style="--party:${c.color};animation-delay:${Math.min(index*28,220)}ms" title="${escapeHtml(c.name)} • ${escapeHtml(c.party)} • ${fmtInt.format(c.votes)} votos">
    <div class="candidate-photo-shell">
      ${photo?`<img class="candidate-photo" src="${photo}" alt="${escapeHtml(c.name)}" loading="lazy" onerror="this.hidden=true;this.nextElementSibling.hidden=false">`:''}
      <div class="candidate-initials" ${photo?'hidden':''}>${escapeHtml(initials(c.name))}</div>
    </div>
    <div class="candidate-copy">
      <strong>${escapeHtml(c.name)}</strong>
      <div class="candidate-bottom">
        <small>${escapeHtml(c.party)} ${escapeHtml(c.number)}</small>
        <span class="tile-percent">${result.progress>0?pct(c.percent):'—'}</span>
      </div>
    </div>
  </div>`;
}

function renderSidebar(result, {scopeLabel=null}={}){
  if(!result) return;
  state.current=result;
  const label=scopeLabel||scopeName(result.scope);
  els.scopeEyebrow.textContent=`${result.officeLabel} • ${label}`;
  els.raceTitle.textContent=result.progress>0?(result.final?'Totalização final':'Apuração em andamento'):'Aguardando totalização';
  els.progressHero.textContent=pct(result.progress);
  els.sectionsHero.textContent=result.sectionsTotal?`${fmtInt.format(result.sectionsDone)} de ${fmtInt.format(result.sectionsTotal)} seções`:'Aguardando seções';
  els.candidateGrid.innerHTML=result.candidates.length?result.candidates.slice(0,12).map((c,i)=>candidateTile(c,result,i)).join(''):`<div class="update-empty" style="grid-column:1/-1"><strong>Sem votos divulgados</strong><p>O arquivo oficial está disponível, mas ainda não contém votação para este recorte.</p></div>`;
  els.candidateTotal.textContent=fmtInt.format(result.candidates.length);
  els.electorateTotal.textContent=result.electorate?`${fmtCompact.format(result.electorate)} eleitores`:'—';
  els.resetScopeBtn.hidden=result.scope==='br' && !result.municipalityCode;
  els.metricVotes.textContent=result.totalVotes?fmtInt.format(result.totalVotes):'0';
  els.metricTurnout.textContent=pct(result.attendancePercent);
  els.metricAbstention.textContent=pct(result.abstentionPercent);
  els.metricBlankNull.textContent=pct(result.blankPercent+result.nullPercent);
  els.timelineTime.textContent=result.time||formatClock();
  const timelinePct=clamp((new Date().getHours()*60+new Date().getMinutes()-(17*60))/(6*60)*100,0,100);
  els.timelineProgress.style.width=`${timelinePct}%`; els.timelineKnob.style.left=`${timelinePct}%`;
  saveHistory(result); renderHistory(result);

  const sigKey=historyKey(result); const sig=`${result.generationId}|${result.progress}|${result.candidates[0]?.sqcand||''}`;
  if(state.lastSignatures[sigKey] && state.lastSignatures[sigKey]!==sig){
    addUpdate(`${result.officeLabel} • ${label}`,`${pct(result.progress)} das seções • atualização ${result.time||'agora'}`);
  }
  state.lastSignatures[sigKey]=sig;

  els.headerUpdate.textContent=`Atualizado ${result.time||'—'} • ${fmt1.format(result.progress)}% das seções`;
  if(result.progress>0) setLive('live',result.final?'Final':'Ao vivo'); else setLive('live','TSE conectado');
}

function renderHistory(result){
  const list=state.history[historyKey(result)]||[];
  if(list.length<2){ els.historyChart.innerHTML='<div class="chart-empty">A curva aparece conforme os dados são atualizados.</div>'; return; }
  const W=330,H=112,pad=8;
  const top=result.candidates.slice(0,2);
  const minTs=list[0].ts,maxTs=list.at(-1).ts||minTs+1;
  const x=(ts)=>pad+(ts-minTs)/Math.max(1,maxTs-minTs)*(W-pad*2);
  const y=(v)=>H-pad-(Number(v||0)/100)*(H-pad*2);
  const grid=[25,50,75,100].map(v=>`<line x1="${pad}" y1="${y(v)}" x2="${W-pad}" y2="${y(v)}" stroke="rgba(120,165,205,.12)" stroke-width="1"/><text x="2" y="${y(v)+3}" fill="rgba(140,165,187,.7)" font-size="7">${v}%</text>`).join('');
  const lines=top.map(c=>{
    const pts=list.map(s=>{const hit=s.candidates.find(k=>k.id===c.sqcand);return hit?`${x(s.ts)},${y(hit.percent)}`:null}).filter(Boolean).join(' ');
    return pts?`<polyline points="${pts}" fill="none" stroke="${c.color}" stroke-width="2.4" stroke-linejoin="round" stroke-linecap="round"/><circle cx="${pts.split(' ').at(-1).split(',')[0]}" cy="${pts.split(' ').at(-1).split(',')[1]}" r="3" fill="${c.color}"/>`:'';
  }).join('');
  const progressPts=list.map(s=>`${x(s.ts)},${y(s.progress)}`).join(' ');
  els.historyChart.innerHTML=`<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none">${grid}<polyline points="${progressPts}" fill="none" stroke="rgba(97,185,255,.34)" stroke-width="1.2" stroke-dasharray="3 4"/>${lines}</svg>`;
}

function populateStateSelects(){
  const options=STATES.map(([uf,name])=>`<option value="${uf}">${name}</option>`).join('');
  els.chamberUf.innerHTML=options; els.chamberUf.value=state.selectedUf;
  els.municipalityUf.innerHTML=options; els.municipalityUf.value=state.selectedUf;
  updateScopeSelect();
}

function updateScopeSelect(){
  const stateOptions=STATES.map(([uf,name])=>`<option value="${uf}">${name}</option>`).join('');
  if(state.officeView==='president'){
    els.scopeSelect.innerHTML=`<option value="br">Brasil</option>${stateOptions}`;
    els.scopeSelect.value=state.current?.scope && state.current.scope!=='zz'?state.current.scope:'br';
    els.scopeSelect.hidden=false;
  } else if(state.officeView==='international') {
    els.scopeSelect.innerHTML='<option value="zz">Exterior</option>'; els.scopeSelect.value='zz'; els.scopeSelect.hidden=true;
  } else {
    els.scopeSelect.innerHTML=stateOptions; els.scopeSelect.value=state.selectedUf; els.scopeSelect.hidden=false;
  }
}

function setStage(name){
  [els.mapStage,els.municipalityStage,els.senateStage,els.chamberStage,els.internationalStage].forEach(x=>x.classList.remove('is-active'));
  const map={map:els.mapStage,municipios:els.municipalityStage,senate:els.senateStage,chamber:els.chamberStage,international:els.internationalStage};
  map[name]?.classList.add('is-active');
}

function configureView(){
  els.officeTabs.forEach(b=>b.classList.toggle('is-active',b.dataset.officeView===state.officeView));
  const president=state.officeView==='president';
  els.subtabs.forEach(b=>b.hidden=!president);
  els.subnav.classList.toggle('is-contextual',!president);
  updateScopeSelect();

  if(state.officeView==='president'){
    els.subtabs.forEach(b=>b.classList.toggle('is-active',b.dataset.subview===state.subview));
    setStage(state.subview==='municipios'?'municipios':'map');
    els.contextTitle.textContent='Por região'; els.contextSubtitle.textContent='Quem lidera para presidente';
    // Em 'Por candidato', o mapa mostra a cor do candidato que lidera em cada UF.
    // O seletor individual fica oculto para evitar a leitura de intensidade de um único candidato.
    els.candidateMapSelect.hidden=true;
    renderMap(); renderRegions();
  } else if(state.officeView==='governor'){
    setStage('map'); els.contextTitle.textContent='Governadores'; els.contextSubtitle.textContent='Apuração por região'; els.candidateMapSelect.hidden=true;
  } else if(state.officeView==='senator'){
    setStage('senate'); els.contextTitle.textContent='Parcial por partido'; els.contextSubtitle.textContent='54 posições na parcial'; els.candidateMapSelect.hidden=true;
  } else if(state.officeView==='federalDeputy'){
    setStage('chamber'); els.contextTitle.textContent='Cadeiras atribuídas'; els.contextSubtitle.textContent='Sem projeções próprias'; els.candidateMapSelect.hidden=true;
  } else if(state.officeView==='international'){
    setStage('international'); els.contextTitle.textContent='Exterior'; els.contextSubtitle.textContent='Presidente • totalização oficial'; els.candidateMapSelect.hidden=true;
  }
}

async function switchOffice(view, {silent=false}={}){
  state.officeView=view;
  localStorage.setItem('apura26:v2:officeView', view);
  configureView(); setLive('loading','Atualizando');
  if(!silent) addUpdate('Visão alterada',OFFICES[view]?.label || 'Internacional');
  try{
    if(view==='president'){
      await refreshCurrentResult('president','br');
      refreshSnapshot('president');
    } else if(view==='governor'){
      await refreshCurrentResult('governor',state.selectedUf);
      refreshSnapshot('governor');
    } else if(view==='senator'){
      await refreshCurrentResult('senator',state.selectedUf);
      await refreshSnapshot('senator');
    } else if(view==='federalDeputy'){
      await loadChamber(state.selectedUf);
    } else if(view==='international'){
      await loadInternational();
    }
  }catch(err){ handleError(err); }
}

async function refreshCurrentResult(officeKey, scope, municipalityCode=null, scopeLabel=null){
  const result=await getResult(officeKey,scope,municipalityCode);
  renderSidebar(result,{scopeLabel});
  return result;
}

async function refreshSnapshot(officeKey, force=false){
  if(state.snapshotBusy[officeKey]) return;
  const existing=state.snapshots[officeKey];
  if(existing && !force && Date.now()-(existing.loadedAt||0)<45000){ renderContextForActive(); renderMap(); return existing; }
  state.snapshotBusy[officeKey]=true;
  if(officeKey==='president'||officeKey==='governor') els.mapLoading.hidden=false;
  try{
    const data=await getStateSnapshot(officeKey,{batchSize:6,delayMs:100,onBatch:partial=>{
      state.snapshots[officeKey]={data:{...partial},loadedAt:Date.now()};
      if(state.officeView===officeKey || (officeKey==='president'&&state.officeView==='president')) { renderMap(); renderContextForActive(); }
    }});
    state.snapshots[officeKey]={data,loadedAt:Date.now()};
    if(officeKey==='senator') renderSenate(); else renderMap();
    renderContextForActive();
    addUpdate(`${OFFICES[officeKey].label}: mapa atualizado`,'Resultados por UF sincronizados com os arquivos oficiais.');
    return state.snapshots[officeKey];
  } catch(err){ console.error(err); toast('Falha ao atualizar mapa',err.message,'error'); }
  finally{ state.snapshotBusy[officeKey]=false; els.mapLoading.hidden=true; }
}

function renderContextForActive(){
  if(state.officeView==='president') renderRegions();
  else if(state.officeView==='governor') renderGovernorContext();
  else if(state.officeView==='senator') renderSenateContext();
  else if(state.officeView==='federalDeputy') renderChamberContext(state.current);
  else if(state.officeView==='international') renderInternationalContext(state.current||state.foreignTotal);
}

function renderRegions(){
  const snap=state.snapshots.president?.data;
  if(!snap){ return; }
  const regions=aggregateRegions(snap);
  const rows=Object.values(regions).map(r=>regionRow(r.region,r.progress,r.leader,r.sectionsTotal-r.sectionsDone)).join('');
  const foreign=state.foreignTotal;
  els.regionList.innerHTML=rows+regionRow('Exterior',foreign?.progress||0,foreign?.candidates?.[0]||null,foreign?.sectionsPending||0,true);
}
function regionRow(name,progress,leader,pending=0,foreign=false){
  const color=leader?.color || (foreign?'#6f8ba4':'#4b6880');
  return `<div class="region-row" style="--region-color:${color}"><div class="region-top"><span class="region-marker"></span><span class="region-name">${foreign?'🌐 ':''}${escapeHtml(name)}</span><span class="region-leader">${leader?`${escapeHtml(leader.name)} • ${escapeHtml(leader.party)}`:'Aguardando'}</span></div><div class="region-bottom"><small>${fmt1.format(progress)}% • faltam ${fmtCompact.format(Math.max(0,pending))} seções</small><div class="mini-progress"><span style="width:${progress}%"></span></div><span class="region-percent">${fmt1.format(progress)}%</span></div></div>`;
}

function renderGovernorContext(){
  const snap=state.snapshots.governor?.data; if(!snap) return;
  els.regionList.innerHTML=Object.entries(REGIONS).map(([region,ufs])=>{
    const rows=ufs.map(uf=>snap[uf]).filter(x=>x?.data); const st=rows.reduce((a,x)=>a+x.data.sectionsDone,0), ts=rows.reduce((a,x)=>a+x.data.sectionsTotal,0); const p=ts?st/ts*100:0;
    const mostAdvanced=[...rows].sort((a,b)=>(b.data?.progress||0)-(a.data?.progress||0))[0];
    return regionRow(region,p,mostAdvanced?.leader||null,Math.max(0,ts-st));
  }).join('');
}

function renderSenateContext(){
  const snap=state.snapshots.senator?.data; if(!snap) return;
  const counts=new Map();
  Object.values(snap).forEach(s=>s?.data?.candidates.slice(0,2).forEach(c=>counts.set(c.party,(counts.get(c.party)||0)+1)));
  const items=[...counts.entries()].sort((a,b)=>b[1]-a[1]);
  els.regionList.innerHTML=items.length?items.map(([party,count])=>`<div class="region-row" style="--region-color:${partyColor(party)}"><div class="region-top"><span class="region-marker"></span><span class="region-name">${escapeHtml(party)}</span><span class="region-leader">${count} posições na parcial</span></div><div class="region-bottom"><small>${count} de 54</small><div class="mini-progress"><span style="width:${count/54*100}%"></span></div><span class="region-percent">${count}</span></div></div>`).join(''):'<div class="update-empty"><strong>Aguardando parcial</strong></div>';
}

function renderChamberContext(result){
  if(!result) return;
  const seats=result.partySeats.filter(x=>x.seats>0);
  els.regionList.innerHTML=seats.length?seats.map(p=>`<div class="region-row" style="--region-color:${p.color}"><div class="region-top"><span class="region-marker"></span><span class="region-name">${escapeHtml(p.party)}</span><span class="region-leader">${p.seats} vaga${p.seats!==1?'s':''}</span></div><div class="region-bottom"><small>${fmtCompact.format(p.votes)} votos</small><div class="mini-progress"><span style="width:${result.vacancies?p.seats/result.vacancies*100:0}%"></span></div><span class="region-percent">${p.seats}</span></div></div>`).join(''):'<div class="update-empty"><strong>Sem cadeiras atribuídas ainda</strong><p>O APURA 26 não projeta vagas. Esta área usa apenas o campo oficial de vagas do TSE.</p></div>';
}
function renderInternationalContext(result){
  if(!result) return;
  const leader=result.candidates[0];
  els.regionList.innerHTML=`${regionRow('Exterior',result.progress,leader,result.sectionsPending,true)}<div class="region-row"><div class="region-top"><span class="region-name">Eleitorado</span><span class="region-leader">${fmtInt.format(result.electorate)}</span></div></div><div class="region-row"><div class="region-top"><span class="region-name">Comparecimento</span><span class="region-leader">${pct(result.attendancePercent)}</span></div></div>`;
}

async function loadGeo(){
  try{
    const res=await fetch(GEOJSON_URL,{cache:'force-cache'}); if(!res.ok) throw new Error(`Mapa HTTP ${res.status}`);
    state.geo=await res.json(); renderMap();
  }catch(err){
    console.error(err); els.mapLoading.innerHTML='Não foi possível carregar a malha geográfica. Os resultados continuam disponíveis nos demais painéis.';
  }
}

function geoBounds(features){
  let minX=Infinity,maxX=-Infinity,minY=Infinity,maxY=-Infinity;
  const visit=(coords)=>{ if(typeof coords[0]==='number'){ const [x,y]=coords; minX=Math.min(minX,x);maxX=Math.max(maxX,x);minY=Math.min(minY,y);maxY=Math.max(maxY,y); } else coords.forEach(visit); };
  features.forEach(f=>visit(f.geometry.coordinates)); return {minX,maxX,minY,maxY};
}
function featureBounds(feature){ let minX=Infinity,maxX=-Infinity,minY=Infinity,maxY=-Infinity; const visit=(c)=>{ if(typeof c[0]==='number'){minX=Math.min(minX,c[0]);maxX=Math.max(maxX,c[0]);minY=Math.min(minY,c[1]);maxY=Math.max(maxY,c[1]);} else c.forEach(visit)}; visit(feature.geometry.coordinates); return{minX,maxX,minY,maxY}; }
function pathFromGeometry(geometry,project){
  const polys=geometry.type==='Polygon'?[geometry.coordinates]:geometry.coordinates;
  let d='';
  for(const poly of polys){
    for(const ring of poly){
      const step=Math.max(1,Math.ceil(ring.length/550));
      for(let i=0;i<ring.length;i+=step){ const [x,y]=project(ring[i]); d+=`${i===0?'M':'L'}${x.toFixed(1)},${y.toFixed(1)}`; }
      const [lx,ly]=project(ring[ring.length-1]); d+=`L${lx.toFixed(1)},${ly.toFixed(1)}Z`;
    }
  }
  return d;
}

const CALLOUTS={rn:250,pb:285,pe:320,al:355,se:390,es:515,rj:555};
function activeSnapshot(){ if(state.officeView==='governor') return state.snapshots.governor?.data; return state.snapshots.president?.data; }
function mapFill(uf){
  const snap=activeSnapshot(); const item=snap?.[uf]; if(!item?.data) return 'rgba(74,103,128,.18)';
  const leader=item.leader, runner=item.runnerUp;
  if(state.officeView==='governor') return leader?hexToRgba(leader.color,.76):'rgba(74,103,128,.18)';
  if(state.subview==='vantagem'){
    const gap=Math.max(0,(leader?.percent||0)-(runner?.percent||0)); const a=.22+Math.min(.7,gap/25*.7); return leader?hexToRgba(leader.color,a):'rgba(74,103,128,.18)';
  }
  if(state.subview==='candidato'){
    // Leitura direta: cada UF recebe a cor partidária do candidato que está na frente na parcial.
    return leader ? hexToRgba(leader.color,.9) : 'rgba(74,103,128,.18)';
  }
  return leader?hexToRgba(leader.color,.78):'rgba(74,103,128,.18)';
}

function renderMap(){
  if(!state.geo || !els.mapStage.classList.contains('is-active')) return;
  const features=state.geo.features||[]; const b=geoBounds(features); const W=820,H=720,padX=52,padY=28,mapRight=665;
  const project=([lon,lat])=>[padX+(lon-b.minX)/(b.maxX-b.minX)*(mapRight-padX),padY+(b.maxY-lat)/(b.maxY-b.minY)*(H-padY*2)];
  let paths='',labels='',callouts='';
  for(const f of features){
    const uf=String(f.properties?.sigla||'').toLowerCase(); if(!uf) continue;
    const fb=featureBounds(f), center=project([(fb.minX+fb.maxX)/2,(fb.minY+fb.maxY)/2]);
    paths+=`<path class="map-state" data-uf="${uf}" d="${pathFromGeometry(f.geometry,project)}" fill="${mapFill(uf)}"></path>`;
    if(CALLOUTS[uf]){
      const ty=CALLOUTS[uf], tx=730; callouts+=`<line class="map-callout-line" x1="${center[0]}" y1="${center[1]}" x2="${tx-35}" y2="${ty}"/><circle cx="${center[0]}" cy="${center[1]}" r="2.2" fill="#7fc8ff"/><rect class="map-callout-box" x="${tx-35}" y="${ty-13}" rx="5" width="48" height="26"/><text class="map-callout-text" x="${tx-11}" y="${ty+4}">${uf.toUpperCase()}</text>`;
    } else labels+=`<text class="map-label" x="${center[0]}" y="${center[1]+4}">${uf.toUpperCase()}</text>`;
  }
  els.mapSvg.innerHTML=`<g>${paths}</g><g>${labels}</g><g>${callouts}</g>`;
  $$('.map-state',els.mapSvg).forEach(p=>{
    p.addEventListener('pointermove',showMapTooltip); p.addEventListener('pointerleave',()=>els.mapTooltip.hidden=true); p.addEventListener('click',()=>selectState(p.dataset.uf));
  });
  els.mapLoading.hidden=true; renderMapLegend(); state.mapRendered=true;
}

function showMapTooltip(ev){
  const uf=ev.currentTarget.dataset.uf; const meta=stateMeta(uf); const item=activeSnapshot()?.[uf]; const leader=item?.leader, runner=item?.runnerUp;
  const gap=leader&&runner?Math.max(0,leader.percent-runner.percent):0;
  els.mapTooltip.innerHTML=`<strong>${escapeHtml(meta.name)} • ${uf.toUpperCase()}</strong><small>${item?.data?pct(item.data.progress)+' das seções':'Aguardando resultado'}</small>${leader?`<div class="tt-row"><span>${escapeHtml(leader.name)} • ${escapeHtml(leader.party)}</span><b>${pct(leader.percent)}</b></div>`:''}${runner?`<div class="tt-row"><span>${escapeHtml(runner.name)} • ${escapeHtml(runner.party)}</span><b>${pct(runner.percent)}</b></div><small>Vantagem na parcial: ${fmt2.format(gap)} p.p.</small>`:''}`;
  els.mapTooltip.hidden=false; const x=Math.min(window.innerWidth-280,ev.clientX+14),y=Math.min(window.innerHeight-150,ev.clientY+14); els.mapTooltip.style.left=`${x}px`;els.mapTooltip.style.top=`${y}px`;
}

function renderMapLegend(){
  const snap=activeSnapshot(); if(!snap){els.mapLegend.innerHTML='';return}
  if(state.subview==='candidato'&&state.officeView==='president'){
    const leaders=new Map();
    Object.values(snap).forEach(item=>{ const c=item?.leader; if(c) leaders.set(c.sqcand||`${c.name}-${c.party}`,c); });
    els.mapLegend.innerHTML=[...leaders.values()].slice(0,10).map(c=>`<span class="legend-chip" style="--legend:${c.color}"><i></i>${escapeHtml(c.name)} • ${escapeHtml(c.party)}</span>`).join('');
    return;
  }
  const parties=new Map(); Object.values(snap).forEach(s=>{if(s?.leader) parties.set(s.leader.party,s.leader.color)});
  els.mapLegend.innerHTML=[...parties.entries()].slice(0,8).map(([p,c])=>`<span class="legend-chip" style="--legend:${c}"><i></i>${escapeHtml(p)}</span>`).join('');
}

async function selectState(uf){
  state.selectedUf=uf; localStorage.setItem('apura26:selectedUf',uf); els.chamberUf.value=uf; els.municipalityUf.value=uf; populateMunicipalityList(uf);
  if(state.officeView==='president'){
    els.scopeSelect.value=uf; try{setLive('loading','Atualizando');await refreshCurrentResult('president',uf);renderCandidateMapOptions();}catch(e){handleError(e)}
  } else if(state.officeView==='governor'){
    els.scopeSelect.value=uf; try{setLive('loading','Atualizando');await refreshCurrentResult('governor',uf)}catch(e){handleError(e)}
  } else if(state.officeView==='senator'){
    els.scopeSelect.value=uf; try{setLive('loading','Atualizando');await refreshCurrentResult('senator',uf)}catch(e){handleError(e)}
  } else if(state.officeView==='federalDeputy'){ els.scopeSelect.value=uf; await loadChamber(uf); }
}

async function resetPresidentScope(){
  if(state.officeView==='international'){ state.selectedForeign=null; await loadInternational(true); return; }
  if(state.officeView==='president'){ await refreshCurrentResult('president','br'); els.scopeSelect.value='br'; renderCandidateMapOptions(); }
}

function renderCandidateMapOptions(){
  if(state.officeView!=='president'||!state.current) return;
  const current=state.current.scope==='br'?state.current:null;
  if(!current && state.snapshots.president?.data){ /* keep previous options */ }
  const base=state.current.scope==='br'?state.current.candidates:(state.history['president:br:']?.at(-1)?.candidates||[]);
  if(Array.isArray(base)&&base.length){
    els.candidateMapSelect.innerHTML=base.map(c=>`<option value="${c.sqcand||c.id}">${escapeHtml(c.name)} • ${escapeHtml(c.party)}</option>`).join('');
    if(!state.mapCandidateId) state.mapCandidateId=base[0].sqcand||base[0].id;
    els.candidateMapSelect.value=state.mapCandidateId;
  }
}

async function loadMunicipalityConfig(){
  try{
    state.municipalConfig=await getMunicipalities(6257); populateMunicipalityList(state.selectedUf); renderForeignLocations();
  }catch(err){ console.error(err); els.municipalitySelect.innerHTML='<option>Não foi possível carregar a lista</option>'; }
}
function populateMunicipalityList(uf){
  if(!state.municipalConfig){els.municipalitySelect.innerHTML='<option>Carregando municípios…</option>';return}
  const list=state.municipalConfig.scopes?.[uf]?.municipalities||[];
  els.municipalitySelect.innerHTML=list.map(m=>`<option value="${m.code}">${m.capital?'★ ':''}${escapeHtml(m.name)}</option>`).join('');
}
async function loadSelectedMunicipality(){
  const uf=els.municipalityUf.value, code=els.municipalitySelect.value; const m=state.municipalConfig?.scopes?.[uf]?.municipalities.find(x=>x.code===code); if(!code||!m)return;
  try{
    els.municipalityResult.className='municipality-result empty-state'; els.municipalityResult.innerHTML='<span class="spinner"></span><strong>Consultando o TSE…</strong>';
    const result=await getResult('president',uf,code); state.selectedMunicipality={uf,...m}; renderMunicipalityResult(result,m); renderSidebar(result,{scopeLabel:`${m.name}/${uf.toUpperCase()}`});
    addUpdate(`Município aberto: ${m.name}/${uf.toUpperCase()}`,`${pct(result.progress)} das seções totalizadas.`);
  }catch(err){ els.municipalityResult.innerHTML=`<div class="empty-icon">!</div><strong>Não foi possível carregar ${escapeHtml(m.name)}</strong><p>${escapeHtml(err.message)}</p>`; handleError(err,false); }
}
function renderMunicipalityResult(result,m){
  els.municipalityResult.className='municipality-result';
  els.municipalityResult.innerHTML=`<div class="municipal-summary"><div class="summary-tile"><span>Localidade</span><strong>${escapeHtml(m.name)}</strong></div><div class="summary-tile"><span>Seções</span><strong>${pct(result.progress)}</strong></div><div class="summary-tile"><span>Votos</span><strong>${fmtCompact.format(result.totalVotes)}</strong></div><div class="summary-tile"><span>Comparecimento</span><strong>${pct(result.attendancePercent)}</strong></div></div><div class="municipal-ranking">${result.candidates.slice(0,8).map((c,i)=>rankRow(c,result,i)).join('')}</div>`;
}
function rankRow(c,result,i){ const photo=buildPhotoUrl(c,result.officeKey,result.scope); return `<div class="rank-row" style="--party:${c.color}"><div class="ranking-number">${i+1}º</div>${photo?`<img class="rank-photo" src="${photo}" alt="" onerror="this.style.visibility='hidden'">`:''}<div class="rank-info"><strong>${escapeHtml(c.name)}</strong><small>${escapeHtml(c.party)} • ${fmtInt.format(c.votes)} votos</small></div><div class="rank-value"><strong>${pct(c.percent)}</strong><small>${c.elected?'Eleito':escapeHtml(c.status||'')}</small></div></div>`; }

function stateFlagUrl(uf){ return `${FLAG_BASE}/${uf}.svg`; }
function renderSenate(){
  const snap=state.snapshots.senator?.data; if(!snap){els.senateGrid.innerHTML='<div class="update-empty"><span class="spinner"></span><strong>Carregando UFs…</strong></div>';return}
  els.senateGrid.innerHTML=STATES.map(([uf,name])=>{
    const item=snap[uf], leaders=item?.data?.candidates.slice(0,2)||[];
    return `<article class="senate-state" data-senate-uf="${uf}"><div class="senate-state-head"><img class="state-flag" src="${stateFlagUrl(uf)}" alt="Bandeira de ${escapeHtml(name)}" onerror="this.style.display='none'"><div><strong>${uf.toUpperCase()}</strong><small>${escapeHtml(name)} • ${item?.data?pct(item.data.progress):'—'}</small></div></div><div class="seat-pair">${[0,1].map(i=>{const c=leaders[i];return c?`<div class="seat" style="--seat:${c.color}" title="${escapeHtml(c.name)} • ${escapeHtml(c.party)} • ${pct(c.percent)}"><strong>${escapeHtml(c.name)}</strong><small>${escapeHtml(c.party)} • ${pct(c.percent)}</small></div>`:`<div class="seat empty"><strong>Aguardando</strong><small>${i+1}ª posição</small></div>`}).join('')}</div></article>`;
  }).join('');
  $$('[data-senate-uf]',els.senateGrid).forEach(x=>x.addEventListener('click',()=>selectState(x.dataset.senateUf)));
  renderSenateContext();
}

async function loadChamber(uf){
  state.selectedUf=uf;localStorage.setItem('apura26:selectedUf',uf);els.chamberUf.value=uf;els.scopeSelect.value=uf;
  setLive('loading','Atualizando');
  try{
    const result=await getResult('federalDeputy',uf); renderSidebar(result,{scopeLabel:stateMeta(uf).name}); renderChamber(result); renderChamberContext(result);
  }catch(err){handleError(err)}
}
function renderChamber(result){
  els.chamberTitle.textContent=`${stateMeta(result.scope).name} • ${result.vacancies||'—'} vagas`;
  const seats=result.partySeats.filter(x=>x.seats>0);
  els.chamberPartySeats.innerHTML=seats.length?seats.map(p=>`<div class="party-seat-chip" style="--party:${p.color}"><span>${escapeHtml(p.party)}</span><strong>${p.seats} vaga${p.seats!==1?'s':''}</strong></div>`).join(''):`<div class="update-empty" style="width:100%"><strong>Ainda sem vagas atribuídas pelo TSE</strong><p>O painel não faz projeção própria de cadeiras.</p></div>`;
  els.chamberCandidates.innerHTML=result.candidates.slice(0,30).map((c,i)=>rankRow(c,result,i)).join('');
}

const LOCATION_COUNTRY_RULES=[
  // Oceania e Ásia
  [/sydney|sidnei|melbourne|brisbane|canberra|perth|adelaide|austral/i,'AU'],[/auckland|wellington|nova zeland/i,'NZ'],
  [/tokyo|t[oó]quio|nagoya|hamamatsu|jap[aã]o/i,'JP'],[/seul|coreia do sul|republica da coreia/i,'KR'],[/beijing|pequim|shanghai|cant[aã]o|guangzhou|china/i,'CN'],[/hong kong/i,'HK'],[/taipei|taiwan/i,'TW'],[/singapura/i,'SG'],[/jacarta|indon[eé]sia/i,'ID'],[/kuala lumpur|mal[aá]sia/i,'MY'],[/manila|filipinas/i,'PH'],[/bangkok|tail[aâ]ndia/i,'TH'],[/han[oó]i|vietn[aã]/i,'VN'],[/nova delhi|new delhi|mumbai|[ií]ndia/i,'IN'],
  // Europa
  [/lisboa|porto|faro|coimbra|portugal/i,'PT'],[/madrid|barcelona|sevilha|espanha/i,'ES'],[/paris|lyon|fran[cç]a/i,'FR'],[/berlim|berlin|frankfurt|munique|munich|hamburgo|alemanha/i,'DE'],[/roma|mil[aã]o|milan|it[aá]lia/i,'IT'],[/londres|london|edinburgo|reino unido|inglaterra/i,'GB'],[/dublin|dublin|irlanda/i,'IE'],[/zurique|z[uü]rich|genebra|su[ií][cç]a/i,'CH'],[/bruxelas|brussels|b[eé]lgica/i,'BE'],[/amsterd[aã]|pa[ií]ses baixos|holanda/i,'NL'],[/viena|vienna|[aá]ustria/i,'AT'],[/estocolmo|stockholm|su[eé]cia/i,'SE'],[/oslo|noruega/i,'NO'],[/copenhag|copenhagen|dinamarca/i,'DK'],[/helsinque|helsinki|finl[aâ]ndia/i,'FI'],[/praga|prague|rep[uú]blica tcheca|tchequia/i,'CZ'],[/vars[oó]via|warsaw|pol[oô]nia/i,'PL'],[/budapeste|budapest|hungria/i,'HU'],[/atenas|athens|gr[eé]cia/i,'GR'],[/bucareste|rom[eê]nia/i,'RO'],[/s[oó]fia|bulg[aá]ria/i,'BG'],[/zagreb|cro[aá]cia/i,'HR'],[/belgrado|s[eé]rvia/i,'RS'],[/moscou|moscow|r[uú]ssia/i,'RU'],
  // América do Norte e Central
  [/nova york|new york|boston|miami|orlando|houston|los angeles|washington|chicago|atlanta|san francisco|estados unidos|eua/i,'US'],[/toronto|montreal|vancouver|ottawa|calgary|canad[aá]/i,'CA'],[/m[eé]xico|cidade do mexico|mexico city/i,'MX'],[/panam[aá]/i,'PA'],[/san jos[eé]|costa rica/i,'CR'],[/havanna|havana|cuba/i,'CU'],[/santo domingo|rep[uú]blica dominicana/i,'DO'],
  // América do Sul
  [/buenos aires|c[oó]rdoba|argentina/i,'AR'],[/santiago|chile/i,'CL'],[/montevideu|montevideo|uruguai/i,'UY'],[/assun[cç][aã]o|asunci[oó]n|paraguai/i,'PY'],[/la paz|santa cruz|bol[ií]via/i,'BO'],[/lima|peru/i,'PE'],[/bogot[aá]|col[oô]mbia/i,'CO'],[/caracas|venezuela/i,'VE'],[/quito|equador/i,'EC'],[/georgetown|guiana/i,'GY'],[/paramaribo|suriname/i,'SR'],
  // África e Oriente Médio
  [/joanesburgo|johannesburg|pret[oó]ria|cape town|cidade do cabo|[aá]frica do sul/i,'ZA'],[/luanda|angola/i,'AO'],[/maputo|mo[cç]ambique/i,'MZ'],[/cabo verde|praia/i,'CV'],[/abuja|lagos|nig[eé]ria/i,'NG'],[/nairobi|qu[eê]nia/i,'KE'],[/acra|accra|gana/i,'GH'],[/ad[ií]s abeba|eti[oó]pia/i,'ET'],[/cairo|egito/i,'EG'],[/rabat|marrocos/i,'MA'],[/dubai|abu dhabi|emirados/i,'AE'],[/doha|catar|qatar/i,'QA'],[/riad|riyadh|ar[aá]bia saudita/i,'SA'],[/tel aviv|jerusal[eé]m|israel/i,'IL'],[/beirute|l[ií]bano/i,'LB'],[/istambul|istanbul|ancara|turquia/i,'TR']
];
const regionDisplay = (()=>{ try{return new Intl.DisplayNames(['pt-BR'],{type:'region'})}catch{return null} })();
function countryCodeForLocation(name){ const hit=LOCATION_COUNTRY_RULES.find(([rx])=>rx.test(String(name||''))); return hit?.[1]||null; }
function countryName(code){ try{return code?(regionDisplay?.of(code)||code):'País não identificado'}catch{return code||'País não identificado'} }
function flagEmoji(code){ if(!code||code.length!==2)return'🌐'; return String.fromCodePoint(...code.toUpperCase().split('').map(c=>127397+c.charCodeAt(0))); }
function flagMarkup(name){
  const code=countryCodeForLocation(name);
  if(!code) return '<span class="foreign-flag is-fallback" title="País não identificado">🌐</span>';
  const cc=code.toLowerCase();
  const label=escapeHtml(countryName(code));
  // Usa imagem real da bandeira para funcionar também no Windows, onde emoji de países pode não ser renderizado como bandeira.
  // Se a imagem não carregar, o código ISO continua visível como fallback local.
  return `<span class="foreign-flag" title="${label}"><img src="https://flagcdn.com/w80/${cc}.png" alt="Bandeira de ${label}" loading="lazy" referrerpolicy="no-referrer" onerror="this.style.display='none';this.nextElementSibling.hidden=false"><span class="flag-code-fallback" hidden>${escapeHtml(code)}</span></span>`;
}


async function loadInternational(reset=false){
  try{
    const result=await getResult('president','zz'); state.foreignTotal=result; if(reset||!state.selectedForeign) renderSidebar(result,{scopeLabel:'Exterior'}); renderInternationalContext(result);
    if(!state.municipalConfig) await loadMunicipalityConfig(); else renderForeignLocations();
  }catch(err){handleError(err)}
}
function renderForeignLocations(filter=''){
  if(!state.municipalConfig){els.foreignLocations.innerHTML='<div class="update-empty"><span class="spinner"></span><strong>Carregando localidades…</strong></div>';return}
  const list=state.municipalConfig.scopes?.zz?.municipalities||[]; const q=normalizeText(filter);
  const filtered=list.filter(m=>!q||normalizeText(m.name).includes(q));
  const totalCard=`<button class="foreign-card ${!state.selectedForeign?'is-active':''}" data-foreign-total="1"><span class="foreign-flag is-fallback">🌐</span><span class="foreign-info"><strong>Exterior • Total</strong><small>Resultado consolidado</small></span></button>`;
  els.foreignLocations.innerHTML=totalCard+filtered.map(m=>{ const cc=countryCodeForLocation(m.name); return `<button class="foreign-card ${state.selectedForeign?.code===m.code?'is-active':''}" data-foreign-code="${m.code}">${flagMarkup(m.name)}<span class="foreign-info"><strong>${escapeHtml(m.name)}</strong><small>${escapeHtml(countryName(cc))} • localidade ${m.code}</small></span></button>`; }).join('');
  $('[data-foreign-total]',els.foreignLocations)?.addEventListener('click',()=>{state.selectedForeign=null;renderForeignLocations(els.foreignSearch.value);renderSidebar(state.foreignTotal,{scopeLabel:'Exterior'});});
  $$('[data-foreign-code]',els.foreignLocations).forEach(btn=>btn.addEventListener('click',()=>loadForeignLocality(btn.dataset.foreignCode)));
}
async function loadForeignLocality(code){
  const m=state.municipalConfig?.scopes?.zz?.municipalities.find(x=>x.code===code); if(!m)return;
  try{ setLive('loading','Atualizando'); const result=await getResult('president','zz',code); state.selectedForeign=m; renderForeignLocations(els.foreignSearch.value); renderSidebar(result,{scopeLabel:m.name}); addUpdate(`Exterior • ${m.name}`,`${pct(result.progress)} das seções totalizadas.`); }
  catch(err){handleError(err)}
}

function handleError(err,notify=true){
  console.error('[APURA 26]',err); setLive('error','Fonte indisponível'); els.headerUpdate.textContent='Falha temporária na consulta';
  if(notify) toast('Não foi possível atualizar',err?.message||'Falha ao consultar o TSE.','error');
}

async function refreshActive(){
  if(state.refreshBusy) return; state.refreshBusy=true;
  try{
    if(state.officeView==='president'){
      if(state.current?.municipalityCode && state.selectedMunicipality) await refreshCurrentResult('president',state.selectedMunicipality.uf,state.selectedMunicipality.code,`${state.selectedMunicipality.name}/${state.selectedMunicipality.uf.toUpperCase()}`);
      else await refreshCurrentResult('president',state.current?.scope==='br'||!state.current?'br':state.current.scope);
    } else if(state.officeView==='governor') await refreshCurrentResult('governor',state.selectedUf);
    else if(state.officeView==='senator') await refreshCurrentResult('senator',state.selectedUf);
    else if(state.officeView==='federalDeputy') await loadChamber(state.selectedUf);
    else if(state.officeView==='international') await loadInternational();
  } catch(err){handleError(err,false)} finally{state.refreshBusy=false}
}

async function refreshBackground(){
  if(state.officeView==='president') await refreshSnapshot('president',true);
  else if(state.officeView==='governor') await refreshSnapshot('governor',true);
  else if(state.officeView==='senator') await refreshSnapshot('senator',true);
}

function setupEvents(){
  els.officeTabs.forEach(b=>b.addEventListener('click',()=>switchOffice(b.dataset.officeView)));
  els.subtabs.forEach(b=>b.addEventListener('click',()=>{
    state.subview=b.dataset.subview;
    localStorage.setItem('apura26:v2:subview', state.subview);
    configureView();
    if(state.subview==='municipios'&&!state.municipalConfig) loadMunicipalityConfig();
  }));
  els.scopeSelect.addEventListener('change',()=>{ const v=els.scopeSelect.value; if(v==='br'&&state.officeView==='president') resetPresidentScope(); else selectState(v); });
  els.candidateMapSelect.addEventListener('change',()=>{state.mapCandidateId=els.candidateMapSelect.value;renderMap()});
  els.resetScopeBtn.addEventListener('click',resetPresidentScope);
  els.municipalityUf.addEventListener('change',()=>populateMunicipalityList(els.municipalityUf.value));
  els.loadMunicipalityBtn.addEventListener('click',loadSelectedMunicipality);
  els.chamberUf.addEventListener('change',()=>loadChamber(els.chamberUf.value));
  els.foreignSearch.addEventListener('input',()=>renderForeignLocations(els.foreignSearch.value));
  els.refreshNowBtn.addEventListener('click',async()=>{setLive('loading','Atualizando');await refreshActive();await refreshBackground();toast('Atualização concluída','Dados consultados novamente no TSE.','success')});
  els.themeBtn.addEventListener('click',toggleTheme);
  els.fullscreenBtn.addEventListener('click',toggleFullscreen);
  els.shareBtn.addEventListener('click',shareApp);
  els.autoRotateBtn.addEventListener('click',toggleAutoRotate);
  els.globalSearch.addEventListener('input',renderSearch);
  els.globalSearch.addEventListener('focus',renderSearch);
  document.addEventListener('click',e=>{if(!e.target.closest('.top-search'))els.searchResults.hidden=true});
  document.addEventListener('keydown',e=>{if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='k'){e.preventDefault();els.globalSearch.focus()} if(e.key==='Escape')els.searchResults.hidden=true});
  document.addEventListener('fullscreenchange',()=>document.body.classList.toggle('tv-mode',!!document.fullscreenElement));
  $('[data-action="home"]')?.addEventListener('click',e=>{e.preventDefault();switchOffice('president')});
}

function renderSearch(){
  const q=normalizeText(els.globalSearch.value); if(!q){els.searchResults.hidden=true;return}
  const results=[];
  STATES.forEach(([uf,name])=>{if(normalizeText(name).includes(q)||uf.includes(q))results.push({type:'state',label:name,meta:uf.toUpperCase(),uf})});
  (state.current?.candidates||[]).forEach(c=>{if(normalizeText(c.name).includes(q)||normalizeText(c.party).includes(q)||String(c.number).includes(q))results.push({type:'candidate',label:c.name,meta:`${c.party} ${c.number}`,candidate:c})});
  if(state.municipalConfig){ for(const [uf,scope] of Object.entries(state.municipalConfig.scopes)){ if(uf==='zz')continue; for(const m of scope.municipalities){ if(results.length>20)break; if(normalizeText(m.name).includes(q))results.push({type:'municipality',label:m.name,meta:uf.toUpperCase(),uf,m}) } } }
  const shown=results.slice(0,9); els.searchResults.hidden=!shown.length; els.searchResults.innerHTML=shown.map((r,i)=>`<button class="search-item" data-search-index="${i}"><span>${escapeHtml(r.label)}</span><small>${escapeHtml(r.meta)}</small></button>`).join('');
  $$('[data-search-index]',els.searchResults).forEach(btn=>btn.addEventListener('click',async()=>{const r=shown[Number(btn.dataset.searchIndex)];els.searchResults.hidden=true;els.globalSearch.value='';if(r.type==='state')await selectState(r.uf);else if(r.type==='candidate'){state.subview='candidato';localStorage.setItem('apura26:v2:subview','candidato');configureView();renderMap()}else if(r.type==='municipality'){state.officeView='president';state.subview='municipios';configureView();els.municipalityUf.value=r.uf;populateMunicipalityList(r.uf);els.municipalitySelect.value=r.m.code;await loadSelectedMunicipality()}}));
}

function toggleTheme(){ const root=document.documentElement; const next=root.dataset.theme==='dark'?'light':'dark';root.dataset.theme=next;localStorage.setItem('apura26:theme',next);renderMap(); }
async function toggleFullscreen(){ try{if(!document.fullscreenElement)await document.documentElement.requestFullscreen();else await document.exitFullscreen()}catch{} }
async function shareApp(){ const data={title:'APURA 26',text:'Acompanhe a apuração das Eleições 2026 no APURA 26.',url:location.href}; try{if(navigator.share)await navigator.share(data);else{await navigator.clipboard.writeText(location.href);toast('Link copiado','Compartilhe o APURA 26 com seus amigos.','success')}}catch{} }
function toggleAutoRotate(){ toast('Visão fixa','A atualização automática mantém a aba atual. Troque de cargo somente quando quiser.','success'); }

function restoreTheme(){ document.documentElement.dataset.theme=localStorage.getItem('apura26:theme')||'dark'; }

async function init(){
  restoreTheme(); populateStateSelects(); setupEvents(); renderUpdates(); configureView();
  loadGeo(); loadMunicipalityConfig();
  try{
    // Restaura exatamente a última aba escolhida. Atualizações nunca trocam de cargo.
    await switchOffice(state.officeView,{silent:true});
  } catch(err){
    handleError(err);
    els.candidateGrid.innerHTML='<div class="update-empty" style="grid-column:1/-1"><strong>Aguardando o TSE</strong><p>Se você abriu pelo arquivo local, use o iniciar.bat ou publique no GitHub Pages para evitar bloqueios de CORS.</p></div>';
  }
  // Presidente e Exterior continuam sendo carregados em segundo plano para os painéis comparativos.
  if(state.officeView!=='president') refreshSnapshot('president');
  try{state.foreignTotal=await getResult('president','zz'); if(state.officeView==='president') renderRegions()}catch{}
  setInterval(refreshActive,10000);
  setInterval(refreshBackground,60000);
}

init();
