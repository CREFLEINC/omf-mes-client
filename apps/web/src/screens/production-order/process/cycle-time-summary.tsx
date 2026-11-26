import { formatQty } from './process-model';

export function CycleTimeSummary({ seconds, unit }: { seconds: number | null; unit: string }) {
  return (
    <div className="erp-wo-cycle-time-inline">
      <span>표준 C/T</span>
      <strong>
        {seconds === null ? '미설정' : `${formatQty(seconds)}초/${unit === 'EA' ? '개' : unit}`}
      </strong>
    </div>
  );
}
