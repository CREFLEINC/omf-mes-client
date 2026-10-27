import { Table } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';

import { lotStatusEntryPath } from '../lot-status-history/filters';
import { linkedValue } from './detail-pane';
import type { ShipmentRequest } from './types';

const t = messages.qualityApproval.oqcShipment;

interface PickedLotRow {
  key: string;
  lotId: number;
  lotNo: string;
  qtyText: string;
}

/** 지시서의 줄마다 집은 LOT 을 한 목록으로 편다 — 같은 LOT 이 두 줄에 나뉘어 집혔으면 두 행이다. */
const toPickedLotRows = (
  shipment: ShipmentRequest,
  uomNameOf: (uomId: number) => string,
): PickedLotRow[] =>
  (shipment.lines ?? []).flatMap((line) =>
    line.picks.map((pick) => ({
      key: `${String(line.shipmentRequestLineId)}:${String(pick.lotId)}`,
      lotId: pick.lotId,
      lotNo: pick.lotNo?.trim() || String(pick.lotId),
      qtyText: [String(pick.pickedQty), uomNameOf(pick.uomId)]
        .filter((part) => part !== '')
        .join(' '),
    })),
  );

export interface OqcShipmentPaneProps {
  shipment: ShipmentRequest | undefined;
  isLoading: boolean;
  isError: boolean;
  /** 단위 이름 — 못 읽었으면 빈 글자(수량만 보인다). */
  uomNameOf: (uomId: number) => string;
  /** LOT 상태 화면 권한 — 없으면 LOT 번호만 둔다. */
  canOpenLot: boolean;
}

/**
 * OQC 생략의 「피킹 LOT」(#193) — 생략은 출하작업지시 단위라, 실행하면 이 LOT 들에 생략 이력이 남는다.
 * IQC 생략의 대상 LOT 처럼 LOT 번호 옆에 LOT 상태를 여는 작은 「열기」 단추를 둔다.
 */
export const OqcShipmentPane = ({
  shipment,
  isLoading,
  isError,
  uomNameOf,
  canOpenLot,
}: OqcShipmentPaneProps) => {
  const rows = shipment === undefined ? [] : toPickedLotRows(shipment, uomNameOf);

  return (
    <section className="quality-approval-oqc-lots" aria-label={t.pickedLots}>
      <h3>{t.pickedLots}</h3>
      {isLoading ? (
        <p className="field-note">{t.loading}</p>
      ) : isError ? (
        <p className="field-error">{t.failed}</p>
      ) : rows.length === 0 ? (
        <p className="field-note">{t.noPicks}</p>
      ) : (
        <Table
          density="compact"
          zebra={false}
          rows={rows}
          getRowId={(row) => row.key}
          columns={[
            {
              key: 'lotNo',
              header: t.lotNo,
              render: (row) =>
                linkedValue(
                  row.lotNo,
                  canOpenLot
                    ? {
                        to: lotStatusEntryPath(row.lotId),
                        label: messages.qualityApproval.condition.openLot,
                      }
                    : undefined,
                ),
            },
            /* 수량은 가운데 — 칸 폭을 정해 LOT 번호 칸과 양쪽 여백이 고르게 보이게 한다(사용자 지시 2026-10-27). */
            {
              key: 'pickedQty',
              header: t.pickedQty,
              align: 'center',
              width: '30%',
              render: (row) => row.qtyText,
            },
          ]}
        />
      )}
    </section>
  );
};
