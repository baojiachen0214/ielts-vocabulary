const {JSDOM,VirtualConsole}=require('jsdom'),fs=require('fs'),vm=require('vm'),assert=require('assert/strict');
const html=fs.readFileSync(require('node:path').join(__dirname,'..','index.html'),'utf8');
const code=[...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/g)].filter(m=>!m[1].includes('application/json')).map(m=>m[2]).join('\n');
const vc=new VirtualConsole(),errors=[];vc.on('jsdomError',e=>errors.push(e));const dom=new JSDOM(html,{url:'https://review.test/',runScripts:'outside-only',virtualConsole:vc}),w=dom.window,d=w.document;
w.scrollTo=()=>{};w.matchMedia=()=>({matches:true});w.confirm=()=>true;let time=Date.now();w.Date.now=()=>time;w.Audio=class extends w.EventTarget{constructor(){super();this.readyState=4;}load(){}pause(){}removeAttribute(){}play(){return Promise.resolve()}};
const get=c=>w.eval(c),submit=()=>d.querySelector('#answer-form').dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));
const change=(id,value)=>{const el=d.getElementById(id);el.value=String(value);el.dispatchEvent(new w.Event('change',{bubbles:true}));};
function finishBatch(){const ids=[];while(get('data.session.index<data.session.items.length')){ids.push(get('currentWord().id'));d.querySelector('#answer-input').value=ids.length%2?get('currentWord().w'):'xyzxyz';submit();time+=1001;submit();}return ids;}
(async()=>{try{
new vm.Script(code).runInContext(dom.getInternalVMContext());
get(`data=freshData();data.confirmedFresh=true;data.settings.autoPlay=false;
var shared=[...records.values()].find(w=>w.sets.some(k=>/^20/.test(k))&&w.sets.some(k=>k.startsWith('Cambridge_'))&&w.sets.length>=3);
var source=shared.sets.find(k=>/^20/.test(k));
var target=shared.sets.find(k=>k.startsWith('Cambridge_'));
data.attempts.push({id:'cross-bank',sessionId:'first',word:shared.id,mode:'listen',ts:Date.now(),localDay:localDay(),input:shared.w,correct:true,assisted:false,setKeys:[source]});`);
assert.equal(get('ORIGINAL_UNIQUE'),1588);
for(const key of get('shared.sets'))assert.equal(get(`allStats().progress[${JSON.stringify(key)}].has(shared.id)`),true);
assert.equal(get('allStats().uniqueDone.size'),1);assert.equal(get('allStats().total'),1);assert.equal(get('allStats().correct'),1);
assert.equal(get('allStats().modes.listen.total'),1);assert.equal(get('allStats().completed'),get('shared.sets.length'));
const raw=get('JSON.stringify(data)');get('allStats();renderDashboard()');assert.equal(get('JSON.stringify(data)'),raw);
// Visible totals and bank bars match the synchronized calculation, including aggregate views.
assert.equal(d.querySelector('.library-total-track').getAttribute('aria-valuenow'),'1');
for(const key of get("['All_Part1','All_Part4',...shared.sets]")){
const expected=get(`bankWords(${JSON.stringify(key)}).some(w=>w.id===shared.id)?1:0`);
const radio=d.querySelector(`input[name="library-bank"][value="${key}"]`);
assert.equal(Number(radio.closest('.library-row').querySelector('.library-count b').textContent),expected);
}
get('librarySelection=target;libraryScope="untouched";renderDashboard();startPractice("listen")');
assert.equal(get('data.session.items.some(item=>item.word===shared.id)'),false);
// Repeating in another bank increments answer totals, while the unique word count stays at one.
get(`data.session=null;data.attempts.push({...data.attempts[0],id:'again',setKeys:[target],correct:false});`);
assert.equal(get('allStats().uniqueDone.size'),1);assert.equal(get('allStats().total'),2);assert.equal(get('allStats().wrong'),1);
// Already-saved single-bank history synchronizes after a save/import round trip.
get('data=validateV2(JSON.parse(JSON.stringify(data)))');
for(const key of get('shared.sets'))assert(get(`allStats().progress[${JSON.stringify(key)}].has(shared.id)`));
// Legacy per-bank done lists synchronize too. Case/whitespace normalize consistently.
get(`data=freshData();data.confirmedFresh=true;data.settings.autoPlay=false;data.legacy.progress[source]={done:['  '+shared.w.toUpperCase()+'  ']};`);
assert.equal(get('allStats().uniqueDone.size'),1);
for(const key of get('shared.sets'))assert(get(`allStats().progress[${JSON.stringify(key)}].has(shared.id)`));
// Invalid legacy entries and words outside the published banks cannot inflate the denominator.
get(`data.legacy.progress[source].done.push('not-in-this-corpus');data.attempts.push({id:'unknown',word:'not-in-this-corpus',sessionId:'x',mode:'listen',ts:Date.now(),localDay:localDay(),input:'x',correct:false,assisted:false,setKeys:[]});`);
assert.equal(get('allStats().uniqueDone.size'),1);
// Identical spelling across Parts also propagates. Similar/different spellings remain separate.
get(`data=freshData();var crossPart=[...records.values()].find(w=>w.sets.some(k=>k.endsWith('Part1'))&&w.sets.some(k=>k.endsWith('Part4')));data.legacy.progress[crossPart.sets[0]]={done:[crossPart.id]};`);
for(const key of get('crossPart.sets'))assert(get(`allStats().progress[${JSON.stringify(key)}].has(crossPart.id)`));
assert.equal(get('allStats().uniqueDone.size'),1);
assert.equal(errors.length,0);
console.log('PASS global total is 1588; shared spelling synchronizes across years, Parts, Cambridge and aggregate progress bars.');
console.log('PASS unpracticed queue excludes shared words; repeated answers count once toward vocabulary coverage and separately toward attempt statistics.');
console.log('PASS existing history, legacy done lists and save/import round trips synchronize without rewriting data; unrelated entries do not inflate coverage.');
}finally{await new Promise(r=>setTimeout(r,0));dom.window.close();}})().catch(e=>{console.error(e);process.exitCode=1});
