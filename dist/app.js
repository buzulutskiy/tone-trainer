(() => {
  const $ = s => document.querySelector(s), $$ = s => [...document.querySelectorAll(s)];
  const levels = [
    {name:"Контраст",count:2,gap:.34,mode:"pick",lesson:"Мысленно превратите обе плитки в серые. Какая из воображаемых серых карточек будет светлее?"},
    {name:"Ловушка цвета",count:2,gap:.17,mode:"pick",lesson:"Насыщенность — это сила цвета, а не его светлота. Яркий синий вполне может стать тёмно-серым."},
    {name:"Третий лишний",count:3,gap:.13,mode:"pick",lesson:"Теперь нужно удержать три отношения одновременно и найти крайний тон."},
    {name:"Шкала × 4",count:4,gap:.14,mode:"order",lesson:"Соберите всю шкалу. Начните с крайних тонов — середину будет легче поставить между ними."},
    {name:"Шкала × 5",count:5,gap:.105,mode:"order",lesson:"Соседние тона стали ближе. Сравнивайте новую плитку с уже выбранной, а не со всеми сразу."},
    {name:"Глаз художника",count:6,gap:.078,mode:"order",lesson:"Шесть близких цветных тонов — почти как в картине. Здесь оттенок сильнее всего спорит со светлотой."}
  ];
  const scenePalettes = [
    {name:"вечер у моря", colors:[[39,58],[199,72],[222,76],[12,84],[154,58],[278,54]]},
    {name:"лес после дождя", colors:[[91,66],[136,61],[31,72],[51,78],[204,48],[344,68]]},
    {name:"город ночью", colors:[[225,76],[267,64],[354,83],[39,92],[184,72],[18,67]]},
    {name:"осеннее поле", colors:[[45,81],[23,77],[353,64],[105,52],[205,49],[287,48]]},
    {name:"зимний свет", colors:[[205,57],[222,41],[32,54],[167,40],[318,39],[55,61]]},
    {name:"натюрморт", colors:[[7,76],[46,82],[114,52],[211,68],[274,55],[337,71]]}
  ];
  const saved = Number(localStorage.getItem("tone-unlocked") || 1);
  const storedMastery = JSON.parse(localStorage.getItem("tone-mastery") || "[0,0,0,0,0,0]");
  const storedSession = JSON.parse(localStorage.getItem("tone-session") || "null");
  const state = {level:storedSession?.level||0,unlocked:Math.min(6,Math.max(1,saved)),round:storedSession?.round||1,score:storedSession?.score||0,streak:storedSession?.streak||0,correctInLevel:storedSession?.correctInLevel||0,colors:[],selection:[],answerType:"light",locked:false,gray:false,sceneName:"",mastery:Array.from({length:6},(_,i)=>Number(storedMastery[i])||0)};
  const clamp=(v,a,b)=>Math.min(b,Math.max(a,v));
  const shuffle=a=>[...a].sort(()=>Math.random()-.5);
  const luminance=rgb=>{const x=rgb.map(v=>{const c=v/255;return c<=.04045?c/12.92:Math.pow((c+.055)/1.055,2.4)});return x[0]*.2126+x[1]*.7152+x[2]*.0722};
  const hslToRgb=(h,s,l)=>{s/=100;l/=100;const c=(1-Math.abs(2*l-1))*s,x=c*(1-Math.abs((h/60)%2-1)),m=l-c/2;let r=h<60?[c,x,0]:h<120?[x,c,0]:h<180?[0,c,x]:h<240?[0,x,c]:h<300?[x,0,c]:[c,0,x];return r.map(v=>Math.round((v+m)*255))};
  const mix=(a,b,t)=>a.map((v,i)=>Math.round(v+(b[i]-v)*t));
  const colorAtLuminance=(target,hue,saturation)=>{const base=hslToRgb(hue,saturation,50),baseLum=luminance(base),end=target>baseLum?[255,255,255]:[0,0,0];let low=0,high=1,result=base;for(let i=0;i<18;i++){const mid=(low+high)/2,candidate=mix(base,end,mid),lum=luminance(candidate);result=candidate;if((target>baseLum&&lum<target)||(target<baseLum&&lum>target))low=mid;else high=mid}return result};
  const rgbText=rgb=>`rgb(${rgb.join(",")})`;
  const grayText=value=>{const c=Math.round(255*(value<=.0031308?12.92*value:1.055*Math.pow(value,1/2.4)-.055));return `rgb(${c},${c},${c})`};
  function saveSession(extra={}){localStorage.setItem("tone-session",JSON.stringify({level:state.level,round:state.round,score:state.score,streak:state.streak,correctInLevel:state.correctInLevel,answered:false,complete:false,...extra}))}
  function updateReadiness(){const done=state.mastery.reduce((sum,value)=>sum+value,0),percent=Math.round(done/30*100),left=Math.max(0,24-done);$("#readinessValue").textContent=`${percent}%`;$("#readinessBar").style.width=`${percent}%`;$("#readinessText").textContent=left?`До этапа с картинами — ${left} тренировок`:"Вы готовы перейти к разбору картин";$("#completeProgress").textContent=`${done} / 30`}

  function renderLevels(){
    $("#levelTrack").innerHTML=levels.map((_,i)=>`<button class="level-dot ${i===state.level?"current":""} ${i<state.level?"done":""}" type="button" data-level="${i}" ${i>=state.unlocked?"disabled":""} aria-label="Уровень ${i+1}">${i<state.level?"✓":i+1}</button>`).join("");
    $$("[data-level]").forEach(b=>b.addEventListener("click",()=>startLevel(Number(b.dataset.level))));
  }
  function makeRound(skipSave=false){
    const level=levels[state.level];state.selection=[];state.locked=false;state.gray=false;state.answerType=Math.random()>.5?"light":"dark";
    $("#feedback").hidden=true;$("#feedback").classList.remove("wrong");$$("[data-vision]").forEach(b=>{b.classList.toggle("active",b.dataset.vision==="color");b.disabled=b.dataset.vision==="gray"});
    const span=level.gap*(level.count-1),center=.5+(Math.random()-.5)*.12,start=clamp(center+span/2,span+.12,.86);
    const targets=Array.from({length:level.count},(_,i)=>start-level.gap*i),scene=scenePalettes[Math.floor(Math.random()*scenePalettes.length)],palette=shuffle(scene.colors).slice(0,level.count);
    state.sceneName=scene.name;state.colors=shuffle(targets.map((target,rank)=>{const [hue,saturation]=palette[rank];const rgb=colorAtLuminance(target,hue,clamp(saturation+(Math.random()-.5)*10,38,94));return{rgb,lum:luminance(rgb),rank}}));
    $("#levelKicker").textContent=`Уровень ${state.level+1} · ${level.name}`;$("#lessonNumber").textContent=String(state.level+1).padStart(2,"0");$("#lessonText").textContent=level.lesson;
    $("#roundStat").textContent=`${state.round} / 5`;$("#scoreStat").textContent=state.score;$("#streakStat").textContent=state.streak;
    $("#prompt").textContent=level.mode==="order"?"Соберите от светлого к тёмному":`Что ${state.answerType==="light"?"светлее":"темнее"}?`;
    $("#instruction").textContent=level.mode==="order"?"Мысленно обесцветьте плитки и нажимайте от самого светлого серого к самому тёмному.":"Мысленно уберите цвет. Сравните только будущие оттенки серого.";
    $("#modeLabel").textContent=`Палитра «${scene.name}» · ${level.mode==="order"?`тон 1 из ${level.count}`:"выберите плитку"}`;
    const tiles=$("#tiles");tiles.className=`tiles count-${level.count}`;tiles.innerHTML=state.colors.map((c,i)=>`<button class="color-tile" type="button" style="--tile:${rgbText(c.rgb)};--gray:${grayText(c.lum)}" data-index="${i}" aria-label="Цветовая плитка ${i+1}"><span class="tile-rank">${c.rank+1}</span></button>`).join("");
    $$(".color-tile").forEach(t=>t.addEventListener("click",()=>chooseColor(Number(t.dataset.index))));renderRack();renderLevels();updateReadiness();if(!skipSave)saveSession();
  }
  function renderRack(){
    const level=levels[state.level],slots=level.mode==="order"?level.count:1;$("#rackSlots").style.gridTemplateColumns=`repeat(${slots},1fr)`;
    $("#rackSlots").innerHTML=Array.from({length:slots},(_,i)=>{const c=state.colors[state.selection[i]];return `<div class="rack-slot ${c?"filled":""}" ${c?`style="background:${state.gray?grayText(c.lum):rgbText(c.rgb)}"`:""}>${i+1}</div>`}).join("");
    $("#undoButton").disabled=state.locked||!state.selection.length;if(!state.locked&&level.mode==="order")$("#modeLabel").textContent=`Палитра «${state.sceneName}» · ${state.selection.length<level.count?`тон ${state.selection.length+1} из ${level.count}`:"шкала собрана"}`;
  }
  function chooseColor(index){
    if(state.locked||state.selection.includes(index))return;const level=levels[state.level];state.selection.push(index);const tile=$(`[data-index="${index}"]`);tile.classList.add("selected");tile.dataset.order=state.selection.length;renderRack();if(level.mode==="pick"||state.selection.length===level.count)checkAnswer();
  }
  function checkAnswer(){
    const level=levels[state.level];state.locked=true;const expected=level.mode==="pick"?(state.answerType==="light"?0:level.count-1):state.colors.map((_,i)=>i).sort((a,b)=>state.colors[a].rank-state.colors[b].rank);
    const correct=level.mode==="pick"?state.colors[state.selection[0]].rank===expected:state.selection.every((x,i)=>x===expected[i]);
    if(correct){state.correctInLevel++;state.streak++;state.score+=100+Math.min(5,state.streak-1)*20}else state.streak=0;$("#scoreStat").textContent=state.score;$("#streakStat").textContent=state.streak;state.gray=true;
    $$(".color-tile").forEach((tile,i)=>{tile.classList.remove("selected");tile.classList.add("revealed");tile.disabled=true;if(level.mode==="pick"){const actual=state.colors[i].rank;if(actual===expected)tile.classList.add("correct");if(i===state.selection[0]&&actual!==expected)tile.classList.add("wrong")}});renderRack();$$("[data-vision]").forEach(b=>{b.disabled=false;b.classList.toggle("active",b.dataset.vision==="gray")});
    const f=$("#feedback");f.hidden=false;f.classList.toggle("wrong",!correct);$("#resultMark").textContent=correct?"Верно":"Почти";$("#resultTitle").textContent=correct?"Вы увидели тон":"Оттенок обманул глаз";
    $("#resultText").textContent=correct?"После обесцвечивания видно: ваш ответ совпал с порядком серых тонов.":level.mode==="pick"?"Посмотрите на серые плитки: 1 — самая светлая. Насыщенность исходного цвета могла отвлечь вас.":"Номера показывают правильный порядок серых тонов. Сравните места, где шкала сломалась.";
    $("#nextButton").innerHTML=state.round===5?'Результат уровня <span>→</span>':'Следующий раунд <span>→</span>';
    saveSession({answered:true});
  }
  function nextRound(){if(state.round<5){state.round++;makeRound()}else showLevelComplete()}
  function showLevelComplete(restored=false){
    const passed=state.correctInLevel>=4;if(passed&&!restored){state.mastery[state.level]=Math.min(5,state.mastery[state.level]+1);localStorage.setItem("tone-mastery",JSON.stringify(state.mastery));if(state.level<5){state.unlocked=Math.max(state.unlocked,state.level+2);localStorage.setItem("tone-unlocked",state.unlocked)}}updateReadiness();
    $("#completeScore").textContent=`${state.correctInLevel} / 5`;$("#completeTitle").textContent=passed?(state.level===5?"Глаз настроен":"Уровень открыт"):"Нужно ещё немного практики";
    $("#completeText").textContent=passed?(state.level===5?"Вы прошли путь от пары контрастов до полной шкалы из шести цветных тонов.":"Дальше различия станут меньше, а цвет будет отвлекать сильнее."):"Для перехода дальше нужно 4 верных ответа. Повторите уровень — новые цвета уже ждут.";
    $("#continueButton").hidden=!passed||state.level===5;if(state.level<5)$("#continueButton").innerHTML=`Уровень ${state.level+2} <span>→</span>`;$("#levelComplete").hidden=false;saveSession({complete:true});
  }
  function startLevel(index){if(index>=state.unlocked)return;state.level=index;state.round=1;state.correctInLevel=0;state.selection=[];$("#levelComplete").hidden=true;makeRound()}
  function setVision(mode){if(!state.locked)return;state.gray=mode==="gray";$$(".color-tile").forEach(t=>t.classList.toggle("revealed",state.gray));$$("[data-vision]").forEach(b=>b.classList.toggle("active",b.dataset.vision===mode));renderRack()}
  $("#undoButton").addEventListener("click",()=>{if(state.locked||!state.selection.length)return;const i=state.selection.pop(),t=$(`[data-index="${i}"]`);t.classList.remove("selected");delete t.dataset.order;renderRack()});
  $("#nextButton").addEventListener("click",nextRound);$("#continueButton").addEventListener("click",()=>startLevel(state.level+1));$("#replayButton").addEventListener("click",()=>startLevel(state.level));
  $("#brandButton").addEventListener("click",e=>{e.preventDefault();startLevel(0)});$$("[data-vision]").forEach(b=>b.addEventListener("click",()=>setVision(b.dataset.vision)));
  $("#helpButton").addEventListener("click",()=>$("#helpDialog").showModal());$("#closeHelp").addEventListener("click",()=>$("#helpDialog").close());$("#helpDialog").addEventListener("click",e=>{if(e.target===e.currentTarget)e.currentTarget.close()});
  if(document.modelContext?.registerTool)Promise.resolve(document.modelContext.registerTool({name:"start_tone_level",title:"Начать уровень тренировки тона",description:"Запускает доступный уровень игры от 1 до 6.",inputSchema:{type:"object",properties:{level:{type:"integer",minimum:1,maximum:6}},required:["level"],additionalProperties:false},annotations:{readOnlyHint:false,untrustedContentHint:false},execute(input){if(!Number.isInteger(input?.level)||input.level<1||input.level>state.unlocked)throw new Error("Этот уровень пока недоступен");startLevel(input.level-1);return{level:input.level,name:levels[input.level-1].name}}})).catch(()=>{});
  if(storedSession?.complete){makeRound(true);showLevelComplete(true)}else if(storedSession?.answered&&state.round===5){makeRound(true);showLevelComplete()}else{if(storedSession?.answered&&state.round<5)state.round++;makeRound()}
})();
