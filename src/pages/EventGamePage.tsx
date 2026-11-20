import { useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { eventGameRequest, GAME_CLOSED } from '../services/eventGameApi';
import Seo from '../components/Seo';
export default function EventGamePage(){
 const {id}=useParams();const {user,refresh}=useAuth();const frame=useRef<HTMLIFrameElement>(null);const [channel]=useState(()=>crypto.randomUUID());const [error,setError]=useState('');const [bridgeReady,setBridgeReady]=useState(false);
 const token=user?.token;const refreshRef=useRef(refresh);refreshRef.current=refresh;
 useEffect(()=>{
  if(!token||!id||!/^\d+$/.test(id))return;
  let active=true,revision:number|null=null;let queue=Promise.resolve();let catalog:Record<string,{name:string;price:number}>={};const inFlight=new Set<number>();
  const receive=(event:MessageEvent)=>{
   const m=event.data;if(event.source!==frame.current?.contentWindow||!m||m.type!=='boosteryuk-game'||m.channel!==channel||!Number.isSafeInteger(m.id)||m.id<1||inFlight.has(m.id))return;
   if(!['get','start','save','buy','use','leaderboard'].includes(m.action)||!m.payload||typeof m.payload!=='object')return;
   if(inFlight.size>=30)return;
   inFlight.add(m.id);
   queue=queue.then(async()=>{
    if(!active)return;
    let result;
    try{
     const body:Record<string,unknown>={action:m.action,token,event_id:Number(id)};
     if(m.action==='start'){body.username=m.payload.username;body.request_id=m.payload.request_id;}
     if(m.action==='save'){body.state=m.payload.state;body.revision=revision;}
     if(m.action==='use'){body.item_id=m.payload.item_id;body.request_id=m.payload.request_id;}
     if(m.action==='buy'){
      const cart=m.payload.cart;if(!cart||Array.isArray(cart)||typeof cart!=='object')throw new Error('Keranjang tidak valid.');
      const entries=Object.entries(cart);let total=0;
      if(!entries.length||entries.length>5)throw new Error('Keranjang tidak valid.');
      for(const [item,n] of entries){if(!catalog[item]||!Number.isInteger(n)||Number(n)<1||Number(n)>100)throw new Error('Item tidak valid.');total+=catalog[item].price*Number(n);}
      if(!window.confirm(`Gunakan saldo WEBSITE sebesar Rp${total.toLocaleString('id-ID')} untuk item virtual game ini? Pembelian akan masuk Riwayat Pesanan. Bukan followers/like sosial media asli.`))throw new Error('Pembelian dibatalkan.');
      body.cart=cart;body.request_id=m.payload.request_id;body.confirm_real_balance=true;
     }
     result=await eventGameRequest(body);
     if(typeof result.revision==='number' && (revision===null || m.action==='save' || m.action==='start'))revision=result.revision;
     if(result.catalog)catalog=result.catalog;
     if(m.action==='buy')void refreshRef.current().catch(()=>{if(active)setError('Pembelian berhasil, tetapi saldo header belum diperbarui. Periksa Riwayat Pesanan sebelum membeli lagi.');});
     setError('');
    }catch(e){const message=e instanceof Error?e.message:GAME_CLOSED;result={ok:false,message};setError(message);}
    if(active)frame.current?.contentWindow?.postMessage({type:'boosteryuk-game-result',channel,id:m.id,result},'*');
   }).catch(()=>{}).finally(()=>inFlight.delete(m.id));
  };
  window.addEventListener('message',receive);setBridgeReady(true);return()=>{active=false;window.removeEventListener('message',receive);};
 },[channel,id,token]);
 return <main className="px-2 pb-28 pt-4 sm:px-6"><Seo title="Naikkan Akunmu! — Event" noindex/><div className="mb-3 flex flex-wrap items-center justify-between gap-2"><Link to="/event" className="text-sm font-semibold text-cyan-700">← Kembali ke Event</Link><p className="text-xs text-slate-500">Merchant memakai saldo website nyata. Jika koneksi terputus saat membayar, periksa riwayat sebelum membayar ulang.</p></div>{error && <p role="alert" className="mb-3 text-sm text-rose-600">{error}</p>}{bridgeReady && <iframe ref={frame} title="Game Naikkan Akunmu!" src={`/games/naikkan-akunmu.html#channel=${channel}`} sandbox="allow-scripts allow-orientation-lock" allow="fullscreen" allowFullScreen referrerPolicy="no-referrer" className="h-[calc(100dvh-150px)] min-h-[420px] w-full rounded-xl border border-slate-200 bg-white"/>}</main>;
}
