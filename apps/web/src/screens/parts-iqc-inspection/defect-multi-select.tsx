import { Icon, SearchInput } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react';

import type { SearchableOption } from '../iqc-inspection/searchable-select';

export interface DefectMultiSelectProps {
  options: readonly SearchableOption[];
  values: readonly string[];
  placeholder: string;
  /** 고른 개수 표시 — 칸에 「n개 선택」 */
  pickedLabel: (count: number) => string;
  searchLabel: string;
  emptyText: string;
  invalid?: boolean;
  'aria-labelledby'?: string;
  onChange: (values: string[]) => void;
}

/**
 * 여러 개 고르는 검색 선택 칸(사용자 지시 2026-11-04) — 고를 때마다 닫히지 않고, 누를 때마다 넣고 뺀다.
 * 모양 · 조작은 OA 검사 화면의 검색 선택 칸(`SearchableSelect`)과 같다: 맨 위 검색 칸, ↑ · ↓ 로 옮기고 Enter 로 넣고 뺀다.
 * Esc 나 바깥을 누르면 닫힌다.
 */
export const DefectMultiSelect = ({
  options,
  values,
  placeholder,
  pickedLabel,
  searchLabel,
  emptyText,
  invalid = false,
  'aria-labelledby': labelledBy,
  onChange,
}: DefectMultiSelectProps) => {
  const listId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [term, setTerm] = useState('');
  const [active, setActive] = useState(0);

  const needle = term.trim().toLowerCase();
  const shown =
    needle === ''
      ? options
      : options.filter((option) => option.label.toLowerCase().includes(needle));

  useEffect(() => {
    if (!isOpen) return;
    const close = (event: MouseEvent): void => {
      if (!rootRef.current?.contains(event.target as Node)) setIsOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [isOpen]);

  const toggle = (option: SearchableOption): void => {
    onChange(
      values.includes(option.value)
        ? values.filter((value) => value !== option.value)
        : [...values, option.value],
    );
  };
  const onSearchKey = (event: KeyboardEvent<HTMLInputElement>): void => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      const step = event.key === 'ArrowDown' ? 1 : -1;
      setActive((current) => Math.min(Math.max(current + step, 0), Math.max(shown.length - 1, 0)));
    } else if (event.key === 'Enter') {
      event.preventDefault();
      const option = shown[active];
      if (option !== undefined) toggle(option);
    } else if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      setIsOpen(false);
      triggerRef.current?.focus();
    }
  };

  return (
    <div className="searchable-select" ref={rootRef}>
      <button
        ref={triggerRef}
        type="button"
        className="searchable-select-trigger"
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-labelledby={labelledBy}
        aria-invalid={invalid || undefined}
        data-open={isOpen ? '' : undefined}
        data-invalid={invalid ? '' : undefined}
        onClick={() => {
          if (!isOpen) {
            setTerm('');
            setActive(0);
          }
          setIsOpen(!isOpen);
        }}
      >
        <span
          className="searchable-select-value"
          data-placeholder={values.length === 0 ? '' : undefined}
        >
          {values.length === 0 ? placeholder : pickedLabel(values.length)}
        </span>
        <Icon name="expand_more" size={20} aria-hidden />
      </button>
      {isOpen && (
        <div className="searchable-select-popover">
          <SearchInput
            size="sm"
            fullWidth
            autoFocus
            aria-label={searchLabel}
            clearLabel={messages.common.clear}
            aria-controls={listId}
            value={term}
            onChange={(event) => {
              setTerm(event.target.value);
              setActive(0);
            }}
            onClear={() => setTerm('')}
            onKeyDown={onSearchKey}
          />
          {shown.length === 0 ? (
            <p className="field-note">{emptyText}</p>
          ) : (
            <ul id={listId} role="listbox" aria-multiselectable className="searchable-select-list">
              {shown.map((option, index) => {
                const picked = values.includes(option.value);
                return (
                  <li
                    key={option.value}
                    role="option"
                    aria-selected={picked}
                    data-active={index === active ? '' : undefined}
                    className="defect-multi-select-option"
                    onMouseEnter={() => setActive(index)}
                    onClick={() => toggle(option)}
                  >
                    <span>{option.label}</span>
                    {picked && <Icon name="check" size={18} aria-hidden />}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
};
