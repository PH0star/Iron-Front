(() => {
  'use strict';
  let moduleReady;
  window.recordRadioClip=function({onReady,onClip,onError}){
    let live=true,started=false,stream,source,node,safety,finishing=false;
    function release(){
      live=false;clearTimeout(safety);stream?.getTracks().forEach(t=>t.stop());
      source?.disconnect();node?.disconnect();node?.port.close();
    }
    function fail(message){
      if(!live)return;
      release();onError(message);
    }
    function stop(send){
      if(!send||!started){release();return;}
      if(live&&!finishing){
        finishing=true;node.port.postMessage('finish');
        clearTimeout(safety);safety=setTimeout(()=>fail('錄音中斷，可改用文字。'),600);
      }
    }
    async function begin(){
      try{
        const ac=Comms.context;
        if(!navigator.mediaDevices?.getUserMedia||!ac?.audioWorklet){
          fail('此裝置無法錄音，可直接打字或使用快捷句。');return;
        }
        stream=await navigator.mediaDevices.getUserMedia({audio:{channelCount:1,echoCancellation:true}});
        if(!live){release();return;}
        if(ac.state!=='running')await ac.resume();
        moduleReady??=ac.audioWorklet.addModule('radio-capture.js').catch(e=>{moduleReady=null;throw e;});
        await moduleReady;
        if(!live)return;
        node=new AudioWorkletNode(ac,'iron-radio',{numberOfInputs:1,numberOfOutputs:1,outputChannelCount:[1],channelCount:1,channelCountMode:'explicit'});
        node.onprocessorerror=()=>fail('錄音中斷，可重新長按或改用文字。');
        node.port.onmessage=({data})=>{
          if(!live)return;release();
          if(data.byteLength>=4800)onClip(data);else onError('錄音太短，請按住說完再放開。');
        };
        source=ac.createMediaStreamSource(stream);
        // The processor writes no output, so the microphone is never fed back to the speaker.
        node.connect(ac.destination);source.connect(node);started=true;onReady();
        stream.getAudioTracks()[0].onended=()=>fail('麥克風連線中斷，可改用文字。');
        safety=setTimeout(()=>stop(true),5000);
      }catch{fail('麥克風未啟用，可直接打字或傳快捷句。');}
    }
    Promise.resolve().then(()=>{if(live)begin();});return {stop};
  };
})();
