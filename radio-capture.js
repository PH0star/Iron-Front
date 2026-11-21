// Downsample mono input to 12 kHz and keep at most five seconds for one radio clip.
class RadioCapture extends AudioWorkletProcessor {
  constructor(){
    super();
    this.samples=new Int16Array(60000);
    this.length=0;this.phase=0;this.sum=0;this.count=0;
    this.port.onmessage=()=>this.finish();
  }
  finish(){
    if(!this.samples)return;
    const clip=this.samples.slice(0,this.length);
    this.samples=null;this.port.postMessage(clip.buffer,[clip.buffer]);
  }
  process(inputs){
    if(!this.samples)return false;
    const mono=inputs[0][0];if(!mono)return true;
    for(const value of mono){
      this.sum+=value;this.count++;this.phase+=12000;
      if(this.phase<sampleRate)continue;
      this.phase-=sampleRate;
      this.samples[this.length++]=Math.round(Math.max(-1,Math.min(1,this.sum/this.count))*32767);
      this.sum=0;this.count=0;
      if(this.length===60000){this.finish();return false;}
    }
    return true;
  }
}
registerProcessor('iron-radio',RadioCapture);
