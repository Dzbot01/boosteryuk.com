export type AvatarPlanUser = {avatar_variant?: 'male' | 'female'; plusActive?: boolean; plan?: {plus?: boolean; extra_active?: boolean; plus_permanent?: boolean; plus_trial_active?: boolean; plus_trial_until?: string | null} | null} | null | undefined;
export const REGULAR_AVATAR = 'https://lottie.host/6504c21f-a8bc-463c-bcb5-37b057de3cdb/RvCn4lEDXK.lottie';
export const PREMIUM_AVATAR = 'https://lottie.host/85c5d7f7-7dd7-40f3-bd0c-c65b7e94c644/Afpy1ehqkk.lottie';
export const FEMALE_AVATAR = 'https://lottie.host/c1ccfe5d-dbe7-4650-9e6f-a397c53d0acd/iFxLD7TCdf.lottie';
export const TRIAL_AVATAR = 'https://lottie.host/f5dc9526-9fde-4a33-8de3-41916cbe65a5/nhBFSRR128.lottie';
export function avatarSource(user: AvatarPlanUser) {
  if (user?.plan?.plus_trial_active && !user.plan.plus_permanent && !user.plan.extra_active) {
    if (Date.parse(user.plan.plus_trial_until || '') > Date.now()) return TRIAL_AVATAR;
    return user.avatar_variant === 'female' ? FEMALE_AVATAR : REGULAR_AVATAR;
  }
  return user?.avatar_variant === 'female' ? FEMALE_AVATAR : user?.plusActive || user?.plan?.plus || user?.plan?.extra_active ? PREMIUM_AVATAR : REGULAR_AVATAR; }
