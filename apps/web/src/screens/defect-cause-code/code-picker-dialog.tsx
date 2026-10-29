import {
  AlertBanner,
  Button,
  Checkbox,
  Dialog,
  Table,
  TextField,
  type Column,
} from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useId, useState } from 'react';

import { PageNav, type PageSize } from '../../patterns/page-nav';
import type { CodeAdapter } from './adapters';
import { isCategory } from './hierarchy';
import { useCodeList } from './queries';
import type { HierarchyCode } from './types';

const t = messages.defectCauseCode;

export interface CodePickerDialogProps {
  adapter: CodeAdapter;
  /** 목록 조건의 미사용 포함 — 창도 같은 범위에서 찾는다(목록에 없는 코드를 고르지 않게). */
  includeInactive: boolean;
  onClose: () => void;
  onConfirm: (code: HierarchyCode) => void;
}

/**
 * 코드를 검색해서 고르는 창(사용자 지시 2026-10-29 · #209) — 코드가 많아도 찾게 한다.
 * 검사 조회·판정의 품목 검색 창 · 검사 기준 검색 창과 같은 모양 · 조작이다. 목록과 같은 조회(`q`)를 쓴다.
 */
export const CodePickerDialog = ({
  adapter,
  includeInactive,
  onClose,
  onConfirm,
}: CodePickerDialogProps) => {
  const keywordId = useId();
  const [keyword, setKeyword] = useState('');
  /** 실제로 조회에 나간 검색어. 「찾기」를 눌러야 바뀐다. */
  const [submitted, setSubmitted] = useState('');
  const [page, setPage] = useState(1);
  const [size, setSize] = useState<PageSize>(20);
  const [picked, setPicked] = useState<HierarchyCode | null>(null);

  const search = useCodeList(adapter, {
    q: submitted,
    includeInactive,
    inactiveOnly: false,
    page,
    size,
  });
  const rows = search.data?.items ?? [];

  const submit = (): void => {
    setPage(1);
    setSubmitted(keyword.trim());
  };

  const columns: Column<HierarchyCode>[] = [
    {
      key: 'select',
      header: t.picker.select,
      align: 'center',
      width: '64px',
      render: (row) => (
        <Checkbox
          aria-label={row.code}
          checked={picked?.id === row.id}
          onChange={() => {
            setPicked((prev) => (prev?.id === row.id ? null : row));
          }}
        />
      ),
    },
    { key: 'code', header: adapter.labels.listCode, width: '200px', render: (row) => row.code },
    { key: 'name', header: adapter.labels.listName, render: (row) => row.name },
    {
      key: 'kind',
      header: t.listColumns.kind,
      align: 'center',
      width: '96px',
      render: (row) => (isCategory(row) ? t.detail.kindCategory : t.detail.kindChild),
    },
  ];

  return (
    <Dialog
      open
      size="lg"
      closeOnBackdropClick={false}
      /* 닫는 길은 꼬리말의 「취소」 하나다 — 품목 검색 창과 같다. */
      showCloseButton={false}
      title={t.picker.title(adapter.labels.tab)}
      onClose={onClose}
      footer={
        <>
          <Button variant="outlined" onClick={onClose}>
            {t.picker.cancel}
          </Button>
          <Button
            variant="filled"
            disabled={picked === null}
            onClick={() => {
              if (picked !== null) onConfirm(picked);
            }}
          >
            {t.picker.pick}
          </Button>
        </>
      }
    >
      <div className="item-picker-body">
        <div className="item-picker-controls">
          <div className="field-cell inspection-standard-picker-keyword">
            <label className="field-label" htmlFor={keywordId}>
              {t.picker.keywordLabel}
            </label>
            <TextField
              id={keywordId}
              fullWidth
              value={keyword}
              placeholder={adapter.labels.searchPlaceholder}
              onChange={(event) => {
                setKeyword(event.target.value);
              }}
              /* 검색칸의 엔터가 창을 통째로 확인하는 것을 막고 검색만 한다. */
              onKeyDown={(event) => {
                if (event.key !== 'Enter') return;
                event.preventDefault();
                submit();
              }}
            />
          </div>
          <Button variant="outlined" onClick={submit}>
            {t.picker.search}
          </Button>
        </div>

        {search.isError && (
          <div className="banner-slot">
            <AlertBanner variant="warning">{t.picker.searchFailed}</AlertBanner>
          </div>
        )}

        {/* 줄 아무 곳이나 눌러도 그 코드를 고른다 — 눌린 줄의 선택 칸으로 넘긴다(품목 검색 창과 같다). */}
        <div
          className="item-picker-results"
          onClick={(event) => {
            const target = event.target as Element;
            if (target.closest('input, button, a, label') !== null) return;
            target
              .closest('tbody tr')
              ?.querySelector<HTMLInputElement>('input[type="checkbox"]')
              ?.click();
          }}
        >
          <Table
            columns={columns}
            rows={rows}
            getRowId={(row) => String(row.id)}
            empty={search.isPending ? t.picker.searching : search.isError ? '' : t.picker.noResult}
          />
        </div>

        {/* 쪽 이동 — 목록 표와 같은 공용 줄(총 건수 · 쪽 크기 · 처음/이전/다음/마지막). */}
        <PageNav
          meta={search.data?.page ?? { page, size, total: 0 }}
          buttonSize="md"
          onChangePage={setPage}
          onChangeSize={(next) => {
            setSize(next);
            setPage(1);
          }}
        />
      </div>
    </Dialog>
  );
};
