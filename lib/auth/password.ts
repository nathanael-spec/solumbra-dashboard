/**
 * One password, read from the environment. No database here: the dashboard
 * stores nothing, it only reads.
 */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export function verifyPassword(candidate: string): boolean {
  const expected = process.env.DASHBOARD_PASSWORD ?? '';
  // A blank configured password must never mean an open door.
  if (!expected) return false;
  return timingSafeEqual(candidate, expected);
}
