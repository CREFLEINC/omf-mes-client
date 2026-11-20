import { Button, TextField } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useEffect, useId, useState } from 'react';

import {
  FilterMoreButton,
  HiddenFilterChips,
  hasChangedFilters,
  useFilterMore,
  type HiddenFilterChip,
} from '../../patterns/filter-more';
import { Select } from '../../patterns/select';
import { sourceCodeOptions, stageOptions, type CodeOption } from './codes';
import { EMPTY_FILTERS, type TargetFilters } from './filters';
import type { CodeOptionSource } from './lookups';

interface SelectCellProps {
  label: string;
  options: CodeOption[];
  value: string;
  /** 선택지가 비었을 때의 사유(G-2). 비어 있으면 감추지 않고 이유를 단다 */
  pendingNote?: string;
  /** 선택지가 «있어도» 상시 붙는 안내 — 축의 범위나 소스를 알릴 때 쓴다 */
  note?: string;
  wide?: boolean;
  onChange: (value: string) => void;
}

/**
 * 디자인 시스템 `Select`에는 `label` prop이 없다 — 라벨을 직접 붙이고 `htmlFor`로 잇는다(배치 규범 3).
 * 두 안내가 한 자리를 쓴다 — 선택지가 비면 그 사유(G-2)가 먼저다.
 */
const SelectCell = ({
  label,
  options,
  value,
  pendingNote,
  note,
  wide,
  onChange,
}: SelectCellProps) => {
  const id = useId();
  const noteId = `${id}-note`;
  const t = messages.dispositionRequest;
  const isPending = options.length === 0;
  const choices = isPending ? [] : [{ value: '', label: t.all }, ...options];
  const description = isPending ? pendingNote : note;

  return (
    <div className={wide === true ? 'field-cell wide-select' : 'field-cell'}>
      <label className="field-label" htmlFor={id}>
        {label}
      </label>
      <Select
        id={id}
        options={choices}
        value={value === '' && isPending ? null : value}
        placeholder={isPending ? t.codePlaceholder : t.all}
        aria-describedby={description === undefined ? undefined : noteId}
        onChange={onChange}
      />
      {description !== undefined && (
        <span id={noteId} className="field-note">
          {description}
        </span>
      )}
    </div>
  );
};

export interface FilterBarProps {
  applied: TargetFilters;
  warehouses: CodeOptionSource;
  onApply: (filters: TargetFilters) => void;
  /** 접힌 조건 칩의 ×. 그 조건 하나만 풀고 곧바로 다시 조회한다. */
  onRemoveFilter: (key: keyof TargetFilters) => void;
  onReset: () => void;
}

/**
 * 조회 조건 줄.
 *
 * **보이는 칸은 셋이다**(C-6) — 원천 · 상태 · 검색어. 창고는 「조건 더보기」에 접고, 걸려 있으면
 * 칩으로만 알린다. 「초기화」는 바뀐 것이 있을 때만 보인다.
 */
export const FilterBar = ({
  applied,
  warehouses,
  onApply,
  onRemoveFilter,
  onReset,
}: FilterBarProps) => {
  const t = messages.dispositionRequest;
  const more = useFilterMore();
  const [draft, setDraft] = useState<TargetFilters>(applied);
  const { warehouseId, sourceCode, stage, q } = applied;

  useEffect(() => {
    setDraft({ warehouseId, sourceCode, stage, q });
  }, [warehouseId, sourceCode, stage, q]);

  /*
   * 초기화. **편집 중인 값도 함께 비운다** — 조회한 값이 이미 처음 값이면 주소가 바뀌지 않아
   * 되돌림 effect 가 깨어나지 않고, 치던 값이 그대로 남는다.
   */
  const reset = (): void => {
    setDraft(EMPTY_FILTERS);
    onReset();
  };

  /* 접힌 칸(창고)의 조건만 칩으로 — 보이는 칸의 값을 칩으로 겹쳐 적지 않는다. */
  const hiddenChips: HiddenFilterChip<keyof TargetFilters>[] =
    warehouseId === ''
      ? []
      : [
          {
            key: 'warehouseId',
            label: t.chipWarehouse(
              warehouses.options.find((option) => option.value === warehouseId)?.label ??
                messages.common.reference.unknown,
            ),
          },
        ];

  return (
    <>
      <div className="filter-bar disposition-request-filter">
        {/* 원천 — 서버가 파생하는 축이고 화면은 «거르는 축»으로만 쓴다(스펙 §5-1-1). */}
        <SelectCell
          label={t.fields.sourceCode}
          options={sourceCodeOptions()}
          value={draft.sourceCode}
          onChange={(value) => setDraft((current) => ({ ...current, sourceCode: value }))}
        />
        {/*
         * 상태 — 「부적합 없음」은 대상 목록의 서버 축이고, 나머지 셋은 부적합 목록에서 온다
         * (요구서 §3-7 둘째 행). 소스가 갈린다는 사실을 상시 적는다 — 검색어가 그쪽에는 안 실린다.
         */}
        <SelectCell
          label={t.fields.stage}
          options={stageOptions()}
          value={draft.stage}
          note={t.stageSourceNote}
          onChange={(value) => setDraft((current) => ({ ...current, stage: value }))}
        />
        <div className="field-cell">
          <TextField
            label={t.fields.keyword}
            value={draft.q}
            placeholder={t.keywordPlaceholder}
            fullWidth
            onChange={(event) => setDraft((current) => ({ ...current, q: event.target.value }))}
          />
        </div>
        <div className="field-cell-unlabeled disposition-request-filter-actions">
          <div className="filter-actions">
            <Button onClick={() => onApply(draft)}>{messages.common.search}</Button>
            {hasChangedFilters(EMPTY_FILTERS, draft, applied) && (
              <Button variant="outlined" onClick={reset}>
                {messages.common.reset}
              </Button>
            )}
            <FilterMoreButton open={more.isOpen} controlsId={more.id} onToggle={more.toggle} />
          </div>
        </div>
      </div>

      {/* `hidden` 은 감싸는 상자에 둔다 — `.filter-bar` 의 display 가 속성을 덮는다. */}
      <div id={more.id} hidden={!more.isOpen}>
        <div className="filter-bar disposition-request-filter">
          {/*
           * 창고 — 판정 대상은 불량창고에 들어온 LOT이라 선택지는 불량창고 목록이다. 목록이 비면 창고를
           * 거르지 않고 조회한다는 사실을 밝힌다 — 빈 목록을 「데이터가 없다」로 읽지 않게.
           */}
          <SelectCell
            label={t.fields.warehouse}
            options={warehouses.options}
            value={draft.warehouseId}
            pendingNote={t.warehousePending}
            wide
            onChange={(value) => setDraft((current) => ({ ...current, warehouseId: value }))}
          />
        </div>
      </div>

      <HiddenFilterChips open={more.isOpen} chips={hiddenChips} onRemove={onRemoveFilter} />
    </>
  );
};
