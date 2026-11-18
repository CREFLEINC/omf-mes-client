import type {
  InspectionLotJudgmentForward,
  InspectionResultSummaryForward,
} from '@omf-mes/api-client';
import { messages } from '@omf-mes/i18n';

import { judgmentText, lotTail } from './result-list';

const t = messages.iqcInboundLot.results.lotJudgments;

export interface SupersededNotesProps {
  judgments: readonly InspectionLotJudgmentForward[];
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
 * 재검으로 판정이 바뀐 LOT(FR-023 · US3-8 · 2026-11-12) — 「LOT 0001: 1회차 불합격 → 2회차 합격(사유)」를 한 줄씩.
 * LOT 별 판정 · 적용 회차는 자재 관리 LOT 표의 칸으로 옮겼다(사용자 시안 2026-11-16 · #274). 바뀐 LOT 이 없으면 그리지 않는다.
 */
export const SupersededNotes = ({ judgments, results }: SupersededNotesProps) => {
  const lines = judgments.flatMap((judgment) => {
    const before = judgment.superseded.at(-1);
    if (judgment.resultSeqNo === null || before === undefined) return [];

    return [
      {
        lotId: judgment.lotId,
        text: t.superseded(
          lotTail(judgment.lotNo),
          before.resultSeqNo,
          judgmentText(before.judgmentCode),
          judgment.resultSeqNo,
          judgmentText(judgment.judgmentCode),
          reasonOf(judgment, results),
        ),
      },
    ];
  });

  return lines.length === 0 ? null : (
    <ul className="iqc-inbound-reason-lines iqc-inbound-superseded" aria-label={t.heading}>
      {lines.map((line) => (
        <li key={line.lotId}>{line.text}</li>
      ))}
    </ul>
  );
};
