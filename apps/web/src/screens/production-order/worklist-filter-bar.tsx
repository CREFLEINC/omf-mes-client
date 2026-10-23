import { Button, DatePicker, SearchInput } from '@crefle/web-ui';
import { messages, named } from '@omf-mes/i18n';
import { useEffect, useId, useMemo, useState } from 'react';

import { useApiClient } from '../../patterns/api-context';
import {
  REFERENCE_PAGE_SIZE,
  ReferenceField,
  type ReferenceSource,
} from '../../patterns/reference-picker';
import { runRequest } from '../../patterns/request';
import { useItemCodeNames } from './item-lookups';
import type { WorklistFilters } from './worklist-queries';

const t = messages.erpWorkOrderFlow.filters;

type Draft = Pick<WorklistFilters, 'q' | 'dueFrom' | 'dueTo' | 'item'>;

export interface WorklistFilterBarProps {
  applied: Draft;
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
      search: async (term, page) => {
        const data = await runRequest(() =>
          client.GET('/mdm/items', {
            params: {
              query: {
                ...(term === '' ? {} : { q: term }),
                includeInactive: true,
                page,
                size: REFERENCE_PAGE_SIZE,
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

/**
 * C-6 조회 조건 한 줄: 번호 검색(보통), 납기 기간(보통), 품목(보통), [초기화], [조회].
 * 칸 폭은 C-19의 세 가지(배치 클래스 filter-field-*), 간격은 하나다. Enter로도 조회한다.
 * 자동 계획 조건은 페이지 머리의 상태별 건수 칩이 맡는다(C-17). 1280×800에서 네 칸과 버튼이 한 줄에 들어가지 않아서다(G-41).
 */
export const WorklistFilterBar = ({ applied, onSearch, onReset }: WorklistFilterBarProps) => {
  const [draft, setDraft] = useState<Draft>(applied);
  const dueId = useId();
  const itemSource = useItemSource();
  const { q, dueFrom, dueTo, item } = applied;
  useEffect(() => setDraft({ q, dueFrom, dueTo, item }), [q, dueFrom, dueTo, item]);
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

  return (
    <form
      className="filter-bar erp-wo-filter-bar"
      aria-label={t.pane}
      onSubmit={(event) => {
        event.preventDefault();
        onSearch(draft);
      }}
    >
      <div className="field-cell filter-field-md">
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
      <div className="field-cell filter-field-md">
        <label className="field-label" htmlFor={dueId}>
          {t.due}
        </label>
        <DatePicker
          id={dueId}
          mode="range"
          clearable
          value={[
            draft.dueFrom === '' ? null : draft.dueFrom,
            draft.dueTo === '' ? null : draft.dueTo,
          ]}
          placeholder={t.duePlaceholder}
          onChange={(value) =>
            setDraft((current) => ({
              ...current,
              dueFrom: value === null ? '' : value[0],
              dueTo: value === null ? '' : value[1],
            }))
          }
        />
      </div>
      <div className="filter-field-md">
        <ReferenceField
          label={t.item}
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
          <Button type="button" variant="outlined" onClick={onReset}>
            {messages.common.reset}
          </Button>
          <Button type="submit">{messages.common.search}</Button>
        </div>
      </div>
    </form>
  );
};
