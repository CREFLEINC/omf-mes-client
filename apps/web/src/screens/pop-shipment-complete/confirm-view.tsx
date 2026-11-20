import { messages } from '@omf-mes/i18n';

import {
  PuChip,
  PuIcon,
  PuNote,
  PuSection,
  puCx,
  type PuChipTone,
} from '../../patterns/pop-uniform';
import {
  OQC_TONE,
  blockedTargetsOf,
  formatQty,
  groupBlockers,
  lotWarehousesOf,
  overText,
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

/** LOT 번호 아래 창고별 몫 — 「창고 | 120 (적치 대기 120 EA)」, 여러 창고면 쉼표로 잇는다(시안 2026-11-20). */
const portionText = (lot: CompletionLot, uom: string): string =>
  lotWarehousesOf(lot.portions)
    .map((entry) => {
      const text = t.lots.portion(entry.name, formatQty(entry.qty));
      return entry.staging > 0
        ? `${text} (${t.lots.staging(qtyWithUom(entry.staging, uom))})`
        : text;
    })
    .join(', ');

/** 교체 근거 판정 글 — 판정 코드가 OQC 판정 이름에 있으면 그 이름. */
const judgmentText = (judgment: string | null): string | null =>
  judgment !== null && judgment in t.lots.oqc
    ? t.lots.oqc[judgment as keyof typeof t.lots.oqc]
    : judgment;

export interface ConfirmViewProps {
  completion: Completion;
}

/**
 * 확인 화면 = `:lookup` 값 그대로(시안 ③·④·⑤ · 「출하 지시서 상세 화면 UI 개선 안」 2026-11-20). 머리 카드(지시서 번호 ·
 * 출하 가능 배지 · 고객·납품처·재고가 빠질 창고 · 수주·총 LOT·총 수량), 출하 불가 사유, 출하 품목, 피킹 LOT(보기만).
 * ⛔ 시안 머리 카드의 [출하 확정]은 두지 않는다 — 주 동작은 아래 작업 줄의 [출하 완료] 하나다(POP 통일 규칙).
 *
 * ⛔ ERP 송신 여부는 어디에도 보이지 않는다(사용자 결정 2026-11-18). 수주 없는 지시서는 수주 칸만 「없음」이다.
 * ⛔ [출하 완료]는 아래 작업 줄에 있다 — 이 화면이 곧 확인 창이라 따로 묻지 않는다.
 */
export const ConfirmView = ({ completion }: ConfirmViewProps) => {
  const groups = groupBlockers(completion.blockers);
  const blocked = groups.length > 0;
  const targets = blockedTargetsOf(completion);
  const uom = uomOf(completion);
  const totalQty = completion.lots.reduce((sum, lot) => sum + lot.qty, 0);
  const splitLots = splitLotsOf(completion);

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
          <span className={puCx('psc-status', blocked ? 'bad' : 'ok')}>
            {blocked ? t.head.blocked : t.head.ready}
          </span>
        }
      >
        {/* 한 카드에 모은다 — 1줄 고객·납품처·창고, 2줄 수주·합계(시안 「정보 밀도 강화 및 불필요한 카드 통합」). */}
        <dl className="pu-kv psc-head-kv">
          <dt>{t.head.customer}</dt>
          <dd>{t.head.named(completion.customer.partnerName, completion.customer.partnerCode)}</dd>
          <dt>{t.head.shipTo}</dt>
          <dd>{t.head.named(completion.shipTo.partnerName, completion.shipTo.partnerCode)}</dd>
          <dt>{t.warehouses.heading}</dt>
          <dd className="psc-wh-chips">
            {completion.warehouses.length === 0
              ? t.head.none
              : completion.warehouses.map((warehouse) => (
                  <span key={warehouse.warehouseId} className="psc-wh-chip">
                    {t.head.named(warehouse.warehouseName, warehouse.warehouseCode)}
                  </span>
                ))}
          </dd>
          <dt>{t.head.salesOrder}</dt>
          <dd>{completion.salesOrderNo ?? t.head.noSalesOrder}</dd>
          <dd className="psc-head-totals">
            <span>{t.head.totalLots(completion.lots.length)}</span>
            <span>{t.head.totalQty(qtyWithUom(totalQty, uom))}</span>
          </dd>
        </dl>
        {splitLots.map((lotNo) => (
          <PuNote key={lotNo}>{t.warehouses.splitLot(lotNo)}</PuNote>
        ))}
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
                      <td className="psc-wrap">{line.itemName}</td>
                      <td className="fit num">{formatQty(line.targetQty)}</td>
                      <td className="fit num">
                        {line.pickedQty === line.targetQty ? (
                          <span className="psc-match">
                            {formatQty(line.pickedQty)}
                            <span role="img" aria-label={t.lines.matched}>
                              <PuIcon name="ok" />
                            </span>
                          </span>
                        ) : (
                          formatQty(line.pickedQty)
                        )}
                      </td>
                      <td className={line.overQty > 0 ? 'fit num psc-over' : 'fit num psc-zero'}>
                        {overText(line.overQty)}
                      </td>
                      <td className="fit num">{line.lotCount}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </PuSection>
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
                      <td className="psc-lot-cell">
                        <span className="pu-mono">{lot.lotNo}</span>
                        {lot.portions.length > 0 && (
                          <span className="psc-lot-portions">{portionText(lot, uom)}</span>
                        )}
                      </td>
                      <td className="fit num">{formatQty(lot.qty)}</td>
                      <td className="fit">
                        {lot.oqcLotStatus !== null && (
                          <PuChip tone={PU_TONE[OQC_TONE[lot.oqcLotStatus]]}>
                            {t.lots.oqc[lot.oqcLotStatus]}
                          </PuChip>
                        )}
                      </td>
                      <td className="fit pu-mono psc-code">
                        {lot.managementCode === null || lot.managementCode === ''
                          ? t.lots.none
                          : lot.managementCode}
                      </td>
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
