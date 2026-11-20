import { messages } from '@omf-mes/i18n';
import { useLayoutEffect, useRef, useState, type ReactNode } from 'react';

import {
  PuBand,
  PuChip,
  PuCount,
  PuIcon,
  PuNote,
  PuPager,
  PuSection,
  useFitPages,
  type PuChipTone,
  type PuIconName,
} from '../../patterns/pop-uniform';
import {
  OQC_TONE,
  blockedTargetsOf,
  groupBlockers,
  overText,
  qtyWithUom,
  splitLotsOf,
  type BlockerGroup,
  type ChipTone,
  type Completion,
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
      ? t.blockers.line(
          lineNo,
          line.itemCode,
          qtyWithUom(line.pickedQty, line.uomCode),
          qtyWithUom(line.targetQty, line.uomCode),
        )
      : `${t.blockers.lineOnly(lineNo)} ${line.itemCode}`;
  });

  return [...lines, ...group.lotNos].join(', ');
};

/** 정보 띠 칸 이름 — 작은 아이콘 + 글(OQC 출하검사 의뢰 정보 띠와 같은 모양). */
const bandLabel = (icon: PuIconName, text: string): ReactNode => (
  <>
    <PuIcon name={icon} />
    {text}
  </>
);

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
 * 출하 가능 배지 · 정보 띠: 고객·납품처·수주·LOT 수·수량·재고가 빠질 창고), 출하 불가 사유, 출하 품목, 피킹 LOT(보기만).
 * ⛔ 시안 머리 카드의 [출하 확정]은 두지 않는다 — 주 동작은 아래 작업 줄의 [출하 완료] 하나다(POP 통일 규칙).
 *
 * ⛔ ERP 송신 여부는 어디에도 보이지 않는다(사용자 결정 2026-11-18). 수주 없는 지시서는 수주 칸만 「없음」이다.
 * ⛔ [출하 완료]는 아래 작업 줄에 있다 — 이 화면이 곧 확인 창이라 따로 묻지 않는다.
 */
export const ConfirmView = ({ completion }: ConfirmViewProps) => {
  const groups = groupBlockers(completion.blockers);
  const blocked = groups.length > 0;
  const targets = blockedTargetsOf(completion);
  const splitLots = splitLotsOf(completion);
  /*
   * 두 카드는 늘 같은 높이(위 · 아래 맞춤). 한 쪽에 다 들면 둘 다 내용 높이(큰 쪽)로 줄고 「총 N건」은 표 바로 아래,
   * 넘칠 때만 남는 높이를 다 갖고 쪽을 나눈다(사용자 지시 2026-11-20). 한 번 넘친 지시서는 그대로 둔다(깜박임 방지).
   */
  const tablesRef = useRef<HTMLDivElement>(null);
  const [overflowed, setOverflowed] = useState(false);
  /*
   * 피킹 LOT 표 — 처음엔 다 그려 보고(한 쪽), 본문을 넘칠 때만 칸 높이에 드는 줄로 쪽을 나눈다(아래 「총 N건 ‹ n/m ›」).
   * 한 번 나누면 그 지시서는 그대로.
   */
  const single = !overflowed;
  const lotPage = useFitPages(completion.lots, { table: true, enabled: !single });
  useLayoutEffect(() => {
    const scroller = tablesRef.current?.parentElement ?? null;
    if (single && scroller !== null && scroller.scrollHeight > scroller.clientHeight + 1) {
      setOverflowed(true);
    }
  });

  return (
    <>
      {/*
       * 머리 박스 하나 — OQC 출하검사 의뢰 정보 띠와 같은 「이름 위 · 값 아래」 4열 격자(`pu-band-stack`, 사용자 지시
       * 2026-11-20). 지시서 번호·출하 여부(목록과 같은 크기 칩)도 칸 하나씩, 맨 앞 두 칸. 박스 밖 제목 줄·카드는 두지 않는다.
       * 아이콘도 그 띠와 같은 뜻으로 고른다(거래처 list · 번호 file · 수량 check). 창고는 칩이 여럿일 수 있어 한 줄 전체.
       */}
      <section className="pu-band-stack is-fluid psc-band" aria-label={t.head.request}>
        <PuBand
          grid={3}
          label={t.head.band}
          items={[
            {
              label: bandLabel('file', t.head.request),
              value: <span className="pu-mono">{completion.shipmentRequestNo}</span>,
            },
            {
              label: bandLabel('shield', t.head.status),
              value: (
                <PuChip tone={blocked ? 'bad' : 'ok'}>
                  {blocked ? t.head.blocked : t.head.ready}
                </PuChip>
              ),
            },
            {
              label: bandLabel('list', t.head.customer),
              value: t.head.named(completion.customer.partnerName, completion.customer.partnerCode),
            },
            {
              label: bandLabel('list', t.head.shipTo),
              value: t.head.named(completion.shipTo.partnerName, completion.shipTo.partnerCode),
            },
            {
              label: bandLabel('file', t.head.salesOrder),
              value: completion.salesOrderNo ?? t.head.noSalesOrder,
            },
            {
              label: bandLabel('pin', t.warehouses.heading),
              wide: true,
              value:
                completion.warehouses.length === 0 ? (
                  t.head.none
                ) : (
                  <span className="psc-wh-chips">
                    {completion.warehouses.map((warehouse) => (
                      <span key={warehouse.warehouseId} className="psc-wh-chip">
                        {t.head.named(warehouse.warehouseName, warehouse.warehouseCode)}
                      </span>
                    ))}
                  </span>
                ),
            },
          ]}
        />
        {splitLots.map((lotNo) => (
          <PuNote key={lotNo}>{t.warehouses.splitLot(lotNo)}</PuNote>
        ))}
      </section>

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

      <div ref={tablesRef} className={single ? 'psc-tables' : 'psc-tables is-paged'}>
        <div className="psc-col">
          <PuSection grow={false} title={t.lines.heading} label={t.lines.heading}>
            <div className="pu-table-wrap">
              <table className="pu-table" aria-label={t.lines.caption}>
                <thead>
                  <tr>
                    <th scope="col" className="fit psc-c">
                      {t.lines.columns.lineNo}
                    </th>
                    <th scope="col">{t.lines.columns.item}</th>
                    <th scope="col" className="fit psc-c">
                      {t.lines.columns.target}
                    </th>
                    <th scope="col" className="fit psc-c">
                      {t.lines.columns.picked}
                    </th>
                    <th scope="col" className="fit psc-c">
                      {t.lines.columns.over}
                    </th>
                    <th scope="col" className="fit psc-c">
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
                      <td className="fit psc-c">{line.lineNo}</td>
                      {/* 품목 한 칸 — 출고 QR(goods-issue-qr)처럼 굵은 코드 + 이름 한 줄. 코드는 한 줄, 이름만 줄을 바꾼다. */}
                      <td className="psc-name" title={`${line.itemCode} ${line.itemName}`}>
                        <b className="pu-mono psc-nowrap">{line.itemCode}</b> {line.itemName}
                      </td>
                      <td className="fit psc-c">{qtyWithUom(line.targetQty, line.uomCode)}</td>
                      <td className="fit psc-c">
                        {line.pickedQty === line.targetQty ? (
                          <span className="psc-match">
                            {qtyWithUom(line.pickedQty, line.uomCode)}
                            <span role="img" aria-label={t.lines.matched}>
                              <PuIcon name="ok" />
                            </span>
                          </span>
                        ) : (
                          qtyWithUom(line.pickedQty, line.uomCode)
                        )}
                      </td>
                      <td
                        className={line.overQty > 0 ? 'fit psc-c psc-over' : 'fit psc-c psc-zero'}
                      >
                        {overText(line.overQty, line.uomCode)}
                      </td>
                      <td className="fit psc-c">{line.lotCount}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </PuSection>
        </div>

        <PuSection
          split
          title={
            /* 건수는 빨간 원 숫자만 — 화면 탭 건수처럼 0 이면 두지 않는다(사용자 지시 2026-11-20). */
            <>
              {t.lots.title}
              {completion.lots.length > 0 && (
                <>
                  {' '}
                  <PuCount tone="primary">{completion.lots.length}</PuCount>
                </>
              )}
            </>
          }
          label={t.lots.title}
        >
          {completion.lots.length === 0 ? (
            <p className="psc-empty-row">{t.lots.empty}</p>
          ) : (
            <div ref={lotPage.fitRef} className="pu-fit">
              <div className="pu-table-wrap">
                <table className="pu-table" aria-label={t.lots.caption}>
                  <thead>
                    <tr>
                      <th scope="col">{t.lots.columns.lotNo}</th>
                      <th scope="col" className="fit psc-c">
                        {t.lots.columns.qty}
                      </th>
                      <th scope="col" className="fit psc-c">
                        {t.lots.columns.oqc}
                      </th>
                      <th scope="col" className="fit">
                        {t.lots.columns.managementCode}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {lotPage.items.map((lot) => (
                      <tr
                        key={lot.shipmentRequestLotId}
                        className={targets.lotNos.has(lot.lotNo) ? 'psc-row-blocked' : undefined}
                      >
                        {/* LOT 번호만 — 창고는 위 정보 띠 「재고가 빠질 창고」에만 둔다(중복 정리 · 사용자 지시 2026-11-20). */}
                        <td className="pu-mono psc-lot-no">{lot.lotNo}</td>
                        <td className="fit psc-c">{qtyWithUom(lot.qty, lot.uomCode)}</td>
                        <td className="fit psc-c">
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
            </div>
          )}
          <PuPager
            total={lotPage.total}
            page={lotPage.page}
            pages={lotPage.pages}
            onPage={lotPage.setPage}
            label={t.lots.title}
          />
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
