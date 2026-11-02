import {
  Select as DsSelect,
  type SelectItems,
  type SelectOption,
  type SelectOptionGroup,
  type SelectProps,
} from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useInfiniteQuery } from '@tanstack/react-query';
import {
  forwardRef,
  type ForwardedRef,
  type KeyboardEvent,
  type ReactNode,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from 'react';
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
 *
 * 선택지가 수천 건인 마스터(품목 9천여 건)는 `PagedSelect` 를 쓴다 — 통째로 받지 않고 검색어로 서버에 묻고, 목록 끝에
 * 닿으면 다음 쪽을 잇는다(사용자 지시 2026-10-29).
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

const SearchableSelect = forwardRef<HTMLButtonElement, SelectProps>(function SearchableSelect(
  { options, placeholder, value, ...rest },
  ref,
) {
  const [query, setQuery] = useState('');
  const filtered = useMemo(() => filterOptions(options, query), [options, query]);

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

  return (
    <SearchFrame
      {...rest}
      {...(value !== undefined ? { value } : {})}
      {...(shownPlaceholder !== undefined ? { placeholder: shownPlaceholder } : {})}
      forwardedRef={ref}
      options={filtered}
      query={query}
      onQueryChange={setQuery}
      listVersion={query}
      head={
        countOptions(filtered) === 0 ? (
          <p className="select-search-empty">{messages.common.selectNoMatch}</p>
        ) : null
      }
    />
  );
});

/** 서버에서 받은 선택지 — `data` 에 원본 행을 실어 고른 뒤에 돌려받는다. */
export interface PagedOption extends SelectOption {
  data?: unknown;
}

/** 한 쪽 — 서버가 준 선택지와 검색어에 맞는 전체 건수. */
export interface SelectPage {
  options: PagedOption[];
  total: number;
}

export interface PagedSelectProps extends Omit<SelectProps, 'options'> {
  /** react-query 열쇠의 앞부분 — 검색어 · 쪽은 뒤에 붙인다. 같은 열쇠의 칸들은 받은 쪽을 나눠 쓴다. */
  queryKey: readonly unknown[];
  /** `page` 는 1부터. 빈 검색어는 「전부」다. */
  fetchPage: (query: string, page: number) => Promise<SelectPage>;
  /**
   * 고른 값의 선택지 — 아직 받은 쪽에 없어도(접힌 칸 · 다른 검색어) 칸에 그 이름을 보인다. 화면이 이미 아는 이름
   * (행의 품목명 등)을 넘긴다. 없으면 받은 쪽에서 찾는다.
   */
  selectedOption?: SelectOption | null;
  /** 검색어가 없을 때 맨 앞에 붙는 고정 선택지 — 조건 줄의 「전체」 같은 것. */
  leadingOptions?: SelectOption[];
  /** 고른 선택지 — 받은 쪽에서 고른 것이면 `data` 가 실려 있다. `onChange` 뒤에 부른다. */
  onOptionChange?: (option: PagedOption) => void;
}

const NO_OPTIONS: SelectOption[] = [];

/** 검색어를 서버에 묻기 전에 타자가 멎기를 기다리는 시간. */
const SEARCH_DEBOUNCE_MS = 250;
/** 목록 바닥에서 이만큼 남으면 다음 쪽을 부른다. */
const NEAR_END_PX = 48;

/**
 * 서버에서 쪽 단위로 받는 선택 칸 — 늘 검색창이 있다. 펼칠 때 첫 쪽을 받고, 목록 끝에 닿으면 다음 쪽을 잇는다.
 * 검색어는 서버로 간다(이름을 화면에서 거르지 않는다 — 받지 않은 쪽에 있을 수 있다).
 */
export const PagedSelect = forwardRef<HTMLButtonElement, PagedSelectProps>(function PagedSelect(
  {
    queryKey,
    fetchPage,
    selectedOption,
    leadingOptions = NO_OPTIONS,
    onOptionChange,
    onChange,
    placeholder,
    value,
    ...rest
  },
  ref,
) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [debounced, setDebounced] = useState('');
  /** 마지막으로 고른 선택지 — 닫힌 뒤 받은 쪽(빈 검색어)에 없어도 칸에 그 이름을 남긴다. */
  const [picked, setPicked] = useState<PagedOption | null>(null);

  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed === debounced) return;
    const timer = setTimeout(() => setDebounced(trimmed), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [query, debounced]);

  const pages = useInfiniteQuery({
    queryKey: [...queryKey, 'paged-select', debounced],
    enabled: open,
    initialPageParam: 1,
    queryFn: ({ pageParam }) => fetchPage(debounced, pageParam),
    getNextPageParam: (last, all) => {
      const loaded = all.reduce((sum, page) => sum + page.options.length, 0);
      /* 빈 쪽이면 더 받아도 새 것이 없다 — 서버 총계가 틀려도 끝없이 부르지 않는다. */
      return last.options.length > 0 && loaded < last.total ? all.length + 1 : undefined;
    },
  });

  const loaded = useMemo(
    (): PagedOption[] => pages.data?.pages.flatMap((page) => page.options) ?? [],
    [pages.data],
  );
  const leading = debounced === '' ? leadingOptions : [];
  const shown = useMemo((): PagedOption[] => [...leading, ...loaded], [leading, loaded]);

  const selectedValue = value !== undefined ? value : null;
  const selected =
    selectedValue === null
      ? null
      : (leadingOptions.find((o) => o.value === selectedValue) ??
        (selectedOption?.value === selectedValue ? selectedOption : null) ??
        (picked?.value === selectedValue ? picked : null) ??
        loaded.find((o) => o.value === selectedValue) ??
        null);

  /*
   * 접힌 칸은 고른 것 하나만 쥔다 — 디자인 시스템이 그 이름을 제 글자색으로 보인다. 펼치면 받은 쪽을 보이고, 고른 것이
   * 거기 없으면 빈 칸 글자 자리에 그 이름을 둔다.
   */
  const options = open ? shown : selected !== null ? [selected] : [];
  const shownPlaceholder =
    open && selected !== null && !shown.some((o) => o.value === selected.value)
      ? selected.label
      : placeholder;

  const settled = debounced === query.trim();
  const head = pages.isError ? (
    <p className="select-search-empty" role="alert">
      {messages.common.selectLoadFailed}
    </p>
  ) : pages.isPending || !settled ? (
    shown.length === 0 ? (
      <p className="select-search-empty" role="status">
        {messages.common.selectLoading}
      </p>
    ) : null
  ) : shown.length === 0 ? (
    <p className="select-search-empty">{messages.common.selectNoMatch}</p>
  ) : null;
  const foot = pages.isFetchingNextPage ? (
    <p className="select-search-empty" role="status">
      {messages.common.selectLoading}
    </p>
  ) : null;

  return (
    <SearchFrame
      {...rest}
      {...(value !== undefined ? { value } : {})}
      {...(shownPlaceholder !== undefined ? { placeholder: shownPlaceholder } : {})}
      forwardedRef={ref}
      options={options}
      onChange={(next) => {
        onChange?.(next);
        const option = shown.find((o) => o.value === next);
        if (option === undefined) return;
        setPicked(option);
        onOptionChange?.(option);
      }}
      query={query}
      onQueryChange={setQuery}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setDebounced('');
      }}
      /* 새 검색어의 첫 쪽이 오면 표시 줄을 첫 줄로 — 다음 쪽이 붙을 때는 그대로 둔다. */
      listVersion={`${debounced}|${String(pages.data !== undefined)}`}
      head={head}
      foot={foot}
      onNearEnd={() => {
        /* 스크롤 사건이 잇달아 와도 받는 중인 쪽을 끊고 다시 부르지 않는다. */
        if (pages.hasNextPage) void pages.fetchNextPage({ cancelRefetch: false });
      }}
    />
  );
});

/** 검색창에서 선택 칸으로 넘기는 키 — 목록 이동 · 고르기 · 닫기. 글자 · 공백 · Home · End 는 검색창의 것이다. */
const FORWARDED_KEYS = new Set(['ArrowDown', 'ArrowUp', 'Enter', 'Escape', 'Tab']);

interface SearchFrameProps extends SelectProps {
  forwardedRef: ForwardedRef<HTMLButtonElement>;
  query: string;
  onQueryChange: (query: string) => void;
  onOpenChange?: (open: boolean) => void;
  /** 바뀌면 펼친 목록의 표시 줄을 첫 줄로 돌린다. */
  listVersion: string;
  /** 검색창 밑 알림(빈 결과 · 불러오는 중). */
  head?: ReactNode;
  /** 목록 끝 알림(다음 쪽 불러오는 중). */
  foot?: ReactNode;
  /** 펼친 목록을 바닥 가까이 내렸을 때. */
  onNearEnd?: () => void;
}

/** 디자인 시스템 선택 칸 + 펼친 목록 맨 앞의 검색창 · 끝의 알림 자리. */
const SearchFrame = ({
  forwardedRef,
  query,
  onQueryChange,
  onOpenChange,
  listVersion,
  head,
  foot,
  onNearEnd,
  id,
  ...dsProps
}: SearchFrameProps) => {
  const fallbackId = useId();
  const triggerId = id ?? fallbackId;
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const [open, setOpen] = useState(false);
  const [slots, setSlots] = useState<{ head: HTMLElement; foot: HTMLElement } | null>(null);
  const nearEndRef = useRef(onNearEnd);
  nearEndRef.current = onNearEnd;
  const openChangeRef = useRef(onOpenChange);
  openChangeRef.current = onOpenChange;

  const setTriggerRef = (element: HTMLButtonElement | null) => {
    triggerRef.current = element;
    if (typeof forwardedRef === 'function') forwardedRef(element);
    else if (forwardedRef !== null) forwardedRef.current = element;
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

  useEffect(() => {
    openChangeRef.current?.(open);
  }, [open]);

  /*
   * 펼치면 목록 맨 앞에 검색창 자리 · 맨 끝에 알림 자리를 끼우고, 닫히면(목록째 사라진다) 검색어를 비운다. 목록은
   * 디자인 시스템이 펼친 뒤에 그려 넣으므로, 아직 없으면 문서에 나타날 때까지 기다린다.
   */
  useEffect(() => {
    if (!open) {
      setSlots(null);
      onQueryChange('');
      return;
    }
    const headSlot = document.createElement('div');
    headSlot.className = 'select-search';
    const footSlot = document.createElement('div');
    footSlot.className = 'select-search-foot';
    let listbox: HTMLElement | null = null;
    const onScroll = () => {
      if (listbox === null) return;
      if (listbox.scrollTop + listbox.clientHeight >= listbox.scrollHeight - NEAR_END_PX) {
        nearEndRef.current?.();
      }
    };
    const attach = (): boolean => {
      listbox = document.getElementById(`${triggerId}-listbox`);
      if (listbox === null) return false;
      /* 거를수록 목록 폭이 줄어 흔들리지 않게, 처음 펼친 폭을 검색창 자리가 붙든다. */
      headSlot.style.minWidth = `${String(listbox.getBoundingClientRect().width)}px`;
      listbox.prepend(headSlot);
      listbox.append(footSlot);
      listbox.addEventListener('scroll', onScroll);
      setSlots({ head: headSlot, foot: footSlot });
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
      listbox?.removeEventListener('scroll', onScroll);
      headSlot.remove();
      footSlot.remove();
    };
  }, [open, triggerId]);

  /*
   * 디자인 시스템은 선택지를 다시 그릴 때 끝 자리 뒤에 줄을 붙인다 — 알림 자리를 늘 맨 끝으로 되돌린다. 짧은 목록이라
   * 내릴 것이 없으면 바로 다음 쪽을 부른다.
   */
  useEffect(() => {
    if (slots === null) return;
    const listbox = slots.foot.parentElement;
    if (listbox === null) return;
    if (listbox.lastElementChild !== slots.foot) listbox.append(slots.foot);
    /* 높이를 모르는 자리(그려지기 전 · 시험 환경)에서는 부르지 않는다 — 끝없이 이어 받게 된다. */
    if (listbox.clientHeight > 0 && listbox.scrollHeight <= listbox.clientHeight + NEAR_END_PX) {
      nearEndRef.current?.();
    }
  });

  const forwardKey = (key: string) => {
    triggerRef.current?.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));
  };

  /*
   * 목록이 바뀌면 표시 줄을 첫 줄로 — 앞 목록의 줄 번호가 새 목록의 엉뚱한 줄을 가리키지 않게. 펼침이 바뀔 때는
   * 디자인 시스템이 고른 줄로 맞춘다.
   */
  const firstVersion = useRef(listVersion);
  useEffect(() => {
    if (!open || listVersion === firstVersion.current) return;
    firstVersion.current = listVersion;
    forwardKey('Home');
  }, [listVersion]);
  useEffect(() => {
    if (open) firstVersion.current = listVersion;
  }, [open]);

  const onSearchKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (!FORWARDED_KEYS.has(event.key)) return;
    if (event.key !== 'Tab') event.preventDefault();
    forwardKey(event.key);
  };

  return (
    <>
      <DsSelect {...dsProps} id={triggerId} ref={setTriggerRef} />
      {slots !== null &&
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
              onChange={(event) => onQueryChange(event.target.value)}
              onKeyDown={onSearchKeyDown}
            />
            {head}
          </>,
          slots.head,
        )}
      {slots !== null && foot !== null && foot !== undefined && createPortal(foot, slots.foot)}
    </>
  );
};
