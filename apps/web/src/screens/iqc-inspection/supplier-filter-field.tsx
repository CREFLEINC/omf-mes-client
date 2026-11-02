import { messages } from '@omf-mes/i18n';
import { useId } from 'react';

import { PartnerSelect } from '../../patterns/partner-select';

const t = messages.iqcInspection.filters;

/** 조건 줄의 「전체」 — 빈 값이라 좁히지 않는다. */
const ALL_SUPPLIERS = [{ value: '', label: t.all }];

interface SupplierFilterFieldProps {
  /** 고른 거래처 번호. 비면 「전체」. */
  value: string;
  onChange: (value: string) => void;
}

/**
 * 공급사 조건 — 품목 조건(`item-filter-field.tsx`)처럼 **칸에서 바로 검색해서 고른다**(omf-all-around#226).
 * 검색어는 서버로 간다(`PartnerSelect`). 「전체」를 고르면 조건을 푼다.
 *
 * 찾는 범위는 종전 검색 창과 같다 — 거래처 전체를 사용 중지까지(`includeInactive`). 지난 의뢰를 찾는 조건이다.
 * 고른 값의 이름은 거래처 상세로 푼다 — 주소로 들어온 값도 이름이 선다.
 */
export const SupplierFilterField = ({ value, onChange }: SupplierFilterFieldProps) => {
  const fieldId = useId();

  return (
    <div className="field-cell">
      <label className="field-label" htmlFor={fieldId}>
        {t.supplier}
      </label>
      <PartnerSelect
        id={fieldId}
        includeInactive
        leadingOptions={ALL_SUPPLIERS}
        value={value}
        placeholder={t.all}
        onChange={onChange}
      />
    </div>
  );
};
