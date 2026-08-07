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
  disabled?: boolean;
  /** 비활성 사유. 디자인 시스템 `Select`에는 `disabledReason`이 없어 화면이 직접 붙인다(배치 규범 4). */
  disabledReason?: string;
  /** 값 목록이 확정되지 않았다는 안내 등. 오류가 있으면 오류가 우선한다. */
  note?: string;
  error?: string;
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
  required = false,
  disabled = false,
  disabledReason,
  note,
  error,
  placeholder,
  wide = false,
}: SelectFieldProps) => {
  const id = useId();
  const noteId = `${id}-note`;
  // 지금 고칠 수 있는 것을 먼저 보인다 — 오류가 있으면 안내를 밀어낸다.
  const message = error ?? (disabled ? disabledReason : note) ?? undefined;

  /*
   * 선택지에 빈 값(「전체」·자리표시)이 있으면 **빈 값도 고른 값이다** —
   * 그때는 자리표시로 대신하지 않는다. 폼의 「지정하지 않음」과 필터의 「전체」는
   * 같은 빈 문자열이지만 뜻이 다르다.
   */
  const hasEmptyOption = options.some((option) => option.value === '');

  return (
    <div className={wide ? 'field-cell wide-select' : 'field-cell'}>
      <FieldLabel htmlFor={id} label={label} required={required} />
      <Select
        id={id}
        options={options}
        value={value === '' && !hasEmptyOption ? null : value}
        onChange={onChange}
        placeholder={placeholder}
        disabled={disabled}
        invalid={error !== undefined}
        aria-required={required || undefined}
        aria-describedby={message === undefined ? undefined : noteId}
      />
      {message !== undefined && (
        <span id={noteId} className={error === undefined ? 'field-note' : 'field-error'}>
          {message}
        </span>
      )}
    </div>
  );
};
