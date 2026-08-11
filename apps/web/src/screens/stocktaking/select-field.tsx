import { Select, type SelectItems } from '@crefle/web-ui';
import { useId } from 'react';

import { FieldLabel } from './field-label';

export interface SelectFieldProps {
  label: string;
  options: SelectItems;
  value: string;
  onChange: (value: string) => void;
  /** 선택지의 한계(잘림·불러오기 실패·값 목록 미확정)를 밝히는 보조 문구. */
  note?: string;
  /** 화면이 잡았거나 서버가 준 오류. 있으면 `invalid`와 함께 오류 문구를 낸다. */
  error?: string;
  placeholder?: string;
  /**
   * 규범 3-2 — 선택지 문구가 길어 트리거 폭에 갇혀 잘리는 자리에만 붙인다(옵트인).
   * **판단 기준은 코드값이 아니라 선택지 문구 길이다.**
   */
  wide?: boolean;
  /**
   * 전송 중처럼 **값을 바꿔도 이번 요청에 실리지 않는** 자리에만 잠근다(옵트인).
   *
   * 조회 조건 칸은 잠그지 않는다 — 잠그면 지금 걸린 조건을 해제할 방법이 사라진다.
   */
  disabled?: boolean;
}

/** 그룹 안까지 훑는다 — 빈 값 선택지는 그룹 안에 들어 있을 수도 있다. */
const hasEmptyValue = (options: SelectItems): boolean =>
  options.some((item) =>
    'options' in item ? item.options.some((option) => option.value === '') : item.value === '',
  );

/**
 * 라벨과 보조 문구가 붙는 선택칸.
 *
 * 디자인 시스템 `Select`에는 `label`·`helperText` prop이 없다(배치 규범 3) —
 * 라벨을 직접 만들되 내장 라벨과 같은 토큰(`.field-label`)을 써 라벨 층 높이를 맞춘다.
 *
 * 보조 문구와 오류는 감추지 않고 **항상 보이는 DOM 텍스트**로 렌더하고 `aria-describedby`로
 * 잇는다. 잠긴 칸은 포커스를 받지 못해 툴팁만으로는 키보드·스크린리더 사용자가 닿을 수 없다.
 *
 * **둘을 함께 낼 수 있다.** 선택지의 사정(「목록 준비 중」)과 값의 오류(「50자를 넘습니다」)는
 * 서로 다른 사정이라 한쪽이 다른 쪽을 덮으면 사용자가 무엇을 해야 하는지 잃는다.
 *
 * **잠금과 오류는 옵트인이다.** PR ①에서는 조회 조건 셋만 이 부품을 썼고 둘 다 쓰이지 않았다 —
 * 개시 폼(PR ②)이 그 둘을 처음 쓴다. 조회 조건 칸은 여전히 잠그지 않는다.
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

  /*
   * 선택지에 빈 값(「전체」)이 있으면 **빈 값도 고른 값이다** — 그때는 자리표시로 대신하지 않는다.
   */
  const hasEmptyOption = hasEmptyValue(options);

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
