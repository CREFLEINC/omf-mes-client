import {
  AlertBanner,
  Button,
  Checkbox,
  Dialog,
  Table,
  TextField,
  type Column,
} from '@crefle/web-ui';
import type { components } from '@omf-mes/api-client';
import { messages } from '@omf-mes/i18n';
import { useQuery } from '@tanstack/react-query';
import { useId, useState } from 'react';

import { useApiClient } from '../../patterns/api-context';
import { PageNav, type PageSize } from '../../patterns/page-nav';
import { runRequest } from '../../patterns/request';

type Process = components['schemas']['Process'];

const t = messages.defectCauseCode;

export interface ProcessPickerDialogProps {
  onClose: () => void;
  onConfirm: (process: Process) => void;
}

/**
 * 공정을 검색해서 고르는 창(사용자 지시 2026-10-29 · #209) — 공정이 많아도 찾게 한다.
 * 불량코드 검색 창과 같은 모양 · 조작이다. 공정 목록 조회(`GET /mdm/processes` 의 `q`)를 쓴다.
 */
export const ProcessPickerDialog = ({ onClose, onConfirm }: ProcessPickerDialogProps) => {
  const { client } = useApiClient();
  const keywordId = useId();
  const [keyword, setKeyword] = useState('');
  /** 실제로 조회에 나간 검색어. 「검색」을 눌러야 바뀐다. */
  const [submitted, setSubmitted] = useState('');
  const [page, setPage] = useState(1);
  const [size, setSize] = useState<PageSize>(20);
  const [picked, setPicked] = useState<Process | null>(null);

  const search = useQuery({
    queryKey: ['defect-cause-code', 'process-picker', submitted, page, size],
    queryFn: () =>
      runRequest(() =>
        client.GET('/mdm/processes', {
          params: { query: { ...(submitted === '' ? {} : { q: submitted }), page, size } },
        }),
      ),
  });
  const rows = search.data?.items ?? [];

  const submit = (): void => {
    setPage(1);
    setSubmitted(keyword.trim());
  };

  const columns: Column<Process>[] = [
    {
      key: 'select',
      header: t.picker.select,
      align: 'center',
      width: '64px',
      render: (row) => (
        <Checkbox
          aria-label={row.processCode}
          checked={picked?.processId === row.processId}
          onChange={() => {
            setPicked((prev) => (prev?.processId === row.processId ? null : row));
          }}
        />
      ),
    },
    {
      key: 'processCode',
      header: t.processPicker.code,
      width: '200px',
      render: (row) => row.processCode,
    },
    { key: 'processName', header: t.processPicker.name, render: (row) => row.processName },
  ];

  return (
    <Dialog
      open
      size="lg"
      closeOnBackdropClick={false}
      showCloseButton={false}
      title={t.processPicker.title}
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
              placeholder={t.processPicker.placeholder}
              onChange={(event) => {
                setKeyword(event.target.value);
              }}
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
            getRowId={(row) => String(row.processId)}
            empty={search.isPending ? t.picker.searching : search.isError ? '' : t.picker.noResult}
          />
        </div>

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
