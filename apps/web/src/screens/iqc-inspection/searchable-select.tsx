import { Icon, SearchInput } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react';

export interface SearchableOption {
  value: string;
  label: string;
}

export interface SearchableSelectProps {
  id: string;
  options: readonly SearchableOption[];
  value: string;
  placeholder: string;
  searchLabel: string;
  searchPlaceholder: string;
  emptyText: string;
  invalid?: boolean;
  disabled?: boolean;
  'aria-describedby'?: string;
  onChange: (value: string) => void;
}

/**
 * 검색되는 선택 칸(사용자 지시 2026-10-28 · #197) — 불량 코드가 많아도 고를 수 있게, 칸을 누르면 목록 맨 위 검색 칸에 코드 · 이름
 * 일부를 쳐서 목록을 좁힌다. 그대로 목록에서 골라도 된다. 모양은 DS 선택 칸(`Select`)과 같다 — DS 에 검색되는 선택 칸이 없다.
 * 검색 칸에서 ↑ · ↓ 로 옮기고 Enter 로 고른다. Esc 나 바깥을 누르면 닫힌다.
 */
export const SearchableSelect = ({
  id,
  options,
  value,
  placeholder,
  searchLabel,
  searchPlaceholder,
  emptyText,
  invalid = false,
  disabled = false,
  'aria-describedby': describedBy,
  onChange,
}: SearchableSelectProps) => {
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
  const selected = options.find((option) => option.value === value);

  /* 바깥을 누르면 닫는다. */
  useEffect(() => {
    if (!isOpen) return;
    const close = (event: MouseEvent): void => {
      if (!rootRef.current?.contains(event.target as Node)) setIsOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [isOpen]);

  const open = (): void => {
    setTerm('');
    setActive(
      Math.max(
        0,
        options.findIndex((option) => option.value === value),
      ),
    );
    setIsOpen(true);
  };
  const pick = (option: SearchableOption): void => {
    onChange(option.value);
    setIsOpen(false);
    triggerRef.current?.focus();
  };
  const onSearchKey = (event: KeyboardEvent<HTMLInputElement>): void => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      const step = event.key === 'ArrowDown' ? 1 : -1;
      setActive((current) => Math.min(Math.max(current + step, 0), Math.max(shown.length - 1, 0)));
    } else if (event.key === 'Enter') {
      /* 바깥 저장 폼으로 넘어가 임시 저장되지 않게 막는다. */
      event.preventDefault();
      const option = shown[active];
      if (option !== undefined) pick(option);
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
        id={id}
        type="button"
        className="searchable-select-trigger"
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-invalid={invalid || undefined}
        aria-describedby={describedBy}
        data-open={isOpen ? '' : undefined}
        data-invalid={invalid ? '' : undefined}
        disabled={disabled}
        onClick={() => (isOpen ? setIsOpen(false) : open())}
      >
        <span className="searchable-select-value" data-placeholder={selected ? undefined : ''}>
          {selected?.label ?? placeholder}
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
            placeholder={searchPlaceholder}
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
            <ul id={listId} role="listbox" className="searchable-select-list">
              {shown.map((option, index) => (
                <li
                  key={option.value}
                  role="option"
                  aria-selected={option.value === value}
                  data-active={index === active ? '' : undefined}
                  onMouseEnter={() => setActive(index)}
                  onClick={() => pick(option)}
                >
                  {option.label}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
};
