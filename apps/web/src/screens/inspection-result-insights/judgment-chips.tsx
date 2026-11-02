import { Chip } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';

import { HubActions, useHubActionsTarget } from '../../patterns/hub-actions';
import type { InspectionFilterOption } from './filter-bar';
import type { InspectionInsightFilters } from './filters';
import { useLotIdByNo } from './history-queries';
import { useJudgmentCounts } from './queries';

const t = messages.inspectionResultInsights.filter;
const hubText = messages.common.inspectionHub;

interface JudgmentChipsProps {
  /** 지금 걸린 조회 조건 — 건수는 이 조건에서 판정 칩만 바꿔 센다. */
  filters: InspectionInsightFilters;
  /** 판정 칩(합격 · 불합격 · 보류 …). 「전체」는 이 부품이 맨 앞에 붙인다. */
  options: readonly InspectionFilterOption[];
  isEnabled: boolean;
  onChange: (code: string) => void;
}

/**
 * 종합 판정 칩 「전체 N · 합격 N · 불합격 N · 보류 N」 — 조회 조건의 「종합 판정 선택」을 대신한다(사용자 2026-10-30 · #217).
 * 검사 조회·판정 탭 줄의 상태 칩과 같은 자리 · 모양: 누르면 그 판정으로 바로 거르고, 「전체」는 거르기를 푼다.
 * 건수는 지금 조건(기간 · LOT · 유형 …)으로 센다. 탭 묶음 밖이면 그 자리(조회 조건 위)에 선다.
 */
export const JudgmentChips = ({ filters, options, isEnabled, onChange }: JudgmentChipsProps) => {
  const target = useHubActionsTarget();
  const chips = [{ value: '', label: t.all }, ...options];
  const lot = useLotIdByNo(isEnabled ? filters.lotNo : '');
  const lotId = filters.lotNo.trim() === '' ? undefined : (lot.data ?? undefined);
  const counts = useJudgmentCounts(
    filters,
    chips.map((chip) => chip.value),
    isEnabled,
    lotId,
  );
  const group = (
    <div className="inspection-hub-counts" role="group" aria-label={t.judgment}>
      {chips.map((chip, index) => {
        const isActive = filters.overallJudgmentCode === chip.value;
        const count = counts[index];

        return (
          <Chip
            key={chip.value}
            variant="filter"
            size="sm"
            selected={isActive}
            aria-pressed={isActive}
            onSelectedChange={() => onChange(chip.value)}
          >
            {count === undefined ? chip.label : hubText.count(chip.label, count)}
          </Chip>
        );
      })}
    </div>
  );

  return target === null ? group : <HubActions target={target}>{group}</HubActions>;
};
