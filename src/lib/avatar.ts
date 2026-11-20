export type AvatarPlanUser = {plusActive?: boolean; plan?: {plus?: boolean; extra_active?: boolean} | null} | null | undefined;
export const REGULAR_AVATAR = 'https://lottie.host/6504c21f-a8bc-463c-bcb5-37b057de3cdb/RvCn4lEDXK.lottie';
export const PREMIUM_AVATAR = 'https://lottie.host/85c5d7f7-7dd7-40f3-bd0c-c65b7e94c644/Afpy1ehqkk.lottie';
export function avatarSource(user: AvatarPlanUser) { return user?.plusActive || user?.plan?.plus || user?.plan?.extra_active ? PREMIUM_AVATAR : REGULAR_AVATAR; }
