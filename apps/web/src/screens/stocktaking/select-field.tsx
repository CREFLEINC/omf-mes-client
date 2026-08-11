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
  placeholder?: string;
  /**
   * 규범 3-2 — 선택지 문구가 길어 트리거 폭에 갇혀 잘리는 자리에만 붙인다(옵트인).
   * **판단 기준은 코드값이 아니라 선택지 문구 길이다.**
   */
  wide?: boolean;
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
 * 보조 문구는 감추지 않고 **항상 보이는 DOM 텍스트**로 렌더하고 `aria-describedby`로 잇는다.
 * 툴팁만으로는 키보드·스크린리더 사용자가 닿을 수 없다.
 *
 * **잠금과 오류를 받지 않는다.** 이 PR에서 이 부품이 붙는 자리는 조회 조건 셋뿐이고,
 * 조회 조건 칸은 잠그지 않는다(잠그면 지금 걸린 조건을 해제할 방법이 사라진다) —
 * 검증 대상도 아니다. 그 둘이 필요한 자리(개시 폼·차이 사유)는 PR ②·③에서 생긴다.
 * 쓰이지 않는 prop을 미리 두면 어느 것이 실제로 화면에 작용하는지 읽을 수 없다.
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
}: SelectFieldProps) => {
  const id = useId();
  const noteId = `${id}-note`;

  /*
   * 선택지에 빈 값(「전체」)이 있으면 **빈 값도 고른 값이다** — 그때는 자리표시로 대신하지 않는다.
   */
  const hasEmptyOption = hasEmptyValue(options);

  return (
    <div className={wide ? 'field-cell wide-select' : 'field-cell'}>
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
