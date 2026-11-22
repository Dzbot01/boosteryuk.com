import { useAdminNotifications } from '../context/AdminNotificationsContext';
export default function AdminDataDot({ path }: { path: string }) {
  const { unread } = useAdminNotifications();
  return unread(path) ? <span role="status" aria-label="Ada data baru" className="absolute right-2 top-2 h-2.5 w-2.5 rounded-full bg-red-500"><span className="sr-only">Ada data baru</span></span> : null;
}
