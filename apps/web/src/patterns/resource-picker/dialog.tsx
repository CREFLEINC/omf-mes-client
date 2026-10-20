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

import {
  RESOURCE_PAGE_SIZE,
  useResourceSearch,
  type ResourceKind,
  type ResourceRow,
} from './queries';

const t = messages.resourcePicker;

export interface ResourcePickerDialogProps {
  kind: ResourceKind;
  plantId: number | null;
  /** 설비만 — 주면 그 라인의 설비만 보인다 */
  lineId?: number | null;
  onClose: () => void;
  onConfirm: (row: ResourceRow) => void;
}

/** 설비·금형을 검색해서 고르는 창 — 4M 담당 작업자 창과 같은 모양·조작이다. */
export const ResourcePickerDialog = ({
  kind,
  plantId,
  lineId = null,
  onClose,
  onConfirm,
}: ResourcePickerDialogProps) => {
  const keywordId = useId();
  const [keyword, setKeyword] = useState('');
  const [submitted, setSubmitted] = useState('');
  const [page, setPage] = useState(1);
  const [picked, setPicked] = useState<ResourceRow | null>(null);

  const search = useResourceSearch(kind, plantId, lineId, submitted, page);
  const rows = search.data?.items ?? [];
  const total = search.data?.total ?? 0;

  const submit = (): void => {
    setPage(1);
    setSubmitted(keyword.trim());
  };

  const columns: Column<ResourceRow>[] = [
    {
      key: 'select',
      header: t.columns.select,
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
    { key: 'code', header: t.columns.code, width: '35%', render: (row) => row.code },
    {
      key: 'name',
      header: t.columns.name,
      render: (row) => `${row.name}${row.isActive ? '' : ` · ${t.inactive}`}`,
    },
  ];

  const from = (page - 1) * RESOURCE_PAGE_SIZE + 1;
  const to = Math.min(page * RESOURCE_PAGE_SIZE, total);
  const hasNext = page * RESOURCE_PAGE_SIZE < total;

  return (
    <Dialog
      open
      size="lg"
      closeOnBackdropClick={false}
      showCloseButton={false}
      title={t.title[kind]}
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
            getRowId={(row) => String(row.id)}
            empty={
              plantId === null
                ? t.searchFailed
                : search.isPending
                  ? t.searching
                  : search.isError
                    ? ''
                    : t.noResult
            }
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
