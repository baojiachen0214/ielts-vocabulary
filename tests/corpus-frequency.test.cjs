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
get(`data.confirmedFresh=true;data.settings.autoPlay=false;var shared=[...records.values()].find(w=>w.sets.some(k=>k.startsWith('20'))&&w.sources.length);var expected=Object.keys(WORDS_DATA).reduce((n,k)=>n+(BANK_INDEX.get(k)?.get(shared.id)?.f||0),0);showView('wrong');startPractice('spell',shared.id);`);
assert.equal(d.querySelector('.word-corpus-frequency').textContent,`词库累计出现 ${get('expected')} 次`);
assert.equal(get('corpusFrequencyCounts(shared).total'),get('shared.frequency'));
// Raw f values, rather than number of banks, determine the result.
get(`var highFrequency=[...records.values()].find(w=>w.frequency>w.sets.length);var raw=highFrequency.sets.reduce((n,k)=>n+BANK_INDEX.get(k).get(highFrequency.id).f,0);`);
assert.equal(get('corpusFrequencyCounts(highFrequency).total'),get('raw'));assert(get('raw>highFrequency.sets.length'));
// Additional virtual views and redundant source metadata cannot inflate the total.
get(`AGGREGATE_BANKS.AnotherView=Object.keys(WORDS_DATA);var copy={...shared,sources:[...shared.sources,...shared.sources]};`);
assert.equal(get('corpusFrequencyCounts(copy).total'),get('expected'));
assert.equal(get('wordCorpusFrequency({id:"unknown",sources:[{paperId:"999"}]})'),'');
get('data.session.items[0].setKeys=[shared.sets[0]];renderPractice()');assert.equal(d.querySelector('.word-corpus-frequency').textContent,`词库累计出现 ${get('expected')} 次`);assert.match(d.querySelector('.practice-sources ul').textContent,/按原始频次字段累计/);assert.equal(errors.length,0);
console.log('PASS full-corpus total sums original f fields, never bank membership count; virtual views and source duplication do not inflate it.');
console.log('PASS combined frequency is global, shows its breakdown and omits unavailable counts.');
}finally{await new Promise(r=>setTimeout(r,0));dom.window.close();}})().catch(e=>{console.error(e);process.exitCode=1});
