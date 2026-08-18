import { Select } from '@crefle/web-ui';
import { useId } from 'react';

import { FieldLabel } from './field-label';
import type { SelectOption } from './types';

export interface SelectFieldProps {
  label: string;
  options: SelectOption[];
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  /** 선택지의 한계(잘림·불러오기 실패)를 밝히는 보조 문구. */
  note?: string;
  placeholder?: string;
}

/*
 * **오류·잠금 prop을 두지 않는다**(사본 체크리스트 7번). 이 회차의 두 선택칸(대상 실사·대상
 * 창고)에는 인라인 오류가 없고 — 고르지 않은 것은 조작 자리의 잠금 사유가 말한다 — 잠글
 * 사정도 없다(나가는 쓰기가 0이다). 값을 안 넘기고 정의만 남기면 「이 슬라이스에 그 기능이
 * 없다」가 타입 수준의 사실이 되지 못하고, 죽은 통로가 다음 사본으로 전파된다.
 * 필요해지는 회차가 그때 되살린다.
 */

/**
 * 라벨과 보조 문구가 붙는 선택칸.
 *
 * 디자인 시스템 `Select`에는 `label`·`helperText` prop이 없다(배치 규범 3) —
 * 라벨을 직접 만들되 내장 라벨과 같은 토큰(`.field-label`)을 써 라벨 층 높이를 맞춘다.
 *
 * 보조 문구·오류는 감추지 않고 **항상 보이는 DOM 텍스트**로 렌더하고 `aria-describedby`로
 * 잇는다. 툴팁만으로는 키보드·스크린리더 사용자가 닿을 수 없다.
 *
 * 이 화면 슬라이스가 소유한다 — 다른 화면 슬라이스의 같은 이름 부품을 참조하지 않는다.
 */
export const SelectField = ({
  label,
  options,
  value,
  onChange,
  required = false,
  note,
  placeholder,
}: SelectFieldProps) => {
  const id = useId();
  const noteId = `${id}-note`;

  return (
    <div className="field-cell">
      <FieldLabel htmlFor={id} label={label} required={required} />
      <Select
        id={id}
        options={options}
        value={value === '' ? null : value}
        onChange={onChange}
        placeholder={placeholder}
        aria-required={required || undefined}
        aria-describedby={note === undefined ? undefined : noteId}
      />
      {note !== undefined && (
        <span id={noteId} className="field-note">
          {note}
        </span>
      )}
    </div>
  );
};
