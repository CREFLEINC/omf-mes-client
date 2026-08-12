import { Select } from '@crefle/web-ui';
import { useId } from 'react';

import { FieldLabel } from './field-label';
import type { SelectOption } from './types';

/**
 * **셋을 걷어 냈다** — `required`·`disabled`·`disabledReason`.
 *
 * 앞 회차에는 「결재가 붙는 회차가 함께 쓴다」고 두었으나, 결재가 붙고 보니 **소비처가
 * 생기지 않았다**: 결재 의견은 선택칸이 아니라 입력칸이고(그쪽은 디자인 시스템이 세 값을
 * 모두 갖는다), 전송 중 잠금은 조건 줄이 아니라 결재 구획의 컨트롤과 주소 이동 문이 맡는다.
 *
 * **쓰이지 않는 prop을 남기지 않는다.** 검사되지 않은 채 실린 갈래는 다음 소비자에게
 * 「이미 되는 것」으로 보이고, 그때 처음 도는 코드가 처음 틀린다. 필요해지면 그 소비처와
 * 함께 되살린다.
 */
export interface SelectFieldProps {
  label: string;
  options: SelectOption[];
  value: string;
  onChange: (value: string) => void;
  /** 값 목록이 확정되지 않았다는 안내 등. */
  note?: string;
  placeholder?: string;
  /**
   * 규범 3-2 — 선택지 문구가 길어 트리거 폭에 갇혀 잘리는 자리에만 붙인다(옵트인).
   * **판단 기준은 코드값이 아니라 선택지 문구 길이다.**
   */
  wide?: boolean;
}

/**
 * 라벨과 보조 문구가 붙는 선택칸.
 *
 * 디자인 시스템 `Select`에는 `label`·`helperText`·`disabledReason` prop이 없다(배치 규범 3) —
 * 라벨을 직접 만들되 내장 라벨과 같은 토큰(`.field-label`)을 써 라벨 층 높이를 맞춘다.
 *
 * 보조 문구는 감추지 않고 항상 보이는 DOM 텍스트로 렌더하고 `aria-describedby`로 잇는다.
 * 비활성 컨트롤은 포커스를 받지 못해 사유를 시각으로만 두면 보조기술이 닿을 수 없다.
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
   * 선택지에 빈 값(「전체」·자리표시)이 있으면 **빈 값도 고른 값이다** —
   * 그때는 자리표시로 대신하지 않는다.
   */
  const hasEmptyOption = options.some((option) => option.value === '');

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
