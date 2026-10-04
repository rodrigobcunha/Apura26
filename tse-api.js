/*
 * APURA 26 — Cliente de dados eleitorais TSE (EA12 / EA20)
 * Criado por Rodrigo Bahiense — 2026
 *
 * Fonte oficial: https://resultados.tse.jus.br/oficial/ele2026/
 * Layout EA20 2026: carg[].agr[].par[].cand[], s{}, e{}, v{}
 */

export const STATES = [
  ['ac','Acre','Norte'], ['al','Alagoas','Nordeste'], ['ap','Amapá','Norte'], ['am','Amazonas','Norte'],
  ['ba','Bahia','Nordeste'], ['ce','Ceará','Nordeste'], ['df','Distrito Federal','Centro-Oeste'],
  ['es','Espírito Santo','Sudeste'], ['go','Goiás','Centro-Oeste'], ['ma','Maranhão','Nordeste'],
  ['mt','Mato Grosso','Centro-Oeste'], ['ms','Mato Grosso do Sul','Centro-Oeste'], ['mg','Minas Gerais','Sudeste'],
  ['pa','Pará','Norte'], ['pb','Paraíba','Nordeste'], ['pr','Paraná','Sul'], ['pe','Pernambuco','Nordeste'],
  ['pi','Piauí','Nordeste'], ['rj','Rio de Janeiro','Sudeste'], ['rn','Rio Grande do Norte','Nordeste'],
  ['rs','Rio Grande do Sul','Sul'], ['ro','Rondônia','Norte'], ['rr','Roraima','Norte'],
  ['sc','Santa Catarina','Sul'], ['sp','São Paulo','Sudeste'], ['se','Sergipe','Nordeste'], ['to','Tocantins','Norte']
];

export const REGIONS = {
  'Norte': ['ac','ap','am','pa','ro','rr','to'],
  'Nordeste': ['al','ba','ce','ma','pb','pe','pi','rn','se'],
  'Centro-Oeste': ['df','go','mt','ms'],
  'Sudeste': ['es','mg','rj','sp'],
  'Sul': ['pr','rs','sc']
};

export const OFFICES = {
  president: { label:'Presidente', fullLabel:'Presidente da República', code:1, election:6257, federal:true },
  governor: { label:'Governadores', fullLabel:'Governador', code:3, election:6259 },
  senator: { label:'Senado', fullLabel:'Senador', code:5, election:6259, seats:2 },
  federalDeputy: { label:'Câmara', fullLabel:'Deputado Federal', code:6, election:6259, proportional:true },
  stateDeputy: { label:'Deputado Estadual', fullLabel:'Deputado Estadual', code:7, election:6259, proportional:true },
  districtDeputy: { label:'Deputado Distrital', fullLabel:'Deputado Distrital', code:8, election:6259, proportional:true }
};

// Cores de identidade partidária usadas apenas como apoio visual.
// Quando não houver cor cadastrada, uma cor estável é derivada da sigla.
export const PARTY_COLORS = {
  PT:'#d51f26', PL:'#1f5fbf', PSD:'#2d5aa6', MDB:'#16935f', PP:'#195dab',
  UNIÃO:'#1db7b7', UNIAO:'#1db7b7', REPUBLICANOS:'#0d5ca8', PDT:'#e13a34',
  PSB:'#d93232', PSOL:'#f28a23', NOVO:'#f47b20', CIDADANIA:'#f37021', PCdoB:'#cc2027',
  PV:'#159447', REDE:'#19a463', AVANTE:'#2870c5', SOLIDARIEDADE:'#f39b25', PRD:'#3157a4',
  DC:'#264796', AGIR:'#2471b6', PMB:'#8f2a55', PCO:'#ca2632', PSTU:'#df2730', UP:'#7f2528',
  MOBILIZA:'#16887f', PODE:'#25a6a1', PSDB:'#2872b7'
};

const BASE = 'https://resultados.tse.jus.br/oficial/ele2026';
const TIMEOUT = 14000;
const ELECTION_PAD = n => String(n).padStart(6,'0');
const OFFICE_PAD = n => String(n).padStart(4,'0');

export function toNumber(value) {
  if (value === null || value === undefined || value === '') return 0;
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  const s = String(value).trim().replace(/\s/g,'');
  // Percentuais do TSE chegam com vírgula decimal; inteiros podem vir como string simples.
  const normalized = s.includes(',') ? s.replace(/\./g,'').replace(',','.') : s;
  const n = Number(normalized.replace(/[^0-9.-]/g,''));
  return Number.isFinite(n) ? n : 0;
}

export const toPercent = v => Math.max(0, Math.min(100, toNumber(v)));

function hashColor(input) {
  const palette = ['#36a7ff','#8b5cf6','#14b8a6','#f59e0b','#ec4899','#22c55e','#06b6d4','#a855f7','#f97316','#64748b','#ef4444','#84cc16'];
  let hash = 0;
  for (const ch of String(input || '')) hash = ((hash << 5) - hash) + ch.charCodeAt(0);
  return palette[Math.abs(hash) % palette.length];
}

export function partyColor(party) {
  const key = String(party || '').trim();
  return PARTY_COLORS[key] || PARTY_COLORS[key.toUpperCase()] || hashColor(key || 'SEM');
}

export function stateMeta(uf) {
  const found = STATES.find(([code]) => code === String(uf).toLowerCase());
  return found ? { uf:found[0], name:found[1], region:found[2] } : { uf:String(uf).toLowerCase(), name:String(uf).toUpperCase(), region:'' };
}

export function buildResultUrl(officeKey='president', scope='br', municipalityCode=null) {
  const office = OFFICES[officeKey];
  if (!office) throw new Error(`Cargo inválido: ${officeKey}`);
  const uf = String(scope).toLowerCase();
  const election = ELECTION_PAD(office.election);
  const officeCode = OFFICE_PAD(office.code);
  const prefix = municipalityCode ? `${uf}${String(municipalityCode).padStart(5,'0')}` : uf;
  return `${BASE}/${office.election}/dados/${uf}/${prefix}-c${officeCode}-e${election}-u.json`;
}

export function buildMunicipalitiesUrl(election=6257) {
  return `${BASE}/${election}/config/mun-e${ELECTION_PAD(election)}-cm.json`;
}

export function buildPhotoUrl(candidate, officeKey='president', scope='br') {
  const office = OFFICES[officeKey];
  if (!candidate?.sqcand || !office) return '';
  // Presidente usa o conjunto nacional; os demais cargos usam a UF.
  const photoScope = office.federal ? 'br' : String(scope).toLowerCase();
  return `${BASE}/${office.election}/fotos/${photoScope}/${candidate.sqcand}.jpeg`;
}

async function fetchJson(url, {timeout=TIMEOUT}={}) {
  // Cache-buster deliberado: o navegador pode ignorar o cache local com cache:'no-store',
  // mas a CDN intermediária ainda pode servir uma representação antiga para a mesma URL.
  // Uma query única mantém o APURA 26 acompanhando o arquivo mais recente publicado pelo TSE.
  const freshUrl = `${url}${url.includes('?') ? '&' : '?'}_apura26=${Date.now()}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  try {
    const res = await fetch(freshUrl, { cache:'no-store', mode:'cors', headers:{'Accept':'application/json'}, signal:controller.signal });
    if (!res.ok) throw new Error(`TSE respondeu HTTP ${res.status}`);
    return await res.json();
  } catch (err) {
    if (err?.name === 'AbortError') throw new Error('Tempo limite ao consultar o TSE');
    throw err;
  } finally { clearTimeout(timer); }
}

function flattenCandidates(cargo) {
  const rows = [];
  const partySeats = new Map();
  const aggregations = Array.isArray(cargo?.agr) ? cargo.agr : [];

  for (const agr of aggregations) {
    const parties = Array.isArray(agr?.par) ? agr.par : [];
    for (const par of parties) {
      const party = String(par?.sg || par?.nm || '—').trim();
      const seats = toNumber(par?.vag);
      const previous = partySeats.get(party) || {party, name:par?.nm || party, seats:0, votes:0, color:partyColor(party)};
      previous.seats += seats;
      previous.votes += toNumber(par?.tvtn) + toNumber(par?.tvtl);
      partySeats.set(party, previous);

      const candidates = Array.isArray(par?.cand) ? par.cand : [];
      for (const c of candidates) {
        rows.push({
          seq: toNumber(c?.seq),
          sqcand: String(c?.sqcand ?? ''),
          number: String(c?.n ?? ''),
          name: String(c?.nmu || c?.nm || 'Candidato'),
          fullName: String(c?.nm || c?.nmu || 'Candidato'),
          party,
          partyName: String(par?.nm || party),
          coalition: String(agr?.com || agr?.nm || ''),
          aggregationType: String(agr?.tp || ''),
          votes: toNumber(c?.vap),
          percent: toPercent(c?.pvap),
          elected: String(c?.e || '').toLowerCase() === 's',
          status: String(c?.st || ''),
          destination: String(c?.dvt || ''),
          color: partyColor(party),
          viceOrSubstitutes: Array.isArray(c?.vs) ? c.vs : []
        });
      }
    }
  }

  rows.sort((a,b) => b.votes - a.votes || b.percent - a.percent || a.seq - b.seq || a.name.localeCompare(b.name,'pt-BR'));
  return { candidates:rows, partySeats:[...partySeats.values()].sort((a,b)=>b.seats-a.seats || b.votes-a.votes) };
}

export function normalizeResult(raw, officeKey='president', scope='br', municipalityCode=null) {
  const office = OFFICES[officeKey];
  const cargos = Array.isArray(raw?.carg) ? raw.carg : [];
  const cargo = cargos.find(c => toNumber(c?.cd) === office.code) || cargos[0] || {};
  const { candidates, partySeats } = flattenCandidates(cargo);

  const sections = raw?.s || {};
  const voters = raw?.e || {};
  const votes = raw?.v || {};
  const totalSections = toNumber(sections.ts);
  const doneSections = toNumber(sections.st);
  const progress = sections.pst !== undefined ? toPercent(sections.pst) : (totalSections ? doneSections / totalSections * 100 : 0);

  return {
    raw,
    officeKey,
    officeLabel: office.fullLabel,
    scope:String(scope).toLowerCase(),
    municipalityCode: municipalityCode ? String(municipalityCode).padStart(5,'0') : null,
    election:office.election,
    phase:String(raw?.f || ''),
    canPublishVotes:String(raw?.dv || '').toLowerCase() !== 'n',
    date:String(raw?.dt || raw?.dg || ''),
    time:String(raw?.ht || raw?.hg || ''),
    generatedDate:String(raw?.dg || ''),
    generatedTime:String(raw?.hg || ''),
    generationId:raw?.idg,
    andamento:String(raw?.and || ''),
    final:String(raw?.tf || '').toLowerCase() === 's' || String(raw?.and || '').toLowerCase() === 'f',
    mathematicallyDefined:['e','s'].includes(String(raw?.md || '').toLowerCase()),
    progress,
    sectionsTotal:totalSections,
    sectionsDone:doneSections,
    sectionsPending:toNumber(sections.snt),
    sectionsInstalled:toNumber(sections.si),
    sectionsCounted:toNumber(sections.sa),
    electorate:toNumber(voters.te),
    attendance:toNumber(voters.c),
    attendancePercent:toPercent(voters.pc),
    abstention:toNumber(voters.a),
    abstentionPercent:toPercent(voters.pa),
    totalVotes:toNumber(votes.tv),
    computableVotes:toNumber(votes.vvc),
    validVotes:toNumber(votes.vv),
    validPercent:toPercent(votes.pvv),
    nominalVotes:toNumber(votes.vnom),
    legendVotes:toNumber(votes.vl),
    blankVotes:toNumber(votes.vb),
    blankPercent:toPercent(votes.pvb),
    nullVotes:toNumber(votes.tvn),
    nullPercent:toPercent(votes.ptvn),
    vacancies:toNumber(cargo?.nv),
    electoralQuotient:toNumber(cargo?.qe),
    candidates,
    partySeats,
    fetchedAt: Date.now()
  };
}

export async function getResult(officeKey='president', scope='br', municipalityCode=null) {
  const office = OFFICES[officeKey];
  if (!office) throw new Error('Cargo inválido');
  const uf = String(scope).toLowerCase();
  if (!office.federal && !municipalityCode && (uf === 'br' || uf === 'zz')) throw new Error(`${office.fullLabel} exige uma UF.`);
  if (officeKey === 'districtDeputy' && uf !== 'df') throw new Error('Deputado Distrital está disponível apenas no DF.');
  const raw = await fetchJson(buildResultUrl(officeKey, uf, municipalityCode));
  return normalizeResult(raw, officeKey, uf, municipalityCode);
}

export async function getMunicipalities(election=6257) {
  const raw = await fetchJson(buildMunicipalitiesUrl(election));
  const out = {};
  for (const abr of (Array.isArray(raw?.abr) ? raw.abr : [])) {
    const uf = String(abr?.cd || '').toLowerCase();
    out[uf] = {
      uf,
      name:String(abr?.ds || uf.toUpperCase()),
      municipalities:(Array.isArray(abr?.mu) ? abr.mu : []).map(mu => ({
        code:String(mu?.cd ?? '').padStart(5,'0'),
        ibge:String(mu?.cdi ?? '').padStart(5,'0'),
        name:String(mu?.nm || ''),
        capital:String(mu?.c || '').toLowerCase() === 's',
        zones:Array.isArray(mu?.z) ? mu.z : []
      })).sort((a,b)=>a.name.localeCompare(b.name,'pt-BR'))
    };
  }
  return { raw, generated:`${raw?.dg || ''} ${raw?.hg || ''}`.trim(), scopes:out };
}

export async function getStateSnapshot(officeKey='president', {batchSize=6, delayMs=90, onBatch=null}={}) {
  const states = {};
  for (let i=0; i<STATES.length; i+=batchSize) {
    const batch = STATES.slice(i,i+batchSize);
    const result = await Promise.all(batch.map(async ([uf,name,region]) => {
      try {
        const data = await getResult(officeKey, uf);
        return [uf,{uf,name,region,data,leader:data.candidates[0] || null,runnerUp:data.candidates[1] || null}];
      } catch (error) {
        return [uf,{uf,name,region,data:null,leader:null,runnerUp:null,error:error.message}];
      }
    }));
    Object.assign(states,Object.fromEntries(result));
    if (typeof onBatch === 'function') onBatch(states);
    if (i + batchSize < STATES.length) await new Promise(r=>setTimeout(r,delayMs));
  }
  return states;
}

export function aggregateRegions(snapshot) {
  const regions = {};
  for (const [region, ufs] of Object.entries(REGIONS)) {
    const votesByCandidate = new Map();
    let sectionsDone=0, sectionsTotal=0, validVotes=0;
    for (const uf of ufs) {
      const data = snapshot?.[uf]?.data;
      if (!data) continue;
      sectionsDone += data.sectionsDone;
      sectionsTotal += data.sectionsTotal;
      validVotes += data.validVotes;
      for (const c of data.candidates) {
        const key = c.sqcand || `${c.number}:${c.name}`;
        const cur = votesByCandidate.get(key) || {...c, votes:0};
        cur.votes += c.votes;
        votesByCandidate.set(key,cur);
      }
    }
    const ranking = [...votesByCandidate.values()].sort((a,b)=>b.votes-a.votes).map(c=>({...c, percent:validVotes ? c.votes/validVotes*100 : 0}));
    regions[region] = {
      region,
      progress:sectionsTotal ? sectionsDone/sectionsTotal*100 : 0,
      sectionsDone, sectionsTotal, validVotes,
      leader:ranking[0] || null,
      runnerUp:ranking[1] || null,
      candidates:ranking
    };
  }
  return regions;
}

export const TSE_META = {
  baseUrl:BASE,
  federalElection:6257,
  stateElection:6259,
  electionDate:'04/10/2026',
  round:1,
  source:'Tribunal Superior Eleitoral'
};
