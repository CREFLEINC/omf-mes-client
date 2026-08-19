import { Select } from '@crefle/web-ui';
import { useId } from 'react';

import { FieldLabel } from './field-label';
import type { SelectOption } from './types';

export interface SelectFieldProps {
  label: string;
  options: SelectOption[];
  value: string;
  onChange: (value: string) => void;
  /** 선택지 목록의 한계(불러오기 실패) 안내. 없으면 자리를 만들지 않는다 */
  note?: string;
  /**
   * 규범 3-2 — 선택지 문구가 길어 트리거 폭에 갇혀 잘리는 자리에만 붙인다(옵트인).
   * **판단 기준은 코드값이 아니라 선택지 문구 길이다.**
   */
  wide?: boolean;
}

/**
 * 라벨과 보조 문구가 붙는 선택칸.
 *
 * 디자인 시스템 `Select`에는 `label`·`helperText` prop이 없다(배치 규범 3) — 라벨을 직접
 * 만들되 내장 라벨과 같은 토큰(`.field-label`)을 써 라벨 층 높이를 맞춘다.
 *
 * 보조 문구는 감추지 않고 항상 보이는 DOM 텍스트로 렌더하고 `aria-describedby`로 잇는다.
 *
 * ⛔ **형제 사본의 `required`·`disabled`·`disabledReason`·`error`를 가져오지 않는다.**
 * 그 인자들이 저쪽에서 참인 이유는 **등록·수정 폼과 「창고를 고르기 전」 잠금이 있기 때문**이다.
 * 이 화면은 조회뿐이고 잠기는 선택칸이 하나도 없다 — 가져오면 아무도 넘기지 않는 인자가 남고,
 * 다음 사람이 그것을 근거로 없는 상태를 상상한다.
 *
 * 이 화면 슬라이스가 소유한다 — 다른 화면 슬라이스의 같은 이름 부품을 참조하지 않는다.
 */
export const SelectField = ({
  label,
  options,
  value,
  onChange,
  note,
  wide = false,
}: SelectFieldProps) => {
  const id = useId();
  const noteId = `${id}-note`;

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
