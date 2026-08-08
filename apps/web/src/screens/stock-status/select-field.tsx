import { Select } from '@crefle/web-ui';
import { useId } from 'react';

import { FieldLabel } from './field-label';
import type { SelectOption } from './types';

/**
 * 선택칸의 최소 폭 갈래. **규범 3-2의 옵트인을 두 단계로 나눈다.**
 *
 * `.wide-select`의 `13rem`은 **가장 긴 코드값 13자**에서 도출된 값이라
 * (`docs/layout-conventions.md` 규범 3-2) 「코드 · 이름」을 담는 칸에는 모자란다 —
 * 브라우저 확인에서 창고 선택지 「WH-01 · 1공장 자재창고」가 말줄임됐다(F-B1).
 *
 * | 갈래 | 최소 폭 | 담는 것 |
 * | --- | ---: | --- |
 * | `code` | `13rem`(208px · `.wide-select`) | 코드값만 고른다. 규범 3-2의 도출값 그대로 |
 * | `codeName` | `18.5rem`(296px) | 「코드 · 이름」이나 긴 식별자를 고른다 |
 *
 * **`codeName`의 도출** — 규범 3-2와 같은 방법(트리거 기준 · `--type-body-lg` 16px ·
 * ASCII 자폭 약 10.5px · 한글 16px). 이 화면에서 가장 긴 선택지는 위치다.
 *
 * | 조각 | 폭 | 근거 |
 * | --- | ---: | --- |
 * | 왼쪽 안쪽 여백 | 16px | `--space-4` |
 * | 값 글자 | 232px | 「A-01-03 · A구역 01열 03단」 — ASCII 11자 116px + 한글·숫자 116px |
 * | 값–화살표 간격 | 12px | `--space-2` + 화살표 `margin-left` |
 * | 화살표 | 20px | `Icon size={20}` |
 * | 오른쪽 안쪽 여백 | 16px | `--space-4` |
 * | **합** | **296px** | `18.5rem` |
 *
 * 규범 3-2가 추정 오차 흡수분 8px을 더한 것과 달리 **더하지 않는다** — 이 값 자체가
 * 세 선택지(창고 260px · 품목 286px · 위치 296px) 중 **가장 긴 것**이라 이미 여유가 있다.
 *
 * **이탈 조건**: 규범 3-2와 같다 — `design-system-v2-webui#62`(목록이 가장 긴 항목만큼
 * 넓어진다)가 반영되면 이 갈래와 `.wide-select`를 **함께** 걷어낸다. 임시 우회다.
 */
export type SelectOptionWidth = 'code' | 'codeName';

/**
 * `codeName` 갈래의 최소 폭. **`app.css`가 아니라 여기 둔다** —
 * `.wide-select`(13rem)는 여러 화면이 함께 쓰는 공통 값이라 이 화면 하나 때문에 올리면
 * 다른 화면의 줄이 이유 없이 일찍 넘어간다(`docs/layout-conventions.md`가 `.wide-table`에서
 * 같은 판단을 내렸다 — 「값을 올리면 그 화면 하나 때문에 …」).
 */
const CODE_NAME_MIN_WIDTH = '18.5rem';

export interface SelectFieldProps {
  label: string;
  options: SelectOption[];
  value: string;
  onChange: (value: string) => void;
  /** 선택지의 한계(잘림·불러오기 실패·매달린 조건 미충족) 등을 밝히는 보조 문구. */
  note?: string;
  placeholder?: string;
  /**
   * 규범 3-2 — 선택지 문구가 길어 트리거 폭에 갇혀 잘리는 자리에만 붙인다(옵트인).
   * **판단 기준은 코드값이 아니라 선택지 문구 길이다.**
   */
  optionWidth?: SelectOptionWidth;
}

/**
 * 라벨과 보조 문구가 붙는 선택칸.
 *
 * 디자인 시스템 `Select`에는 `label`·`helperText` prop이 없다(배치 규범 3) —
 * 라벨을 직접 만들되 내장 라벨과 같은 토큰(`.field-label`)을 써 라벨 층 높이를 맞춘다.
 *
 * 보조 문구는 감추지 않고 항상 보이는 DOM 텍스트로 렌더하고 `aria-describedby`로 잇는다.
 *
 * **비활성 상태를 두지 않는다** — 위치·LOT처럼 매달린 조건이 채워지지 않아 선택지가 빈
 * 칸도 열어 둔다. 잠그면 지금 걸린 조건을 해제할 방법이 사라지고(주소로 들어온 경우가
 * 그렇다), 왜 잠겼는지는 보조 문구가 이미 말한다.
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
  optionWidth,
}: SelectFieldProps) => {
  const id = useId();
  const noteId = `${id}-note`;

  /*
   * 선택지에 빈 값(「전체」)이 있으면 **빈 값도 고른 값이다** — 그때는 자리표시로 대신하지 않는다.
   */
  const hasEmptyOption = options.some((option) => option.value === '');

  /*
   * 두 갈래 모두 `.wide-select`를 붙인다 — 그 클래스가 최소 폭과 함께 `align-items: stretch`를
   * 주는데, 그것이 없으면 셀을 넓혀도 선택칸이 내용 폭으로 줄어 목록이 그대로 잘린다(규범 3-1).
   * `codeName`은 그 위에 더 큰 하한만 얹는다.
   */
  const isWide = optionWidth !== undefined;

  return (
    <div
      className={isWide ? 'field-cell wide-select' : 'field-cell'}
      style={optionWidth === 'codeName' ? { minWidth: CODE_NAME_MIN_WIDTH } : undefined}
    >
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
