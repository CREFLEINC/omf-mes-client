import { messages } from '@omf-mes/i18n';
import { useId } from 'react';

import { ItemSelect } from '../../patterns/item-select';
import { lookupDisplayLabelWithInactive, type LookupSource } from '../../patterns/lookup-display';
import { useItemNameSources } from './reference-options';

const t = messages.lotStatusHistory;

interface ItemFilterFieldProps {
  /** 고른 품목 번호. 비면 「전체」. */
  value: string;
  onChange: (value: string) => void;
  /** 칸 이름 — 주지 않으면 LOT 현황의 「품목 검색」. */
  label?: string;
  disabled?: boolean;
}

/**
 * 품목 필터 — **칸에서 바로 검색해서 고른다**(omf-all-around#226). 품목 마스터를 통째로 받지 않고 서버에 묻는다(`ItemSelect`).
 * 지난 LOT 을 찾는 필터라 종전 품목 선택 창처럼 사용 중지 품목까지 찾는다. 「전체」는 종전 × 자리다.
 * 고른 품목의 이름은 품목 상세로 푼다 — 주소로 들어온 값도 이름이 선다(칸 글자는 종전 표기 그대로).
 */
export const ItemFilterField = ({
  value,
  onChange,
  label: fieldLabel,
  disabled,
}: ItemFilterFieldProps) => {
  const fieldId = useId();
  const itemId = value === '' ? null : Number(value);
  const names = useItemNameSources(itemId === null ? [] : [itemId]);
  const source: LookupSource = (itemId === null ? undefined : names.get(itemId)) ?? {
    entries: [],
    isError: false,
    isLoading: true,
  };
  const label = itemId === null ? '' : lookupDisplayLabelWithInactive(source, itemId);

  return (
    <div className="field-cell lot-status-filter-item search-select-cell">
      <label className="field-label" htmlFor={fieldId}>
        {fieldLabel ?? t.lotFilter.labels.item}
      </label>
      <ItemSelect
        id={fieldId}
        includeInactive
        selectedOption={label === '' ? null : { value, label }}
        leadingOptions={[{ value: '', label: t.values.all }]}
        value={value}
        placeholder={t.values.all}
        {...(disabled === undefined ? {} : { disabled })}
        onChange={onChange}
      />
    </div>
  );
};
