import { useEffect, useRef, useState, type ButtonHTMLAttributes, type MouseEvent } from 'react';
import './TransactionButton.css';
// Adapted from Uiverse.io by Admin12121. Native button semantics, scoped CSS.
export default function TransactionButton({children,onClick,disabled,type='button',className='',...props}:ButtonHTMLAttributes<HTMLButtonElement>){
 const [animating,setAnimating]=useState(false);const locked=useRef(false);const timer=useRef<ReturnType<typeof setTimeout>|null>(null);const latest=useRef({onClick,disabled});latest.current={onClick,disabled};
 useEffect(()=>()=>{if(timer.current)clearTimeout(timer.current);},[]);
 const click=(event:MouseEvent<HTMLButtonElement>)=>{
  event.preventDefault();if(locked.current||disabled)return;
  const button=event.currentTarget;const form=button.form;
  if(type==='submit'&&form&&!form.reportValidity())return;
  locked.current=true;setAnimating(true);
  const delay=window.matchMedia('(prefers-reduced-motion: reduce)').matches?0:1350;
  timer.current=setTimeout(()=>{
   timer.current=null;locked.current=false;setAnimating(false);
   if(latest.current.disabled||!button.isConnected)return;
   if(latest.current.onClick)latest.current.onClick(event);
   else if(type==='submit'&&form){form.requestSubmit();}
  },delay);
 };
 return <button {...props} type={type} disabled={disabled} aria-disabled={disabled||animating} aria-busy={animating||props['aria-busy']} onClick={click} className={`transaction-button ${animating?'is-animating':''} ${className}`}><span aria-hidden="true" className="tx-left-side"><span className="tx-card"><span className="tx-card-line"/><span className="tx-buttons"/></span><span className="tx-post"><span className="tx-post-line"/><span className="tx-screen"><span className="tx-dollar">$</span></span><span className="tx-numbers"/><span className="tx-numbers-line2"/></span></span><span className="tx-right-side"><span className="tx-new">{children}</span><svg aria-hidden="true" viewBox="0 0 451.846 451.847" className="tx-arrow"><path fill="currentColor" d="M345.441 248.292L151.154 442.573c-12.359 12.365-32.397 12.365-44.75 0-12.354-12.354-12.354-32.391 0-44.744L278.318 225.92 106.409 54.017c-12.354-12.359-12.354-32.394 0-44.748 12.354-12.359 32.391-12.359 44.75 0l194.287 194.284c6.177 6.18 9.262 14.271 9.262 22.366 0 8.099-3.091 16.196-9.267 22.373z"/></svg></span></button>;
}
