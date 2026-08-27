import { AlertBanner, Button, PageHeader } from '@crefle/web-ui';
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
 * 아래가 잘린다. 제목은 DS `PageHeader`가 그린다(`size="compact"`) — 맨 `<h1>`을 두면
 * 브라우저 기본 크기가 나와 **이 화면만 다른 화면과 제목 크기가 어긋난다**(실기에서 드러났다).
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
        <PageHeader title={t.title} size="compact" />
      </header>

      <div className="pop-panes">
        <section className="pane pop-pane" aria-label={t.receipts.paneLabel}>
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
                onToggleSelect={(inboundReceiptId) => {
                  // 같은 건을 다시 누르면 해제한다 — 고른 것을 무를 수단이 없으면 갇힌다.
                  setSelectedReceiptId((current) =>
                    current === inboundReceiptId ? null : inboundReceiptId,
                  );
                }}
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
