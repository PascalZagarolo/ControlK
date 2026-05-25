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

// Gradient pairs for the legacy `Avatar` component (used in surfaces that
// still render a gradient — workspace settings members tab, todo-detail
// drawer, owner pickers, etc.). Keep the same 10-bucket alignment as
// AVATAR_COLORS so a user's hash-derived flat color and their stored
// gradient feel like the same "identity slot". The darker `to` is hand-
// picked to give a clean vertical-light fall-off without crushing.
export const AVATAR_GRADIENTS: ReadonlyArray<{ from: string; to: string }> = [
  { from: '#7C5CFF', to: '#5740B3' },
  { from: '#5E9EFF', to: '#4072B3' },
  { from: '#FF8A5C', to: '#B36140' },
  { from: '#5FCFA8', to: '#3F8E74' },
  { from: '#E8B86D', to: '#A37F4B' },
  { from: '#B86DDB', to: '#7F4998' },
  { from: '#FFB85C', to: '#B37F3F' },
  { from: '#6DDBDB', to: '#479898' },
  { from: '#DB6D8A', to: '#984B5F' },
  { from: '#8A8A8A', to: '#5F5F5F' },
];

// Pick a random gradient pair. Used at signup so each new user lands on
// a distinct visual slot instead of the default blue. Cryptographic
// strength is not needed — Math.random gives enough variation for the
// expected workspace sizes (10s, not millions).
export function randomUserAvatarColors(): { from: string; to: string } {
  return AVATAR_GRADIENTS[Math.floor(Math.random() * AVATAR_GRADIENTS.length)];
}

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

// Discord-style discriminator: deterministic 4-digit suffix (#0001 .. #9999)
// derived from the same FNV hash. Stable per user, no DB column needed.
// Two users sharing a first name remain unambiguous because the hash
// virtually never collides on 16-byte UUIDs.
export function getDiscriminator(userId: string): string {
  const h = hash(userId);
  const n = (h % 9999) + 1;
  return '#' + n.toString().padStart(4, '0');
}
