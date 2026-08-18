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
   * 서버가 이 칸에 붙인 오류. **화면이 잡은 오류는 여기 오지 않는다** — 필수를 안 고른 것은
   * 조작 자리의 잠금 사유가 말한다(누르기 전에 붉은 글씨를 띄우지 않는다).
   */
  error?: string;
  /**
   * 잠겼는가. **사유는 이 칸이 내지 않는다** — 나가는 중과 이미 등록한 뒤가 같은 잠금을 쓰고,
   * 그 사정은 조작 자리에 한 번 선다. 칸마다 되풀이하면 같은 사실이 여러 번 읽힌다.
   */
  disabled?: boolean;
}

/*
 * **오류·잠금 prop은 소비처가 생긴 회차에 되살렸다**(사본 체크리스트 7번). 앞 회차의 두
 * 선택칸(대상 실사·대상 창고)에는 인라인 오류도 잠글 사정도 없어 정의째 빼 두었고, 등록이
 * 붙으면서 **헤더 사유 칸의 서버 오류**와 **등록 뒤 잠금**이라는 실제 소비처가 생겼다.
 * 지금도 규율은 같다 — 넘기는 자리가 없는 prop은 두지 않는다.
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
  error,
  disabled = false,
}: SelectFieldProps) => {
  const id = useId();
  const noteId = `${id}-note`;
  const errorId = `${id}-error`;

  /* 둘 다 있으면 오류를 먼저 읽힌다 — 지금 막고 있는 것이 그쪽이다. */
  const describedBy = [error === undefined ? null : errorId, note === undefined ? null : noteId]
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
