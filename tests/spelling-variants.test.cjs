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
const reset=()=>get(`localStorage.clear();lastSaved='';data=freshData();data.confirmedFresh=true;data.settings.autoPlay=false;wrongFilter={search:'',status:'active',sort:'errors',day:'pending',limit:20,minErrors:1,period:'all',from:'',to:'',page:0};libraryScope='untouched';librarySelection='All_Complete';repeatReviewDone.clear();`);
assert.equal(get('learningKey("colour")'),get('learningKey("color")'));assert.equal(get('learningKey("programme")'),get('learningKey("program")'));assert.notEqual(get('learningKey("flour")'),get('learningKey("floor")'));assert.notEqual(get('learningKey("neighbour")'),get('learningKey("neighbours")'));assert.notEqual(get('learningKey("colours")'),get('learningKey("colour")'));
get(`var counterpartPairs=spellingPairs.filter(([a,b])=>records.has(a)&&records.has(b));`);assert.equal(get('counterpartPairs.length'),10);
// Every counterpart pair, in both directions, must share legacy and current practice coverage.
for(const pair of get('counterpartPairs'))for(const [a,b] of [pair,[...pair].reverse()]){
 reset();get(`var a=${JSON.stringify(a)},b=${JSON.stringify(b)};data.attempts.push({id:uid(),sessionId:'prior',word:a,mode:'listen',ts:Date.now(),localDay:localDay(),correct:true,input:a,assisted:false,setKeys:records.get(a).sets});`);
 assert(get('allStats().uniqueDone.has(b)'));assert.equal(get('allStats().uniqueLearned.size'),1);assert.equal(get('allStats().total'),1);
 get(`librarySelection=records.get(b).sets.find(k=>k.startsWith('Cambridge_'))||records.get(b).sets[0];showView('dashboard');startPractice('listen')`);
 assert.equal(get(`data.session.items.some(w=>learningKey(w.word)===learningKey(b))`),false);
 reset();get(`data.legacy.progress.old={done:[${JSON.stringify(a)}]};`);assert(get(`allStats().uniqueDone.has(${JSON.stringify(b)})`));
}
// Historical alternatives absent from today's raw corpus still recognize the equivalent present spelling.
reset();get(`data.legacy.progress.old={done:['gray']}`);assert.equal(get('learningKey("gray")===learningKey("grey")'),true);assert.equal(get('allStats().uniqueLearned.size'),get('records.has("grey")||records.has("gray")?1:0'));
// Both forms in an old queue only occupy one question; plurals still occupy another.
reset();get(`data.session={id:'old',mode:'listen',scope:'all',items:['colour','color','colours'].map(word=>({word,setKeys:records.get(word)?.sets||[]})),index:0,answered:null,draft:'',assisted:false};showView('practice')`);assert.equal(get('data.session.items.filter(w=>learningKey(w.word)===learningKey("colour")).length'),1);
// Same word errors, review stage, dates, flags and daily skip are shared; original attempts remain intact.
reset();get(`for(const [i,word] of ['colour','color'].entries())data.attempts.push({id:uid(),sessionId:'different-'+i,word,mode:'listen',ts:Date.now()+i,localDay:localDay(),correct:false,input:'x',assisted:false,setKeys:records.get(word).sets});data.legacy.wrongBook.colour={count:3,wordData:records.get('colour')};`);assert.equal(get('allStats().wrongWords.length'),1);assert.equal(get('((s)=>s.perWord.get("colour")===s.perWord.get("color"))(allStats())'),true);assert.equal(get('allStats().perWord.get("color").errors+allStats().perWord.get("color").legacyWrong'),5);assert.equal(get('allStats().total'),2);
get(`data.attempts.push({id:uid(),sessionId:'reviewed',word:'color',mode:'spell',ts:Date.now()+10,localDay:localDay(),correct:true,input:'color',assisted:false,setKeys:records.get('color').sets});`);assert.equal(get('reviewCandidates().length'),0);
get(`data.wordFlags.colour={archived:true,updatedAt:100};`);assert.equal(get('wordFlag("color").archived'),true);
// Drafted old cards covered by an alias must also be removed, before the user repeats them.
reset();get(`data.legacy.progress.old={done:['colour']};data.session={id:'old-draft',mode:'listen',items:[{word:'color',setKeys:[]},{word:'root',setKeys:[]}],index:0,answered:null,draft:'col',assisted:false};showView('practice')`);assert.equal(get('currentWord().id'),'root');
// All combined banks and each raw bank contain at most one learning variant.
for(const key of get('[...Object.keys(WORDS_DATA),...Object.keys(AGGREGATE_BANKS)]'))assert.equal(get(`bankWords(${JSON.stringify(key)}).length`),get(`new Set(bankWords(${JSON.stringify(key)}).map(w=>learningKey(w.id))).size`));
get('data=validateV2(JSON.parse(JSON.stringify(data)))');assert(get('allStats().uniqueDone.has("color")'));assert.equal(errors.length,0);
console.log('PASS all 10 corpus counterpart pairs in both directions, current and legacy coverage, Cambridge unseen exclusion and queue deduplication.');
console.log('PASS variant-shared errors/dates/daily review/flags and drafted-session cleanup; singular/plural and unrelated similar spellings stay separate.');
console.log('Learning words:',get('LEARNING_UNIQUE'),'from raw spellings:',get('ORIGINAL_UNIQUE'));console.log('Bank learning units:',get('JSON.stringify(Object.fromEntries(Object.keys(AGGREGATE_BANKS).map(k=>[k,bankWords(k).length])))'));
}finally{await new Promise(r=>setTimeout(r,0));dom.window.close();}})().catch(e=>{console.error(e);process.exitCode=1});
