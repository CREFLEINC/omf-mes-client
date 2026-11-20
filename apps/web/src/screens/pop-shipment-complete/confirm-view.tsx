import { messages } from '@omf-mes/i18n';

import { PuChip, PuKv, PuNote, PuSection, type PuChipTone } from '../../patterns/pop-uniform';
import {
  OQC_TONE,
  blockedTargetsOf,
  formatQty,
  groupBlockers,
  itemCodeOfLot,
  overText,
  portionSummaryOf,
  qtyWithUom,
  splitLotsOf,
  uomOf,
  type BlockerGroup,
  type ChipTone,
  type Completion,
  type CompletionLot,
} from './model';

const t = messages.popShipmentComplete;

/** 판정 칩 색 → POP 통일 칩 색. */
const PU_TONE: Record<ChipTone, PuChipTone> = {
  idle: 'idle',
  info: 'info',
  success: 'ok',
  warning: 'warn',
  error: 'bad',
};

/**
 * 이유 글. 라인을 짚지 않은 피킹 부족은 서버가 «낼 피킹 LOT 이 하나도 없을 때» 내는 것이라(라인 수량이 다 차도
 * 난다 — 서버 `completionBlockers`) 「피킹된 출하 LOT 이 없습니다」로 쓴다. 판정은 서버 그대로다.
 */
const reasonOf = (group: BlockerGroup): { title: string; hint: string } =>
  group.code === 'PICKING_SHORT' && group.lineNos.length === 0
    ? t.blockers.noPickedLot
    : t.blockers[group.code];

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
}

/**
 * 확인 화면 = `:lookup` 값 그대로(시안 ③·④·⑤). 머리(지시서 번호 · 출하 가능 여부 · 고객·납품처·수주),
 * 출하 불가 사유, 출하 품목, 재고가 빠질 창고(정보로만), 피킹 LOT(판정·코드 — 보기만).
 *
 * ⛔ ERP 송신 여부는 어디에도 보이지 않는다(사용자 결정 2026-11-18). 수주 없는 지시서는 수주 칸만 「없음」이다.
 * ⛔ [출하 완료]는 아래 작업 줄에 있다 — 이 화면이 곧 확인 창이라 따로 묻지 않는다.
 */
export const ConfirmView = ({ completion }: ConfirmViewProps) => {
  const groups = groupBlockers(completion.blockers);
  const blocked = groups.length > 0;
  const targets = blockedTargetsOf(completion);
  const uom = uomOf(completion);

  return (
    <>
      <PuSection
        grow={false}
        label={t.head.request}
        title={
          <>
            {t.head.request} <span className="pu-mono">{completion.shipmentRequestNo}</span>
          </>
        }
        meta={
          <PuChip tone={blocked ? 'bad' : 'ok'}>{blocked ? t.head.blocked : t.head.ready}</PuChip>
        }
      >
        <PuKv
          cols2
          items={[
            {
              label: t.head.customer,
              value: t.head.named(completion.customer.partnerName, completion.customer.partnerCode),
            },
            {
              label: t.head.shipTo,
              value: t.head.named(completion.shipTo.partnerName, completion.shipTo.partnerCode),
            },
            { label: t.head.salesOrder, value: completion.salesOrderNo ?? t.head.noSalesOrder },
          ]}
        />
      </PuSection>

      {blocked && (
        <PuSection grow={false} title={t.blockers.heading} label={t.blockers.heading}>
          {groups.map((group) => {
            const reason = reasonOf(group);
            const target = targetOf(completion, group);
            return (
              <PuNote key={group.code} tone="bad">
                <b>{reason.title}</b>
                {target !== '' && <span> {target}</span>}
                <span> {reason.hint}</span>
              </PuNote>
            );
          })}
        </PuSection>
      )}

      <div className="psc-tables">
        <div className="psc-col">
          <PuSection grow={false} title={t.lines.heading} label={t.lines.heading}>
            <div className="pu-table-wrap">
              <table className="pu-table" aria-label={t.lines.caption}>
                <thead>
                  <tr>
                    <th scope="col" className="fit num">
                      {t.lines.columns.lineNo}
                    </th>
                    <th scope="col" className="fit">
                      {t.lines.columns.itemCode}
                    </th>
                    <th scope="col">{t.lines.columns.itemName}</th>
                    <th scope="col" className="fit num">
                      {t.lines.columns.target}
                    </th>
                    <th scope="col" className="fit num">
                      {t.lines.columns.picked}
                    </th>
                    <th scope="col" className="fit num">
                      {t.lines.columns.over}
                    </th>
                    <th scope="col" className="fit num">
                      {t.lines.columns.lotCount}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {completion.lines.map((line) => (
                    <tr
                      key={line.shipmentRequestLineId}
                      className={targets.lineNos.has(line.lineNo) ? 'psc-row-blocked' : undefined}
                    >
                      <td className="fit num">{line.lineNo}</td>
                      <td className="fit pu-mono">{line.itemCode}</td>
                      <td title={line.itemName}>{line.itemName}</td>
                      <td className="fit num">{formatQty(line.targetQty)}</td>
                      <td className="fit num">{formatQty(line.pickedQty)}</td>
                      <td className={line.overQty > 0 ? 'fit num psc-over' : 'fit num'}>
                        {overText(line.overQty)}
                      </td>
                      <td className="fit num">{line.lotCount}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </PuSection>

          {completion.warehouses.length > 0 && (
            <PuSection grow={false} title={t.warehouses.heading} label={t.warehouses.heading}>
              <PuKv
                items={completion.warehouses.map((warehouse) => ({
                  label: t.head.named(warehouse.warehouseName, warehouse.warehouseCode),
                  value: t.warehouses.entry(warehouse.lotCount, qtyWithUom(warehouse.qty, uom)),
                }))}
              />
              {splitLotsOf(completion).map((lotNo) => (
                <PuNote key={lotNo}>{t.warehouses.splitLot(lotNo)}</PuNote>
              ))}
            </PuSection>
          )}
        </div>

        <PuSection
          grow={false}
          title={t.lots.heading(completion.lots.length)}
          label={t.lots.heading(completion.lots.length)}
        >
          {completion.lots.length === 0 ? (
            <p className="psc-empty-row">{t.lots.empty}</p>
          ) : (
            <div className="pu-table-wrap">
              <table className="pu-table" aria-label={t.lots.caption}>
                <thead>
                  <tr>
                    <th scope="col">{t.lots.columns.lotNo}</th>
                    <th scope="col" className="fit">
                      {t.lots.columns.itemCode}
                    </th>
                    <th scope="col" className="fit num">
                      {t.lots.columns.qty}
                    </th>
                    <th scope="col" className="fit">
                      {t.lots.columns.oqc}
                    </th>
                    <th scope="col" className="fit">
                      {t.lots.columns.managementCode}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {completion.lots.map((lot) => (
                    <tr
                      key={lot.shipmentRequestLotId}
                      className={targets.lotNos.has(lot.lotNo) ? 'psc-row-blocked' : undefined}
                    >
                      <td className="pu-mono" title={lot.lotNo}>
                        {lot.lotNo}
                        {portionText(lot) !== null && (
                          <span className="psc-lot-portions">{portionText(lot)}</span>
                        )}
                      </td>
                      <td className="fit pu-mono">{itemCodeOfLot(completion, lot)}</td>
                      <td className="fit num">{formatQty(lot.qty)}</td>
                      <td className="fit">
                        {lot.oqcLotStatus !== null && (
                          <PuChip tone={PU_TONE[OQC_TONE[lot.oqcLotStatus]]}>
                            {t.lots.oqc[lot.oqcLotStatus]}
                          </PuChip>
                        )}
                      </td>
                      <td className="fit pu-mono">{lot.managementCode ?? ''}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {completion.replacedLots.length > 0 && (
            <PuNote>
              {t.lots.replaced(
                completion.replacedLots.length,
                completion.replacedLots
                  .map((lot) => t.lots.replacedLot(lot.lotNo, judgmentText(lot.judgment)))
                  .join(', '),
              )}
            </PuNote>
          )}
        </PuSection>
      </div>
    </>
  );
};
