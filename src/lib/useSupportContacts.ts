import { useSiteSettings } from '../context/SiteSettingsContext';
import { ADMIN_EMAIL, ADMIN_WHATSAPP, ADMIN_WHATSAPP_INTL, SUPPORT_EMAIL, WHATSAPP_ADMIN } from '../constants';
export function useSupportContacts(){
 const {tenant}=useSiteSettings();
 let number=(tenant?.config.supportWhatsapp||'').replace(/\D/g,'');
 if(number.startsWith('0'))number='62'+number.slice(1);
 const email=tenant?.config.supportEmail||'';
 return {adminEmail:email||ADMIN_EMAIL,supportEmail:email||SUPPORT_EMAIL,whatsapp:number||ADMIN_WHATSAPP_INTL,display:number?'+'+number:ADMIN_WHATSAPP,supportWhatsapp:{intl:number||WHATSAPP_ADMIN.intl,display:number?'+'+number:WHATSAPP_ADMIN.display}};
}
