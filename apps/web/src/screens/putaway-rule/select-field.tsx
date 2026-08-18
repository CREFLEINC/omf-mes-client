import { Select } from '@crefle/web-ui';
import { useId } from 'react';

import { FieldLabel } from './field-label';
import type { SelectOption } from './types';

/**
 * **필수 표시와 인라인 오류는 이 회차에 넘어오지 않는다**(`required`·`error`).
 *
 * 읽기 회차에는 폼이 없어 둘 다 설 자리가 없고, 값만 안 넘기고 prop 정의를 남기면
 * 「이 슬라이스에 그 기능이 없다」가 타입 수준의 사실이 되지 못한다(사본 체크리스트 7번).
 * 등록·수정 폼이 붙는 회차가 그때 필요한 형태로 더한다.
 *
 * **`disabled`+`disabledReason`은 이 회차에 실제로 쓴다** — 창고를 고르기 전에는 품목 칸이
 * 잠기고, 왜 잠겼는지가 화면에 서야 한다.
 */
export interface SelectFieldProps {
  label: string;
  options: SelectOption[];
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  /** 비활성 사유. 디자인 시스템 `Select`에는 `disabledReason`이 없어 화면이 직접 붙인다(배치 규범 4). */
  disabledReason?: string;
  /** 선택지 목록의 한계(잘림·실패) 안내. 잠겨 있으면 잠긴 사유가 앞선다. */
  note?: string;
  placeholder?: string;
  /**
   * 규범 3-2 — 선택지 문구가 길어 트리거 폭에 갇혀 잘리는 자리에만 붙인다(옵트인).
   * **판단 기준은 코드값이 아니라 선택지 문구 길이다** — 이 화면의 창고·품목은 「코드 · 이름」이다.
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
  disabled = false,
  disabledReason,
  note,
  placeholder,
  wide = false,
}: SelectFieldProps) => {
  const id = useId();
  const noteId = `${id}-note`;
  /* 잠긴 칸에서는 잠긴 사유가 먼저다 — 지금 사용자가 할 수 있는 일을 가리키는 문장이 앞선다. */
  const message = (disabled ? disabledReason : note) ?? undefined;

  /*
   * 선택지에 빈 값(「전체」)이 있으면 **빈 값도 고른 값이다** —
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
        disabled={disabled}
        aria-describedby={message === undefined ? undefined : noteId}
      />
      {message !== undefined && (
        <span id={noteId} className="field-note">
          {message}
        </span>
      )}
    </div>
  );
};
