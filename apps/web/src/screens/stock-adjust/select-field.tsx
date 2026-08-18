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
  /**
   * 그 칸 아래 서는 오류. 화면이 잡은 것과 서버가 준 것이 **같은 칸에** 붙는다.
   * 보조 문구와 함께 있으면 둘 다 접근 이름에 이어진다 — 하나만 이으면 나머지가 조용히 사라진다.
   */
  error?: string;
  /**
   * 잠겼는가. **사유는 이 부품이 내지 않는다** — 화면의 조작 자리에 한 번 서고, 같은 사정으로
   * 여러 칸이 함께 잠기므로 칸마다 되풀이하면 같은 사실이 여러 번 읽힌다.
   */
  disabled?: boolean;
}

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
  error,
  disabled = false,
}: SelectFieldProps) => {
  const id = useId();
  const noteId = `${id}-note`;
  const errorId = `${id}-error`;

  /* 둘 다 있으면 **둘 다 잇는다** — 하나만 이으면 나머지가 화면에는 보이는데 이름에서 사라진다. */
  const describedBy = [note === undefined ? null : noteId, error === undefined ? null : errorId]
    .filter((candidate): candidate is string => candidate !== null)
    .join(' ');

  return (
    <div className="field-cell">
      <FieldLabel htmlFor={id} label={label} required={required} />
      <Select
        id={id}
        options={options}
        value={value === '' ? null : value}
        onChange={onChange}
        placeholder={placeholder}
        disabled={disabled}
        invalid={error !== undefined}
        aria-required={required || undefined}
        aria-describedby={describedBy === '' ? undefined : describedBy}
      />
      {note !== undefined && (
        <span id={noteId} className="field-note">
          {note}
        </span>
      )}
      {error !== undefined && (
        <span id={errorId} className="field-error">
          {error}
        </span>
      )}
    </div>
  );
};
