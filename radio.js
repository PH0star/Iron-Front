(() => {
  'use strict';
  const $=id=>document.getElementById(id),key=$('radioKey'),panel=$('fieldRadio'),input=$('radioText');
  const strip=$('radioStrip'),log=$('radioLog'),hint=$('radioHint'),listen=$('radioListen');
  const names=['紅軍','藍軍'],guide='點按打字，長按或按住 V 說話，滑出按鈕可取消。';
  let session=null,media=null,ready=false,retry,attempt=0,pending=null,ackTimer;
  let hand=null,holdTimer,recording=null,started=0,clock,stripTimer,player=null,speech=null;
  const drafts=new Map();
  let composing=false,lastComposition=-Infinity;
  try{const mode=localStorage.getItem('iron-radio-listen');if(['tap','auto','mute'].includes(mode))listen.value=mode;}catch{}
  const Recognition=window.SpeechRecognition||window.webkitSpeechRecognition;
  $('radioDictate').hidden=!Recognition;
  function notice(text,action){
    strip.textContent=text;
    if(action){const b=document.createElement('button');b.textContent='收聽';b.onclick=action;strip.append(' ',b);}
    strip.hidden=false;clearTimeout(stripTimer);
    stripTimer=setTimeout(()=>{strip.hidden=true;},action?6500:3200);
  }
  function error(text){hint.textContent=text;notice(text);}
  function show(focus=false){
    if(!session)return;
    panel.hidden=false;key.setAttribute('aria-expanded','true');
    if(focus)input.focus({preventScroll:true});
  }
  function stopDictation(){
    if(!speech)return;
    const old=speech;speech=null;old.abort();$('radioDictate').textContent='語音轉文字';
  }
  function hide(){
    stopDictation();input.blur();panel.hidden=true;key.setAttribute('aria-expanded','false');
  }
  $('radioClose').onclick=hide;
  function stopAudio(){if(player){player.stop();player=null;}}
  function play(buffer){
    if(listen.value==='mute'){hint.textContent='語音已靜音，請先變更收聽方式。';return;}
    const ac=Comms.context;
    if(!ac||ac.state!=='running'){hint.textContent='請點選語音收聽。';return;}
    stopAudio();const pcm=new DataView(buffer),length=pcm.byteLength/2;
    const audio=ac.createBuffer(1,length,12000),channel=audio.getChannelData(0);
    for(let i=0;i<length;i++)channel[i]=pcm.getInt16(i*2,true)/32768;
    const source=ac.createBufferSource(),gain=ac.createGain();gain.gain.value=Comms.prefs.volume;
    source.buffer=audio;source.connect(gain);gain.connect(ac.destination);player=source;
    source.onended=()=>{source.disconnect();gain.disconnect();if(player===source)player=null;};source.start();
  }
  listen.onchange=()=>{
    if(listen.value!=='auto')stopAudio();
    try{localStorage.setItem('iron-radio-listen',listen.value);}catch{}
  };
  function append(team,text,clip){
    if(!session)return;
    const mine=team===session.team,who=(mine?'我方':'敵方')+'通訊｜'+names[team];
    const row=document.createElement('p'),label=document.createElement('b');label.className=team?'blue':'red';
    label.textContent=who;row.append(label);
    const caption=clip?'語音 '+Math.ceil(clip.byteLength/24000)+' 秒':text;
    if(clip){
      const button=document.createElement('button');button.textContent='▶ '+caption;
      button.onclick=async()=>{
        Comms.init();const ac=Comms.context,current=session;
        if(!ac)return error('此裝置無法播放語音。');
        try{if(ac.state!=='running')await ac.resume();if(session===current)play(clip);}catch{error('請再點一次收聽。');}
      };
      row.append(button);
    }else row.append(document.createTextNode(text));
    log.append(row);while(log.children.length>12)log.firstElementChild.remove();log.scrollTop=log.scrollHeight;
    if(!mine){
      notice(who+' · '+caption,clip&&listen.value==='tap'?()=>row.querySelector('button').click():null);
      if(listen.value!=='mute')Comms.play('radio');
      if(clip&&listen.value==='auto')play(clip);
    }else if(panel.hidden)notice('已送出 · '+caption);
  }
  function textSend(value,isDraft=false){
    const text=value.trim();if(!text||!session)return;
    const seq=session.sendText(text);
    if(seq){if(isDraft){drafts.set(seq,value);input.value='';}hint.textContent=guide;}
  }
  $('radioForm').onsubmit=e=>{e.preventDefault();if(!composing&&performance.now()-lastComposition>70)textSend(input.value,true);};
  $('radioQuick').onclick=e=>{if(e.target.tagName==='BUTTON')textSend(e.target.textContent);};
  input.oncompositionstart=()=>{composing=true;};
  input.oncompositionend=()=>{composing=false;lastComposition=performance.now();};
  input.onkeydown=e=>{
    if(e.key==='Enter'){
      if(e.isComposing||composing||e.keyCode===229)return;
      e.preventDefault();
      if(!e.repeat&&performance.now()-lastComposition>70)textSend(input.value,true);
    }
    if(e.key==='Escape'&&!composing&&!e.isComposing)hide();
  };
  function dictation(){
    if(speech){speech.stop();return;}
    if(!Recognition||!session||recording)return;
    const current=session,recognizer=new Recognition();speech=recognizer;recognizer.lang='zh-TW';recognizer.interimResults=false;
    $('radioDictate').textContent='結束辨識';hint.textContent='請說話，辨識完成後可修改文字並送出。';
    recognizer.onresult=e=>{
      if(speech!==recognizer||session!==current)return;
      input.value=(input.value+e.results[0][0].transcript).slice(0,input.maxLength);input.focus();
    };
    recognizer.onerror=()=>{if(speech===recognizer)hint.textContent='辨識未完成，可直接打字。';};
    recognizer.onend=()=>{if(speech===recognizer){speech=null;$('radioDictate').textContent='語音轉文字';}};
    try{recognizer.start();}catch{stopDictation();error('此裝置暫時無法辨識，可直接打字。');}
  }
  $('radioDictate').onclick=()=>{
    if(!speech&&!$('radioDictate').dataset.informed){
      $('radioDictate').dataset.informed='yes';hint.textContent='瀏覽器可能將聲音交給辨識服務。再次點選開始，結果會先放入輸入框。';return;
    }
    dictation();
  };
  function displayIdle(){
    clearInterval(clock);key.classList.remove('recording');
    key.lastChild.textContent='對講';
  }
  function beginRecording(){
    if(!hand||!session)return;
    hand.held=true;
    if(!ready||pending){show();error('語音通道準備中，可先打字。');return;}
    stopDictation();const current=session;
    hint.textContent='正在啟用麥克風…';notice(hint.textContent);
    recording=recordRadioClip({
      onReady(){
        started=performance.now();key.classList.add('recording');
        key.lastChild.textContent='錄音 5';hint.textContent='放開送出，滑出取消。';notice(hint.textContent);
        clock=setInterval(()=>{key.lastChild.textContent='錄音 '+Math.max(1,5-Math.floor((performance.now()-started)/1000));},160);
      },
      onClip(clip){
        displayIdle();recording=null;if(session!==current)return;
        if(!ready||media?.readyState!==WebSocket.OPEN)return error('語音未送出，請重新錄製。');
        pending=clip;media.send(clip);notice('傳送語音中…');
        ackTimer=setTimeout(()=>{if(pending){pending=null;error('未收到語音送達確認。');media?.close();}},8000);
      },
      onError(message){displayIdle();recording=null;if(session===current){show();error(message);}}
    });
  }
  function finishHand(cancel=false){
    const h=hand;hand=null;clearTimeout(holdTimer);
    if(!h)return;
    if(recording){const mic=recording;if(cancel||!key.classList.contains('recording'))recording=null;mic.stop(!cancel);displayIdle();}
    if(cancel&&h.held){notice('已取消錄音');hint.textContent=guide;}
    if(!cancel&&!h.held){if(panel.hidden)show(true);else hide();}
  }
  function stopCapture(){
    finishHand(true);recording?.stop(false);recording=null;displayIdle();stopDictation();
  }
  key.onpointerdown=e=>{
    if(!session||hand||e.button!==0)return;
    e.preventDefault();Comms.init();hand={id:e.pointerId,held:false};key.setPointerCapture(e.pointerId);
    holdTimer=setTimeout(beginRecording,330);
  };
  function inside(e){const r=key.getBoundingClientRect();return e.clientX>=r.left&&e.clientX<=r.right&&e.clientY>=r.top&&e.clientY<=r.bottom;}
  key.onpointermove=e=>{if(hand?.id===e.pointerId&&!inside(e))finishHand(true);};
  key.onpointerup=e=>{if(hand?.id===e.pointerId)finishHand(!inside(e));};
  key.onpointercancel=key.onlostpointercapture=e=>{if(hand?.id===e.pointerId)finishHand(true);};
  key.oncontextmenu=e=>e.preventDefault();
  key.onclick=e=>{if(e.detail===0){if(panel.hidden)show(true);else hide();}};
  window.addEventListener('keydown',e=>{
    if(!session||e.ctrlKey||e.altKey||e.metaKey||e.isComposing||e.keyCode===229||document.querySelector('dialog[open]'))return;
    if(e.target.closest?.('input,textarea,select,[contenteditable=true],#fieldRadio'))return;
    if(e.key==='Enter'&&!e.target.closest?.('button')){e.preventDefault();e.stopImmediatePropagation();if(!e.repeat)show(true);}
    if(e.code==='KeyV'){e.preventDefault();e.stopImmediatePropagation();if(!hand&&!e.repeat){Comms.init();hand={id:'V',held:true};beginRecording();}}
  },true);
  window.addEventListener('keyup',e=>{if(e.code==='KeyV'&&hand?.id==='V'){e.preventDefault();finishHand();}},true);
  window.addEventListener('blur',stopCapture);
  document.addEventListener('visibilitychange',()=>{if(document.hidden){stopCapture();stopAudio();}});
  function connectMedia(current){
    if(session!==current)return;
    const ws=new WebSocket(current.url);ws.binaryType='arraybuffer';media=ws;
    ws.onopen=()=>{if(media===ws)ws.send(JSON.stringify({round:current.round,token:current.token}));};
    ws.onmessage=({data})=>{
      if(media!==ws||current!==session)return;
      if(typeof data!=='string'){if(data.byteLength>=4800&&data.byteLength<=120000&&data.byteLength%2===0)append(1-current.team,'',data);return;}
      const m=JSON.parse(data);
      if(m.type==='ready'){ready=true;attempt=0;return;}
      clearTimeout(ackTimer);
      if(m.type==='sent'&&pending)append(current.team,'',pending);
      pending=null;if(m.error)error(m.error);
    };
    ws.onclose=()=>{
      if(media!==ws||current!==session)return;
      ready=false;media=null;if(recording)stopCapture();
      if(pending){pending=null;error('語音送達狀態未確認。');}
      clearTimeout(ackTimer);retry=setTimeout(()=>connectMedia(current),Math.min(10000,800*2**Math.min(attempt++,4)));
    };
  }
  window.FieldRadio={
    get active(){return !!session;},
    session(next){
      session=next;clearTimeout(retry);clearTimeout(ackTimer);stopCapture();stopAudio();hide();
      const old=media;media=null;old?.close();ready=false;pending=null;attempt=0;
      drafts.clear();log.replaceChildren();input.value='';hint.textContent=guide;composing=false;
      clearTimeout(stripTimer);strip.hidden=true;key.hidden=!next;
      if(next)connectMedia(next);
    },
    textAck(m){
      const draft=drafts.get(m.seq);drafts.delete(m.seq);
      if(m.error){if(draft&&!input.value)input.value=draft;error(m.error);}
    },
    receive(m){if(session?.round===m.round)append(m.team,m.text,null);},error
  };
})();
