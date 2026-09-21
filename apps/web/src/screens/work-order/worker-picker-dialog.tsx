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

import { useWorkOrderWorkers, type WorkOrderWorkerFact } from './people-tool-queries';

/** 창 한 쪽에 담는 건수 — 품목·공급사 선택 창과 같다. */
const PAGE_SIZE = 20;

const t = messages.workOrder.resourcePane.workerPicker;

export interface WorkerPickerDialogProps {
  /** 이 W/O 가 속한 공장. 서버가 이 공장의 작업자만 낸다. */
  plantId: number | null;
  onClose: () => void;
  onConfirm: (worker: WorkOrderWorkerFact) => void;
}

/**
 * 담당 작업자를 **검색해서 고르는 창** — 품목·공급사 선택 창과 같은 모양·조작이다
 * (사용자 지시 2026-09-20). 「찾기」나 엔터로만 조회하고, 검색어가 비면 그 공장의 전체를 쪽으로 보인다.
 *
 * 선택칸 하나로는 작업자가 한 쪽에 다 오지 않아 그 너머를 고를 수 없었다.
 */
export const WorkerPickerDialog = ({ plantId, onClose, onConfirm }: WorkerPickerDialogProps) => {
  const keywordId = useId();
  const [keyword, setKeyword] = useState('');
  /** 실제로 조회에 나간 검색어. 「찾기」를 눌러야 바뀐다. */
  const [submitted, setSubmitted] = useState('');
  const [page, setPage] = useState(1);
  const [picked, setPicked] = useState<WorkOrderWorkerFact | null>(null);

  const search = useWorkOrderWorkers(plantId, page, submitted, PAGE_SIZE);
  const rows = search.data?.items ?? [];
  const total = search.data?.page.total ?? 0;

  const submit = (): void => {
    setPage(1);
    setSubmitted(keyword.trim());
  };

  const columns: Column<WorkOrderWorkerFact>[] = [
    {
      key: 'select',
      header: t.columns.select,
      align: 'center',
      width: '64px',
      render: (row) => (
        <Checkbox
          aria-label={row.workerNo}
          checked={picked?.workerId === row.workerId}
          onChange={() => {
            setPicked((prev) => (prev?.workerId === row.workerId ? null : row));
          }}
        />
      ),
    },
    {
      key: 'workerNo',
      header: t.columns.workerNo,
      align: 'center',
      width: '40%',
      render: (row) => row.workerNo,
    },
    {
      key: 'workerName',
      header: t.columns.workerName,
      width: '40%',
      render: (row) => `${row.workerName}${row.isActive ? '' : ` · ${t.inactive}`}`,
    },
  ];

  const from = (page - 1) * PAGE_SIZE + 1;
  const to = Math.min(page * PAGE_SIZE, total);
  const hasNext = page * PAGE_SIZE < total;

  return (
    <Dialog
      open
      size="lg"
      closeOnBackdropClick={false}
      /* 아래 「취소」가 같은 일을 한다 — 우상단 × 는 두지 않는다(사용자 지시 2026-09-20). */
      showCloseButton={false}
      title={t.title}
      onClose={onClose}
      footer={
        <>
          <Button variant="outlined" onClick={onClose}>
            {t.cancel}
          </Button>
          <Button
            variant="filled"
            disabled={picked === null}
            onClick={() => {
              if (picked !== null) onConfirm(picked);
            }}
          >
            {t.pick}
          </Button>
        </>
      }
    >
      <div className="item-picker-body">
        <div className="item-picker-controls work-order-worker-picker-controls">
          <div className="field-cell">
            <label className="field-label" htmlFor={keywordId}>
              {t.keywordLabel}
            </label>
            <TextField
              id={keywordId}
              fullWidth
              value={keyword}
              placeholder={t.keywordPlaceholder}
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
            {t.search}
          </Button>
        </div>

        {search.isError && (
          <div className="banner-slot">
            <AlertBanner variant="warning">{t.searchFailed}</AlertBanner>
          </div>
        )}

        <div className="item-picker-results">
          <Table
            columns={columns}
            rows={rows}
            getRowId={(row) => String(row.workerId)}
            empty={search.isPending ? t.searching : search.isError ? '' : t.noResult}
          />
        </div>

        <div className="item-picker-pager">
          {total > 0 && <span className="field-note">{t.page.range(from, to, total)}</span>}
          <Button
            variant="outlined"
            disabled={page <= 1}
            onClick={() => {
              setPage((prev) => Math.max(1, prev - 1));
            }}
          >
            {t.page.previous}
          </Button>
          <Button
            variant="outlined"
            disabled={!hasNext}
            onClick={() => {
              setPage((prev) => prev + 1);
            }}
          >
            {t.page.next}
          </Button>
        </div>
      </div>
    </Dialog>
  );
};
