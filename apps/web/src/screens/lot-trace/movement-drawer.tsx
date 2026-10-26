import { Button, Table, type Column } from '@crefle/web-ui';
import { messages, named } from '@omf-mes/i18n';
import { useNavigate } from 'react-router';

import { DetailDrawer } from '../../patterns/detail-drawer';
import { formatQty, qtyLabel, type MovementLot, type MovementRow } from './rows';

const t = messages.lotTrace;

/** W-03-01 LOT 상태 — 그 화면이 `q`(LOT 번호)와 `lot`(고른 LOT)을 주소로 받는다. */
export const LOT_STATUS_PATH = '/quality/lot-status';

export const lotStatusHref = (lot: MovementLot): string =>
  `${LOT_STATUS_PATH}?${new URLSearchParams({ q: lot.lotNo, lot: String(lot.lotId) }).toString()}`;

export interface MovementDrawerProps {
  row: MovementRow;
  statusName: (code: string) => string;
  /** W-03-01 권한이 있을 때만 [LOT 상태 보기]를 둔다(사이드바와 같은 판정). */
  canOpenLotStatus: boolean;
  onClose: () => void;
}

/**
 * 고른 입출고 줄의 상세(T-W-A 드로어). 머리는 문서번호, 요약은 구분과 일시.
 * LOT 행의 [LOT 상태 보기]는 W-03-01로 간다(드로어 안에서 다른 화면으로 가는 동작은 링크 버튼).
 * 2단계에서 이 자리에 [정방향 추적], [역방향 추적]이 더해진다(omf-all-around#73).
 */
export const MovementDrawer = ({
  row,
  statusName,
  canOpenLotStatus,
  onClose,
}: MovementDrawerProps) => {
  const navigate = useNavigate();
  const kindName = t.kinds[row.kind];
  const facts: { label: string; value: string; mono?: boolean }[] = [
    { label: t.detail.lineNo, value: String(row.lineNo) },
    { label: t.detail.item, value: named(row.item.name, row.item.code) },
    { label: t.detail.qty, value: qtyLabel(row) },
    { label: t.detail.warehouse, value: named(row.warehouse.name, row.warehouse.code) },
    ...(row.partner === null
      ? []
      : [
          {
            label: row.kind === 'SHIPMENT' ? t.detail.customer : t.detail.supplier,
            value: named(row.partner.name, row.partner.code),
          },
        ]),
    ...(row.workOrderNo === null
      ? []
      : [{ label: t.detail.workOrder, value: row.workOrderNo, mono: true }]),
    { label: t.detail.status, value: statusName(row.statusCode) },
  ];

  const lotColumns: Column<MovementLot>[] = [
    {
      key: 'lotNo',
      header: t.detail.lotNo,
      render: (lot) => <span className="nowrap-cell mono-cell">{lot.lotNo}</span>,
    },
    {
      key: 'qty',
      header: t.detail.lotQty,
      align: 'end',
      render: (lot) => (
        <span className="nowrap-cell">{`${formatQty(lot.qty)} ${row.uomCode}`}</span>
      ),
    },
    ...(canOpenLotStatus
      ? [
          {
            key: 'open',
            header: <span className="visually-hidden">{t.detail.lotStatus}</span>,
            align: 'end' as const,
            render: (lot: MovementLot) => (
              <Button
                size="sm"
                variant="outlined"
                aria-label={t.detail.lotStatusFor(lot.lotNo)}
                onClick={() => void navigate(lotStatusHref(lot))}
              >
                {t.detail.lotStatus}
              </Button>
            ),
          },
        ]
      : []),
  ];

  return (
    <DetailDrawer
      title={<span className="mono-cell">{row.documentNo}</span>}
      summary={t.detail.summary(kindName, `${row.date} ${row.time}`.trim())}
      onClose={onClose}
      className="lot-trace-drawer"
    >
      <dl className="lot-trace-facts">
        {facts.map((fact) => (
          <div key={fact.label} className="lot-trace-fact">
            <dt>{fact.label}</dt>
            <dd className={fact.mono === true ? 'mono-cell' : undefined}>{fact.value}</dd>
          </div>
        ))}
      </dl>
      <section className="lot-trace-lots" aria-labelledby="lot-trace-lots-title">
        <h3 id="lot-trace-lots-title" className="subsection-title">
          {t.detail.lots}
        </h3>
        <Table
          density="compact"
          caption={<span className="visually-hidden">{t.detail.lots}</span>}
          columns={lotColumns}
          rows={row.lots}
          getRowId={(lot) => String(lot.lotId)}
        />
        {row.lotCount > row.lots.length && (
          <p className="lot-trace-lots-note">
            {t.detail.lotsPartial(row.lots.length, row.lotCount)}
          </p>
        )}
      </section>
    </DetailDrawer>
  );
};
