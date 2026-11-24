import { messages } from '@omf-mes/i18n';
import { useId } from 'react';

import { Select } from '../../patterns/select';

/**
 * OQC 탭의 「구분」(omf-all-around#354) — OQC 검사 건 · 판정 의뢰. 재작업/폐기 판정 의뢰로 올린 반품 · 제품 부적합은
 * 검사 건에 묶이지 않아 검사 목록에 오를 줄이 없으므로, 고르면 그 부적합 목록과 처분 상자가 선다.
 * 주소 이름 · 값은 옛 처분 주소 넘기기(`legacy-redirect.tsx`)와 같다.
 */
export type OqcKind = 'inspection' | 'request';

const KIND_KEY = 'kind';
const REQUEST = 'request';

export const readKind = (params: URLSearchParams): OqcKind =>
  params.get(KIND_KEY) === REQUEST ? 'request' : 'inspection';

/**
 * 구분을 바꾸면 조건 · 쪽 · 고른 건을 모두 버린다 — 두 목록이 주소 이름(`st` · `page` 등)을 함께 쓰므로 물려주면
 * 다른 목록의 값으로 읽힌다.
 */
export const withKind = (kind: OqcKind): URLSearchParams =>
  new URLSearchParams(kind === 'request' ? { [KIND_KEY]: REQUEST } : {});

export const OqcKindSelect = ({
  value,
  onChange,
}: {
  value: OqcKind;
  onChange: (kind: OqcKind) => void;
}) => {
  const t = messages.oqcInspection.kind;
  const id = useId();
  return (
    <div className="field-cell field-cell-unlabeled oqc-kind-select">
      <label className="visually-hidden" htmlFor={id}>
        {t.label}
      </label>
      <Select
        id={id}
        options={[
          { value: 'inspection', label: t.inspection },
          { value: 'request', label: t.request },
        ]}
        value={value}
        onChange={(next) => {
          if (next === 'inspection' || next === 'request') onChange(next);
        }}
      />
    </div>
  );
};
