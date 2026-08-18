import { Button, Checkbox, Chip } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';

import { toFilterChips, type FilterKey } from './filters';
import { SelectField } from './select-field';
import type { RuleFilters, SelectOption } from './types';

const t = messages.putawayRule;

export interface RuleFilterBarProps {
  /** 주소에 반영된(= 조회에 쓰인) 조건. 이 부품은 편집 상태를 따로 들지 않는다. */
  appliedFilters: RuleFilters;
  warehouseOptions: SelectOption[];
  /** 선택지의 한계(잘림·실패) 안내. 밝히지 않으면 값이 사라진 것으로 읽힌다. */
  warehouseNote?: string;
  /** 품목 선택지. **창고를 고르기 전에는 비어 있다** — 그때는 칸 자체가 잠긴다. */
  itemOptions: SelectOption[];
  itemNote?: string;
  /** 조건 칩에 실을 창고 이름. 번호를 문구로 만드는 자리를 두지 않기 위한 것이다. */
  warehouseLabel: (warehouseId: string) => string;
  itemLabel: (itemId: string) => string;
  onApply: (filters: RuleFilters) => void;
  /** 조건 칩의 ×. 그 조건 하나만 푼다. */
  onRemoveFilter: (key: FilterKey) => void;
  onReset: () => void;
}

/**
 * 적치 규칙 조회 조건 줄.
 *
 * **트리거 모델이 전례와 다르다 — 셋 다 「고르면 즉시」다.**
 *
 * 전례(결재선·공통코드)는 검색어 입력칸이 있어 「모아서 적용」이 필요했다. 이 화면의 조건은
 * 셋 다 **고르는 축**이고 치는 축이 없다(계약의 목록 쿼리에 검색어가 없다) — 고른 것이
 * 반영되지 않은 채 남는 상태를 만들지 않는 편이 낫다. 그래서 「조회」 버튼을 두지 않는다.
 * 눌러야 할 것이 없는 버튼을 두면 사용자가 그것을 누르지 않아 화면이 비어 있는 이유가
 * 「창고를 안 골랐다」인지 「안 눌렀다」인지 갈린다.
 *
 * **창고를 바꾸면 품목 조건이 함께 풀린다** — 품목 선택지가 창고로 좁혀지므로 앞 창고에서 고른
 * 품목은 이 창고의 조건이 아니다. 그 규칙은 `filters.ts`의 `clearFilter`와 같은 뜻이다.
 *
 * 이 화면 슬라이스가 소유한다 — 다른 화면 슬라이스의 같은 이름 부품을 참조하지 않는다.
 */
export const RuleFilterBar = ({
  appliedFilters,
  warehouseOptions,
  warehouseNote,
  itemOptions,
  itemNote,
  warehouseLabel,
  itemLabel,
  onApply,
  onRemoveFilter,
  onReset,
}: RuleFilterBarProps) => {
  /* 「전체」를 값이 빈 선택지로 둔다 — 두지 않으면 한 번 고른 뒤에 해제할 방법이 칸 안에 없어진다. */
  const withAll = (options: SelectOption[]): SelectOption[] => [
    { value: '', label: t.filters.all },
    ...options,
  ];

  const hasWarehouse = appliedFilters.warehouseId !== '';
  const chips = toFilterChips(appliedFilters, warehouseLabel, itemLabel);

  return (
    <>
      <div className="filter-bar">
        {/*
         * 규범 3-2 — 선택칸이 「코드 · 이름」을 고른다. 최소 폭을 주지 않으면 선택지 목록이
         * 트리거 폭에 갇혀 잘리고, 무엇을 고르는지 읽을 수 없다.
         */}
        <SelectField
          wide
          label={t.fields.warehouse}
          options={withAll(warehouseOptions)}
          value={appliedFilters.warehouseId}
          note={warehouseNote}
          onChange={(value) => {
            /* 창고가 바뀌면 앞 창고에서 고른 품목은 이 창고의 조건이 아니다. */
            onApply({ ...appliedFilters, warehouseId: value, itemId: '' });
          }}
        />

        <SelectField
          wide
          label={t.fields.item}
          options={withAll(itemOptions)}
          value={appliedFilters.itemId}
          disabled={!hasWarehouse}
          disabledReason={t.filters.itemNeedsWarehouse}
          note={itemNote}
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
      </div>

      {chips.length > 0 && (
        <div className="filter-bar">
          {chips.map((chip) => (
            <Chip
              key={chip.key}
              variant="status"
              removeLabel={chip.removeLabel}
              onRemove={() => {
                onRemoveFilter(chip.key);
              }}
            >
              {chip.label}
            </Chip>
          ))}
        </div>
      )}
    </>
  );
};
