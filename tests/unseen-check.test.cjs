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
get(`data=freshData();data.confirmedFresh=true;data.settings.autoPlay=false;var list=bankWords('All_Complete');var prior=list.slice(0,4);data.attempts.push({id:'spell-only',word:prior[0].id,mode:'spell',sessionId:'s',ts:Date.now(),localDay:localDay(),input:prior[0].w,correct:true,assisted:false,setKeys:[]});data.legacy.wrongBook[prior[1].id]={count:2,wordData:prior[1]};data.legacy.progress['old-bank-name']={done:[prior[2].id]};data.legacy.progress.All_Complete={done:[prior[3].id]};librarySelection='All_Complete';libraryScope='untouched';showView('dashboard');`);
assert.equal(get('allStats().uniqueDone.size'),4);
get('startPractice("listen")');assert.equal(get('data.session.items.some(item=>prior.some(w=>w.id===item.word))'),false);
assert.equal(get('allStats().total'),1);assert.equal(get('allStats().modes.spell.total'),1);assert.equal(get('allStats().modes.listen.total'),0);
get(`data.session=null;data=validateV2(JSON.parse(JSON.stringify(data)));showView('dashboard')`);assert.equal(get('allStats().uniqueDone.size'),4);
// Selecting a completed bank must preserve the user's untouched-only preference.
get(`data.legacy.progress.completed={done:bankWords('All_Part1').map(w=>w.id)};libraryScope='untouched';showView('dashboard')`);
const bank=d.querySelector('input[name="library-bank"][value="All_Part1"]');bank.checked=true;bank.dispatchEvent(new w.Event('change',{bubbles:true}));assert.equal(get('libraryScope'),'untouched');assert(d.querySelector('#only-unseen').checked);assert(d.querySelector('#library-start').disabled);
// Explicitly opting into repetition still works, without changing modes automatically.
d.querySelector('#only-unseen').checked=false;d.querySelector('#only-unseen').dispatchEvent(new w.Event('change',{bubbles:true}));assert.equal(get('libraryScope'),'all');assert(!d.querySelector('#library-start').disabled);
assert.equal(errors.length,0);console.log('PASS spell-only, legacy wrong words, renamed and aggregate legacy progress all count as practiced after reload.');console.log('PASS completed bank never silently disables untouched-only; explicit repeat works; actual answer totals remain unchanged.');
}finally{await new Promise(r=>setTimeout(r,0));dom.window.close();}})().catch(e=>{console.error(e);process.exitCode=1});
