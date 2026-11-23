import type { DecisionConfirmRow } from './decision-confirm-dialog';

/**
 * 결재 대기 · 승인 · 반려 중인 처분 · 특채의 내용 — 무엇으로 결재를 올렸는지(#352 사용자 지시). 판정 확인 팝업과 같은
 * 「이름 | 값」 두 칸이다.
 */
export const PendingDetails = ({ rows }: { rows: readonly DecisionConfirmRow[] }) => (
  <dl className="disposition-confirm-rows disposition-pending-details">
    {rows.map((row) => (
      <div key={row.label}>
        <dt>{row.label}</dt>
        <dd>{row.strong === true ? <strong>{row.value}</strong> : row.value}</dd>
      </div>
    ))}
  </dl>
);
