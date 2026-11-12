import { Chip } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';

import type { IqcResultRef } from './types';

const t = messages.dispositionDecision.inboundLot;

/** 「결과 2 불합격 · 외관 찍힘」 — 판정 이름을 모르면 코드 그대로(G-9). */
export const iqcResultLabel = (result: IqcResultRef): string =>
  t.resultChip(
    result.seqNo,
    result.overallJudgmentCode === null
      ? '—'
      : (t.judgment[result.overallJudgmentCode] ?? result.overallJudgmentCode),
    result.defectSummary === undefined ||
      result.defectSummary === null ||
      result.defectSummary === ''
      ? null
      : result.defectSummary,
  );

export interface IqcMatchChipsProps {
  results: readonly IqcResultRef[] | undefined;
  /** 불합격 결과 수만 왔을 때(매칭 목록 없음) — 「불합격 결과 n건」. */
  rejectedCount?: number | undefined;
  emptyText: string;
}

/**
 * 자재 관리 LOT 의 IQC 결과 매칭(005 · 참고용) — 처분은 입하 LOT 단위라 매칭은 판단을 돕는 표시일 뿐이다.
 * 불합격은 붉게, 합격은 초록, 그 밖은 회색.
 */
export const IqcMatchChips = ({ results, rejectedCount, emptyText }: IqcMatchChipsProps) => {
  if (results !== undefined && results.length > 0) {
    return (
      <span className="disposition-iqc-matches">
        {results.map((result) => (
          <Chip
            key={result.inspectionResultId}
            size="sm"
            status={
              result.overallJudgmentCode === 'REJECTED'
                ? 'error'
                : result.overallJudgmentCode === 'ACCEPTED'
                  ? 'success'
                  : 'idle'
            }
          >
            {iqcResultLabel(result)}
          </Chip>
        ))}
      </span>
    );
  }
  if (rejectedCount !== undefined && rejectedCount > 0) {
    return (
      <Chip size="sm" status="error">
        {t.rejectedCount(rejectedCount)}
      </Chip>
    );
  }
  return <span className="field-note">{emptyText}</span>;
};
