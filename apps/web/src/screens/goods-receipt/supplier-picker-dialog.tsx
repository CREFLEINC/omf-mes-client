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

import { SUPPLIER_SEARCH_PAGE_SIZE, useSupplierSearch, type SupplierSearchRow } from './lookups';

const t = messages.goodsReceipt.supplierPicker;

export interface SupplierPickerDialogProps {
  onClose: () => void;
  onConfirm: (supplier: SupplierSearchRow) => void;
}

/**
 * 공급사를 **검색해서 고르는 창** — 조건 줄 공급사 칸이 연다.
 *
 * W-03-01 품목 칸이 여는 공용 「품목 선택」 창(`patterns/item-picker`)과 **모양·조작을 맞췄다**
 * (사용자 지시 2026-09-19): 「찾기」로만 조회하고 검색칸의 엔터는 검색만 한다, 검색어가 비면
 * 전체를 쪽으로 보인다, 한 번에 하나를 고른다. 같은 배치 클래스(`item-picker-*`)를 쓴다.
 * 품목 창을 넓히지 않고 따로 세운 것은 그쪽이 유형·가용 재고까지 품목에 묶여 있어서다.
 */
export const SupplierPickerDialog = ({ onClose, onConfirm }: SupplierPickerDialogProps) => {
  const keywordId = useId();
  const [keyword, setKeyword] = useState('');
  /** 실제로 조회에 나간 검색어. 「찾기」를 눌러야 바뀐다. */
  const [submitted, setSubmitted] = useState('');
  const [page, setPage] = useState(1);
  const [picked, setPicked] = useState<SupplierSearchRow | null>(null);

  const search = useSupplierSearch(submitted, page);
  const rows = search.data?.rows ?? [];
  const total = search.data?.total ?? 0;

  const submit = (): void => {
    setPage(1);
    setSubmitted(keyword.trim());
  };

  const columns: Column<SupplierSearchRow>[] = [
    {
      key: 'select',
      header: t.columns.select,
      align: 'center',
      width: '64px',
      render: (row) => (
        <Checkbox
          aria-label={row.partnerCode}
          checked={picked?.partnerId === row.partnerId}
          onChange={() => {
            setPicked((prev) => (prev?.partnerId === row.partnerId ? null : row));
          }}
        />
      ),
    },
    {
      key: 'partnerCode',
      header: t.columns.code,
      width: '160px',
      render: (row) => row.partnerCode,
    },
    {
      key: 'partnerName',
      header: t.columns.name,
      render: (row) => `${row.partnerName}${row.isActive ? '' : ` · ${t.inactive}`}`,
    },
  ];

  const from = (page - 1) * SUPPLIER_SEARCH_PAGE_SIZE + 1;
  const to = Math.min(page * SUPPLIER_SEARCH_PAGE_SIZE, total);
  const hasNext = page * SUPPLIER_SEARCH_PAGE_SIZE < total;

  return (
    <Dialog
      open
      size="lg"
      closeOnBackdropClick={false}
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
        <div className="item-picker-controls goods-receipt-supplier-picker-controls">
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
            getRowId={(row) => String(row.partnerId)}
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
