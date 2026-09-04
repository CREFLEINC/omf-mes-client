import { AlertBanner, Button, type Column, Table } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';

import type { HandoverFailure, HandoverTarget } from './handover';
import type { WorkOrder } from './types';

export interface HandoverPaneProps {
  /** 배포되지 않은 긴급 W/O. 못 받았으면 `undefined` — 빈 배열과 다른 사실이다. */
  workOrders: WorkOrder[] | undefined;
  /** 필터 전체 건수. 목록이 잘렸는지는 이 값으로만 알 수 있다. */
  total: number | undefined;
  isError: boolean;
  /** 지금 배포가 나가 있는 W/O. 그 줄의 버튼만 잠근다. */
  releasingId: number | null;
  releasedNo: string | null;
  failure: HandoverFailure | null;
  uomLabel: (uomId: number | undefined) => string;
  onRelease: (target: HandoverTarget) => void;
}

/**
 * 「배포되지 않은 긴급 W/O 이어받기」 구획.
 *
 * ⚠ **빈 목록이 정상이라 그때는 서지 않는다.** 밀린 것이 없다는 뜻이므로 「없습니다」를
 * 세우지 않는다 — 늘 서 있으면 밀린 상태처럼 읽혀, 정작 진짜 밀렸을 때 눈에 띄지 않는다.
 *
 * ⛔ **받지 못한 것은 다르다 — 그때는 선다.** 감추면 「밀린 것이 없다」와 구별되지 않아,
 * 배포 안 된 지시가 남아 있는데 화면이 조용해진다. 모르는 것을 없는 것으로 말하지 않는다.
 *
 * ⛔ **여기서 새로 발행할 수 있게 하지 않는다.** 이 구획의 지시들은 **이미 만들어져 있다** —
 * 낼 수 있는 액션은 배포뿐이고, 되돌리는 액션은 이 화면에 없다.
 */
export const HandoverPane = ({
  workOrders,
  total,
  isError,
  releasingId,
  releasedNo,
  failure,
  uomLabel,
  onRelease,
}: HandoverPaneProps) => {
  const t = messages.emergencyWorkOrder.handover;

  /* 못 받았으면 그 사실을 알리고, 받았는데 비었으면 아무것도 세우지 않는다. */
  if (!isError && (workOrders === undefined || workOrders.length === 0)) return null;

  const columns: Column<WorkOrder>[] = [
    { key: 'no', header: t.columns.workOrderNo, render: (row) => row.workOrderNo },
    {
      key: 'qty',
      header: t.columns.orderQty,
      align: 'end',
      render: (row) => `${String(row.orderQty)} ${uomLabel(row.uomId)}`,
    },
    {
      key: 'reason',
      header: t.columns.reason,
      /* 사유를 비운 채 발행된 것도 있다 — 빈 칸을 「사유 없음」으로 단정하지 않고 자리만 둔다. */
      render: (row) => (row.remarks ?? '').trim() || t.reasonEmpty,
    },
    {
      key: 'action',
      header: t.retry,
      render: (row) => (
        <Button
          size="sm"
          variant="tonal"
          /* ⛔ 나가 있는 동안 잠근다 — 되돌릴 수 없는 쓰기다. */
          disabled={releasingId !== null}
          onClick={() => {
            onRelease({
              workOrderId: row.workOrderId,
              workOrderNo: row.workOrderNo,
              orderQty: row.orderQty,
            });
          }}
        >
          {releasingId === row.workOrderId ? t.retrying : t.retry}
        </Button>
      ),
    },
  ];

  const rows = workOrders ?? [];
  const isTruncated = total !== undefined && total > rows.length;

  return (
    <section className="pane emergency-work-order-pane" aria-label={t.title}>
      <h2 className="pane-title">{t.title}</h2>

      {isError ? (
        <div className="banner-slot">
          <AlertBanner variant="error">{t.loadError}</AlertBanner>
        </div>
      ) : (
        <>
          {/* ⛔ 왜 남았는지와 무엇을 하면 되는지를 함께 적는다 — 새로 발행하면 지시가 둘이 된다. */}
          <div className="banner-slot">
            <AlertBanner variant="warning">{t.lead}</AlertBanner>
          </div>

          {releasedNo !== null && (
            <div className="banner-slot">
              <AlertBanner variant="success">{t.released(releasedNo)}</AlertBanner>
            </div>
          )}

          {/* ⛔ 보내지 못한 것과 답을 못 받은 것을 갈라 말한다 — 단언이 거짓이면 이중 배포를 부른다. */}
          {failure !== null && (
            <div className="banner-slot">
              <AlertBanner variant="warning">
                {failure.step === 'unknown'
                  ? t.releaseUnknown(failure.workOrderNo)
                  : t.notSent(failure.workOrderNo)}
              </AlertBanner>
            </div>
          )}

          <div className="emergency-work-order-table">
            <Table
              density="compact"
              columns={columns}
              rows={rows}
              getRowId={(row) => String(row.workOrderId)}
              caption={t.tableCaption}
            />
          </div>

          {/*
           * A-11 — 여기 없는 것을 밝힌다. 없는 이유까지 적어야 다른 데를 찾아보지 않는다.
           *
           * ⛔ **`.field-note` 를 쓰지 않는다**(규범 4의 20rem 제한). 이것은 칸 하나에 딸린
           * 사유가 아니라 **표 전체**의 설명이라, 좁은 기둥으로 접히면 표 아래에서 서너 줄로
           * 접혀 읽기 어려워진다(브라우저 확인 실측).
           */}
          <p>{t.itemNotShown}</p>

          {isTruncated && <p>{t.truncated(rows.length, total)}</p>}
        </>
      )}
    </section>
  );
};
