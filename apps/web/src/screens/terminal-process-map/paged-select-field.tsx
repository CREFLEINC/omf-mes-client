import { forwardRef, useId, type ReactNode } from 'react';

import { PagedSelect, type SelectPage } from '../../patterns/select';
import { FieldLabel } from './field-label';

export interface PagedSelectFieldProps {
  label: string;
  optionalMark?: string;
  /** 비었을 때 보이는 맨 앞 선택지 · 흐린 문구(「미지정」 · 「공장 전체」) */
  emptyLabel: string;
  value: string;
  /** 고른 값의 표시 이름 — 아직 받지 않은 쪽에 있어도 칸에 이름을 보인다. */
  valueLabel: string;
  queryKey: readonly unknown[];
  fetchPage: (query: string, page: number) => Promise<SelectPage>;
  error?: string;
  /** 칸 아래 안내(창고 기준 안내 등) */
  children?: ReactNode;
  onChange: (value: string, label: string) => void;
}

/**
 * 누르면 검색란과 선택지가 펼쳐지는 칸(설치 설비 · 창고 · 사용자 지시 2026-11-20 · #333).
 * 별도 찾기 창을 띄우지 않는다 — 공용 `PagedSelect`(서버 검색 · 쪽 넘김)에 이 화면 라벨을 붙인다.
 */
export const PagedSelectField = forwardRef<HTMLButtonElement, PagedSelectFieldProps>(
  function PagedSelectField(
    {
      label,
      optionalMark,
      emptyLabel,
      value,
      valueLabel,
      queryKey,
      fetchPage,
      error,
      children,
      onChange,
    },
    ref,
  ) {
    const id = useId();
    const errorId = `${id}-error`;

    return (
      <div className="field-cell">
        <FieldLabel htmlFor={id} label={label} optionalMark={optionalMark} />
        <PagedSelect
          ref={ref}
          id={id}
          value={value}
          placeholder={emptyLabel}
          invalid={error !== undefined}
          aria-describedby={error === undefined ? undefined : errorId}
          queryKey={queryKey}
          fetchPage={fetchPage}
          leadingOptions={[{ value: '', label: emptyLabel }]}
          selectedOption={value === '' ? null : { value, label: valueLabel || value }}
          onOptionChange={(option) => {
            onChange(option.value, option.value === '' ? '' : option.label);
          }}
        />
        {error !== undefined && (
          <span id={errorId} className="field-error">
            {error}
          </span>
        )}
        {children}
      </div>
    );
  },
);
