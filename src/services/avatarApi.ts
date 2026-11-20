import { MAIN_API } from '../lib/apiBase';
export type AvatarVariant = 'male' | 'female';
export async function avatarPreference(token: string, variant?: AvatarVariant): Promise<{ok:boolean;avatar_variant?:AvatarVariant;message?:string}> {
  try {
    const response=await fetch(`${MAIN_API}/avatar_preferences.php`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({token,action:variant?'save':'get',avatar_variant:variant}),cache:'no-store',signal:AbortSignal.timeout(8000)});
    const data=await response.json();
    if(!response.ok || !data.ok)return {ok:false,message:data.message || 'Gagal menyimpan pilihan avatar.'};
    return {ok:true,avatar_variant:data.avatar_variant==='female'?'female':'male'};
  }catch{return {ok:false,message:'Tidak dapat menghubungi server avatar. Silakan coba lagi.'};}
}
