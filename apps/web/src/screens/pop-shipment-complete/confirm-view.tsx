import { Chip, Icon } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';

import {
  OQC_TONE,
  blockedTargetsOf,
  formatQty,
  groupBlockers,
  itemCodeOfLot,
  overText,
  portionSummaryOf,
  qtyWithUom,
  uomOf,
  type BlockerCode,
  type BlockerGroup,
  type Completion,
  type CompletionLot,
} from './model';

const t = messages.popShipmentComplete;

/** 이유마다 앞에 서는 그림 — 시안 ④의 표식(피킹·대기·불합격·보류·취소). */
const BLOCKER_ICON: Record<BlockerCode, string> = {
  PICKING_SHORT: 'inventory_2',
  NOT_INSPECTED: 'pending',
  REJECTED: 'cancel',
  HELD: 'pause_circle',
  SALES_ORDER_LINE_CANCELLED: 'block',
};

/** 이유가 짚는 곳 — 라인은 「라인 2 FG-B200, 피킹 0 / 목표 50」, LOT 은 번호(쉼표로 잇는다). */
const targetOf = (completion: Completion, group: BlockerGroup): string => {
  const lines = group.lineNos.map((lineNo) => {
    const line = completion.lines.find((candidate) => candidate.lineNo === lineNo);
    if (line === undefined) return t.blockers.lineOnly(lineNo);
    return group.code === 'PICKING_SHORT'
      ? t.blockers.line(lineNo, line.itemCode, formatQty(line.pickedQty), formatQty(line.targetQty))
      : `${t.blockers.lineOnly(lineNo)} ${line.itemCode}`;
  });

  return [...lines, ...group.lotNos].join(', ');
};

/** LOT 몫 요약 글 — 「완제품 창고 A 20 (적치 대기 10 포함), 완제품 창고 B 20」. 한 창고 한 자리면 null. */
const portionText = (lot: CompletionLot): string | null => {
  const summary = portionSummaryOf(lot.portions);
  if (summary === null) return null;
  /* 적치 대기 몫은 그 몫이 있는 창고 바로 뒤에만 붙인다 — 「창고1 30 (적치 대기 5 포함), 창고2 10」. */
  return summary.warehouses
    .map((entry) => {
      const text = t.lots.portion(entry.name, formatQty(entry.qty));
      return entry.staging > 0
        ? `${text} (${t.lots.stagingIncluded(formatQty(entry.staging))})`
        : text;
    })
    .join(', ');
};

/** 교체 근거 판정 글 — 판정 코드가 OQC 판정 이름에 있으면 그 이름. */
const judgmentText = (judgment: string | null): string | null =>
  judgment !== null && judgment in t.lots.oqc
    ? t.lots.oqc[judgment as keyof typeof t.lots.oqc]
    : judgment;

export interface ConfirmViewProps {
  completion: Completion;
  via: 'scan' | 'search' | 'direct';
}

/**
 * 확인 화면 = `:lookup` 값 그대로(시안 ③·④·⑤). 머리(지시서·고객·납품처·수주·상태), 막는 이유, 라인,
 * 재고가 빠질 창고(정보로만), LOT(판정·코드 — 보기만).
 *
 * ⛔ ERP 송신 여부는 어디에도 보이지 않는다(사용자 결정 2026-11-18). 수주 없는 지시서는 수주 칸만 「없음」이다.
 * ⛔ [출하 완료]는 바닥 띠에 있다 — 이 화면이 곧 확인 창이라 따로 묻지 않는다.
 */
export const ConfirmView = ({ completion, via }: ConfirmViewProps) => {
  const groups = groupBlockers(completion.blockers);
  const blocked = groups.length > 0;
  const targets = blockedTargetsOf(completion);
  const uom = uomOf(completion);

  return (
    <div className="pop-ship-confirm">
      <section className="pop-ship-head" aria-label={t.head.request}>
        <div className="pop-ship-head__key">
          <span className="pop-ship-head__label">{t.head.request}</span>
          <strong className="pop-ship-head__no">{completion.shipmentRequestNo}</strong>
          <Chip
            variant="status"
            size="md"
            status={blocked ? 'error' : 'success'}
            leadingIcon={<Icon name={blocked ? 'block' : 'check_circle'} size={18} aria-hidden />}
          >
            {blocked ? t.head.blocked : t.head.ready}
          </Chip>
          <span className="pop-ship-head__via">
            {via === 'scan'
              ? t.head.openedByScan
              : via === 'direct'
                ? t.head.openedByDirect
                : t.head.openedBySearch}
          </span>
        </div>
        <dl className="pop-ship-head__facts">
          <div>
            <dt>{t.head.customer}</dt>
            <dd>
              {t.head.named(completion.customer.partnerName, completion.customer.partnerCode)}
            </dd>
          </div>
          <div>
            <dt>{t.head.shipTo}</dt>
            <dd>{t.head.named(completion.shipTo.partnerName, completion.shipTo.partnerCode)}</dd>
          </div>
          <div>
            <dt>{t.head.salesOrder}</dt>
            <dd>{completion.salesOrderNo ?? t.head.noSalesOrder}</dd>
          </div>
        </dl>
      </section>

      {blocked && (
        <section className="pop-ship-blockers" aria-label={t.blockers.heading(groups.length)}>
          <h2 className="pop-ship-section-title pop-ship-section-title--error">
            <Icon name="block" size={20} aria-hidden />
            <span>{t.blockers.heading(groups.length)}</span>
          </h2>
          <ul>
            {groups.map((group) => (
              <li key={group.code} className="pop-ship-blocker">
                <Icon name={BLOCKER_ICON[group.code]} size={24} aria-hidden />
                <span className="pop-ship-blocker__text">
                  <strong>{t.blockers[group.code].title}</strong>
                  {targetOf(completion, group) !== '' && (
                    <span className="pop-ship-blocker__target">{targetOf(completion, group)}</span>
                  )}
                  <span className="pop-ship-blocker__hint">{t.blockers[group.code].hint}</span>
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="pop-ship-body">
        <div className="pop-ship-col">
          <section aria-label={t.lines.heading}>
            <h2 className="pop-ship-section-title">{t.lines.heading}</h2>
            <p className="field-note">{t.lines.note}</p>
            <table className="pop-ship-table" aria-label={t.lines.caption}>
              <thead>
                <tr>
                  <th scope="col">{t.lines.columns.lineNo}</th>
                  <th scope="col">{t.lines.columns.itemCode}</th>
                  <th scope="col">{t.lines.columns.itemName}</th>
                  <th scope="col" className="pop-ship-num">
                    {t.lines.columns.target}
                  </th>
                  <th scope="col" className="pop-ship-num">
                    {t.lines.columns.picked}
                  </th>
                  <th scope="col" className="pop-ship-num">
                    {t.lines.columns.over}
                  </th>
                  <th scope="col" className="pop-ship-num">
                    {t.lines.columns.lotCount}
                  </th>
                </tr>
              </thead>
              <tbody>
                {completion.lines.map((line) => (
                  <tr
                    key={line.shipmentRequestLineId}
                    className={
                      targets.lineNos.has(line.lineNo) ? 'pop-ship-row-blocked' : undefined
                    }
                  >
                    <td className="pop-ship-num">{line.lineNo}</td>
                    <td className="pop-ship-code">{line.itemCode}</td>
                    <td className="pop-ship-name" title={line.itemName}>
                      {line.itemName}
                    </td>
                    <td className="pop-ship-num">{formatQty(line.targetQty)}</td>
                    <td className="pop-ship-num">{formatQty(line.pickedQty)}</td>
                    <td
                      className={line.overQty > 0 ? 'pop-ship-num pop-ship-over' : 'pop-ship-num'}
                    >
                      {overText(line.overQty)}
                    </td>
                    <td className="pop-ship-num">{line.lotCount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          {completion.warehouses.length > 0 && (
            <section aria-label={t.warehouses.heading}>
              <h2 className="pop-ship-section-title">{t.warehouses.heading}</h2>
              <p className="field-note">{t.warehouses.note}</p>
              <ul className="pop-ship-warehouses">
                {completion.warehouses.map((warehouse) => (
                  <li key={warehouse.warehouseId}>
                    <Icon name="warehouse" size={20} aria-hidden />
                    <span className="pop-ship-warehouse__name">
                      {t.head.named(warehouse.warehouseName, warehouse.warehouseCode)}
                    </span>
                    <span className="pop-ship-warehouse__qty">
                      {t.warehouses.entry(warehouse.lotCount, qtyWithUom(warehouse.qty, uom))}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>

        <section className="pop-ship-col" aria-label={t.lots.heading(completion.lots.length)}>
          <h2 className="pop-ship-section-title">{t.lots.heading(completion.lots.length)}</h2>
          <p className="field-note">{t.lots.note}</p>
          <table className="pop-ship-table" aria-label={t.lots.caption}>
            <thead>
              <tr>
                <th scope="col">{t.lots.columns.lotNo}</th>
                <th scope="col">{t.lots.columns.itemCode}</th>
                <th scope="col" className="pop-ship-num">
                  {t.lots.columns.qty}
                </th>
                <th scope="col">{t.lots.columns.oqc}</th>
                <th scope="col">{t.lots.columns.managementCode}</th>
              </tr>
            </thead>
            <tbody>
              {completion.lots.map((lot) => (
                <tr
                  key={lot.shipmentRequestLotId}
                  className={targets.lotNos.has(lot.lotNo) ? 'pop-ship-row-blocked' : undefined}
                >
                  <td className="pop-ship-lot">
                    {lot.lotNo}
                    {portionText(lot) !== null && (
                      <span className="pop-ship-lot__portions">{portionText(lot)}</span>
                    )}
                  </td>
                  <td className="pop-ship-code">{itemCodeOfLot(completion, lot)}</td>
                  <td className="pop-ship-num">{formatQty(lot.qty)}</td>
                  <td>
                    {lot.oqcLotStatus !== null && (
                      <Chip variant="status" size="sm" status={OQC_TONE[lot.oqcLotStatus]}>
                        {t.lots.oqc[lot.oqcLotStatus]}
                      </Chip>
                    )}
                  </td>
                  <td className="pop-ship-code">{lot.managementCode ?? ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {completion.replacedLots.length > 0 && (
            <p className="pop-ship-replaced">
              <Icon name="swap_horiz" size={20} aria-hidden />
              <span>
                {t.lots.replaced(
                  completion.replacedLots.length,
                  completion.replacedLots
                    .map((lot) => t.lots.replacedLot(lot.lotNo, judgmentText(lot.judgment)))
                    .join(', '),
                )}
              </span>
            </p>
          )}
        </section>
      </div>
    </div>
  );
};
