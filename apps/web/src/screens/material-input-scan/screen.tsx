import { AlertBanner } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useId } from 'react';
import { useSearchParams } from 'react-router';

import { LoadErrorBanner } from './load-error-banner';
import { useReceiptLines } from './queries';
import { ReceiptTable } from './receipt-table';
import { readWorkOrderId } from './screen-params';

const t = messages.materialInputScan;

/**
 * P-02-03 컨테이너 — **POP(현장 단말) 화면이라 관리웹 셸을 쓰지 않는다.**
 *
 * 사이드바·상단 바는 마우스로 메뉴를 오가는 사람을 위한 것이고, 이 화면 앞에 선 사람은
 * 장갑을 낀 채 스캐너를 든다. 그래서 `AppLayout` 밖에 서서 자기 `<main>`을 직접 렌더한다 —
 * `W-CO-01`(로그인)이 셸 밖에 선 것과 같은 형태이고, 근거는 다르다: 그쪽은 **메뉴가
 * 성립하지 않는 것**이고 이쪽은 **메뉴를 쓸 손이 없는 것**이다.
 *
 * **이 슬라이스는 「계획 대비 수령」 한 구획이다.** 스캔 입력·투입 목록·투입 확정은 뒤
 * 슬라이스에서 붙는다 — 자리만 비워 두지 않고 아직 없는 것은 그리지 않는다.
 *
 * ⛔ **단말 게이팅을 화면이 미리 판정하지 않는다.** 스펙 §5-1은 자재 투입 플래그로 「투입
 * 확정」을 잠그라고 하는데 계약의 단말 기능 구성에 그 플래그가 없다(검토 요청 omf-mes#246).
 * 대신 쓰기가 붙는 슬라이스에서 서버가 내려주는 거절을 안내로 그린다 — **없는 값을 다른
 * 플래그로 대신 읽지 않는다.**
 */
export const MaterialInputScanScreen = () => {
  const [searchParams] = useSearchParams();
  const workOrderId = readWorkOrderId(searchParams);

  const titleId = useId();

  const receipt = useReceiptLines(workOrderId);

  return (
    /*
     * **표제가 본문의 이름이 된다.** 셸이 있는 화면은 `AppShell`이 본문 이름을 주지만
     * 이 화면에는 줄 사람이 없다 — 이름 없는 랜드마크로 남으면 무엇인지 알 수 없다.
     */
    <main className="pop-shell" aria-labelledby={titleId}>
      <header className="pop-header">
        <h1 id={titleId} className="pop-title">
          {t.title}
        </h1>
        {workOrderId !== null && <p className="pop-context">{t.header.workOrder(workOrderId)}</p>}
      </header>

      {/*
       * 작업지시가 없으면 **조회가 나가지 않는다.** 그 사실을 배너로 먼저 말한다 — 표의 빈
       * 상태만으로는 「받은 자재가 없다」와 「무엇을 볼지 정해지지 않았다」가 같은 모양이 된다.
       */}
      {workOrderId === null && (
        <div className="banner-slot">
          <AlertBanner variant="warning" title={t.title}>
            {t.header.workOrderMissing}
          </AlertBanner>
        </div>
      )}

      {receipt.isError && <LoadErrorBanner error={receipt.error} onRetry={receipt.refetch} />}

      <section className="pane" aria-label={t.panes.receipt}>
        {!receipt.isError && (
          <ReceiptTable
            lines={receipt.lines}
            isLoading={receipt.isPending && workOrderId !== null}
            hasWorkOrder={workOrderId !== null}
          />
        )}
      </section>
    </main>
  );
};
