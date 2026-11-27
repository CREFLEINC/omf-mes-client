import {
  Button,
  Dialog,
  EmptyState,
  Icon,
  IconButton,
  SearchInput,
  TextField,
  type Column,
} from '@crefle/web-ui';
import { messages, named } from '@omf-mes/i18n';
import { useQuery } from '@tanstack/react-query';
import { useId, useState, type ReactNode } from 'react';

import { PageNav } from '../page-nav';
import { pageSizesWith } from '../page-nav/page-size-param';
import { Select } from '../select';
import { SelectableTable } from '../selectable-table';

/**
 * C-12 기준 정보 참조 선택. 입력칸(`ReferenceField`)과 검색 팝업(`PickerDialog`)의 공용 틀.
 * 조회 함수만 바꿔 라인, 설비, 금형, 작업자, 위치에 쓴다. 한 건만 고른다.
 * 미구현: 여러 건 선택(체크박스), 「추천」 표시를 결과 맨 위에 두기(추천은 칸 아래 칩으로 둔다).
 */
const t = messages.screenPatterns.referencePicker;

export interface ReferenceRow {
  id: number;
  code: string;
  name: string;
  /** 분류 값(위치의 창고 등). 결과 표의 세 번째 열. */
  group?: string;
  /** 고르면 함께 채울 상위 값(설비의 라인 등). 부르는 쪽이 해석한다. */
  parentId?: number | null;
}

export interface ReferenceSearchPage {
  items: ReferenceRow[];
  total: number;
}

export interface ReferenceFilter {
  label: string;
  value: string;
  options: { value: string; label: string }[];
}

export interface ReferenceSource {
  /** 팝업 제목(「〈대상〉 선택」) */
  title: string;
  /** 캐시 키의 앞부분. 범위(공장, 라인)를 넣는다. */
  key: readonly unknown[];
  /** 결과 표 머리 */
  columns: { code: string; name: string; group?: string };
  /** 분류 필터(위치의 창고 등). 없으면 그리지 않는다. */
  filter?: ReferenceFilter;
  /**
   * 한 쪽 건수 — 팝업이 쪽 크기 선택(10 · 20 · 50)으로 바꿔 넘긴다(품질 화면과 같다 · #360). 원천이 받지 않던 시절의 3인자
   * 호출과 맞도록 선택 인자다.
   */
  search: (
    term: string,
    page: number,
    filterValue: string,
    size?: number,
  ) => Promise<ReferenceSearchPage>;
  /** 이 원천의 기본 쪽 크기 — 종전에 보내던 값. 없으면 `REFERENCE_PAGE_SIZE`(20). */
  pageSize?: number;
}

export const REFERENCE_PAGE_SIZE = 20;

export interface PickerDialogProps {
  wrapValue?: boolean;
  source: ReferenceSource;
  onClose: () => void;
  onPick: (row: ReferenceRow) => void;
}

export const PickerDialog = ({ source, onClose, onPick, wrapValue = false }: PickerDialogProps) => {
  const keywordId = useId();
  const reasonId = useId();
  const [keyword, setKeyword] = useState('');
  const [term, setTerm] = useState('');
  const [page, setPage] = useState(1);
  /* 쪽 크기 — 기본은 원천이 종전에 보내던 값(#360). */
  const defaultSize = source.pageSize ?? REFERENCE_PAGE_SIZE;
  const [size, setSize] = useState(defaultSize);
  const [filterValue, setFilterValue] = useState(source.filter?.value ?? '');
  const [picked, setPicked] = useState<ReferenceRow | null>(null);
  const result = useQuery({
    queryKey: [...source.key, 'reference-picker', term, page, filterValue, size],
    queryFn: () => source.search(term, page, filterValue, size),
  });
  const rows = result.data?.items ?? [];
  const columns: Column<ReferenceRow>[] = [
    {
      key: 'code',
      header: source.columns.code,
      render: (row) => <span className="nowrap-cell">{row.code}</span>,
    },
    {
      key: 'name',
      header: source.columns.name,
      render: (row) => (
        <span className={wrapValue ? 'erp-wo-complete-value' : 'ellipsis-cell'} title={row.name}>
          {row.name}
        </span>
      ),
    },
    ...(source.columns.group === undefined
      ? []
      : [
          {
            key: 'group',
            header: source.columns.group,
            render: (row: ReferenceRow) => <span className="nowrap-cell">{row.group ?? ''}</span>,
          },
        ]),
  ];
  const submit = () => {
    setPage(1);
    setTerm(keyword.trim());
    setPicked(null);
  };
  /* 쪽을 넘기면 고른 행이 보이지 않으므로 고름을 푼다. */
  const changePage = (next: number) => {
    setPage(next);
    setPicked(null);
  };

  return (
    <Dialog
      open
      size="lg"
      title={source.title}
      closeOnBackdropClick={false}
      onClose={onClose}
      footer={
        <>
          <Button type="button" variant="outlined" onClick={onClose}>
            {messages.common.cancel}
          </Button>
          <Button
            type="button"
            disabled={picked === null}
            aria-describedby={picked === null ? reasonId : undefined}
            onClick={() => picked !== null && onPick(picked)}
          >
            {t.pick}
          </Button>
          <span id={reasonId} className="visually-hidden">
            {t.pickReason}
          </span>
        </>
      }
    >
      <div className="reference-picker-body">
        {/* 팝업이 조회 조건 form 안에서 열릴 수 있어 form을 겹치지 않는다. Enter는 검색만 한다. */}
        <div
          className="reference-picker-search"
          role="search"
          onKeyDown={(event) => {
            if (event.key !== 'Enter') return;
            event.preventDefault();
            event.stopPropagation();
            submit();
          }}
        >
          {source.filter !== undefined && (
            <div className="field-cell filter-field-sm">
              <label className="field-label" htmlFor={`${keywordId}-filter`}>
                {source.filter.label}
              </label>
              <Select
                id={`${keywordId}-filter`}
                value={filterValue}
                options={source.filter.options}
                onChange={(value) => {
                  setFilterValue(value);
                  setPage(1);
                  setPicked(null);
                }}
              />
            </div>
          )}
          <div className="field-cell reference-picker-keyword">
            <label className="field-label" htmlFor={keywordId}>
              {t.keyword}
            </label>
            <TextField
              id={keywordId}
              fullWidth
              value={keyword}
              placeholder={t.keywordPlaceholder}
              onChange={(event) => setKeyword(event.target.value)}
            />
          </div>
          <div className="field-cell field-cell-unlabeled">
            <Button type="button" variant="outlined" onClick={submit}>
              {t.search}
            </Button>
          </div>
        </div>
        <SelectableTable
          columns={columns}
          rows={rows}
          getRowId={(row) => String(row.id)}
          activeId={picked === null ? null : String(picked.id)}
          rowLabel={(row) => named(row.name, row.code)}
          onActivate={setPicked}
          empty={
            /* 조회 실패를 「결과 없음」으로 보이지 않는다. */
            <EmptyState
              size="sm"
              title={result.isError ? t.failed : result.isPending ? t.searching : t.empty(term)}
            />
          }
        />
        <PageNav
          meta={{ page, size, total: result.data?.total ?? 0 }}
          sizes={pageSizesWith(defaultSize)}
          onChangePage={changePage}
          onChangeSize={(next) => {
            /* 쪽 크기를 바꾸면 첫 쪽으로 — 쪽을 넘길 때처럼 고른 행도 푼다. */
            setSize(next);
            changePage(1);
          }}
        />
      </div>
    </Dialog>
  );
};

export interface ReferenceFieldProps {
  renderPicker?: (props: PickerDialogProps) => ReactNode;
  label: string;
  /** 표 칸 안에서처럼 라벨을 화면에 보이지 않고 접근 이름으로만 둔다. */
  hideLabel?: boolean;
  /** 칸 높이. 표 행과 조밀한 편집 영역은 sm(C-19). */
  size?: 'sm' | 'md';
  /** 고른 값의 「이름 (코드)」. 비었으면 ''. */
  valueLabel: string;
  /** 긴 선택값을 줄바꿈하여 전체 표시한다. */
  wrapValue?: boolean;
  clearable?: boolean;
  /** 비었을 때 흐린 문구. 기본은 「눌러서 찾기」. */
  placeholder?: string;
  source: ReferenceSource | null;
  required?: boolean;
  disabled?: boolean;
  invalid?: boolean;
  /** 라벨 옆에 붙는 요소(ⓘ 툴팁 등) */
  labelAddon?: ReactNode;
  /** 칸 아래 요소(추천 칩 등) */
  children?: ReactNode;
  'aria-describedby'?: string;
  onPick: (row: ReferenceRow) => void;
  onClear: () => void;
}

export const ReferenceField = ({
  renderPicker,
  placeholder,
  label,
  hideLabel = false,
  size = 'md',
  valueLabel,
  wrapValue = false,
  clearable = true,
  source,
  required = false,
  disabled = false,
  invalid = false,
  labelAddon,
  children,
  'aria-describedby': describedBy,
  onPick,
  onClear,
}: ReferenceFieldProps) => {
  const id = useId();
  const [open, setOpen] = useState(false);
  const locked = disabled || source === null;
  return (
    <div className="field-cell reference-field">
      <span className={hideLabel ? 'visually-hidden' : 'field-label reference-field-label'}>
        <label htmlFor={id}>{label}</label>
        {required && (
          <span className="required-mark" aria-hidden="true">
            {' '}
            *
          </span>
        )}
        {labelAddon}
      </span>
      {wrapValue ? (
        <div
          className="reference-field-full-value"
          data-disabled={locked || undefined}
          data-invalid={invalid || undefined}
          data-size={size}
        >
          <button
            type="button"
            id={id}
            aria-label={label}
            aria-haspopup="dialog"
            aria-required={required || undefined}
            aria-invalid={invalid || undefined}
            aria-describedby={describedBy}
            disabled={locked}
            onClick={() => setOpen(true)}
          >
            <Icon name="search" size={20} />
            <span className={valueLabel ? 'reference-field-value' : 'reference-field-placeholder'}>
              {valueLabel || placeholder || t.select(label)}
            </span>
          </button>
          {clearable && valueLabel !== '' && (
            <IconButton
              icon="close"
              size="sm"
              variant="standard"
              aria-label={t.clear(label)}
              disabled={locked}
              onClick={onClear}
            />
          )}
        </div>
      ) : (
        <SearchInput
          id={id}
          fullWidth
          size={size}
          value={valueLabel}
          readOnly
          title={valueLabel === '' ? undefined : valueLabel}
          placeholder={placeholder ?? t.open}
          aria-haspopup="dialog"
          aria-required={required || undefined}
          aria-invalid={invalid || undefined}
          aria-describedby={describedBy}
          clearLabel={t.clear(label)}
          disabled={locked}
          onClick={() => !locked && setOpen(true)}
          onSearch={() => !locked && setOpen(true)}
          onChange={() => undefined}
          onClear={clearable ? onClear : undefined}
        />
      )}
      {children}
      {open &&
        source !== null &&
        (renderPicker ?? ((props: PickerDialogProps) => <PickerDialog {...props} />))({
          wrapValue,
          source,
          onClose: () => setOpen(false),
          onPick: (row) => {
            onPick(row);
            setOpen(false);
          },
        })}
    </div>
  );
};
