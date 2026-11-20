import { useId } from 'react';

import { ItemSelect } from '../../patterns/item-select';
import { Select } from '../../patterns/select';
import { FieldLabel } from './field-label';
import type { SelectOption } from './types';

/**
 * 조회 조건 칸 폭(C-19) — 좁음 160px(`sm`) · 보통 240px(`md`). 정한 폭이라 고른 값에 따라 칸 폭이 바뀌지 않는다(값이 길면
 * 말줄임). 창고 · 품목은 「코드 · 이름」 참조라 보통, 묶기는 고정 선택지라 좁음이다.
 */
export type FilterFieldWidth = 'sm' | 'md';

export interface SelectFieldProps {
  label: string;
  options: SelectOption[];
  value: string;
  onChange: (value: string) => void;
  /** 선택지의 한계(잘림·불러오기 실패·매달린 조건 미충족) 등을 밝히는 보조 문구. */
  note?: string;
  placeholder?: string;
  fieldWidth: FilterFieldWidth;
}

/**
 * 라벨과 보조 문구가 붙는 선택칸. W-01-07의 같은 이름 부품을 그대로 옮겼다.
 *
 * 디자인 시스템 `Select`에는 `label`·`helperText` prop이 없다(배치 규범 3) — 라벨을
 * 직접 만들되 내장 라벨과 같은 토큰(`.field-label`)을 써 라벨 층 높이를 맞춘다.
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
  fieldWidth,
}: SelectFieldProps) => {
  const id = useId();
  const noteId = `${id}-note`;

  const hasEmptyOption = options.some((option) => option.value === '');

  return (
    <div className={`field-cell filter-field-${fieldWidth}`}>
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

export interface ItemSelectFieldProps extends Omit<SelectFieldProps, 'options' | 'fieldWidth'> {
  /** 목록 맨 앞의 고정 선택지 — 조건 줄의 「전체」. */
  leadingOptions?: SelectOption[];
}

/**
 * 품목 선택칸 — `SelectField` 와 같은 짜임에 품목만 서버에서 쪽으로 받는다(`ItemSelect`). 품목 마스터가 9천여 건이라
 * 한 쪽 목록으로는 뒤쪽 품목을 고를 수 없다.
 */
export const ItemSelectField = ({
  label,
  value,
  onChange,
  note,
  placeholder,
  leadingOptions,
}: ItemSelectFieldProps) => {
  const id = useId();
  const noteId = `${id}-note`;
  const hasEmptyOption = leadingOptions?.some((option) => option.value === '') ?? false;

  return (
    <div className="field-cell filter-field-md">
      <FieldLabel htmlFor={id} label={label} />
      <ItemSelect
        id={id}
        {...(leadingOptions !== undefined ? { leadingOptions } : {})}
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
