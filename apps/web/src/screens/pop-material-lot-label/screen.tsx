import { Button } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useState } from 'react';

import { popTouchClass } from '../../patterns/pop-touch';
import { useSupplierLookup } from './lookups';
import { PageNav } from './page-nav';
import { toPageView } from './pagination';
import { useReceipts } from './queries';
import { ReceiptTable } from './receipt-table';

const t = messages.popMaterialLotLabel;

/**
 * `P-01-01` 자재LOT 등록·라벨 발행 (POP).
 *
 * **이 슬라이스는 왼쪽 절반까지다.** 발번 대상·프린터 상태·등록·인쇄·재인쇄는 뒤따르는
 * 슬라이스가 채운다. 등록·인쇄와 단말 게이팅은 설계 회신을 기다리고 있다 —
 * LOT 채번 주체와 `can_print_label`을 읽을 경로가 계약에 없다(검토 요청 omf-mes#245 ①②).
 *
 * 세로로 쌓지 않고 좌우로 편다 — 1024×768에서 세로 여유가 119px뿐이라 구획을 쌓으면
 * 아래가 잘린다.
 */
export const PopMaterialLotLabelScreen = () => {
  const [page, setPage] = useState(1);
  const [selectedReceiptId, setSelectedReceiptId] = useState<number | null>(null);

  // 첫 쪽이면 조건을 싣지 않는다 — 서버 기본값이 1이라 URL에 없는 편이 조건을 정직하게 드러낸다.
  const receipts = useReceipts(page === 1 ? {} : { page });
  const supplierLookup = useSupplierLookup();

  const result = receipts.data;
  const pageView = result === undefined ? null : toPageView(result.page, result.items.length);

  return (
    <div className="pop-screen">
      <header className="pop-screen-head">
        <h1>{t.title}</h1>
      </header>

      <div className="pop-panes">
        <section className="pane pop-pane" aria-label={t.receipts.paneLabel}>
          {receipts.isError ? (
            <div className="banner-slot">
              <p className="field-error">{t.receipts.loadFailed}</p>
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
            </div>
          ) : (
            <>
              <p className="field-note">{t.receipts.filterNotice}</p>
              <ReceiptTable
                rows={result?.items ?? []}
                supplierLookup={supplierLookup}
                selectedId={selectedReceiptId}
                onSelect={setSelectedReceiptId}
                empty={pageView?.isBeyondLast === true ? t.receipts.beyondLast : t.receipts.empty}
              />
              {pageView === null ? null : <PageNav view={pageView} onChange={setPage} />}
            </>
          )}
        </section>
      </div>
    </div>
  );
};
