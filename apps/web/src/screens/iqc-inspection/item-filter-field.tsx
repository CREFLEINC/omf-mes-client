import { messages } from '@omf-mes/i18n';
import { useId } from 'react';

import { useItemTypeOptions } from '../../patterns/item-picker/queries';
import { ItemSelect } from '../../patterns/item-select';

const t = messages.iqcInspection.filters;

/** 조건 줄의 「전체」 — 빈 값이라 좁히지 않는다. */
const ALL_ITEMS = [{ value: '', label: t.all }];

const NO_EXCLUDED_TYPES: readonly string[] = [];

interface ItemFilterFieldProps {
  /** 고른 품목 번호. 비면 「전체」. */
  value: string;
  onChange: (value: string) => void;
  /** 찾을 때 뺄 유형 — IQC 는 제품(FINISHED)을 뺀다(사용자 지시 2026-10-30). 비우면 다 낸다. */
  excludeItemTypeCodes?: readonly string[];
}

/**
 * 품목 조건 — **칸에서 바로 검색해서 고른다**(omf-all-around#226). 펼친 목록 맨 위 검색창에 코드 · 이름 일부를 치면
 * 서버에 묻고(`ItemSelect`), 「전체」를 고르면 조건을 푼다. 창(팝업)을 거치지 않는다.
 *
 * ⛔ **번호를 치라고 하지 않는다**(omf-all-around#40) — 품목 `12588` 을 외우는 검사자는 없다.
 *
 * 찾는 범위는 종전 품목 선택 창과 같다 — 사용 중지 품목까지(`includeInactive`), 뺄 유형은 부르는 쪽이 정한다. 유형 목록이
 * 오기 전에는 창과 같이 유형으로 좁히지 않는다. 고른 품목의 이름은 품목 상세로 푼다 — 주소로 들어온 값도 이름이 선다.
 */
export const ItemFilterField = ({
  value,
  onChange,
  excludeItemTypeCodes = NO_EXCLUDED_TYPES,
}: ItemFilterFieldProps) => {
  const fieldId = useId();
  const types = useItemTypeOptions(excludeItemTypeCodes.length > 0);
  /* 창과 같은 요청 — 남은 유형을 쉼표로 묶은 값 하나다. 뺄 유형이 없거나 남은 유형이 없으면 싣지 않는다. */
  const joined =
    excludeItemTypeCodes.length === 0
      ? ''
      : (types.data
          ?.map((option) => option.code)
          .filter((code) => !excludeItemTypeCodes.includes(code))
          .join(',') ?? '');
  const typeCodes = joined === '' ? undefined : [joined];

  return (
    <div className="field-cell search-select-cell">
      <label className="field-label" htmlFor={fieldId}>
        {t.item}
      </label>
      <ItemSelect
        id={fieldId}
        includeInactive
        {...(typeCodes !== undefined ? { itemTypeCodes: typeCodes } : {})}
        leadingOptions={ALL_ITEMS}
        value={value}
        placeholder={t.all}
        onChange={onChange}
      />
    </div>
  );
};
