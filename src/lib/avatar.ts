export type AvatarPlanUser = {avatar_variant?: 'male' | 'female'; plusActive?: boolean; plan?: {plus?: boolean; extra_active?: boolean} | null} | null | undefined;
export const REGULAR_AVATAR = 'https://lottie.host/6504c21f-a8bc-463c-bcb5-37b057de3cdb/RvCn4lEDXK.lottie';
export const PREMIUM_AVATAR = 'https://lottie.host/85c5d7f7-7dd7-40f3-bd0c-c65b7e94c644/Afpy1ehqkk.lottie';
export const FEMALE_AVATAR = 'https://lottie.host/c1ccfe5d-dbe7-4650-9e6f-a397c53d0acd/iFxLD7TCdf.lottie';
export function avatarSource(user: AvatarPlanUser) { return user?.avatar_variant === 'female' ? FEMALE_AVATAR : user?.plusActive || user?.plan?.plus || user?.plan?.extra_active ? PREMIUM_AVATAR : REGULAR_AVATAR; }
