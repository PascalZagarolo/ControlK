export const AVATAR_COLORS = [
  '#7C5CFF',
  '#5E9EFF',
  '#FF8A5C',
  '#5FCFA8',
  '#E8B86D',
  '#B86DDB',
  '#FFB85C',
  '#6DDBDB',
  '#DB6D8A',
  '#8A8A8A',
] as const;

function hash(input: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h;
}

export function getAvatarColor(userId: string): string {
  return AVATAR_COLORS[hash(userId) % AVATAR_COLORS.length];
}

export function firstInitial(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return '?';
  return trimmed.charAt(0).toUpperCase();
}
