import { Select } from '@crefle/web-ui';
import { useId } from 'react';

import { FieldLabel } from './field-label';
import type { SelectOption } from './types';

/**
 * **이 회차가 쓰는 것만 받는다.** `required`·`disabled`·`disabledReason`·`wide`를 두지 않았다 —
 * 소비처가 조건 줄의 상태 칸 하나이고 그 칸은 잠기지도, 선택지 문구가 길지도 않다.
 *
 * 쓰이지 않는 prop을 미리 남기면 검사되지 않은 채 실린 갈래가 다음 소비자에게 「이미 되는 것」
 * 으로 보이고, 그때 처음 도는 코드가 처음 틀린다. 필요해지면 그 소비처와 함께 만든다.
 */
export interface SelectFieldProps {
  label: string;
  options: SelectOption[];
  value: string;
  onChange: (value: string) => void;
  /** 값 목록이 확정되지 않았다는 안내 등. */
  note?: string;
  placeholder?: string;
}

/**
 * 라벨과 보조 문구가 붙는 선택칸.
 *
 * 디자인 시스템 `Select`에는 `label`·`helperText` prop이 없다(배치 규범 3) —
 * 라벨을 직접 만들되 내장 라벨과 같은 토큰(`.field-label`)을 써 라벨 층 높이를 맞춘다.
 *
 * 보조 문구는 감추지 않고 항상 보이는 DOM 텍스트로 렌더하고 `aria-describedby`로 잇는다.
 * 선택지가 없는 칸은 포커스를 받아도 고를 것이 없어, 사유를 시각으로만 두면 보조기술이 닿을 수 없다.
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
   * 선택지에 빈 값(「전체」·자리표시)이 있으면 **빈 값도 고른 값이다** —
   * 그때는 자리표시로 대신하지 않는다.
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
