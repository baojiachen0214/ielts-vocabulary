const {JSDOM,VirtualConsole}=require('jsdom'),fs=require('fs'),vm=require('vm'),assert=require('assert/strict');
const html=fs.readFileSync(require('node:path').join(__dirname,'..','index.html'),'utf8');
const code=[...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/g)].filter(m=>!m[1].includes('application/json')).map(m=>m[2]).join('\n');
const vc=new VirtualConsole(),errors=[];vc.on('jsdomError',e=>errors.push(e));const dom=new JSDOM(html,{url:'https://review.test/',runScripts:'outside-only',virtualConsole:vc}),w=dom.window,d=w.document;
w.scrollTo=()=>{};w.matchMedia=()=>({matches:true});w.confirm=()=>true;let time=Date.now();w.Date.now=()=>time;w.Audio=class extends w.EventTarget{constructor(){super();this.readyState=4;}load(){}pause(){}removeAttribute(){}play(){return Promise.resolve()}};
const get=c=>w.eval(c),submit=()=>d.querySelector('#answer-form').dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));
const change=(id,value)=>{const el=d.getElementById(id);el.value=String(value);el.dispatchEvent(new w.Event('change',{bubbles:true}));};
function finishBatch(){const ids=[];while(get('data.session.index<data.session.items.length')){ids.push(get('currentWord().id'));d.querySelector('#answer-input').value=ids.length%2?get('currentWord().w'):'xyzxyz';submit();time+=1001;submit();}return ids;}
(async()=>{try{
new vm.Script(code).runInContext(dom.getInternalVMContext());get(`data=freshData();data.confirmedFresh=true;data.settings.autoPlay=false;
const seed=[...records.values()].slice(0,45);for(let i=0;i<seed.length;i++){data.legacy.wrongBook[seed[i].id]={count:45-i,wordData:seed[i]};data.attempts.push({id:'seed-'+i,sessionId:'old',word:seed[i].id,mode:'listen',ts:Date.now()-86400000+i*100,localDay:localDay(Date.now()-86400000),input:'x',correct:false,assisted:false,setKeys:seed[i].sets});}persist();showView('wrong');`);
assert.equal(get('reviewCandidates().length'),45);assert.equal(d.querySelectorAll('.mistake-row').length,20);
d.querySelector('[data-start-mode="spell"]').click();const first=finishBatch();assert.equal(first.length,20);assert.match(d.querySelector('[data-action="review-next"]').textContent,/25/);
d.querySelector('[data-action="review-next"]').click();const second=finishBatch();assert.equal(second.length,20);assert.equal(first.filter(x=>second.includes(x)).length,0);
d.querySelector('[data-action="review-next"]').click();const third=finishBatch();assert.equal(third.length,5);assert.equal(new Set([...first,...second,...third]).size,45);
d.querySelector('[data-action="review-next"]').click();assert.equal(get('view'),'wrong');assert(d.querySelector('[data-start-mode="spell"]').disabled);assert.equal(get('reviewedToday().size'),45);assert.equal(get('reviewCandidates().length'),0);
// Existing stored attempts also exclude today's words after reconstruction, without new storage fields.
get('data=validateV2(JSON.parse(localStorage.getItem(STORE_KEY)));showView("wrong")');assert.equal(get('reviewCandidates().length'),0);
change('review-day','done');assert.equal(get('reviewCandidates().length'),45);change('review-limit',0);d.querySelector('[data-start-mode="spell"]').click();assert.equal(get('data.session.items.length'),45);finishBatch();d.querySelector('[data-action="review-next"]').click();assert.equal(get('reviewCandidates().length'),0);assert(d.querySelector('[data-action="restart-review"]'));d.querySelector('[data-action="restart-review"]').click();assert.equal(get('reviewCandidates().length'),45);
change('review-order','recent');const expected=get('[...allStats().wrongWords].sort((a,b)=>b.lastWrong-a.lastWrong)[0].id');d.querySelector('[data-start-mode="spell"]').click();assert.equal(get('data.session.items[0].word'),expected);
get('data.session=null;showView("wrong")');change('review-order','priority');d.querySelector('[data-start-mode="spell"]').click();assert.equal(get('data.session.items[0].word'),first[0]);
get('data.session=null;showView("wrong");Math.random=()=>0');change('review-order','random');d.querySelector('[data-start-mode="spell"]').click();assert.equal(get('data.session.items.length'),45);assert.notEqual(get('data.session.items[0].word'),first[0]);
get('data.session=null;showView("wrong")');change('review-day','pending');time+=86400000;get('renderWrong()');assert.equal(get('reviewCandidates().length'),45);
// Recently answered correctly must not displace the last actual error in recent-error order.
get(`data.attempts.push({id:'late-correct',sessionId:'later',word:${JSON.stringify(first[0])},mode:'listen',ts:Date.now()+10000,localDay:localDay(),input:'x',correct:true,assisted:false,setKeys:[]});`);
assert(get(`allStats().perWord.get(${JSON.stringify(first[0])}).lastWrong`) < get(`allStats().perWord.get(${JSON.stringify(first[0])}).last`));
assert.equal(errors.length,0);
console.log('PASS 45 words across 20 + 20 + 5 with no repeats, including wrong review answers; direct next-batch and remaining counts.');
console.log('PASS stored progress reload, next-day availability, explicit repeat pass without duplicate batches, and restart.');
console.log('PASS cumulative-error, actual latest-error, random ordering and all-remaining batch size.');
}finally{await new Promise(r=>setTimeout(r,0));dom.window.close();}})().catch(e=>{console.error(e);process.exitCode=1});
