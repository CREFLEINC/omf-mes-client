import { Select } from '@crefle/web-ui';
import { useId } from 'react';

import { FieldLabel } from './field-label';
import type { SelectOption } from './types';

export interface SelectFieldProps {
  label: string;
  options: SelectOption[];
  value: string;
  onChange: (value: string) => void;
  /** 선택지의 한계(잘림·불러오기 실패) 등을 밝히는 보조 문구. */
  note?: string;
  /**
   * 이 칸의 오류. **선택칸에도 오류 자리가 필요하다** — 이 화면에는 고르지 않으면 저장할 수
   * 없는 선택칸이 셋 있는데, 자리가 없으면 저장을 눌렀을 때 **무엇이 비었는지 화면이 말하지
   * 못한다**(브라우저 확인에서 실제로 그랬다). 형제 화면의 같은 부품에는 이 자리가 없다 —
   * 그쪽 선택칸은 전부 조회 조건이라 비어도 막지 않기 때문이다.
   */
  error?: string;
  placeholder?: string;
  /** 규범 3-2 — 선택지 문구가 길어 트리거 폭에 갇혀 잘리는 자리에만 붙인다(옵트인). */
  wide?: boolean;
  /**
   * 고를 수 없는 칸. **사유(`note`)와 함께만 쓴다** — 잠긴 이유가 없으면 사용자는 화면이
   * 고장 난 것으로 읽는다(배치 규범 4).
   */
  disabled?: boolean;
}

/**
 * 라벨과 보조 문구가 붙는 선택칸.
 *
 * 디자인 시스템 `Select`에는 `label`·`helperText` prop이 없다(배치 규범 3) — 라벨을 직접
 * 만들되 내장 라벨과 같은 토큰(`.field-label`)을 써 라벨 층 높이를 맞춘다.
 *
 * ⭐ **이 화면의 사본은 잠금을 갖는다.** 형제 화면들의 같은 이름 부품은 「잠그지 않는다」로
 * 두었는데, 그쪽은 **조회 조건**이라 잠그면 걸린 조건을 해제할 길이 사라지기 때문이다.
 * 여기에는 **값 목록이 아직 없는 입력칸**이 있고, 그 칸은 열어 두면 눌러도 아무것도 나오지
 * 않아 사용자가 화면이 고장 난 것으로 읽는다. 잠그되 **사유를 반드시 함께** 낸다(규범 4).
 *
 * 이 화면 슬라이스가 소유한다 — 다른 화면 슬라이스의 같은 이름 부품을 참조하지 않는다.
 */
export const SelectField = ({
  label,
  options,
  value,
  onChange,
  note,
  error,
  placeholder,
  wide = false,
  disabled = false,
}: SelectFieldProps) => {
  const id = useId();
  const noteId = `${id}-note`;
  const errorId = `${id}-error`;

  const hasEmptyOption = options.some((option) => option.value === '');

  return (
    <div className={wide ? 'field-cell wide-select' : 'field-cell'}>
      <FieldLabel htmlFor={id} label={label} />
      <Select
        id={id}
        options={options}
        value={value === '' && !hasEmptyOption ? null : value}
        onChange={onChange}
        disabled={disabled}
        placeholder={placeholder}
        invalid={error !== undefined}
        aria-describedby={
          [error === undefined ? null : errorId, note === undefined ? null : noteId]
            .filter((value) => value !== null)
            .join(' ') || undefined
        }
      />
      {error !== undefined && (
        <span id={errorId} className="field-error">
          {error}
        </span>
      )}
      {note !== undefined && (
        <span id={noteId} className="field-note">
          {note}
        </span>
      )}
    </div>
  );
};
