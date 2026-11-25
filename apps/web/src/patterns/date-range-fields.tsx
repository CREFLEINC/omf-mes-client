import { DatePicker } from '@crefle/web-ui';
import { useId, type ReactNode } from 'react';

import { InfoTip } from './info-tip';

export interface DateRangeFieldsProps {
  /** 시작일. 빈 문자열이면 비어 있다. */
  from: string;
  /** 종료일. 빈 문자열이면 비어 있다. */
  to: string;
  /** 한쪽 칸만 바뀌어도 부른다 — 바뀌지 않은 쪽은 지금 값 그대로 넘긴다. */
  onChange: (from: string, to: string) => void;
  startLabel: string;
  endLabel: string;
  /**
   * 라벨 층이 없는 조회 줄 — 칸 이름을 흐린 글자와 접근 이름으로만 둔다.
   * 이때 `placeholder`는 쓰지 않고 칸 이름이 그 자리에 선다.
   */
  hideLabels?: boolean;
  /** 두 칸 모두 이름 옆 빨간 *(라벨 밖, 접근 이름 그대로). */
  required?: boolean;
  /** 시작일 라벨 옆 ⓘ — 기간 전체에 대한 안내. */
  info?: string;
  /** 칸마다 지우기 단추 — 그 칸만 비운다. */
  clearable?: boolean;
  disabled?: boolean;
  invalid?: boolean;
  /** 두 칸 공통 흐린 문구. 칸마다 다르면 `placeholders`[시작, 종료] 가 앞선다. */
  placeholder?: string;
  placeholders?: readonly [string, string];
  /** 두 칸 공통 한계(YYYY-MM-DD). 서로의 한계(시작 ≤ 종료)는 이 부품이 더한다. */
  min?: string;
  max?: string;
  describedBy?: string;
  /** 칸마다 붙일 배치 클래스. */
  className?: string;
  /** 두 칸 아래 안내(막힌 이유 등). */
  note?: ReactNode;
}

const earlier = (a: string | undefined, b: string): string => (a !== undefined && a < b ? a : b);
const later = (a: string | undefined, b: string): string => (a !== undefined && a > b ? a : b);

/**
 * 조회 조건의 기간 — 시작일 · 종료일 **두 칸**(사용자 지시 2026-11-25: 기간 칸은 시작일 · 종료일로 나눈다).
 *
 * 값과 바꾸는 법은 화면의 것을 그대로 쓴다(`from` · `to` 두 문자열). 바뀐 것은 고르는 수단뿐이다.
 * 시작 ≤ 종료는 달력 한계로 막는다 — 시작 칸은 종료일 뒤를, 종료 칸은 시작일 앞을 고를 수 없다.
 * 한쪽만 고른 상태는 화면의 조회 규칙이 그대로 다룬다.
 *
 * 조회 줄(`.filter-bar`)에 다른 칸과 같은 `field-cell` 두 개로 서되, 한 묶음(`.date-range-fields`)에 담아
 * 줄이 좁아져도 시작일과 종료일이 다른 줄로 갈라지지 않고, 격자 조회 줄에서는 종전 기간 칸 한 자리를 나눠 쓴다.
 */
export const DateRangeFields = ({
  from,
  to,
  onChange,
  startLabel,
  endLabel,
  hideLabels = false,
  required = false,
  info,
  clearable = false,
  disabled,
  invalid,
  placeholder,
  placeholders,
  min,
  max,
  describedBy,
  className,
  note,
}: DateRangeFieldsProps) => {
  const id = useId();
  const startId = `${id}-from`;
  const endId = `${id}-to`;

  const picker = (side: 'from' | 'to') => {
    const isStart = side === 'from';
    const label = isStart ? startLabel : endLabel;
    const value = isStart ? from : to;
    const set = (next: string | null): void => {
      const date = next ?? '';
      if (isStart) onChange(date, to);
      else onChange(from, date);
    };
    const common = {
      id: isStart ? startId : endId,
      value: value === '' ? null : value,
      placeholder: hideLabels ? label : (placeholders?.[isStart ? 0 : 1] ?? placeholder),
      'aria-label': hideLabels ? label : undefined,
      'aria-required': required ? true : undefined,
      'aria-describedby': describedBy,
      disabled,
      invalid,
      min: isStart ? min : from === '' ? min : later(min, from),
      max: isStart ? (to === '' ? max : earlier(max, to)) : max,
    };

    return clearable ? (
      <DatePicker {...common} clearable onChange={set} />
    ) : (
      <DatePicker {...common} onChange={set} />
    );
  };

  if (hideLabels) {
    return (
      <div className="date-range-fields">
        {picker('from')}
        {picker('to')}
      </div>
    );
  }

  const cell = (side: 'from' | 'to') => {
    const isStart = side === 'from';

    return (
      <div className={className === undefined ? 'field-cell' : `field-cell ${className}`}>
        <span className={isStart && info !== undefined ? 'info-label' : 'field-label'}>
          <label
            className={isStart && info !== undefined ? 'field-label' : undefined}
            htmlFor={isStart ? startId : endId}
          >
            {isStart ? startLabel : endLabel}
          </label>
          {required && (
            <span className="required-mark" aria-hidden="true">
              {' *'}
            </span>
          )}
          {isStart && info !== undefined && <InfoTip text={info} />}
        </span>
        {picker(side)}
      </div>
    );
  };

  return (
    <div className="date-range-fields">
      {cell('from')}
      {cell('to')}
      {note}
    </div>
  );
};
