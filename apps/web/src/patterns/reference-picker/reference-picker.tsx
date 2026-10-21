import {
  AlertBanner,
  Button,
  Dialog,
  EmptyState,
  SearchInput,
  Select,
  TextField,
  type Column,
} from '@crefle/web-ui';
import { messages, named } from '@omf-mes/i18n';
import { useQuery } from '@tanstack/react-query';
import { useId, useState, type ReactNode } from 'react';

import { PageNav } from '../page-nav';
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
  search: (term: string, page: number, filterValue: string) => Promise<ReferenceSearchPage>;
}

export const REFERENCE_PAGE_SIZE = 20;

export interface PickerDialogProps {
  source: ReferenceSource;
  onClose: () => void;
  onPick: (row: ReferenceRow) => void;
}

export const PickerDialog = ({ source, onClose, onPick }: PickerDialogProps) => {
  const keywordId = useId();
  const reasonId = useId();
  const [keyword, setKeyword] = useState('');
  const [term, setTerm] = useState('');
  const [page, setPage] = useState(1);
  const [filterValue, setFilterValue] = useState(source.filter?.value ?? '');
  const [picked, setPicked] = useState<ReferenceRow | null>(null);
  const result = useQuery({
    queryKey: [...source.key, 'reference-picker', term, page, filterValue],
    queryFn: () => source.search(term, page, filterValue),
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
        <span className="ellipsis-cell" title={row.name}>
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
          <div className="field-cell filter-field-md">
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
        {result.isError && <AlertBanner variant="warning">{t.failed}</AlertBanner>}
        <SelectableTable
          columns={columns}
          rows={rows}
          getRowId={(row) => String(row.id)}
          activeId={picked === null ? null : String(picked.id)}
          rowLabel={(row) => named(row.name, row.code)}
          onActivate={setPicked}
          empty={<EmptyState size="sm" title={result.isPending ? t.searching : t.empty(term)} />}
        />
        <PageNav
          meta={{ page, size: REFERENCE_PAGE_SIZE, total: result.data?.total ?? 0 }}
          onChangePage={setPage}
        />
      </div>
    </Dialog>
  );
};

export interface ReferenceFieldProps {
  label: string;
  /** 표 칸 안에서처럼 라벨을 화면에 보이지 않고 접근 이름으로만 둔다. */
  hideLabel?: boolean;
  /** 칸 높이. 표 행과 조밀한 편집 영역은 sm(C-19). */
  size?: 'sm' | 'md';
  /** 고른 값의 「이름 (코드)」. 비었으면 ''. */
  valueLabel: string;
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
  label,
  hideLabel = false,
  size = 'md',
  valueLabel,
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
      <SearchInput
        id={id}
        fullWidth
        size={size}
        value={valueLabel}
        readOnly
        title={valueLabel === '' ? undefined : valueLabel}
        placeholder={t.open}
        aria-haspopup="dialog"
        aria-required={required || undefined}
        aria-invalid={invalid || undefined}
        aria-describedby={describedBy}
        clearLabel={t.clear(label)}
        disabled={locked}
        onClick={() => !locked && setOpen(true)}
        onSearch={() => !locked && setOpen(true)}
        onChange={() => undefined}
        onClear={onClear}
      />
      {children}
      {open && source !== null && (
        <PickerDialog
          source={source}
          onClose={() => setOpen(false)}
          onPick={(row) => {
            onPick(row);
            setOpen(false);
          }}
        />
      )}
    </div>
  );
};
