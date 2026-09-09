import {
  Button,
  Dialog,
  TextField,
  type SelectItems,
  type SelectOption,
  type SelectProps,
} from '@crefle/web-ui';
import { forwardRef, useMemo, useState } from 'react';

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

  return labelled || placeholder || '항목';
};

export interface PopSelectProps extends SelectProps {
  /**
   * 이전 POP 화면과의 소스 호환용이다. E-3에 따라 렌더 크기는 관리웹 기본 `md`로 고정한다.
   */
  size?: SelectProps['size'];
  /** 닫힌 상태에서 팝업을 여는 버튼 문구. */
  actionLabel?: string;
}

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
    actionLabel = '선택',
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
  const [title, setTitle] = useState('항목 선택');
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
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages - 1);
  const visibleOptions = filtered.slice(currentPage * PAGE_SIZE, (currentPage + 1) * PAGE_SIZE);

  const close = () => {
    setIsOpen(false);
    setQuery('');
    setPage(0);
  };

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
            `${accessibleName({
              ariaLabel,
              labelledBy: ariaLabelledBy,
              placeholder,
            })} 선택`,
          );
          setIsOpen(true);
        }}
      >
        {actionLabel}
      </Button>

      {name !== undefined ? <input type="hidden" name={name} value={selectedValue ?? ''} /> : null}

      {isOpen ? (
        <Dialog open onClose={close} title={title} size="md" className="pop-select-dialog">
          <div className="pop-select-dialog__search">
            <TextField
              type="search"
              size="md"
              fullWidth
              aria-label="목록 검색"
              placeholder="목록에서 검색"
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
              검색어 지우기
            </Button>
          </div>

          <div className="pop-select-dialog__list" role="listbox" aria-label={title}>
            {visibleOptions.length === 0 ? (
              <p className="pop-select-dialog__empty">표시할 항목이 없습니다.</p>
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
                    if (value === undefined) setUncontrolledValue(option.value);
                    onChange?.(option.value);
                    close();
                  }}
                >
                  {option.label}
                </Button>
              ))
            )}
          </div>

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
              페이지 위
            </Button>
            <output aria-live="polite">
              {currentPage + 1} / {totalPages} · 전체 {filtered.length}건
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
              페이지 아래
            </Button>
          </div>
        </Dialog>
      ) : null}
    </div>
  );
});
