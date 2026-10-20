import { Button } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';

import type { ResourceRecommendationChip } from './resource-recommendation';

const t = messages.workOrder.resourcePane;

/* 작업자의 배정 있음도 접근 이름은 설비와 같은 긴 문장으로 읽는다 — 칩 안의 짧은 말만 다르다. */
const LONG_WARNING: Record<NonNullable<ResourceRecommendationChip['warning']>, string> = {
  busy: t.recommendation.busy,
  workerBusy: t.recommendation.busy,
  outOfService: t.recommendation.outOfService,
};

interface RecommendationChipsProps {
  /** 칸 이름 — 후보 묶음의 접근 이름이 된다 */
  label: string;
  chips: ResourceRecommendationChip[];
  value: string;
  disabled: boolean;
  onPick: (chip: ResourceRecommendationChip) => void;
}

export const RecommendationChips = ({
  label,
  chips,
  value,
  disabled,
  onPick,
}: RecommendationChipsProps) => {
  if (chips.length === 0) return null;

  return (
    <div
      className="work-order-recommendations"
      role="group"
      aria-label={`${label} ${t.recommendation.label}`}
    >
      <span className="field-note">{t.recommendation.label}</span>
      {chips.map((chip) => {
        const isAssigned = chip.value === value;
        const name = [
          chip.source === null ? null : t.recommendation.sources[chip.source],
          chip.label,
          chip.warning === null ? null : LONG_WARNING[chip.warning],
          isAssigned ? t.recommendation.assigned : null,
        ]
          .filter((part) => part !== null)
          .join(', ');

        return (
          <Button
            key={chip.value}
            size="sm"
            variant="outlined"
            className={`work-order-recommendation${isAssigned ? ' is-assigned' : ''}`}
            title={chip.label}
            aria-label={name}
            disabled={disabled}
            onClick={() => onPick(chip)}
          >
            {/* 기호는 매핑 화면의 ★(자동 배정)와 같게 둔다. 뜻은 접근 이름이 말한다. */}
            {isAssigned && <span aria-hidden="true">✓ </span>}
            {chip.source === 'DEFAULT' && <span aria-hidden="true">★ </span>}
            {(chip.source === 'RECENT' || chip.source === 'QUALIFIED') && (
              <span aria-hidden="true" className="work-order-recommendation-tag">
                {t.recommendation.sources[chip.source]}
              </span>
            )}
            <span aria-hidden="true">{chip.code}</span>
            {chip.warning !== null && (
              <span aria-hidden="true" className="work-order-recommendation-warning">
                {` · ${t.recommendation.short[chip.warning]}`}
              </span>
            )}
          </Button>
        );
      })}
    </div>
  );
};
