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
const reset=()=>get(`localStorage.clear();lastSaved='';data=freshData();data.confirmedFresh=true;data.settings.autoPlay=false;var words=bankWords('All_Complete').slice(0,6);wrongFilter={search:'',status:'active',sort:'errors',day:'pending',limit:20,minErrors:1,period:'all',from:'',to:'',page:0};repeatReviewDone.clear();repeatReviewPass=uid();libraryScope='untouched';librarySelection='All_Complete';`);
const makeQueue=(scope='untouched')=>get(`data.session={id:'queue',mode:'listen',scope:${JSON.stringify(scope)},items:words.slice(0,3).map(w=>({word:w.id,setKeys:w.sets})),index:0,answered:null,draft:'',assisted:false,createdAt:Date.now(),updatedAt:Date.now()};persist();showView('practice');`);
const event=(word,session='other',mode='listen')=>`({id:uid(),sessionId:${JSON.stringify(session)},word:${word}.id,mode:${JSON.stringify(mode)},ts:Date.now(),localDay:localDay(),correct:true,input:${word}.w,assisted:false,setKeys:${word}.sets})`;
reset();get(`data.session={id:'old',mode:'listen',items:[words[0],words[0],words[1]].map((w,i)=>({word:i===1?' '+w.w.toUpperCase()+' ':w.id,setKeys:w.sets})),index:0,answered:null,draft:'',assisted:false};showView('practice')`);assert.equal(get('data.session.items.length'),2);
// Restore a stale session after another session has already covered its words.
reset();get(`data.attempts.push(${event('words[0]')});data.attempts.push(${event('words[1]','other','spell')});`);makeQueue();assert.equal(get('data.session.items.length'),1);assert.equal(get('currentWord().id===words[2].id'),true);
// Explicit all-words repetition remains available.
reset();get(`data.attempts.push(${event('words[0]')});`);makeQueue('all');assert.equal(get('data.session.items.length'),3);
// Data on disk may be newer even before the browser dispatches a storage event.
reset();get(`var incoming=JSON.parse(JSON.stringify(data));incoming.attempts.push(${event('words[0]')});localStorage.setItem(STORE_KEY,JSON.stringify(incoming));showView('dashboard');startPractice('listen')`);assert.equal(get('data.session.items.some(w=>w.word===words[0].id)'),false);
// Another tab submits the exact same session/question while this tab is typing.
reset();makeQueue();d.querySelector('#answer-input').value=get('words[0].w');get(`var incoming=JSON.parse(JSON.stringify(data));incoming.attempts.push(${event('words[0]','queue')});localStorage.setItem(STORE_KEY,JSON.stringify(incoming));`);submit();assert.equal(get('data.attempts.length'),1);assert.equal(get('data.session.answered.word'),get('words[0].id'));time+=1001;submit();assert.equal(get('currentWord().id'),get('words[1].id'));
// An unrelated session covers the word after the queue was built. No second answer is saved.
reset();makeQueue();d.querySelector('#answer-input').value=get('words[0].w');get(`var incoming=JSON.parse(JSON.stringify(data));incoming.attempts.push(${event('words[0]')});localStorage.setItem(STORE_KEY,JSON.stringify(incoming));`);submit();assert.equal(get('data.attempts.length'),1);assert.equal(get('currentWord().id'),get('words[1].id'));
// A new mistake in listening reopens a mastered review word. An untouched second mode cannot keep it active forever.
reset();get(`var base=Date.now()-20*DAY;for(const [i,day] of [0,1,2,6].entries()){data.attempts.push({id:'stage-'+i,sessionId:'srs',word:words[0].id,mode:i?'spell':'listen',ts:base+day*DAY,localDay:localDay(base+day*DAY),correct:!!i,input:words[0].w,assisted:false,setKeys:words[0].sets});}`);assert.equal(get('allStats().perWord.get(words[0].id).spell.stage'),3);assert.equal(get('allStats().active.length'),0);
get(`data.attempts.push({...${event('words[0]')},correct:false})`);assert.equal(get('allStats().perWord.get(words[0].id).spell.stage'),0);assert.equal(get('allStats().active.length'),1);assert.equal(get('allStats().due.length'),0);time+=11*60000;assert.equal(get('allStats().due.length'),1);
// Explicit repeat keeps its pass identity through a reload and carries it to the next batch.
reset();get(`for(const word of words){data.legacy.wrongBook[word.id]={count:2,wordData:word};data.attempts.push({...${event('word','prior','spell')},id:uid()});}wrongFilter.day='done';wrongFilter.limit=2;showView('wrong');startPractice('spell');`);const a=finishBatch();get('data=validateV2(JSON.parse(localStorage.getItem(STORE_KEY)));repeatReviewDone.clear();repeatReviewPass=uid();wrongFilter.day="pending";data.session.index=1;data.session.answered=data.attempts.find(e=>e.sessionId===data.session.id&&e.word===data.session.items[1].word);showView("practice");');assert.equal(get('wrongFilter.day'),'done');time+=1001;submit();d.querySelector('[data-action="review-next"]').click();const b=finishBatch();assert.equal(a.some(x=>b.includes(x)),false);
// Two tabs that submit before either sees the other still create the same logical answer ID.
reset();makeQueue('all');get('var original=clone(data)');d.querySelector('#answer-input').value=get('currentWord().w');submit();get('var tabA=clone(data);localStorage.clear();lastSaved="";data=clone(original);showView("practice")');d.querySelector('#answer-input').value=get('currentWord().w');submit();assert.equal(get('data.attempts[0].id'),get('tabA.attempts[0].id'));assert.equal(get('mergeData(data,tabA).attempts.length'),1);
assert.equal(errors.length,0);
console.log('PASS normalized queue deduplication, stale queue cleanup, explicit repetition, disk updates before storage events.');
console.log('PASS same-session cross-tab submissions never double-count; other-session coverage skips pending words.');
console.log('PASS review graduation, due-time consistency, new-error reset and explicit repeat-pass reload.');
}finally{await new Promise(r=>setTimeout(r,0));dom.window.close();}})().catch(e=>{console.error(e);process.exitCode=1});
