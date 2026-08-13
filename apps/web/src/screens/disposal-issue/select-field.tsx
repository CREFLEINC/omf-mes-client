import { Select } from '@crefle/web-ui';
import { useId } from 'react';

import { FieldLabel } from './field-label';
import type { SelectOption } from './types';

export interface SelectFieldProps {
  label: string;
  options: SelectOption[];
  value: string;
  onChange: (value: string) => void;
  /** 선택지의 한계(잘림·불러오기 실패·값 목록 미확정)를 밝히는 보조 문구. */
  note?: string;
  placeholder?: string;
  /**
   * 규범 3-2 — 선택지 문구가 길어 트리거 폭에 갇혀 잘리는 자리에만 붙인다(옵트인).
   * **판단 기준은 코드값이 아니라 선택지 문구 길이다.**
   */
  wide?: boolean;
  /**
   * 이 칸이 잠겼는가. **품의 정보 구획에만 붙는다** — 조회 조건 칸은 잠그지 않는다(배치 규범 3).
   * 잠그면 지금 걸린 조건을 읽을 수만 있고 고칠 수 없는 상태가 된다.
   *
   * 품의 정보는 다르다. 잠기는 자리가 둘이다: **전송 중**(값이 바뀌면 확인한 것과 나가는 것이
   * 갈린다)과 **폐기 계정**(고를 값 자체가 아직 없다 — 계획 §13-5). 잠근 사유는 `note`가 낸다.
   *
   * **디자인 시스템 `Select`에 사유를 받는 prop이 없다**(설치본 실측) — 사유를 보이는 글자로
   * 두고 접근 이름에 잇는 것은 이 부품의 몫이다. 잠긴 컨트롤은 포커스를 받지 못해 툴팁만으로는
   * 키보드·스크린리더 사용자가 닿을 수 없다.
   */
  disabled?: boolean;
  /**
   * 그 칸 아래 서는 오류. 화면이 잡은 것과 서버가 준 것이 **같은 칸에** 붙는다.
   * 보조 문구와 함께 있으면 둘 다 접근 이름에 이어진다 — 하나만 이으면 나머지가 조용히 사라진다.
   */
  error?: string;
}

/**
 * 라벨과 보조 문구가 붙는 선택칸.
 *
 * 디자인 시스템 `Select`에는 `label`·`helperText` prop이 없다(배치 규범 3) —
 * 라벨을 직접 만들되 내장 라벨과 같은 토큰(`.field-label`)을 써 라벨 층 높이를 맞춘다.
 *
 * 보조 문구는 감추지 않고 **항상 보이는 DOM 텍스트**로 렌더하고 `aria-describedby`로 잇는다.
 * 툴팁만으로는 키보드·스크린리더 사용자가 닿을 수 없다.
 *
 * **잠금과 오류를 받는 자리는 품의 정보 구획이다**(PR ④에서 더했다). 조회 조건 칸은 둘 다
 * 쓰지 않는다 — 조건은 잠그지 않고(배치 규범 3), 조건 값에는 서버가 오류를 돌려줄 자리가 없다.
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
  wide = false,
  disabled = false,
  error,
}: SelectFieldProps) => {
  const id = useId();
  const noteId = `${id}-note`;
  const errorId = `${id}-error`;

  /*
   * 선택지에 빈 값(「전체」)이 있으면 **빈 값도 고른 값이다** — 그때는 자리표시로 대신하지 않는다.
   */
  const hasEmptyOption = options.some((option) => option.value === '');

  /* 둘 다 있으면 **둘 다 잇는다** — 하나만 이으면 나머지가 화면에는 보이는데 이름에서 사라진다. */
  const describedBy = [note === undefined ? null : noteId, error === undefined ? null : errorId]
    .filter((candidate): candidate is string => candidate !== null)
    .join(' ');

  return (
    <div className={wide ? 'field-cell wide-select' : 'field-cell'}>
      <FieldLabel htmlFor={id} label={label} />
      <Select
        id={id}
        options={options}
        value={value === '' && !hasEmptyOption ? null : value}
        onChange={onChange}
        placeholder={placeholder}
        disabled={disabled}
        invalid={error !== undefined}
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
