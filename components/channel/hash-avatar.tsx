import { firstInitial, getAvatarColor } from '@/lib/avatar-colors';

export function HashAvatar({
  userId,
  name,
  size = 24,
  ringColor,
}: {
  userId: string;
  name: string;
  size?: number;
  ringColor?: string;
}) {
  const color = getAvatarColor(userId);
  const initial = firstInitial(name);
  return (
    <span
      className="inline-flex shrink-0 items-center justify-center rounded-full font-medium leading-none text-white"
      style={{
        width: size,
        height: size,
        fontSize: Math.round(size * 0.42),
        background: color,
        boxShadow: ringColor ? `0 0 0 2px ${ringColor}` : undefined,
      }}
    >
      {initial}
    </span>
  );
}
