import { Chip } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useState } from 'react';

import { DispositionBox } from '../disposition-decision/disposition-box';
import { oqcInspectionKeys } from './queries';

/** 처분 저장 뒤 OQC 상세(피킹 LOT 판정 · 교체 줄)를 다시 읽는다. */
const OQC_REFRESH_KEYS = [oqcInspectionKeys.all];

export interface ReplacedNonconformance {
  nonconformanceId: number;
  nonconformanceNo: string;
}

/**
 * 출하 OQC 불합격 LOT 을 교체할 때 서버가 세운 부적합(피처 010 · 처분 대기) — 검사 상세와 따로 처분 상자로 선다
 * (omf-all-around#354). 교체한 LOT 이 여럿이면 부적합 번호 칩으로 골라 본다.
 */
export const ReplacedDispositions = ({
  nonconformances,
}: {
  nonconformances: readonly ReplacedNonconformance[];
}) => {
  const [pickedId, setPickedId] = useState<number | null>(null);
  const first = nonconformances[0];
  if (first === undefined) return null;
  const current =
    nonconformances.find((nonconformance) => nonconformance.nonconformanceId === pickedId) ?? first;

  return (
    <>
      {nonconformances.length > 1 && (
        <div
          className="quality-approval-status-chips oqc-replaced-nc-chips"
          role="group"
          aria-label={messages.dispositionDecision.box.title}
        >
          {nonconformances.map((nonconformance) => {
            const isActive = nonconformance.nonconformanceId === current.nonconformanceId;
            return (
              <Chip
                key={nonconformance.nonconformanceId}
                variant="filter"
                size="sm"
                selected={isActive}
                aria-pressed={isActive}
                onClick={() => setPickedId(nonconformance.nonconformanceId)}
              >
                {nonconformance.nonconformanceNo}
              </Chip>
            );
          })}
        </div>
      )}
      <DispositionBox nonconformanceId={current.nonconformanceId} refreshKeys={OQC_REFRESH_KEYS} />
    </>
  );
};
