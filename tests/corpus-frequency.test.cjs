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
get(`data.confirmedFresh=true;data.settings.autoPlay=false;var shared=[...records.values()].find(w=>w.sets.some(k=>k.startsWith('20'))&&w.sources.length);var expected=YEAR_BANK_KEYS.reduce((n,k)=>n+(BANK_INDEX.get(k)?.get(shared.id)?.f||0),0);var papers=new Set(shared.sources.map(s=>s.paperId)).size;showView('wrong');startPractice('spell',shared.id);`);
assert.match(d.querySelector('.word-corpus-frequency').textContent,new RegExp(`年份词表累计 ${get('expected')} 次`));assert.match(d.querySelector('.word-corpus-frequency').textContent,new RegExp(`剑桥 ${get('papers')} 套`));
get(`var synthetic={id:'test-only',sources:[{paperId:'1',part:1,question:1},{paperId:'1',part:4,question:40},{paperId:'2',part:4,question:35}]};`);assert.match(get('wordCorpusFrequency(synthetic)'),/剑桥 2 套/);assert.equal(get('wordCorpusFrequency({id:"unknown",sources:[]})'),'');
get('data.session.items[0].setKeys=[shared.sets[0]];renderPractice()');assert.match(d.querySelector('.word-corpus-frequency').textContent,new RegExp(`年份词表累计 ${get('expected')} 次`));assert.equal(errors.length,0);
console.log('PASS global year frequency and deduplicated paper counts, independent of selected bank; no unknown counts fabricated.');
}finally{await new Promise(r=>setTimeout(r,0));dom.window.close();}})().catch(e=>{console.error(e);process.exitCode=1});
