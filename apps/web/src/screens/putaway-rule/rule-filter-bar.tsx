import { Button, Checkbox } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import type { ReactNode } from 'react';

import { SelectField } from './select-field';
import type { RuleFilters } from './types';

const t = messages.putawayRule;

export interface RuleFilterBarProps {
  appliedFilters: RuleFilters;
  onApply: (filters: RuleFilters) => void;
  onReset: () => void;
  /** 줄 오른쪽 끝의 화면 단추(규칙 추가 · 다시 조회) — 입고 관리 짜임에는 머리 줄이 없다(사용자 지시 2026-10-29). */
  actions?: ReactNode;
}

/**
 * 적치 규칙 조회 조건 줄 — 창고 상세 탭 안이라 창고는 고르지 않는다(상세가 고른 창고, 사용자 지시 2026-10-29).
 *
 * 두 조건(품목 · 사용 중만) 다 **고르는 축**이라 고르는 즉시 조회한다 — 「조회」 버튼을 두지 않는다.
 *
 * 이 화면 슬라이스가 소유한다 — 다른 화면 슬라이스의 같은 이름 부품을 참조하지 않는다.
 */
export const RuleFilterBar = ({
  appliedFilters,
  onApply,
  onReset,
  actions,
}: RuleFilterBarProps) => {
  return (
    <div className="filter-bar">
      {/* 품목은 9천여 건이라 칸이 쪽 단위로 받는다 — 펼칠 때 첫 쪽, 검색은 서버로(사용자 지시 2026-10-29). */}
      <SelectField
        wide
        label={t.fields.item}
        items={{ leadingOptions: [{ value: '', label: t.filters.all }] }}
        value={appliedFilters.itemId}
        onChange={(value) => {
          onApply({ ...appliedFilters, itemId: value });
        }}
      />

      <div className="field-cell field-cell-unlabeled">
        <Checkbox
          checked={appliedFilters.activeOnly}
          onChange={(event) => {
            onApply({ ...appliedFilters, activeOnly: event.target.checked });
          }}
        >
          {t.filters.activeOnly}
        </Checkbox>
      </div>

      <div className="field-cell field-cell-unlabeled">
        <div className="filter-actions">
          <Button variant="outlined" onClick={onReset}>
            {messages.common.reset}
          </Button>
        </div>
      </div>
      {actions !== undefined && (
        <div className="field-cell-unlabeled putaway-rule-actions">{actions}</div>
      )}
    </div>
  );
};
