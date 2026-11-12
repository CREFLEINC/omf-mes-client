import { Chip } from '@crefle/web-ui';
import type {
  InspectionLotForward,
  InspectionLotJudgmentForward,
  InspectionResultSummaryForward,
} from '@omf-mes/api-client';
import { messages } from '@omf-mes/i18n';

import { LotNo } from './lot-match-field';
import { judgmentStatus, judgmentText, lotTail } from './result-list';

const t = messages.iqcInboundLot.results.lotJudgments;

export interface LotJudgmentListProps {
  judgments: readonly InspectionLotJudgmentForward[];
  lots: readonly InspectionLotForward[];
  results: readonly InspectionResultSummaryForward[];
}

/** 대체한 결과의 재검 사유 이름 — LOT 판정에 실려 오면 그것, 없으면 결과 목록의 같은 결과에서. 이름이 없으면 코드. */
const reasonOf = (
  judgment: InspectionLotJudgmentForward,
  results: readonly InspectionResultSummaryForward[],
): string | null => {
  const result = results.find((each) => each.inspectionResultId === judgment.resultId);

  return (
    judgment.reinspectionReasonName ??
    result?.reinspectionReasonName ??
    judgment.reinspectionReasonCode ??
    result?.reinspectionReasonCode ??
    null
  );
};

/**
 * 자재 관리 LOT 별 판정(FR-023 · US3-8 · 2026-11-12) — LOT 마다 그 LOT 를 매칭한 마지막 결과의 판정과, 앞 결과를 대체했으면
 * 「LOT 0001: 결과 1 불합격 → 결과 2 합격(사유)」. 매칭한 결과가 없는 LOT 은 판정에서 빠진다고 알린다.
 */
export const LotJudgmentList = ({ judgments, lots, results }: LotJudgmentListProps) => {
  const unmatched = lots.filter((lot) => !judgments.some((each) => each.lotId === lot.lotId));

  return (
    <section className="iqc-inbound-lot-judgments" aria-label={t.heading}>
      <h4 className="parts-iqc-sub-title">{t.heading}</h4>
      <p className="field-note">{t.help}</p>
      <ul className="iqc-inbound-lot-judgment-list">
        {judgments.map((judgment) => {
          const before = judgment.superseded.at(-1);

          return (
            <li key={judgment.lotId}>
              <LotNo lotNo={judgment.lotNo} />
              <Chip size="sm" status={judgmentStatus(judgment.judgmentCode)}>
                {judgmentText(judgment.judgmentCode)}
              </Chip>
              <span className="parts-iqc-muted">{t.byResult(judgment.resultSeqNo)}</span>
              {before === undefined ? null : (
                <span className="iqc-inbound-superseded">
                  {t.superseded(
                    lotTail(judgment.lotNo),
                    before.resultSeqNo,
                    judgmentText(before.judgmentCode),
                    judgment.resultSeqNo,
                    judgmentText(judgment.judgmentCode),
                    reasonOf(judgment, results),
                  )}
                </span>
              )}
            </li>
          );
        })}
      </ul>
      {unmatched.length === 0 ? null : (
        <p className="field-note">{t.unmatched(unmatched.length)}</p>
      )}
    </section>
  );
};
