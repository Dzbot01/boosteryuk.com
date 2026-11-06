import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

function DepositSkeleton() {
  return (
    <div className="mx-auto max-w-2xl px-4 pb-32 pt-8 sm:px-6 animate-pulse">
      {/* back button */}
      <div className="mb-6 h-8 w-24 rounded-xl bg-slate-100 dark:bg-slate-800" />
      {/* title */}
      <div className="h-8 w-40 rounded-xl bg-slate-900/10" />
      <div className="mt-2 h-4 w-64 rounded-lg bg-slate-100 dark:bg-slate-800" />
      {/* badges */}
      <div className="mt-6 flex gap-2">
        <div className="h-7 w-48 rounded-full bg-cyan-100/70" />
        <div className="h-7 w-28 rounded-full bg-slate-100 dark:bg-slate-800" />
      </div>
      {/* search */}
      <div className="mt-5 h-11 w-full rounded-xl bg-slate-100 dark:bg-slate-800" />
      {/* manual card */}
      <div className="mt-5 flex items-center gap-4 rounded-2xl border border-slate-200 bg-white p-4 dark:bg-slate-900 dark:border-slate-700">
        <div className="h-14 w-14 rounded-2xl bg-slate-100 dark:bg-slate-800" />
        <div className="flex-1 space-y-2">
          <div className="h-4 w-1/3 rounded bg-slate-200" />
          <div className="h-3 w-2/3 rounded bg-slate-100 dark:bg-slate-800" />
        </div>
      </div>
      {/* groups */}
      <div className="mt-6 space-y-3">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="flex items-center gap-4 rounded-2xl border border-slate-200 bg-white p-4 dark:bg-slate-900 dark:border-slate-700">
            <div className="h-12 w-12 rounded-xl bg-slate-100 dark:bg-slate-800" />
            <div className="flex-1 space-y-2.5">
              <div className="h-3.5 w-1/2 rounded bg-slate-200" />
              <div className="h-2.5 w-3/4 rounded bg-slate-100 dark:bg-slate-800" />
            </div>
            <div className="h-5 w-5 rounded bg-slate-100 dark:bg-slate-800" />
          </div>
        ))}
      </div>
    </div>
  );
}

export default function ProtectedRoute({
  children,
  adminOnly = false,
}: {
  children: React.ReactNode;
  adminOnly?: boolean;
}) {
  const { user, isAdmin, loading } = useAuth() as any;
  const location = useLocation();
  const pathname = location?.pathname || "/";

  if (loading) {
    // Kalo di halaman deposit, kasih skeleton deposit biar seamless
    if (pathname.startsWith('/deposit')) {
      return <DepositSkeleton />;
    }
    // Halaman lain kasih skeleton general yang clean
    return (
      <div className="mx-auto max-w-2xl px-4 pt-8">
        <div className="animate-pulse space-y-4">
          <div className="h-8 w-1/3 rounded-xl bg-slate-200" />
          <div className="h-32 rounded-2xl bg-slate-100 dark:bg-slate-800" />
          <div className="h-32 rounded-2xl bg-slate-100 dark:bg-slate-800" />
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/" replace state={{ from: pathname }} />;
  }
  if (adminOnly && !isAdmin) {
    return <Navigate to="/" replace />;
  }
  if (
    !adminOnly &&
    isAdmin &&
    (pathname === '/profil' ||
      pathname === '/payment' ||
      pathname === '/pengaturan-akun' ||
      pathname.startsWith('/deposit'))
  ) {
    return <Navigate to="/admin" replace />;
  }
  return <>{children}</>;
}