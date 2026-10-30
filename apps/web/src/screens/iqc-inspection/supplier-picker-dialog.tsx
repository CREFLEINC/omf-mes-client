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
import { type TabPageSize, TAB_PAGE_SIZES } from '../../patterns/client-page';
import { PageNav } from '../../patterns/page-nav';
import { runRequest } from '../../patterns/request';

type Partner = components['schemas']['Partner'];

const t = messages.iqcInspection.filters.supplierPicker;
const itemPicker = messages.itemPicker;

/** 처음 한 쪽에 보이는 공급사 수 — 품목 검색 창과 같다. */
const SUPPLIER_PAGE_SIZE: TabPageSize = 20;

export interface SupplierPickerDialogProps {
  onClose: () => void;
  onConfirm: (partner: Partner) => void;
}

/**
 * 공급사 검색 창(#133) — 품목 검색 창(`patterns/item-picker` 의 compact 창)과 같은 모양·동작이다.
 * 검색어 · [검색] → 표에서 한 곳을 골라 [선택]. 닫는 길은 꼬리말의 [취소] 하나다.
 *
 * 찾는 범위는 종전 선택칸과 같다 — 거래처 전체를 사용 중지까지(`includeInactive`). 지난 의뢰를 찾는 조건이다.
 */
export const SupplierPickerDialog = ({ onClose, onConfirm }: SupplierPickerDialogProps) => {
  const keywordId = useId();
  const { client } = useApiClient();
  const [keyword, setKeyword] = useState('');
  const [submitted, setSubmitted] = useState('');
  const [page, setPage] = useState(1);
  const [size, setSize] = useState<TabPageSize>(SUPPLIER_PAGE_SIZE);
  const [picked, setPicked] = useState<Partner | null>(null);

  const search = useQuery({
    queryKey: ['iqc-inspection', 'supplier-picker', submitted, page, size] as const,
    queryFn: () =>
      runRequest(() =>
        client.GET('/mdm/partners', {
          params: {
            query: {
              ...(submitted === '' ? {} : { q: submitted }),
              includeInactive: true,
              page,
              size,
            },
          },
        }),
      ),
  });
  const rows = search.data?.items ?? [];
  const total = search.data?.page.total ?? 0;

  const submit = (): void => {
    setPage(1);
    setSubmitted(keyword.trim());
  };

  /* 한 곳만 고른다 — 다시 누르면 고름을 푼다. */
  const toggle = (row: Partner): void => {
    setPicked((prev) => (prev?.partnerId === row.partnerId ? null : row));
  };

  const columns: Column<Partner>[] = [
    {
      key: 'select',
      header: itemPicker.columns.select,
      align: 'center',
      width: '64px',
      render: (row) => (
        <Checkbox
          aria-label={row.partnerCode}
          checked={picked?.partnerId === row.partnerId}
          onChange={() => {
            toggle(row);
          }}
        />
      ),
    },
    {
      key: 'partnerCode',
      header: t.columns.code,
      /* 코드는 가운데(#133 · 담당자 지시). */
      align: 'center',
      width: '160px',
      render: (row) => row.partnerCode,
    },
    {
      key: 'partnerName',
      header: t.columns.name,
      render: (row) => (
        <span>
          {row.partnerName}
          {row.isActive ? '' : ` · ${itemPicker.inactive}`}
        </span>
      ),
    },
  ];

  return (
    <Dialog
      open
      size="lg"
      closeOnBackdropClick={false}
      showCloseButton={false}
      title={t.title}
      onClose={onClose}
      footer={
        <>
          <Button variant="outlined" onClick={onClose}>
            {itemPicker.cancel}
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
        <div className="item-picker-controls supplier-picker-controls">
          <div className="field-cell">
            <label className="field-label" htmlFor={keywordId}>
              {itemPicker.keywordLabel}
            </label>
            <TextField
              id={keywordId}
              fullWidth
              value={keyword}
              placeholder={t.keywordPlaceholder}
              onChange={(event) => {
                setKeyword(event.target.value);
              }}
              /* 검색칸의 엔터는 검색만 한다 — 바깥 조회 조건 줄을 제출하지 않는다. */
              onKeyDown={(event) => {
                if (event.key !== 'Enter') return;

                event.preventDefault();
                event.stopPropagation();
                submit();
              }}
            />
          </div>

          <Button variant="outlined" onClick={submit}>
            {itemPicker.search}
          </Button>
        </div>

        {search.isError && (
          <div className="banner-slot">
            <AlertBanner variant="warning">{t.searchFailed}</AlertBanner>
          </div>
        )}

        {/* 줄 아무 곳이나 눌러도 그 공급사를 고른다 — 품목 검색 창과 같다. */}
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
            getRowId={(row) => String(row.partnerId)}
            empty={search.isPending ? itemPicker.searching : search.isError ? '' : t.noResult}
          />
        </div>

        {/* 목록 표 아래와 같은 쪽 이동 줄 — 총 건수 · 10 · 20 · 50건 · [처음] [이전] n/N [다음] [마지막](사용자 지시 2026-10-28 · #197). */}
        <PageNav
          meta={{ page, size, total }}
          sizes={TAB_PAGE_SIZES}
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
