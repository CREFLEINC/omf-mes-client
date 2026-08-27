import { AlertBanner, Button, PageHeader } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useState } from 'react';

import { popTouchClass } from '../../patterns/pop-touch';
import { LineTable } from './line-table';
import { useItemLookup, useSupplierLookup, useUomLookup } from './lookups';
import { PageNav } from './page-nav';
import { toPageView } from './pagination';
import { PrinterStatusIndicator } from './printer-status';
import { usePrinters, useReceiptLines, useReceipts } from './queries';
import { ReceiptTable } from './receipt-table';
import { TargetCard } from './target-card';
import { toHeadPrinter } from './types';

const t = messages.popMaterialLotLabel;

/**
 * `P-01-01` 자재LOT 등록·라벨 발행 (POP).
 *
 * 스펙 §3 배치를 따른다 — **좌: 입하 목록 / 우: 발번 대상.** 세로로 쌓지 않는다.
 * 1024×768에서 세로 여유가 119px뿐이라 구획을 쌓으면 아래가 잘린다.
 *
 * ⭐ **좌측 구획이 두 단계를 갈아 끼운다** — 입하 건 목록 ↔ 그 건의 품목 줄. 스펙은 품목·수량이
 * 목록에 바로 보이는 한 단계이나, 계약이 입하 건 목록에 품목을 싣지 않아 라인을 따로 부른다.
 * 두 표를 세로로 쌓으면 세로 예산을 넘기므로 **한 자리에서 단계를 바꾼다**(검토 요청
 * omf-mes#245 ③ 이 풀리면 한 단계로 줄어든다).
 *
 * 프린터·단말 상태와 등록·인쇄·재인쇄는 뒤따르는 슬라이스와 설계 회신을 기다린다.
 */
export const PopMaterialLotLabelScreen = () => {
  const [page, setPage] = useState(1);
  const [selectedReceiptId, setSelectedReceiptId] = useState<number | null>(null);
  const [selectedLineId, setSelectedLineId] = useState<number | null>(null);

  // 첫 쪽이면 조건을 싣지 않는다 — 서버 기본값이 1이라 URL에 없는 편이 조건을 정직하게 드러낸다.
  const receipts = useReceipts(page === 1 ? {} : { page });
  const lines = useReceiptLines(selectedReceiptId);
  const printers = usePrinters();

  const hasReceipt = selectedReceiptId !== null;
  const supplierLookup = useSupplierLookup();
  const itemLookup = useItemLookup(hasReceipt);
  const uomLookup = useUomLookup(hasReceipt);

  const result = receipts.data;
  const pageView = result === undefined ? null : toPageView(result.page, result.items.length);

  const selectedReceipt =
    result?.items.find((row) => row.inboundReceiptId === selectedReceiptId) ?? null;
  const selectedLine =
    lines.data?.find((row) => row.inboundReceiptLineId === selectedLineId) ?? null;

  /** 입하 건을 바꾸면 고른 품목이 남아 있으면 안 된다 — 다른 건의 품목을 가리키게 된다. */
  const selectReceipt = (inboundReceiptId: number) => {
    setSelectedLineId(null);
    setSelectedReceiptId((current) => (current === inboundReceiptId ? null : inboundReceiptId));
  };

  return (
    <div className="pop-screen">
      <header className="pop-screen-head">
        <PageHeader title={t.title} size="compact" />
        <PrinterStatusIndicator
          printer={toHeadPrinter(printers.data ?? [])}
          isLoading={printers.isPending}
          isError={printers.isError}
          onRetry={() => {
            void printers.refetch();
          }}
        />
      </header>

      <div className="pop-panes">
        <section
          className="pane pop-pane"
          aria-label={hasReceipt ? t.lines.paneLabel : t.receipts.paneLabel}
        >
          {receipts.isError ? (
            <AlertBanner
              variant="error"
              title={t.receipts.loadFailed}
              action={
                <Button
                  className={popTouchClass('normal')}
                  variant="outlined"
                  size="xl"
                  onClick={() => {
                    void receipts.refetch();
                  }}
                >
                  {t.receipts.retry}
                </Button>
              }
            />
          ) : hasReceipt ? (
            <>
              <Button
                className={`pop-pane-back ${popTouchClass('normal')}`}
                variant="text"
                size="xl"
                onClick={() => {
                  setSelectedLineId(null);
                  setSelectedReceiptId(null);
                }}
              >
                {t.receipts.backToReceipts}
              </Button>
              {lines.isError ? (
                <AlertBanner
                  variant="error"
                  title={t.lines.loadFailed}
                  action={
                    <Button
                      className={popTouchClass('normal')}
                      variant="outlined"
                      size="xl"
                      onClick={() => {
                        void lines.refetch();
                      }}
                    >
                      {t.lines.retry}
                    </Button>
                  }
                />
              ) : (
                <LineTable
                  rows={lines.data ?? []}
                  itemLookup={itemLookup}
                  uomLookup={uomLookup}
                  selectedId={selectedLineId}
                  onToggleSelect={(lineId) => {
                    setSelectedLineId((current) => (current === lineId ? null : lineId));
                  }}
                />
              )}
            </>
          ) : (
            <>
              {/*
               * ⛔ `.field-note`를 쓰지 않는다 — 그 클래스는 규범 4가 **비활성 사유**용으로
               * 정의한 것이라 `max-width: 20rem`에 갇힌다. 이 문구는 구획 전체에 걸리는
               * 안내라 가로 여유가 남는데도 두 줄로 접혔다(실기에서 드러났다).
               */}
              <AlertBanner variant="info">{t.receipts.filterNotice}</AlertBanner>
              <ReceiptTable
                rows={result?.items ?? []}
                supplierLookup={supplierLookup}
                selectedId={selectedReceiptId}
                onToggleSelect={selectReceipt}
                empty={pageView?.isBeyondLast === true ? t.receipts.beyondLast : t.receipts.empty}
              />
              {pageView === null ? null : <PageNav view={pageView} onChange={setPage} />}
            </>
          )}
        </section>

        <section className="pane pop-pane" aria-label={t.target.paneLabel}>
          <h2 className="pop-pane-title">{t.target.title}</h2>
          <TargetCard
            receipt={selectedReceipt}
            line={selectedLine}
            itemLookup={itemLookup}
            uomLookup={uomLookup}
            supplierLookup={supplierLookup}
          />
        </section>
      </div>
    </div>
  );
};
