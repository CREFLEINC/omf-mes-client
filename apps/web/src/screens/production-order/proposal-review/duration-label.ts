export function durationLabel(seconds: number | null | undefined): string {
  if (seconds === undefined) return '';
  if (seconds === null) return '표준 C/T 미설정';
  if (!Number.isFinite(seconds) || seconds < 0) return '—';
  return `예상 ${seconds.toLocaleString(undefined, { maximumFractionDigits: 3 })}초`;
}

export function cycleTimeLabel(seconds: number | null | undefined): string {
  if (seconds === undefined) return '표준 C/T 조회 중';
  if (seconds === null) return '표준 C/T 미설정';
  return `표준 C/T ${seconds.toLocaleString(undefined, { maximumFractionDigits: 6 })}초/개`;
}
