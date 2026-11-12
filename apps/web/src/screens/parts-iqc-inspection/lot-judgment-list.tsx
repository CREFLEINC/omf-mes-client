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
  /*
   * 서버는 그 LOT 의 판정을 불합격 · 보류에서 바꾼 경우에만 값을 싣고 그 밖에는 null 이다(S12 · G2) — 칸이 있으면 그것만 쓴다.
   * 결과의 사유는 다른 LOT 을 덮은 것일 수 있어 칸이 없을 때(서버 T134 전)만 읽는다.
   */
  /* 생성 계약은 두 칸을 늘 싣지만, 칸이 없는 응답(서버 T134 전)도 지금처럼 결과에서 읽는다. */
  const own: { reinspectionReasonCode?: string | null; reinspectionReasonName?: string | null } =
    judgment;
  if ('reinspectionReasonCode' in own || 'reinspectionReasonName' in own) {
    return own.reinspectionReasonName ?? own.reinspectionReasonCode ?? null;
  }
  const result = results.find((each) => each.inspectionResultId === judgment.resultId);
  return result?.reinspectionReasonName ?? result?.reinspectionReasonCode ?? null;
};

/**
 * 자재 관리 LOT 별 판정(FR-023 · US3-8 · 2026-11-12) — LOT 마다 그 LOT 를 매칭한 마지막 결과의 판정과, 앞 결과를 대체했으면
 * 「LOT 0001: 결과 1 불합격 → 결과 2 합격(사유)」. 매칭한 결과가 없는 LOT 은 판정에서 빠진다고 알린다.
 */
type Judged = InspectionLotJudgmentForward & { resultSeqNo: number };

export const LotJudgmentList = ({ judgments, lots, results }: LotJudgmentListProps) => {
  /* 매칭한 결과가 없는 줄(서버가 null 로 싣는다 · G2 M1)은 「매칭 없음」으로 센다. */
  const judged = judgments.filter((each): each is Judged => each.resultSeqNo !== null);
  const unmatched = lots.filter((lot) => !judged.some((each) => each.lotId === lot.lotId));

  return (
    <section className="iqc-inbound-lot-judgments" aria-label={t.heading}>
      <h4 className="parts-iqc-sub-title">{t.heading}</h4>
      <p className="field-note">{t.help}</p>
      <ul className="iqc-inbound-lot-judgment-list">
        {judged.map((judgment) => {
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
