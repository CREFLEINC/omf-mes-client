import { useId } from 'react';

import { PartnerSelect } from '../../patterns/partner-select';
import { Select } from '../../patterns/select';
import { FieldLabel } from './field-label';
import type { SelectOption } from './types';

export interface SelectFieldProps {
  label: string;
  options: SelectOption[];
  value: string;
  onChange: (value: string) => void;
  /** 선택지의 한계(잘림·불러오기 실패) 등을 밝히는 보조 문구. */
  note?: string;
  placeholder?: string;
  /**
   * 규범 3-2 — 선택지 문구가 길어 트리거 폭에 갇혀 잘리는 자리에만 붙인다(옵트인).
   * **판단 기준은 코드값이 아니라 선택지 문구 길이다.**
   */
  wide?: boolean;
  /**
   * 거래처 칸 — 거래처를 통째로 받지 않고 쪽 단위로 찾는다(`PartnerSelect`, 사용자 지시 2026-10-29). 이때 `options` 는
   * 맨 앞 고정 선택지(「전체」)다.
   */
  partners?: boolean;
}

/**
 * 라벨과 보조 문구가 붙는 선택칸.
 *
 * 디자인 시스템 `Select`에는 `label`·`helperText` prop이 없다(배치 규범 3) —
 * 라벨을 직접 만들되 내장 라벨과 같은 토큰(`.field-label`)을 써 라벨 층 높이를 맞춘다.
 *
 * 보조 문구는 감추지 않고 항상 보이는 DOM 텍스트로 렌더하고 `aria-describedby`로 잇는다.
 *
 * **비활성 상태를 두지 않는다** — 이 화면의 선택칸은 잠기는 자리가 없다.
 * 참조 목록이 아직 오지 않았거나 실패했을 때도 칸은 열어 둔다. 잠그면 지금 걸린 조건을
 * 해제할 방법이 사라진다.
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
  partners = false,
}: SelectFieldProps) => {
  const id = useId();
  const noteId = `${id}-note`;

  /*
   * 선택지에 빈 값(「전체」)이 있으면 **빈 값도 고른 값이다** — 그때는 자리표시로 대신하지 않는다.
   */
  const hasEmptyOption = options.some((option) => option.value === '');

  return (
    <div className={wide ? 'field-cell wide-select' : 'field-cell'}>
      <FieldLabel htmlFor={id} label={label} />
      {partners ? (
        <PartnerSelect
          id={id}
          includeInactive
          leadingOptions={options}
          value={value === '' && !hasEmptyOption ? null : value}
          onChange={onChange}
          {...(placeholder === undefined ? {} : { placeholder })}
          aria-describedby={note === undefined ? undefined : noteId}
        />
      ) : (
        <Select
          id={id}
          options={options}
          value={value === '' && !hasEmptyOption ? null : value}
          onChange={onChange}
          placeholder={placeholder}
          aria-describedby={note === undefined ? undefined : noteId}
        />
      )}
      {note !== undefined && (
        <span id={noteId} className="field-note">
          {note}
        </span>
      )}
    </div>
  );
};
