import { messages } from '@omf-mes/i18n';
import { useId } from 'react';

import { ItemSelect } from '../../patterns/item-select';

const t = messages.oqcInspection.filters;

/** 조건 줄의 「전체」 — 빈 값이라 좁히지 않는다. */
const ALL_ITEMS = [{ value: '', label: messages.iqcInspection.filters.all }];

interface ItemFilterFieldProps {
  /** 고른 품목 번호. 비면 「전체」. */
  value: string;
  onChange: (value: string) => void;
}

/**
 * 품목 조건 — **칸에서 바로 검색해서 고른다**(omf-all-around#226 · IQC 와 같은 칸). 펼친 목록 맨 위 검색창에 코드 · 이름
 * 일부를 치면 서버에 묻고(`ItemSelect`), 「전체」를 고르면 조건을 푼다. 창(팝업)을 거치지 않는다.
 *
 * ⛔ **번호를 치라고 하지 않는다**(omf-all-around#40) — 품목 `12588` 을 외우는 검사자는 없다.
 *
 * 찾는 범위는 종전 품목 선택 창과 같다 — 사용 중지 품목까지(`includeInactive`), 유형은 좁히지 않는다.
 * 고른 품목의 이름은 품목 상세로 푼다 — 주소로 들어온 값도 이름이 선다.
 */
export const ItemFilterField = ({ value, onChange }: ItemFilterFieldProps) => {
  const fieldId = useId();

  return (
    <div className="field-cell">
      <label className="field-label" htmlFor={fieldId}>
        {t.item}
      </label>
      <ItemSelect
        id={fieldId}
        includeInactive
        leadingOptions={ALL_ITEMS}
        value={value}
        placeholder={messages.iqcInspection.filters.all}
        onChange={onChange}
      />
    </div>
  );
};
