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
get(`data=freshData();data.confirmedFresh=true;data.settings.autoPlay=false;var sample=[...records.values()].slice(0,6);
function seedError(i,ago,correct=false){const ts=Date.now()-ago*DAY;data.attempts.push({id:uid(),sessionId:'seed',word:sample[i].id,mode:'listen',ts,localDay:localDay(ts),input:'x',correct,assisted:false,setKeys:sample[i].sets});}
seedError(0,0);seedError(0,10);seedError(0,40);seedError(1,6);seedError(1,7);seedError(2,29);seedError(3,30);data.legacy.wrongBook[sample[4].id]={count:8,wordData:sample[4]};seedError(5,40);seedError(5,0,true);showView('wrong');`);
const ids=()=>Array.from(get('reviewCandidates().map(w=>w.id)'));
const sample=Array.from(get('sample.map(w=>w.id)'));
assert.equal(ids().length,6);
change('review-min-errors',3);assert.deepEqual(new Set(ids()),new Set([sample[0],sample[4]]));
change('review-period','week');assert.deepEqual(ids(),[sample[0]]);
change('review-min-errors',1);assert.deepEqual(new Set(ids()),new Set([sample[0],sample[1]]));
change('review-period','month');assert.deepEqual(new Set(ids()),new Set([sample[0],sample[1],sample[2]]));
change('review-period','older');assert.deepEqual(new Set(ids()),new Set([sample[0],sample[3],sample[5]]));
change('review-period','today');assert.deepEqual(ids(),[sample[0]]); // Recent correct answer is never an error.
change('review-period','unknown');assert.deepEqual(ids(),[sample[4]]);
change('review-period','custom');const oldDay=get('localDay(Date.now()-40*DAY)');change('review-from',oldDay);change('review-to',oldDay);assert.deepEqual(new Set(ids()),new Set([sample[0],sample[5]])); // Include earlier errors even if the same word failed again today.
change('review-min-errors',3);assert.deepEqual(ids(),[sample[0]]);d.querySelector('[data-start-mode="spell"]').click();assert.equal(get('data.session.items.length'),1);assert.equal(get('data.session.items[0].word'),sample[0]);d.querySelector('#answer-input').value=get('currentWord().w');submit();time+=1001;submit();assert.equal(get('reviewCandidates().length'),0);
get('showView("wrong")');change('review-day','done');assert.deepEqual(ids(),[sample[0]]);
// Reversed ranges show a useful explanation and never start an unrelated queue.
change('review-from',get('localDay()'));assert.equal(ids().length,0);assert.match(d.querySelector('#view-wrong').textContent,/起始日期不能晚于结束日期/);assert(d.querySelector('[data-start-mode="spell"]').disabled);
d.querySelector('[data-action="clear-review-filters"]').click();assert.equal(get('wrongFilter.period'),'all');assert.equal(get('wrongFilter.minErrors'),1);
change('review-day','pending');const dateButton=d.querySelector('[data-error-date]');const date=dateButton.dataset.errorDate;dateButton.click();assert.equal(get('wrongFilter.from'),date);assert.equal(get('wrongFilter.to'),date);assert.equal(get('wrongFilter.period'),'custom');
get('data=validateV2(JSON.parse(JSON.stringify(data)))');assert.equal(get(`allStats().perWord.get(${JSON.stringify(sample[0])}).wrongDays[localDay(Date.now()-40*DAY)]`),1);
assert.equal(errors.length,0);
console.log('PASS error-count thresholds combine with date filters; 7/30-day inclusive boundaries, older records and unknown legacy dates.');
console.log('PASS exact dates include any historical error, never correct attempts; session membership matches filters and daily skip still applies.');
console.log('PASS invalid dates, clearing filters, clickable dates and saved history reconstruction.');
}finally{await new Promise(r=>setTimeout(r,0));dom.window.close();}})().catch(e=>{console.error(e);process.exitCode=1});
