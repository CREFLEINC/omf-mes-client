import { Button, SearchInput, type SelectOption } from '@crefle/web-ui';
import { messages, named } from '@omf-mes/i18n';
import { useEffect, useId, useMemo, useState } from 'react';

import { DateRangeFields } from '../../patterns/date-range-fields';
import { josa } from '../../patterns/josa';
import { useApiClient } from '../../patterns/api-context';
import {
  FilterMoreButton,
  HiddenFilterChips,
  hasChangedFilters,
  useFilterMore,
} from '../../patterns/filter-more';
import {
  REFERENCE_PAGE_SIZE,
  ReferenceField,
  type ReferenceSource,
} from '../../patterns/reference-picker';
import { runRequest } from '../../patterns/request';
import { Select } from '../../patterns/select';
import { useItemCodeNames } from './item-lookups';
import { DEFAULT_WORKLIST_FILTER, isWorklistFilter } from './worklist-model';
import type { WorklistFilters } from './worklist-queries';

const t = messages.erpWorkOrderFlow.filters;

type Draft = Pick<WorklistFilters, 'state' | 'q' | 'dueFrom' | 'dueTo' | 'item' | 'plant'>;

export interface WorklistFilterBarProps {
  applied: Draft;
  /** 처리 상태 선택지. 「전체」부터 처리 순서대로이고, 이름 뒤 건수는 화면이 붙여 넘긴다. */
  stateOptions: SelectOption[];
  /** 세션 데이터 범위 안 공장. 「전체」는 이 컴포넌트가 앞에 붙인다. */
  plantOptions: SelectOption[];
  /** 범위 안 공장이 하나뿐이라 그 공장으로 정해져 있고 바꿀 수 없다. */
  plantLocked: boolean;
  /** 공장 목록이 잘렸거나 못 불러왔을 때의 안내 */
  plantNote?: string;
  onSearch: (draft: Draft) => void;
  onReset: () => void;
}

/** 품목 참조 선택(C-12). 지난 자료를 찾는 조회 조건이라 사용 중지 품목도 찾는다. */
const useItemSource = (): ReferenceSource => {
  const { client } = useApiClient();
  return useMemo(
    () => ({
      title: t.itemPicker,
      key: ['reference', 'item'],
      columns: { code: t.itemCode, name: t.itemName },
      search: async (term, page, _filterValue, size = REFERENCE_PAGE_SIZE) => {
        const data = await runRequest(() =>
          client.GET('/mdm/items', {
            params: {
              query: {
                ...(term === '' ? {} : { q: term }),
                includeInactive: true,
                page,
                size,
              },
            },
          }),
        );
        return {
          items: data.items.map((item) => ({
            id: item.itemId,
            code: item.itemCode,
            name: item.itemName,
          })),
          total: data.page.total,
        };
      },
    }),
    [client],
  );
};

/** 조회 조건 줄의 처음 값. 공장이 하나로 정해져 있으면 그 공장이 처음 값이다. */
const initialDraft = (plant: string): Draft => ({
  state: DEFAULT_WORKLIST_FILTER,
  q: '',
  dueFrom: '',
  dueTo: '',
  item: '',
  plant,
});

/**
 * C-6 조회 조건 한 줄: 처리 상태(좁음), 번호 검색(보통), 납기 기간(보통), 품목(보통), [초기화], [조회], [조건 더보기].
 * 칸 폭은 C-19의 세 가지(배치 클래스 filter-field-*), 간격은 하나다. Enter로도 조회한다.
 * 처리 상태는 페이지 머리 탭 대신 이 줄의 선택 칸으로 고른다(사용자 지시 2026-11-27). 다른 칸처럼 [조회]를 눌러야 걸린다.
 *
 * 공장은 「조건 더보기」에 접는다(C-6). 접힌 공장 조건이 걸려 있으면 칩으로만 알린다.
 * 범위 안 공장이 하나로 정해져 있으면 바꿀 수 없는 범위라 칩을 세우지 않는다.
 * 「초기화」는 조건 줄의 칸이 처음 값과 다를 때만 보인다.
 */
export const WorklistFilterBar = ({
  applied,
  stateOptions,
  plantOptions,
  plantLocked,
  plantNote,
  onSearch,
  onReset,
}: WorklistFilterBarProps) => {
  const [draft, setDraft] = useState<Draft>(applied);
  const more = useFilterMore();
  const stateId = useId();
  const plantId = useId();
  const plantNoteId = useId();
  const itemSource = useItemSource();
  const { state, q, dueFrom, dueTo, item, plant } = applied;
  useEffect(
    () => setDraft({ state, q, dueFrom, dueTo, item, plant }),
    [state, q, dueFrom, dueTo, item, plant],
  );
  const itemNames = useItemCodeNames(draft.item === '' ? [] : [Number(draft.item)]);
  const [pickedLabel, setPickedLabel] = useState<{ id: string; label: string } | null>(null);
  const known = draft.item === '' ? undefined : itemNames.get(Number(draft.item));
  const itemLabel =
    draft.item === ''
      ? ''
      : pickedLabel?.id === draft.item
        ? pickedLabel.label
        : known === undefined
          ? ''
          : named(known.itemName, known.itemCode);

  const isChanged = hasChangedFilters(initialDraft(plantLocked ? plant : ''), draft, {
    state,
    q,
    dueFrom,
    dueTo,
    item,
    plant,
  });
  const plantLabel = plantOptions.find((option) => option.value === plant)?.label ?? plant;
  /* 접힌 칸(공장)의 조건만 칩으로 — 보이는 칸의 값을 칩으로 겹쳐 적지 않는다. */
  const hiddenChips =
    plantLocked || plant === '' ? [] : [{ key: 'plant' as const, label: t.plantChip(plantLabel) }];

  return (
    <>
      <form
        className="filter-bar erp-wo-filter-bar"
        aria-label={t.pane}
        onSubmit={(event) => {
          event.preventDefault();
          onSearch(draft);
        }}
      >
        <div className="field-cell filter-field-sm">
          <label className="field-label" htmlFor={stateId}>
            {t.state}
          </label>
          <Select
            id={stateId}
            value={draft.state}
            options={stateOptions}
            onChange={(value) => {
              if (isWorklistFilter(value)) setDraft((current) => ({ ...current, state: value }));
            }}
          />
        </div>
        <div className="field-cell filter-field-md erp-wo-filter-q">
          <SearchInput
            fullWidth
            label={t.q}
            placeholder={t.qPlaceholder}
            value={draft.q}
            clearLabel={messages.common.clear}
            onChange={(event) => setDraft((current) => ({ ...current, q: event.target.value }))}
            onSearch={() => onSearch(draft)}
          />
        </div>
        <DateRangeFields
          clearable
          startLabel={t.dueFrom}
          endLabel={t.dueTo}
          placeholder={messages.common.selectDate}
          from={draft.dueFrom}
          to={draft.dueTo}
          onChange={(dueFrom, dueTo) => setDraft((current) => ({ ...current, dueFrom, dueTo }))}
        />
        <div className="filter-field-md">
          <ReferenceField
            label={t.item}
            placeholder={`${josa(t.item, '을/를')} 선택하세요`}
            valueLabel={itemLabel}
            source={itemSource}
            onPick={(row) => {
              setPickedLabel({ id: String(row.id), label: named(row.name, row.code) });
              setDraft((current) => ({ ...current, item: String(row.id) }));
            }}
            onClear={() => setDraft((current) => ({ ...current, item: '' }))}
          />
        </div>
        <div className="field-cell field-cell-unlabeled filter-actions-end">
          <div className="filter-actions">
            {isChanged && (
              <Button type="button" variant="outlined" onClick={onReset}>
                {messages.common.reset}
              </Button>
            )}
            <Button type="submit">{messages.common.search}</Button>
            <FilterMoreButton open={more.isOpen} controlsId={more.id} onToggle={more.toggle} />
          </div>
        </div>
      </form>

      {/* `hidden` 은 감싸는 상자에 둔다 — `.filter-bar` 의 display 가 속성을 덮는다. */}
      <div id={more.id} hidden={!more.isOpen}>
        <div className="filter-bar erp-wo-filter-bar erp-wo-filter-more">
          <div className="field-cell filter-field-sm">
            <label className="field-label" htmlFor={plantId}>
              {t.plant}
            </label>
            <Select
              id={plantId}
              value={draft.plant}
              disabled={plantLocked}
              options={
                plantLocked ? plantOptions : [{ value: '', label: t.allPlants }, ...plantOptions]
              }
              aria-describedby={plantNote === undefined ? undefined : plantNoteId}
              onChange={(value) => setDraft((current) => ({ ...current, plant: value }))}
            />
            {plantNote !== undefined && (
              <span id={plantNoteId} className="field-error" role="alert">
                {plantNote}
              </span>
            )}
          </div>
        </div>
      </div>

      <HiddenFilterChips
        open={more.isOpen}
        chips={hiddenChips}
        onRemove={() => onSearch({ state, q, dueFrom, dueTo, item, plant: '' })}
      />
    </>
  );
};
