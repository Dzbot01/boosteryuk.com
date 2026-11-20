import { Component, lazy, Suspense, useCallback, useState, type ReactNode } from 'react';
import { avatarSource, type AvatarPlanUser } from '../lib/avatar';
const Animation = lazy(() => import('./UserAvatarAnimation'));
class AvatarBoundary extends Component<{children: ReactNode; onFailure:()=>void}, {failed:boolean}> {
  state = {failed:false};
  static getDerivedStateFromError() { return {failed:true}; }
  componentDidCatch() { this.props.onFailure(); }
  render() { return this.state.failed ? null : this.props.children; }
}
function AvatarContent({src,children}:{src:string;children:ReactNode}) {
  const [failed,setFailed]=useState(false);
  const [ready,setReady]=useState(false);
  const fail=useCallback(()=>{setFailed(true);setReady(false);},[]);
  return <span className="relative isolate flex h-full w-full items-center justify-center overflow-hidden rounded-[inherit]" aria-hidden="true">
    <span className={`flex h-full w-full items-center justify-center ${ready && !failed?'invisible':''}`}>{children}</span>
    {!failed && <span className={`pointer-events-none absolute inset-0 ${ready?'opacity-100':'opacity-0'}`}>
      <AvatarBoundary onFailure={fail}><Suspense fallback={null}><Animation src={src} onReady={setReady} onFailure={fail}/></Suspense></AvatarBoundary>
    </span>}
  </span>;
}
/** Fill existing dimensions and retain the old avatar until an animation frame is actually rendered. */
export default function UserAvatar({user,children}:{user:AvatarPlanUser;children:ReactNode}) {
  const src=avatarSource(user);
  return <AvatarContent key={src} src={src}>{children}</AvatarContent>;
}
