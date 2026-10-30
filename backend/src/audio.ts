import {ProviderError} from './ai.js';
export function assertAudiblePcm(pcm:Buffer){
 if(pcm.length<3200||pcm.length%2)throw new ProviderError('Narration returned invalid or empty audio.',502,'TTS_INVALID_AUDIO');
 let peak=0,total=0;for(let i=0;i<pcm.length;i+=2){const value=pcm.readInt16LE(i);peak=Math.max(peak,Math.abs(value));total+=value*value}
 if(peak<128||Math.sqrt(total/(pcm.length/2))<16)throw new ProviderError('Narration returned silent audio. Try another voice or provider.',502,'TTS_SILENT_AUDIO');
}
export function assertAudibleWav(audio:Buffer){
 if(audio.toString('ascii',0,4)!=='RIFF'||audio.toString('ascii',8,12)!=='WAVE')throw new ProviderError('Narration provider returned invalid WAV audio.',502,'TTS_INVALID_AUDIO');
 let pcm:Buffer|undefined,valid=false;
 for(let at=12;at+8<=audio.length;){const size=audio.readUInt32LE(at+4),end=at+8+size;if(end>audio.length)break;const tag=audio.toString('ascii',at,at+4);if(tag==='fmt '&&size>=16)valid=audio.readUInt16LE(at+8)===1&&audio.readUInt16LE(at+22)===16;if(tag==='data')pcm=audio.subarray(at+8,end);at=end+(size%2)}
 if(!valid||!pcm)throw new ProviderError('Narration provider returned unsupported audio.',502,'TTS_INVALID_AUDIO');assertAudiblePcm(pcm);
}
