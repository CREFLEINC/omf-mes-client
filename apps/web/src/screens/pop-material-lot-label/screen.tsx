import { AlertBanner, Button, PageHeader } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useState } from 'react';

import { popTouchClass } from '../../patterns/pop-touch';
import { useItemLookup, useSupplierLookup, useUomLookup } from './lookups';
import { PageNav } from './page-nav';
import { toPageView } from './pagination';
import { PrinterStatusIndicator } from './printer-status';
import { usePrinters, useReceipts, useTargetRows } from './queries';
import { ReceiptTable } from './receipt-table';
import { TargetCard } from './target-card';
import { toHeadPrinter } from './types';

const t = messages.popMaterialLotLabel;

/**
 * 빈 목록의 안내를 고른다 — **왜 비었는지가 셋으로 갈린다.**
 *
 * 사전부착 자재를 걸러 내므로 **입하 건은 있는데 보일 자재가 없는** 상태가 정상적으로 생긴다.
 * 그때 「발행할 자재가 없습니다」만 내면 「전체 N건」과 나란히 서서 서로 어긋나 보인다.
 */
const emptyMessage = (isBeyondLast: boolean, receiptCount: number): string => {
  if (isBeyondLast) return t.receipts.beyondLast;

  return receiptCount > 0 ? t.receipts.emptyOnThisPage : t.receipts.empty;
};

/**
 * `P-01-01` 자재LOT 등록·라벨 발행 (POP).
 *
 * 스펙 §3 배치를 따른다 — **좌: 입하 목록(미부착) / 우: 발번 대상.** 세로로 쌓지 않는다.
 * 1024×768에서 세로 여유가 119px뿐이라 구획을 쌓으면 아래가 잘린다.
 *
 * 목록은 스펙대로 **한 단계**다 — 입하번호·품목·수량·공급사·입하일이 한 줄에 함께 온다.
 * 계약이 그것을 두 경로로 나눠 주므로 화면이 합친다(`useTargetRows`).
 */
export const PopMaterialLotLabelScreen = () => {
  const [page, setPage] = useState(1);
  const [selectedLineId, setSelectedLineId] = useState<number | null>(null);

  // 첫 쪽이면 조건을 싣지 않는다 — 서버 기본값이 1이라 URL에 없는 편이 조건을 정직하게 드러낸다.
  const receipts = useReceipts(page === 1 ? {} : { page });
  const targets = useTargetRows(receipts.data?.items ?? []);
  const printers = usePrinters();

  const supplierLookup = useSupplierLookup();
  const itemLookup = useItemLookup(true);
  const uomLookup = useUomLookup(true);

  const result = receipts.data;
  /*
   * ⚠ **세는 단위가 둘이다.** 쪽 나눔은 입하 건 단위이고 목록 줄은 자재다. 쪽 계산에는
   * 입하 건 수를 넘긴다 — 자재 줄 수를 넘기면 「51–52 / 전체 3건」 같은 값이 나온다.
   */
  const pageView = result === undefined ? null : toPageView(result.page, result.items.length);
  const selectedRow =
    targets.rows.find((row) => row.inboundReceiptLineId === selectedLineId) ?? null;

  /** 한 건이라도 실패하면 목록이 불완전하다 — 일부만 보이는 것을 「전부」로 내지 않는다. */
  const isListError = receipts.isError || targets.isError;

  return (
    <div className="pop-screen">
      <header className="pop-screen-head">
        <PageHeader title={t.title} size="compact" />
        <PrinterStatusIndicator
          printer={toHeadPrinter(printers.data ?? [])}
          hasChoice={(printers.data ?? []).length > 1}
          isLoading={printers.isPending}
          isError={printers.isError}
          onRetry={() => {
            void printers.refetch();
          }}
        />
      </header>

      <div className="pop-panes">
        <section className="pane pop-pane" aria-label={t.receipts.paneLabel}>
          {isListError ? (
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
                    targets.refetch();
                  }}
                >
                  {t.receipts.retry}
                </Button>
              }
            />
          ) : (
            <>
              {/*
               * ⛔ `.field-note`를 쓰지 않는다 — 그 클래스는 규범 4가 **비활성 사유**용으로
               * 정의한 것이라 `max-width: 20rem`에 갇힌다. 구획 전체에 걸리는 안내다.
               */}
              <AlertBanner variant="info">{t.receipts.filterNotice}</AlertBanner>
              <ReceiptTable
                rows={targets.rows}
                supplierLookup={supplierLookup}
                itemLookup={itemLookup}
                uomLookup={uomLookup}
                selectedId={selectedLineId}
                onToggleSelect={(lineId) => {
                  // 같은 줄을 다시 누르면 해제한다 — 고른 것을 무를 수단이 없으면 갇힌다.
                  setSelectedLineId((current) => (current === lineId ? null : lineId));
                }}
                empty={emptyMessage(pageView?.isBeyondLast === true, result?.items.length ?? 0)}
              />
              {pageView === null ? null : (
                <PageNav
                  view={pageView}
                  onChange={(nextPage) => {
                    // 쪽을 옮기면 고른 줄이 화면에서 사라진다 — 남겨 두면 보이지 않는 것을 가리킨다.
                    setSelectedLineId(null);
                    setPage(nextPage);
                  }}
                />
              )}
            </>
          )}
        </section>

        <section className="pane pop-pane" aria-label={t.target.paneLabel}>
          <h2 className="pop-pane-title">{t.target.title}</h2>
          <TargetCard
            row={selectedRow}
            itemLookup={itemLookup}
            uomLookup={uomLookup}
            supplierLookup={supplierLookup}
          />
        </section>
      </div>
    </div>
  );
};
