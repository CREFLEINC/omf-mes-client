import { formatQty } from './process-model';

/** 표준 C/T 값 글자 — 「12초/개」. 정해지지 않았으면 「미설정」. */
export const cycleTimeText = (seconds: number | null, unit: string): string =>
  seconds === null ? '미설정' : `${formatQty(seconds)}초/${unit === 'EA' ? '개' : unit}`;

export function CycleTimeSummary({ seconds, unit }: { seconds: number | null; unit: string }) {
  return (
    <div className="erp-wo-cycle-time-inline">
      <span>표준 C/T</span>
      <strong>{cycleTimeText(seconds, unit)}</strong>
    </div>
  );
}
