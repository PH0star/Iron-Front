/* Original oscillator, percussion and filtered-noise score. */
(() => {
  const defaults={enabled:true,music:false,volume:.5};let prefs={...defaults};
  try{Object.assign(prefs,JSON.parse(localStorage.getItem('iron-front-audio')||'{}'));}catch{}
  let ac,bus,noise,voice=0,lastShot=0,nextBeat=0,step=0;
  const save=()=>{try{localStorage.setItem('iron-front-audio',JSON.stringify(prefs));}catch{}};
  function init(){if(!ac){const AC=window.AudioContext||window.webkitAudioContext;if(!AC)return;try{ac=new AC();bus=ac.createGain();bus.gain.value=prefs.volume*.53;bus.connect(ac.destination);noise=ac.createBuffer(1,ac.sampleRate*.55,ac.sampleRate);const a=noise.getChannelData(0);for(let i=0;i<a.length;i++)a[i]=Math.random()*2-1;}catch{return;}}if(ac.state==='suspended')ac.resume().catch(()=>{});}
  function tone(f,end,t,d,v,wave='triangle'){if(!ac||!bus)return;const o=ac.createOscillator(),g=ac.createGain();o.type=wave;o.frequency.setValueAtTime(f,t);o.frequency.exponentialRampToValueAtTime(Math.max(20,end),t+d);g.gain.setValueAtTime(.0001,t);g.gain.exponentialRampToValueAtTime(Math.max(.001,v),t+.007);g.gain.exponentialRampToValueAtTime(.0001,t+d+.01);o.connect(g).connect(bus);o.start(t);o.stop(t+d+.02);o.onended=()=>{g.disconnect();o.disconnect();};}
  function hiss(t,d,v,f=900){if(!noise)return;const s=ac.createBufferSource(),g=ac.createGain(),b=ac.createBiquadFilter();s.buffer=noise;b.type='lowpass';b.frequency.setValueAtTime(f,t);b.frequency.exponentialRampToValueAtTime(80,t+d);g.gain.setValueAtTime(v,t);g.gain.exponentialRampToValueAtTime(.0001,t+d);s.connect(b).connect(g).connect(bus);s.start(t);s.stop(t+d);s.onended=()=>{s.disconnect();g.disconnect();b.disconnect();};}
  function play(name){if(!prefs.enabled||!ac||ac.state!=='running')return;const t=ac.currentTime;
    if(name==='fire'||name==='rifle'){if(t-lastShot<.065)return;lastShot=t;const heavy=name==='fire';hiss(t,heavy?.24:.1,heavy?.42:.26,heavy?1050:2550);tone(heavy?83:148,32,t,heavy?.19:.075,heavy?.24:.09,'sawtooth');return;}
    if(name==='destroy'){hiss(t,.50,.65,1600);tone(101,24,t,.38,.37,'triangle');return;}
    const notes={select:[620,820],order:[450,655],queued:[351,526],ready:[392,494,659],income:[880,1050],wave:[355,310,355],fail:[200,160],victory:[392,494,587,784],defeat:[392,349,294,196]};
    (notes[name]||notes.select).forEach((n,i)=>tone(n,n*(1+(voice%3)*.003),t+i*.073,.075,.085,'triangle'));voice++;}
  function music(active){if(!ac||!prefs.music||!active||ac.state!=='running'){nextBeat=0;return;}const t=ac.currentTime;if(!nextBeat||nextBeat<t-.1)nextBeat=t+.02;
    const line=[98,98,0,146.83,98,0,116.54,130.81,87.31,87.31,130.81,0,98,146.83,116.54,0];
    while(nextBeat<t+.06){let i=step%16;if(line[i])tone(line[i],line[i]*.985,nextBeat,.16,.08,'triangle');if(i%4===0)tone(93,35,nextBeat,.16,.15,'sine');if(i%4===2)hiss(nextBeat,.10,.17,1900);if(i%2===1)hiss(nextBeat,.04,.06,3300);nextBeat+=.24;step++;}}
  window.Comms={prefs,init,play,music,set(key,v){prefs[key]=v;save();if(ac&&key==='volume')bus.gain.setTargetAtTime(v*.53,ac.currentTime,.015);}};
})();
