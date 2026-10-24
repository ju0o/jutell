/** User's local time with its zone, e.g. "2026-10-24 21:07 (UTC+9)". */
export function stamp(now: Date) {
  const pad = (value: number) => String(value).padStart(2, '0');
  const offset = -now.getTimezoneOffset();
  const zone = `UTC${offset < 0 ? '-' : '+'}${Math.floor(Math.abs(offset) / 60)}${Math.abs(offset) % 60 ? `:${pad(Math.abs(offset) % 60)}` : ''}`;
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())} (${zone})`;
}

/** '이' after a final consonant (batchim), else '가': 결제 → 가, 로그인 → 이, login → 이. */
export function subjectParticle(word: string) {
  const last = word.trim().slice(-1);
  const code = last.charCodeAt(0);
  if (code >= 0xac00 && code <= 0xd7a3) return (code - 0xac00) % 28 ? '이' : '가';
  if (/[0136789]/.test(last)) return '이';
  return /[lmn]/i.test(last) || /(?:ng|ck|[bdgkpt])$/i.test(word.trim()) ? '이' : '가';
}
