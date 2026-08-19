import { Select } from '@crefle/web-ui';
import { useId } from 'react';

import { FieldLabel } from './field-label';
import type { SelectOption } from './types';

export interface SelectFieldProps {
  label: string;
  options: SelectOption[];
  value: string;
  onChange: (value: string) => void;
  /** 선택지의 한계(값 목록 미확정·고를 수 없는 항목)를 밝히는 보조 문구. */
  note?: string;
  placeholder?: string;
}

/**
 * 라벨과 보조 문구가 붙는 선택칸.
 *
 * 디자인 시스템 `Select`에는 `label`·`helperText` prop이 없다 — 라벨을 직접 만들되 내장 라벨과
 * 같은 토큰(`.field-label`)을 써 라벨 층 높이를 맞춘다.
 *
 * 보조 문구는 감추지 않고 **항상 보이는 DOM 텍스트**로 렌더하고 `aria-describedby`로 잇는다.
 * 툴팁만으로는 키보드·스크린리더 사용자가 닿을 수 없다.
 *
 * **잠금·오류 prop을 두지 않는다.** 이 회차에서 이 부품이 붙는 자리는 조회 조건뿐이다 —
 * 조건은 잠그지 않고(잠그면 지금 걸린 조건을 읽을 수만 있고 고칠 수 없다), 조건 값에는 서버가
 * 오류를 돌려줄 자리가 없다. 값을 안 넘기는 대신 **정의째 두지 않는 것**이 「이 슬라이스에 그
 * 기능이 없다」를 타입 수준의 사실로 만든다.
 *
 * 이 화면 슬라이스가 소유한다 — 다른 화면 슬라이스의 같은 이름 부품을 참조하지 않는다.
 */
export const SelectField = ({
  label,
  options,
  value,
  onChange,
  note,
  placeholder,
}: SelectFieldProps) => {
  const id = useId();
  const noteId = `${id}-note`;

  /*
   * 선택지에 빈 값(「전체」)이 있으면 **빈 값도 고른 값이다** — 그때는 자리표시로 대신하지 않는다.
   */
  const hasEmptyOption = options.some((option) => option.value === '');

  return (
    <div className="field-cell">
      <FieldLabel htmlFor={id} label={label} />
      <Select
        id={id}
        options={options}
        value={value === '' && !hasEmptyOption ? null : value}
        onChange={onChange}
        placeholder={placeholder}
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
