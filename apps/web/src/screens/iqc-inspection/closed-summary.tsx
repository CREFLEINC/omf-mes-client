import { messages } from '@omf-mes/i18n';
import type { ReactNode } from 'react';

import type { CodeOption } from './code-options';
import { formatDateTime, type InspectionResultRound } from './types';
import { withUom } from './uom-lookup';

const t = messages.iqcInspection.result;

export interface ClosedSummaryProps {
  round: InspectionResultRound;
  judgmentOptions: readonly CodeOption[];
  uomCode: string | null;
  /** 불량 LOT 이면 처분·반품 안내(omf-all-around#106 후속 (나)) — 요약 아래에 그대로 둔다. */
  followUp?: ReactNode;
}

/**
 * 끝난 의뢰의 읽기 전용 요약(3단계 검증 · 담당자 지시 2026-10-19).
 *
 * 의뢰가 끝났고(COMPLETED) 최신 회차가 확정이면 판정·수량·불합격 사유 입력을 두지 않고 최신 회차의 결과만
 * 보인다 — 회차 단추를 누르지 않아도 최신이 보인다. 재작업 처분으로 의뢰가 다시 열리면(IN_PROGRESS) 입력
 * 화면과 [재검사]가 돌아온다(서버 P-43).
 */
export const ClosedSummary = ({
  round,
  judgmentOptions,
  uomCode,
  followUp = null,
}: ClosedSummaryProps) => {
  const judgment =
    judgmentOptions.find((option) => option.value === round.overallJudgmentCode)?.label ??
    round.overallJudgmentCode;

  return (
    <section className="iqc-inspection-section iqc-inspection-closed" aria-label={t.closed.title}>
      <div className="iqc-inspection-section-head">
        <h3>{t.closed.title}</h3>
        <p className="field-note">{t.round(round.inspectionRound)}</p>
      </div>
      <p className="field-note">{t.closed.note}</p>
      <dl className="iqc-inspection-closed-grid">
        <div>
          <dt className="field-label">{t.closed.finalJudgment}</dt>
          <dd>
            <strong>{judgment}</strong>
          </dd>
        </div>
        <div>
          <dt className="field-label">{t.fields.inspectedQty}</dt>
          <dd>{withUom(String(round.inspectedQty), uomCode)}</dd>
        </div>
        <div>
          <dt className="field-label">{t.fields.accepted}</dt>
          <dd>{withUom(String(round.acceptedQty), uomCode)}</dd>
        </div>
        <div>
          <dt className="field-label">{t.fields.rejected}</dt>
          <dd>{withUom(String(round.rejectedQty), uomCode)}</dd>
        </div>
        <div>
          <dt className="field-label">{t.fields.held}</dt>
          <dd>{withUom(String(round.heldQty), uomCode)}</dd>
        </div>
        <div>
          <dt className="field-label">{t.closed.confirmedAt}</dt>
          <dd>{round.confirmedAt === null ? '—' : formatDateTime(round.confirmedAt)}</dd>
        </div>
      </dl>
      {followUp}
    </section>
  );
};
