import { MAIN_API } from '../lib/apiBase';
export interface EarnedTitle { code: string; earned_at: string }
export interface StreakState {
  blocked_message?: string; completed?: boolean; day: number; last_checkin: string | null; claimed_today: boolean; can_claim: boolean;
  today: string; next_day_at: number; server_time: number; cycle: number;
  reset_notice: boolean; reset_version: number; trial_until: string | null;
  balance: number; titles: EarnedTitle[]; event_active: boolean;
  /**
   * Hari 1-6 yang hadiah UANG-nya sudah pernah masuk ke akun ini (siklus mana pun).
   * Setelah streak putus dan progres mengulang, hari-hari ini tetap bisa di-check-in
   * tetapi tanpa uang — hadiah harian hanya diterima sekali per akun.
   */
  paid_days?: number[];
  /** Nominal yang akan masuk pada check-in berikutnya (0 = check-in tanpa hadiah uang). */
  next_cash?: number;
}
export interface StreakResult { state: StreakState; reward: { day: number; cash: number; already_paid?: boolean; trial_until: string | null } | null }
export async function streakCall(action: 'get' | 'claim' | 'ack_reset', version?: number): Promise<StreakResult> {
  const token = localStorage.getItem('token') || '';
  const response = await fetch(`${MAIN_API}/daily_streak.php`, { method: 'POST', cache: 'no-store', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action, token, ...(version === undefined ? {} : { version }) }) });
  const data = await response.json().catch(() => null);
  if (!response.ok || !data?.ok || !data.state) throw new Error(data?.message || 'Tidak dapat menghubungi layanan reward. Silakan coba lagi.');
  return data as StreakResult;
}
export const STREAK_ANIMATIONS = {
  day1: 'https://lottie.host/2a05195e-0c77-40dd-9e27-2af17a3ea5f2/iwCQfoJS1z.lottie',
  day2: 'https://lottie.host/ec72c5b4-1202-4325-8b5f-6c3edead2962/2Dft6FCcZn.lottie',
  day7: 'https://lottie.host/8aebf605-3fb2-4d40-a798-558e6bc8ba1b/YJydJSM6hi.lottie',
  success: 'https://lottie.host/950c9d46-726a-4d67-ac1b-23a634655e35/9Lbirovu0g.lottie',
  failed: 'https://lottie.host/b9f81dbc-b894-4ad1-a3da-f219354b31ac/y5zJ7z4ncG.lottie',
  newyear: 'https://lottie.host/9f48f7b3-b8c0-49d8-a63d-c25ec7881988/9cm3Ljdekg.lottie',
};
export const TITLE_CATALOG: Record<string, { name: string; description: string; src: string }> = {
  'daily-streak-7': { name: 'Daily Streak · 7 Hari', description: 'Menyelesaikan check-in tujuh hari berturut-turut.', src: STREAK_ANIMATIONS.success },
  'newyear-2027': { name: 'Hitung Mundur Tahun Baru', description: 'Menyelesaikan satu sesi game Tahun Baru selama 3 menit.', src: STREAK_ANIMATIONS.newyear },
};
export const streakAnimation = (day: number) => day >= 7 ? STREAK_ANIMATIONS.day7 : day >= 2 ? STREAK_ANIMATIONS.day2 : STREAK_ANIMATIONS.day1;
