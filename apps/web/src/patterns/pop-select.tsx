import { type SelectItems, type SelectOption, type SelectProps } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { forwardRef, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';

import { PuDialog } from './pop-uniform/dialog';
import { PuIcon } from './pop-uniform/icon';
import { PuEmpty } from './pop-uniform/layout';
import { PuPager, useFitCount } from './pop-uniform/pager';
import { PuTextKeyboard } from './pop-uniform/text-keyboard';

/**
 * 한 쪽에 놓는 항목 수.
 *
 * ⛔ **목록은 스크롤하지 않는다**(사용자 지시 2026-09-09). 넘치는 것은 [이전]과
 * [다음]이 넘긴다 — 장갑 낀 손으로 좁은 목록을 굴리는 것보다 큰 버튼 둘이 낫다.
 * 그래서 이 수는 **팝업이 한 번에 다 보일 수 있는 줄 수**여야 한다. 여섯으로 두었더니
 * 다섯 줄 자리에 여섯을 넣어 마지막 줄이 잘리고 스크롤이 생겼다(실측 2026-09-09).
 *
 * ⚠ 줄 높이나 팝업 높이를 바꾸면 이 수도 함께 재어 고친다(`pop.css` 의 `__list`).
 */
const PAGE_SIZE = 5;

const flattenOptions = (items: SelectItems): SelectOption[] =>
  items.flatMap((item) => ('options' in item ? item.options : [item]));

/** 칸 이름표(`<label for>`)의 글 — 별표·(선택) 같은 덧붙임은 뺀다. */
const fieldLabelOf = (id: string | undefined): string => {
  if (id === undefined) return '';
  const label = document.querySelector(`label[for="${CSS.escape(id)}"]`);
  if (label === null) return '';

  return [...label.childNodes]
    .filter((node) => !(node instanceof HTMLElement && node.matches('.req, .opt, .aside')))
    .map((node) => node.textContent ?? '')
    .join('')
    .trim();
};

const accessibleName = ({
  ariaLabel,
  labelledBy,
  id,
  placeholder,
}: {
  ariaLabel?: string;
  labelledBy?: string;
  id?: string;
  placeholder?: string;
}): string => {
  if (ariaLabel !== undefined) return ariaLabel;

  const labelled = labelledBy
    ?.split(/\s+/u)
    .map((id) => document.getElementById(id)?.textContent?.trim() ?? '')
    .filter(Boolean)
    .join(' ');

  /* 창 제목은 칸 이름을 먼저 쓴다 — 안내 문구(「…를 선택하세요」)를 쓰면 「…선택하세요 선택」이 된다(사용자 지적 2026-11-19). */
  return (
    labelled || fieldLabelOf(id) || placeholder || messages.popChrome.selectDialog.fallbackName
  );
};

export interface PopSelectProps extends SelectProps {
  /**
   * 이전 POP 화면과의 소스 호환용이다. E-3에 따라 렌더 크기는 관리웹 기본 `md`로 고정한다.
   */
  size?: SelectProps['size'];
  /** 닫힌 상태에서 팝업을 여는 버튼 문구. */
  actionLabel?: string;
  /**
   * 팝업에서 **스캐너로 골라도 되는 목록인가**(#1351).
   *
   * ⭐ 켜면 셋이 달라진다 — ⓐ 검색 줄을 **짧은 목록에서도** 세운다(감추면 찍을 자리가 없다)
   *    ⓑ 팝업이 열릴 때 그 칸에 **초점**을 준다(스캐너는 초점이 있는 칸에 글자를 쏜다)
   *    ⓒ 값이 **후보 하나와 정확히 같아지면 스스로 고르고 닫는다**.
   *
   * ⛔ **후보를 새로 가져오지는 않는다.** 이 부품의 계약(위 머리말)이 그대로다 — 스캔은
   *    「목록 안에서 빨리 찾는 수단」이지 목록 밖으로 나가는 문이 아니다. P-04-01 이 겪은 것이
   *    그 반대였다: 목록과 스캔이 **같은 조회에 다른 필터**로 나가 「목록엔 없는데 찍으면 잡히는
   *    출하」가 생겼다(`docs/decisions.md` 18).
   *
   * ⚠ **기본은 꺼짐이다** — 이 부품은 POP 화면 열여덟 곳이 함께 쓴다.
   */
  scannable?: boolean;
  /**
   * 닫힌 상태의 값 글자를 따로 세우지 않는다. 버튼 문구(`actionLabel`)가 지금 값을 말할 때 쓴다
   * (예: 목록 제목 줄의 설비 고르기 [사출기 1호기]). 좁은 제목 줄에서 값과 [선택]을 둘 다 세우면
   * 넘친다(P-02-01, 2026-10-26). 기본은 꺼짐이다.
   */
  hideValue?: boolean;
  /**
   * 항목 뒤에 붙일 표시(D-10, 피처 002 — 화면 이동의 남은 작업 수). 항목 단추 안 이름 뒤에 선다.
   *
   * ⚠ **주지 않으면 지금과 같다** — 이 부품은 POP 화면 열여덟 곳이 함께 쓴다.
   */
  optionTrailing?: (option: SelectOption) => ReactNode;
  /**
   * 팝업 맨 위, 목록 앞에 세울 묶음(D-10 — 화면 이동의 「남은 작업」). 받은 `choose` 로 고르면 목록에서
   * 고른 것과 같은 길로 값을 내고 닫는다. 주지 않으면 지금과 같다.
   */
  dialogLead?: (choose: (value: string) => void) => ReactNode;
  /** 닫힌 단추의 글 뒤에 붙일 표시(점 등). 주지 않으면 지금과 같다. */
  actionBadge?: ReactNode;
}

/**
 * 마지막 글자 뒤 이만큼 조용하면 스캔이 끝난 것으로 본다 —
 * `screens/packing-result/scan-field` 와 같은 값이다.
 *
 * ⛔ **곧바로 대조하지 않는 이유가 있다.** 스캐너는 글자를 하나씩 붙여 보내므로 `SH-10` 을
 *    쏘는 도중 `SH-1` 이 잠깐 만들어진다 — 그 값이 다른 후보와 정확히 같으면 **엉뚱한 출하를
 *    고르고 팝업이 닫힌다.** 멎은 뒤에 재면 중간값은 결코 확정되지 않는다.
 */
const SCAN_IDLE_MS = 150;

/**
 * POP 선택 목록의 단일 표현(G-34).
 *
 * 닫힌 상태는 현재 값과 [선택]을 나란히 보이고, 열린 상태는 이미 받은 후보만 로컬에서
 * 검색한다. 이 부품은 데이터를 가져오지 않으므로 검색어 변경이 API 호출을 만들 수 없다.
 */
export const PopSelect = forwardRef<HTMLButtonElement, PopSelectProps>(function PopSelect(
  {
    options,
    value,
    defaultValue = null,
    onChange,
    placeholder = '',
    disabled = false,
    invalid = false,
    name,
    id,
    className,
    leadingIcon,
    actionLabel = messages.popChrome.select,
    scannable = false,
    hideValue = false,
    optionTrailing,
    dialogLead,
    actionBadge,
    size: _legacySize,
    'aria-label': ariaLabel,
    'aria-labelledby': ariaLabelledBy,
    'aria-describedby': ariaDescribedBy,
    'aria-required': ariaRequired,
    ...buttonProps
  },
  ref,
) {
  const [uncontrolledValue, setUncontrolledValue] = useState<string | null>(defaultValue);
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(0);
  const [title, setTitle] = useState(
    messages.popChrome.selectDialog.title(messages.popChrome.selectDialog.fallbackName),
  );
  const flatOptions = useMemo(() => flattenOptions(options), [options]);
  const selectedValue = value === undefined ? uncontrolledValue : value;
  const selected = flatOptions.find((option) => option.value === selectedValue) ?? null;
  const normalizedQuery = query.trim().toLocaleLowerCase('ko-KR');
  const filtered = useMemo(
    () =>
      normalizedQuery === ''
        ? flatOptions
        : flatOptions.filter((option) =>
            `${option.label} ${option.value}`.toLocaleLowerCase('ko-KR').includes(normalizedQuery),
          ),
    [flatOptions, normalizedQuery],
  );
  /*
   * ⭐ **짧은 목록에는 검색도 쪽 이동도 두지 않는다**(사용자 지적 2026-09-10). 값이 둘·셋인
   * 목록에 검색창과 쪽 단추가 서면, 고르는 데 필요한 것보다 조작이 더 많다 — POP 은 큰 단추로
   * 한 번에 고르는 화면이다(설계 §7 DS 매핑에 이 판이 없다).
   */
  /*
   * ⚠ **묶음이 아니라 «항목»을 센다**(리뷰 지적 2026-09-11). `options` 는 묶음을 담을 수 있어
   *   (`flattenOptions`), 묶음 셋에 항목 예순이 든 목록도 `length` 가 3 이다. 그것을 짧다고
   *   보면 검색도 쪽 이동도 없이 «첫 다섯만» 보이고 나머지는 고를 길이 사라진다.
   */
  const isShortList = flatOptions.length <= PAGE_SIZE;
  /*
   * ⭐ **스캔 목록은 짧아도 검색 줄을 세운다** — 감추면 찍어 넣을 칸이 없다.
   *
   * ⛔ **쪽 이동은 함께 켜지 «않는다»**(리뷰 지적). 한때 `isShortList` 자체에 `&& !scannable` 을
   *    붙였는데, 그 값이 검색 줄과 쪽 이동 줄 **둘 다**를 통제한다 — 후보가 둘뿐인 목록에
   *    양쪽 다 눌리지 않는 [이전]과 [다음]이 함께 섰다(실측). 위 규율이 지우려던
   *    바로 그 모양이라, 두 자리를 가르고 이름도 뜻대로 붙인다.
   */
  const showSearch = !isShortList || scannable;
  /*
   * ⭐ 검색 칸이 있으면 창 맨 아래에 화면 글자판을 둔다 — POP 단말에는 실물 자판이 없다(#295).
   *    글자판이 자리를 차지하므로 한 쪽 건수는 남은 목록 칸 높이로 잰다(창 안 스크롤 없음).
   */
  const listRef = useRef<HTMLDivElement>(null);
  const fitCount = useFitCount(listRef, { fallback: 4, max: PAGE_SIZE });
  const pageSize = showSearch ? fitCount : PAGE_SIZE;
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, totalPages - 1);
  const visibleOptions = filtered.slice(currentPage * pageSize, (currentPage + 1) * pageSize);
  const searchRef = useRef<HTMLInputElement>(null);

  const close = () => {
    setIsOpen(false);
    setQuery('');
    setPage(0);
  };

  /** 후보 하나를 골라 닫는다 — 목록 단추와 스캔이 같은 길을 쓴다. */
  const choose = (option: SelectOption): void => {
    if (value === undefined) setUncontrolledValue(option.value);
    onChange?.(option.value);
    close();
  };

  /*
   * ⭐ **스캔 칸에 초점을 준다.** 스캐너는 초점이 있는 칸에 글자를 쏘므로, 열어 놓고 초점이
   *    없으면 찍어도 아무 데도 들어가지 않는다. 터치 단말에서는 이 초점이 화면 자판도 함께
   *    띄운다 — 손으로 칠 때의 「직접 입력」이 이 한 동작에 들어 있다.
   */
  useEffect(() => {
    if (!scannable || !isOpen) return;

    searchRef.current?.focus();
  }, [scannable, isOpen]);

  /*
   * 타이머 «안»에서 읽을 최신값.
   *
   * ⛔ **후보와 `choose` 를 의존성에 넣지 않는다**(리뷰 지적). `flatOptions` 는 부르는 쪽이
   *    `options` 를 인라인 배열로 만들면 **매 렌더 새 값**이고(`screen.tsx` 가 그렇다),
   *    `choose` 도 렌더마다 새로 만들어진다 — 의존성에 넣으면 타이머가 **렌더마다 다시 서서**
   *    아래 「멎은 뒤에 잰다」가 무너진다. 렌더가 `SCAN_IDLE_MS` 보다 잦아지면 자동 선택이
   *    영영 뜨지 않는다.
   * ⭐ ref 로 넘기면 타이머는 **검색어가 바뀔 때만** 다시 서고, 터질 때는 늘 최신 후보를 본다.
   */
  const latest = useRef({ flatOptions, choose });
  latest.current = { flatOptions, choose };

  /*
   * ⭐ **값이 후보 하나와 «정확히» 같아지면 스스로 고른다.** 찍고 나서 또 눌러야 하면 스캔으로
   *    얻는 것이 없다.
   *
   * ⛔ **부분 일치로 좁혀진 하나는 고르지 않는다.** 손으로 몇 글자만 쳐도 후보가 하나로 줄 수
   *    있는데, 그때 스스로 고르면 **고를 생각이 없던 것이 골라진다.** 손으로 치는 사람은
   *    목록에서 눌러 고른다.
   *
   * ⚠ 멎은 뒤에 잰다 — 위 `SCAN_IDLE_MS` 머리말.
   */
  useEffect(() => {
    if (!scannable || !isOpen || normalizedQuery === '') return;

    const timer = setTimeout(() => {
      const exact = latest.current.flatOptions.filter(
        (option) =>
          option.label.trim().toLocaleLowerCase('ko-KR') === normalizedQuery ||
          option.value.trim().toLocaleLowerCase('ko-KR') === normalizedQuery,
      );

      /* 같은 이름이 둘이면 어느 것인지 화면이 정하지 않는다 — 목록에서 고르게 둔다. */
      if (exact.length !== 1) return;
      const [only] = exact;
      if (only === undefined || only.disabled === true) return;

      latest.current.choose(only);
    }, SCAN_IDLE_MS);

    return () => {
      clearTimeout(timer);
    };
  }, [scannable, isOpen, normalizedQuery]);

  /*
   * ⭐ 모양은 POP 통일 규칙 7·16(#295) — 칸 하나(고른 값 또는 회색 「○○ 선택」 + 오른쪽 ⌄)를 누르면 선택 창.
   *    창 머리에 닫기(X)가 없고 아래 [취소] 하나로 닫는다. 쪽 넘김은 「총 N건 ‹ 1 / 2 ›」.
   *    고르는 동작(검색 · 스캔 자동 선택 · 5개씩 쪽)은 그대로다.
   */
  const shownLabel = hideValue ? actionLabel : (selected?.label ?? placeholder);
  const isPlaceholder = !hideValue && selected === null;

  return (
    <div className="pop-select">
      <button
        {...buttonProps}
        ref={ref}
        id={id}
        type="button"
        role="combobox"
        className={['pu-input', 'pu-pickf', 'pop-select__trigger', invalid && 'is-need', className]
          .filter(Boolean)
          .join(' ')}
        disabled={disabled}
        aria-label={ariaLabel}
        aria-labelledby={ariaLabelledBy}
        aria-describedby={ariaDescribedBy}
        aria-required={ariaRequired}
        aria-invalid={invalid || undefined}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        onClick={(event) => {
          buttonProps.onClick?.(event);
          if (event.defaultPrevented) return;

          setTitle(
            messages.popChrome.selectDialog.title(
              accessibleName({
                ariaLabel,
                labelledBy: ariaLabelledBy,
                id,
                placeholder,
              }),
            ),
          );
          setIsOpen(true);
        }}
      >
        {leadingIcon}
        <span className={isPlaceholder ? 'ph' : undefined}>
          {shownLabel === '' ? actionLabel : shownLabel}
        </span>
        {actionBadge}
        <PuIcon name="chevron" />
      </button>

      {name !== undefined ? <input type="hidden" name={name} value={selectedValue ?? ''} /> : null}

      {isOpen ? (
        /*
         * ⛔ **창 바깥을 눌러 닫히지 않는다**(사용자 지시 2026-09-10) — 터치 단말에서 손이 스치면 고르려던
         *    항목과 검색어가 사라진다. 닫는 길은 아래 [취소]와 Esc 다.
         */
        <PuDialog
          title={title}
          wide={showSearch}
          onClose={close}
          closeLabel={messages.popUniform.dialog.cancel}
        >
          {dialogLead?.((chosen) => {
            const option = flatOptions.find((candidate) => candidate.value === chosen);
            if (option !== undefined) choose(option);
          })}

          {showSearch && (
            <div className="pu-input pu-search">
              <PuIcon name="search" />
              <input
                ref={searchRef}
                type="search"
                aria-label={
                  scannable
                    ? messages.popChrome.selectDialog.scanLabel
                    : messages.popChrome.selectDialog.searchLabel
                }
                placeholder={
                  scannable
                    ? messages.popChrome.selectDialog.scanPlaceholder
                    : messages.popChrome.selectDialog.searchPlaceholder
                }
                value={query}
                onChange={(event) => {
                  setQuery(event.target.value);
                  setPage(0);
                }}
              />
              {query !== '' && (
                <button
                  type="button"
                  className="pu-btn sm ghost icon"
                  aria-label={messages.popChrome.selectDialog.clearSearch}
                  title={messages.popChrome.selectDialog.clearSearch}
                  onClick={() => {
                    setQuery('');
                    setPage(0);
                  }}
                >
                  <PuIcon name="x" />
                </button>
              )}
            </div>
          )}

          <div ref={listRef} className="pu-list" role="listbox" aria-label={title}>
            {visibleOptions.length === 0 ? (
              <PuEmpty icon="search" title={messages.popChrome.selectDialog.empty} />
            ) : (
              visibleOptions.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  role="option"
                  className={option.value === selectedValue ? 'pu-opt is-on' : 'pu-opt'}
                  disabled={option.disabled}
                  aria-selected={option.value === selectedValue}
                  onClick={() => {
                    choose(option);
                  }}
                >
                  <span>{option.label}</span>
                  {optionTrailing === undefined ? null : (
                    <span className="tail">{optionTrailing(option)}</span>
                  )}
                </button>
              ))
            )}
          </div>

          {(!isShortList || totalPages > 1) && (
            <PuPager
              label={title}
              total={filtered.length}
              page={currentPage + 1}
              pages={totalPages}
              onPage={(next) => {
                setPage(Math.min(totalPages - 1, Math.max(0, next - 1)));
              }}
            />
          )}
          {/* 글자판은 맨 아래 — 목록·쪽 넘김 다음(사용자 지시 2026-11-19). */}
          {showSearch && (
            <PuTextKeyboard
              value={query}
              onChange={(next) => {
                setQuery(next);
                setPage(0);
              }}
            />
          )}
        </PuDialog>
      ) : null}
    </div>
  );
});
