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

import { inspectionTypeLabel } from './code-options';
import { toPageView } from './pagination';
import { useInspectionPlanList } from './queries';
import type { InspectionPlan } from './types';

const t = messages.inspectionStandard;

export interface PlanPickerDialogProps {
  /** 목록 조건의 미사용 포함 — 창도 같은 범위에서 찾는다(목록에 없는 기준을 고르지 않게). */
  includeInactive: boolean;
  onClose: () => void;
  onConfirm: (plan: InspectionPlan) => void;
}

/**
 * 검사 기준을 검색해서 고르는 창 — 검사 조회·판정의 품목 선택 창(`ItemPickerDialog` compact)과 같은 모양·조작이다
 * (omf-all-around#196). 목록과 같은 조회(`GET /quality/inspection-plans` 의 `q`)를 쓴다.
 */
export const PlanPickerDialog = ({
  includeInactive,
  onClose,
  onConfirm,
}: PlanPickerDialogProps) => {
  const keywordId = useId();
  const [keyword, setKeyword] = useState('');
  /** 실제로 조회에 나간 검색어. 「찾기」를 눌러야 바뀐다. */
  const [submitted, setSubmitted] = useState('');
  const [page, setPage] = useState(1);
  const [picked, setPicked] = useState<InspectionPlan | null>(null);

  const search = useInspectionPlanList(
    { q: submitted, inspectionTypeCode: '', includeInactive },
    page,
  );
  const rows = search.data?.items ?? [];
  const view = search.data === undefined ? null : toPageView(search.data.page, rows.length);

  const submit = (): void => {
    setPage(1);
    setSubmitted(keyword.trim());
  };

  const columns: Column<InspectionPlan>[] = [
    {
      key: 'select',
      header: t.picker.columns.select,
      align: 'center',
      width: '64px',
      render: (row) => (
        <Checkbox
          aria-label={row.inspectionPlanCode}
          checked={picked?.inspectionPlanId === row.inspectionPlanId}
          onChange={() => {
            setPicked((prev) => (prev?.inspectionPlanId === row.inspectionPlanId ? null : row));
          }}
        />
      ),
    },
    {
      key: 'inspectionPlanCode',
      header: t.picker.columns.code,
      width: '240px',
      render: (row) => row.inspectionPlanCode,
    },
    { key: 'inspectionPlanName', header: t.picker.columns.name },
    {
      key: 'inspectionTypeCode',
      header: t.picker.columns.type,
      align: 'center',
      width: '136px',
      render: (row) => inspectionTypeLabel(row.inspectionTypeCode),
    },
  ];

  return (
    <Dialog
      open
      size="lg"
      closeOnBackdropClick={false}
      /* 닫는 길은 꼬리말의 「취소」 하나다 — 품목 선택 창(compact)과 같다. */
      showCloseButton={false}
      title={t.picker.title}
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
          <div className="field-cell">
            <label className="field-label" htmlFor={keywordId}>
              {t.picker.keywordLabel}
            </label>
            <TextField
              id={keywordId}
              fullWidth
              value={keyword}
              placeholder={t.picker.keywordPlaceholder}
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

        {/* 줄 아무 곳이나 눌러도 그 기준을 고른다 — 눌린 줄의 선택 칸으로 넘긴다(품목 선택 창과 같다). */}
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
            getRowId={(row) => String(row.inspectionPlanId)}
            empty={search.isPending ? t.picker.searching : search.isError ? '' : t.picker.noResult}
          />
        </div>

        {/* 쪽 이동 줄은 늘 선다 — 검색할 때마다 표의 아래 경계가 움직이지 않게. */}
        <div className="item-picker-pager">
          {view !== null && rows.length > 0 && (
            <span className="field-note">{view.rangeLabel}</span>
          )}
          <Button
            variant="outlined"
            disabled={view === null || !view.canPrev}
            onClick={() => {
              setPage((prev) => Math.max(1, prev - 1));
            }}
          >
            {t.actions.prevPage}
          </Button>
          <Button
            variant="outlined"
            disabled={view === null || !view.canNext}
            onClick={() => {
              setPage((prev) => prev + 1);
            }}
          >
            {t.actions.nextPage}
          </Button>
        </div>
      </div>
    </Dialog>
  );
};
