import {
  Select as DsSelect,
  type SelectItems,
  type SelectOption,
  type SelectOptionGroup,
  type SelectProps,
} from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { forwardRef, useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { createPortal } from 'react-dom';

/**
 * 관리웹의 선택 칸 — 디자인 시스템 `Select` 와 같은 사용법이다. 화면은 `@crefle/web-ui` 의 `Select` 대신 이것을 쓴다
 * (`select-imports.test.ts` 가 지킨다).
 *
 * **선택지가 5개를 넘으면 펼친 목록 맨 위에 검색창을 둔다**(사용자 지시 2026-10-28). 5개 이하는 디자인 시스템 그대로다.
 *
 * 디자인 시스템 `Select` 는 목록에 끼울 자리를 주지 않아, 펼쳐진 목록(`{id}-listbox`)의 맨 앞에 검색창을 끼운다. 목록과
 * 키보드 이동 · 선택 · 닫기는 디자인 시스템이 그대로 맡는다 — 검색창의 ↑ · ↓ · Enter · Esc · Tab 은 선택 칸으로 넘긴다.
 * 고른 값이 검색으로 목록에서 빠져도 선택 칸에는 그 이름이 남는다(빈 칸 글자로).
 */
export const SEARCH_THRESHOLD = 5;

const isGroup = (item: SelectOption | SelectOptionGroup): item is SelectOptionGroup =>
  'options' in item;

const flatten = (items: SelectItems): SelectOption[] =>
  items.flatMap((item) => (isGroup(item) ? item.options : [item]));

export const countOptions = (items: SelectItems): number => flatten(items).length;

/** 이름에 검색어가 들어간 선택지만 남긴다(대소문자 · 앞뒤 공백 무시). 묶음은 남은 선택지가 없으면 뺀다. */
export const filterOptions = (items: SelectItems, query: string): SelectItems => {
  const needle = query.trim().toLowerCase();
  if (needle === '') return items;
  const matches = (option: SelectOption) => option.label.toLowerCase().includes(needle);
  return items.flatMap((item): (SelectOption | SelectOptionGroup)[] => {
    if (!isGroup(item)) return matches(item) ? [item] : [];
    const options = item.options.filter(matches);
    return options.length === 0 ? [] : [{ ...item, options }];
  });
};

export const Select = forwardRef<HTMLButtonElement, SelectProps>(function Select(props, ref) {
  return countOptions(props.options) > SEARCH_THRESHOLD ? (
    <SearchableSelect {...props} ref={ref} />
  ) : (
    <DsSelect {...props} ref={ref} />
  );
});

/** 검색창에서 선택 칸으로 넘기는 키 — 목록 이동 · 고르기 · 닫기. 글자 · 공백 · Home · End 는 검색창의 것이다. */
const FORWARDED_KEYS = new Set(['ArrowDown', 'ArrowUp', 'Enter', 'Escape', 'Tab']);

const SearchableSelect = forwardRef<HTMLButtonElement, SelectProps>(function SearchableSelect(
  { options, id, placeholder, value, defaultValue, ...rest },
  ref,
) {
  const fallbackId = useId();
  const triggerId = id ?? fallbackId;
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const [open, setOpen] = useState(false);
  const [slot, setSlot] = useState<HTMLElement | null>(null);
  const [query, setQuery] = useState('');

  const setTriggerRef = (element: HTMLButtonElement | null) => {
    triggerRef.current = element;
    if (typeof ref === 'function') ref(element);
    else if (ref !== null) ref.current = element;
  };

  /* 펼침은 디자인 시스템이 쥐고 있다 — 선택 칸의 `aria-expanded` 로 따라간다. */
  useEffect(() => {
    const trigger = triggerRef.current;
    if (trigger === null) return;
    const sync = () => setOpen(trigger.getAttribute('aria-expanded') === 'true');
    sync();
    const observer = new MutationObserver(sync);
    observer.observe(trigger, { attributes: true, attributeFilter: ['aria-expanded'] });
    return () => observer.disconnect();
  }, []);

  /*
   * 펼치면 목록 맨 앞에 검색창 자리를 끼우고, 닫히면(목록째 사라진다) 검색어를 비운다. 목록은 디자인 시스템이 펼친 뒤에
   * 그려 넣으므로, 아직 없으면 문서에 나타날 때까지 기다린다.
   */
  useEffect(() => {
    if (!open) {
      setSlot(null);
      setQuery('');
      return;
    }
    const container = document.createElement('div');
    container.className = 'select-search';
    const attach = (): boolean => {
      const listbox = document.getElementById(`${triggerId}-listbox`);
      if (listbox === null) return false;
      /* 거를수록 목록 폭이 줄어 흔들리지 않게, 처음 펼친 폭을 검색창 자리가 붙든다. */
      container.style.minWidth = `${String(listbox.getBoundingClientRect().width)}px`;
      listbox.prepend(container);
      setSlot(container);
      return true;
    };
    let waiting: MutationObserver | null = null;
    if (!attach()) {
      waiting = new MutationObserver(() => {
        if (attach()) waiting?.disconnect();
      });
      waiting.observe(document.body, { childList: true, subtree: true });
    }
    return () => {
      waiting?.disconnect();
      container.remove();
    };
  }, [open, triggerId]);

  const filtered = useMemo(() => filterOptions(options, query), [options, query]);
  const empty = countOptions(filtered) === 0;

  /* 고른 값이 검색으로 빠지면 디자인 시스템은 빈 칸 글자를 보인다 — 그 자리에 고른 이름을 둔다. */
  const selectedValue = value !== undefined ? value : null;
  const selectedLabel =
    selectedValue === null
      ? undefined
      : flatten(options).find((option) => option.value === selectedValue)?.label;
  const shownPlaceholder =
    selectedLabel !== undefined && !flatten(filtered).some((o) => o.value === selectedValue)
      ? selectedLabel
      : placeholder;

  /*
   * 검색어가 바뀌면 목록의 표시 줄을 첫 줄로 — 앞 목록의 줄 번호가 새 목록의 엉뚱한 줄을 가리키지 않게. 검색어가 바뀔
   * 때만 돈다(펼침이 바뀔 때는 디자인 시스템이 고른 줄로 맞춘다).
   */
  useEffect(() => {
    if (!open || query === '') return;
    forwardKey('Home');
  }, [query]);

  const forwardKey = (key: string) => {
    triggerRef.current?.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));
  };

  const onSearchKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (!FORWARDED_KEYS.has(event.key)) return;
    if (event.key !== 'Tab') event.preventDefault();
    forwardKey(event.key);
  };

  return (
    <>
      <DsSelect
        {...rest}
        {...(value !== undefined ? { value } : {})}
        {...(defaultValue !== undefined ? { defaultValue } : {})}
        {...(shownPlaceholder !== undefined ? { placeholder: shownPlaceholder } : {})}
        id={triggerId}
        ref={setTriggerRef}
        options={filtered}
      />
      {slot !== null &&
        createPortal(
          <>
            <input
              autoFocus
              type="search"
              className="select-search-input"
              aria-label={messages.common.selectSearch}
              aria-controls={`${triggerId}-listbox`}
              placeholder={messages.common.selectSearch}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={onSearchKeyDown}
            />
            {empty && <p className="select-search-empty">{messages.common.selectNoMatch}</p>}
          </>,
          slot,
        )}
    </>
  );
});
