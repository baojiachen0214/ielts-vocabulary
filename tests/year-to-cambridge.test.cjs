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
get(`data=freshData();data.confirmedFresh=true;data.settings.autoPlay=false;var annualKeys=new Set(YEAR_BANK_KEYS.flatMap(k=>WORDS_DATA[k].map(w=>learningKey(w.w))));for(const k of YEAR_BANK_KEYS)data.legacy.progress[k]={done:WORDS_DATA[k].map(w=>w.w)};persist();libraryScope='untouched';libraryLimit=50;showView('dashboard');`);
const oldKeys=new Set(get('[...annualKeys]')),newKeys=new Set();assert.equal(oldKeys.size,1117);
for(const key of ['Cambridge_Part1','Cambridge_Part4']){
 let rounds=0;
 while(true){
  get(`data.session=null;librarySelection=${JSON.stringify(key)};libraryScope='untouched';showView('dashboard')`);
  if(d.querySelector('#library-start').disabled)break;
  d.querySelector('#library-start').click();
  while(get('data.session.index<data.session.items.length')){
   const current=get('learningKey(currentWord().id)');assert(!oldKeys.has(current),`annual word repeated in ${key}: ${current}`);assert(!newKeys.has(current),`Cambridge word repeated: ${current}`);newKeys.add(current);
   d.querySelector('#answer-input').value=get('currentWord().w');submit();submit();
  }
  assert(++rounds<30);
 }
}
assert.equal(newKeys.size,461);assert.equal(get('allStats().uniqueLearned.size'),1578);
// The whole word list may include intentional repeats, but the next bank always defaults to unseen.
get(`data.session=null;librarySelection='All_Years';libraryScope='all';showView('dashboard')`);assert.equal(d.querySelector('#library-start').textContent,'开始重练');assert.match(d.querySelector('#library-start-info').textContent,/重练模式/);
const radio=d.querySelector('input[name="library-bank"][value="Cambridge_Part1"]');radio.checked=true;radio.dispatchEvent(new w.Event('change',{bubbles:true}));assert.equal(get('libraryScope'),'untouched');assert(d.querySelector('#only-unseen').checked);assert(d.querySelector('#library-start').disabled);
// Check all ordinary recorded annual attempts too, rather than relying on legacy done arrays alone.
get(`data=freshData();data.confirmedFresh=true;data.settings.autoPlay=false;var yearWords=uniqueLearningWords([...records.values()].filter(w=>w.sets.some(k=>YEAR_BANK_KEYS.includes(k))));for(const word of yearWords)data.attempts.push({id:uid(),sessionId:'year-run',word:word.id,mode:'listen',ts:Date.now(),localDay:localDay(),correct:true,input:word.w,assisted:false,setKeys:word.sets.filter(k=>YEAR_BANK_KEYS.includes(k))});persist();librarySelection='Cambridge_Part4';libraryScope='untouched';showView('dashboard');startPractice('listen')`);assert.equal(get('data.session.items.some(item=>annualKeys.has(learningKey(item.word)))'),false);
// Update checks are read-only; they only show a notice and never reload or change progress.
const before=get('JSON.stringify(data)');w.fetch=async()=>({ok:true,json:async()=>({version:'2027.01.01.1'})});await get('checkForPageUpdate(true)');assert.equal(d.querySelector('#app-update-notice').hidden,false);assert.equal(get('JSON.stringify(data)'),before);assert.equal(get('isNewerPageVersion("2026.10.16.1")'),false);assert.equal(get('isNewerPageVersion(APP_VERSION)'),false);assert.equal(get('isNewerPageVersion("garbage")'),false);assert.equal(JSON.parse(fs.readFileSync(require('node:path').join(__dirname,'..','version.json'),'utf8')).version,get('APP_VERSION'));
assert.equal(errors.length,0);
console.log('PASS full annual corpus (1117 learning words) then both Cambridge banks: exactly 461 new words, zero annual or cross-Cambridge repeats.');
console.log('PASS both legacy and event history, bank-switch unseen default, explicit repeat labeling and read-only update notice.');
}finally{await new Promise(r=>setTimeout(r,0));dom.window.close();}})().catch(e=>{console.error(e);process.exitCode=1});
