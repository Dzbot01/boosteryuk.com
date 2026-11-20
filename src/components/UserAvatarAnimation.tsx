import { useEffect, useState } from 'react';
import { DotLottieReact, type DotLottie } from '@lottiefiles/dotlottie-react';
export default function UserAvatarAnimation({src,onReady,onFailure}:{src:string;onReady:(ready:boolean)=>void;onFailure:()=>void}) {
  const [player,setPlayer]=useState<DotLottie|null>(null);
  useEffect(()=>{
    let rendered=false;
    const timeout=window.setTimeout(()=>{if(!rendered)onFailure();},12000);
    const render=()=>{if(!rendered){rendered=true;window.clearTimeout(timeout);onReady(true);}};
    const fail=()=>onFailure();
    player?.addEventListener('render',render);
    player?.addEventListener('loadError',fail);
    player?.addEventListener('renderError',fail);
    return ()=>{window.clearTimeout(timeout);player?.removeEventListener('render',render);player?.removeEventListener('loadError',fail);player?.removeEventListener('renderError',fail);};
  },[player,onReady,onFailure]);
  return <DotLottieReact src={src} dotLottieRefCallback={setPlayer} autoplay loop layout={{fit:'contain',align:[0.5,0.5]}} renderConfig={{freezeOnOffscreen:true}} style={{width:'100%',height:'100%',display:'block'}}/>;
}
