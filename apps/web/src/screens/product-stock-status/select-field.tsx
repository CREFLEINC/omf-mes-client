import { Select } from '@crefle/web-ui';
import { useId } from 'react';

import { FieldLabel } from './field-label';
import type { SelectOption } from './types';

/**
 * 선택칸의 최소 폭 갈래(배치 규범 3-2의 옵트인). `codeName`은 「코드 · 이름」 선택지를 담는다
 * — 이 화면의 창고·품목 선택지가 그 형태다.
 *
 * **`app.css`가 아니라 여기 둔다** — 공통 클래스(`.wide-select` 13rem)는 여러 화면이
 * 함께 쓰는 값이라 이 화면 하나 때문에 올리면 다른 화면의 줄이 이유 없이 일찍 넘어간다.
 */
export type SelectOptionWidth = 'code' | 'codeName';

const CODE_NAME_MIN_WIDTH = '18.5rem';

export interface SelectFieldProps {
  label: string;
  options: SelectOption[];
  value: string;
  onChange: (value: string) => void;
  /** 선택지의 한계(잘림·불러오기 실패·매달린 조건 미충족) 등을 밝히는 보조 문구. */
  note?: string;
  placeholder?: string;
  optionWidth?: SelectOptionWidth;
}

/**
 * 라벨과 보조 문구가 붙는 선택칸. W-01-07의 같은 이름 부품을 그대로 옮겼다.
 *
 * 디자인 시스템 `Select`에는 `label`·`helperText` prop이 없다(배치 규범 3) — 라벨을
 * 직접 만들되 내장 라벨과 같은 토큰(`.field-label`)을 써 라벨 층 높이를 맞춘다.
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
  optionWidth,
}: SelectFieldProps) => {
  const id = useId();
  const noteId = `${id}-note`;

  const hasEmptyOption = options.some((option) => option.value === '');
  const isWide = optionWidth !== undefined;

  return (
    <div
      className={isWide ? 'field-cell wide-select' : 'field-cell'}
      style={optionWidth === 'codeName' ? { minWidth: CODE_NAME_MIN_WIDTH } : undefined}
    >
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
