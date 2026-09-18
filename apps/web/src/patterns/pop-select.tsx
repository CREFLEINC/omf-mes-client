import {
  Button,
  Dialog,
  TextField,
  type SelectItems,
  type SelectOption,
  type SelectProps,
} from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { forwardRef, useEffect, useMemo, useRef, useState } from 'react';

/**
 * 한 쪽에 놓는 항목 수.
 *
 * ⛔ **목록은 스크롤하지 않는다**(사용자 지시 2026-09-09). 넘치는 것은 [페이지 위]·
 * [페이지 아래]가 넘긴다 — 장갑 낀 손으로 좁은 목록을 굴리는 것보다 큰 버튼 둘이 낫다.
 * 그래서 이 수는 **팝업이 한 번에 다 보일 수 있는 줄 수**여야 한다. 여섯으로 두었더니
 * 다섯 줄 자리에 여섯을 넣어 마지막 줄이 잘리고 스크롤이 생겼다(실측 2026-09-09).
 *
 * ⚠ 줄 높이나 팝업 높이를 바꾸면 이 수도 함께 재어 고친다(`pop.css` 의 `__list`).
 */
const PAGE_SIZE = 5;

const flattenOptions = (items: SelectItems): SelectOption[] =>
  items.flatMap((item) => ('options' in item ? item.options : [item]));

const accessibleName = ({
  ariaLabel,
  labelledBy,
  placeholder,
}: {
  ariaLabel?: string;
  labelledBy?: string;
  placeholder?: string;
}): string => {
  if (ariaLabel !== undefined) return ariaLabel;

  const labelled = labelledBy
    ?.split(/\s+/u)
    .map((id) => document.getElementById(id)?.textContent?.trim() ?? '')
    .filter(Boolean)
    .join(' ');

  return labelled || placeholder || messages.popChrome.selectDialog.fallbackName;
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
  /* ⚠ 스캔 목록은 짧아도 검색 줄을 세운다 — 감추면 찍어 넣을 칸이 없다. */
  const isShortList = flatOptions.length <= PAGE_SIZE && !scannable;
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages - 1);
  const visibleOptions = filtered.slice(currentPage * PAGE_SIZE, (currentPage + 1) * PAGE_SIZE);
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
      const exact = flatOptions.filter(
        (option) =>
          option.label.trim().toLocaleLowerCase('ko-KR') === normalizedQuery ||
          option.value.trim().toLocaleLowerCase('ko-KR') === normalizedQuery,
      );

      /* 같은 이름이 둘이면 어느 것인지 화면이 정하지 않는다 — 목록에서 고르게 둔다. */
      if (exact.length !== 1) return;
      const [only] = exact;
      if (only === undefined || only.disabled === true) return;

      choose(only);
    }, SCAN_IDLE_MS);

    return () => {
      clearTimeout(timer);
    };
    /*
     * ⚠ `choose` 는 매 렌더 새로 만들어져 의존성에 넣으면 타이머가 매번 다시 선다 — 그러면
     *   「멎은 뒤에 잰다」가 성립하지 않는다. 값이 바뀔 때만 다시 건다.
     */
  }, [scannable, isOpen, normalizedQuery, flatOptions]);

  return (
    <div className="pop-select">
      <span className="pop-select__value" aria-hidden="true">
        {leadingIcon}
        <span className={selected === null ? 'pop-select__placeholder' : undefined}>
          {selected?.label ?? placeholder}
        </span>
      </span>
      <Button
        {...buttonProps}
        ref={ref}
        id={id}
        type="button"
        role="combobox"
        variant="outlined"
        size="md"
        className={['pop-select__trigger', className].filter(Boolean).join(' ')}
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
                placeholder,
              }),
            ),
          );
          setIsOpen(true);
        }}
      >
        {actionLabel}
      </Button>

      {name !== undefined ? <input type="hidden" name={name} value={selectedValue ?? ''} /> : null}

      {isOpen ? (
        <Dialog
          open
          onClose={close}
          title={title}
          size="md"
          className="pop-select-dialog"
          /*
           * ⛔ **팝업 바깥을 눌러 닫히지 않는다**(사용자 지시 2026-09-10). 닫는 길은 우상단
           *    [✕] 하나다.
           *
           * ⭐ **터치 단말이라서다.** 목록 팝업은 화면 대부분을 덮고, 손이 스치거나 장갑 낀
           *    손가락이 가장자리를 짚는 일이 잦다. 스크림 클릭이 닫기로 이어지면 고르려던
           *    항목을 놓치고 검색어와 쪽 위치까지 함께 사라진다 — 고르려고 연 팝업이
           *    「누른 적 없는데 닫힌다」가 된다.
           *
           * ⚠ **설계는 이 자리를 정하지 않았다.** G-34 는 팝업의 «내용»(목록 스크롤 ·
           *   페이지 위/아래 · 현재 쪽 · 검색어 지우기)만 정하고 닫는 방법을 적지 않았다.
           *   회신이 오면 그때 맞춘다.
           *
           * ⚠ Escape 는 그대로 둔다 — 자판이 붙은 단말과 개발 중 확인에서 쓰는 길이고,
           *   손이 스쳐 눌리는 자리가 아니다.
           */
          closeOnBackdropClick={false}
        >
          {!isShortList && (
            <div className="pop-select-dialog__search">
              <TextField
                ref={searchRef}
                type="search"
                size="md"
                fullWidth
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
              <Button
                type="button"
                variant="outlined"
                size="md"
                disabled={query === ''}
                onClick={() => {
                  setQuery('');
                  setPage(0);
                }}
              >
                {messages.popChrome.selectDialog.clearSearch}
              </Button>
            </div>
          )}

          <div className="pop-select-dialog__list" role="listbox" aria-label={title}>
            {visibleOptions.length === 0 ? (
              <p className="pop-select-dialog__empty">{messages.popChrome.selectDialog.empty}</p>
            ) : (
              visibleOptions.map((option) => (
                <Button
                  key={option.value}
                  type="button"
                  role="option"
                  variant={option.value === selectedValue ? 'tonal' : 'text'}
                  size="md"
                  className="pop-select-dialog__option"
                  disabled={option.disabled}
                  aria-selected={option.value === selectedValue}
                  onClick={() => {
                    choose(option);
                  }}
                >
                  {option.label}
                </Button>
              ))
            )}
          </div>

          {!isShortList && (
            <div className="pop-select-dialog__paging">
              <Button
                type="button"
                variant="outlined"
                size="md"
                disabled={currentPage === 0}
                onClick={() => {
                  setPage((previous) => Math.max(0, previous - 1));
                }}
              >
                {messages.popPageNav.pageUp}
              </Button>
              <output aria-live="polite">
                {messages.popChrome.selectDialog.position(
                  currentPage + 1,
                  totalPages,
                  filtered.length,
                )}
              </output>
              <Button
                type="button"
                variant="outlined"
                size="md"
                disabled={currentPage >= totalPages - 1}
                onClick={() => {
                  setPage((previous) => Math.min(totalPages - 1, previous + 1));
                }}
              >
                {messages.popPageNav.pageDown}
              </Button>
            </div>
          )}
        </Dialog>
      ) : null}
    </div>
  );
});
