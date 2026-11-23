import { messages } from '@omf-mes/i18n';
import { useEffect, useRef } from 'react';

import { FitName } from '../../patterns/fit-name';
import { rowNumberStyle } from '../../patterns/row-number';
import {
  activeLots,
  inTerminalScope,
  lineTiles,
  warehouseTagOf,
  type ShipmentRequestLine,
} from './picking';

const t = messages.productPicking.tally;
const tw = messages.productPicking.warehouse;

export interface LineTallyProps {
  lines: readonly ShipmentRequestLine[];
  itemOf: (line: ShipmentRequestLine) => { itemCode: string; itemName: string };
  uomOf: (uomId: number) => string;
  /** 방금 피킹한 라인 — 초록. */
  currentLineId: number | null;
  /** 이미 피킹한 LOT 을 또 찍었을 때 그 라인 — 회색. */
  duplicateLineId: number | null;
  /** 찍을 때마다 바뀌는 값 — 바뀌면 강조한 줄로 옮긴다. */
  focusKey: number | null;
  onOpen: (lineId: number) => void;
}

/**
 * 피킹 라인 표(사용자 지시 2026-11-20, 입하 등록 「이번 입하」 표와 같은 모양) — No · 품목코드 위 품목명 아래 ·
 * LOT 수 · 피킹 / 목표. 품목명은 글자를 줄여서라도 한 줄. 불합격 LOT 은 줄 안 칩으로만 알린다 - 교체는 줄을 눌러 연
 * 시트에서 한다.
 */
export const LineTally = ({
  lines,
  itemOf,
  uomOf,
  currentLineId,
  duplicateLineId,
  focusKey,
  onOpen,
}: LineTallyProps) => {
  const tableRef = useRef<HTMLTableElement>(null);

  useEffect(() => {
    if (focusKey === null) return;
    tableRef.current
      ?.querySelector("tr[data-current='true'], tr[data-duplicate='true']")
      ?.scrollIntoView?.({ block: 'nearest', behavior: 'smooth' });
  }, [focusKey]);

  return (
    <section className="picking-tally" aria-label={t.title}>
      <h2 className="picking-tally__title">
        {t.title} <span className="picking-tally__total">{t.total(lines.length)}</span>
      </h2>
      <div className="picking-tally__box">
        <table
          ref={tableRef}
          className="picking-tally__table"
          style={rowNumberStyle(Math.max(0, ...lines.map((line) => line.lineNo)))}
        >
          <colgroup>
            <col className="picking-tally__col-no" />
            <col />
            <col className="picking-tally__col-lots" />
            <col className="picking-tally__col-qty" />
          </colgroup>
          <thead>
            <tr>
              <th scope="col">{t.columns.no}</th>
              <th scope="col">{t.columns.item}</th>
              <th scope="col">{t.columns.lots}</th>
              <th scope="col">{t.columns.qty}</th>
            </tr>
          </thead>
          <tbody>
            {lines.map((line) => {
              const item = itemOf(line);
              const live = activeLots(line);
              const rejected = live.filter((lot) => lot.oqcLotStatus === 'REJECTED').length;
              const tiles = lineTiles(line);
              const mine = inTerminalScope(line);
              const tag = warehouseTagOf(line, tw);

              /*
               * ⭐ 이 기기 범위 밖 줄(피처 012 FR-011)은 읽기만 한다 — 점선 테 · 회색, 누를 자리 없음(LOT · 교체 · 코드 칸이
               *    없다). 목표 · 피킹은 보여 지시서 전체 진행을 안다.
               */
              if (!mine) {
                const reason = line.outOfScopeReason === 'OTHER_WAREHOUSE' ? 'OTHER_WAREHOUSE' : 'OTHER_PLANT';

                return (
                  <tr
                    key={line.shipmentRequestLineId}
                    data-out-of-scope="true"
                    data-reached={tiles.kind === 'over'}
                  >
                    <td className="picking-tally__no">{line.lineNo}</td>
                    <td className="picking-tally__item">
                      <span className="picking-tally__code">{item.itemCode}</span>
                      <span className="picking-tally__scope">{tw[reason](tag)}</span>
                    </td>
                    <td className="picking-tally__num picking-tally__lots">{live.length}</td>
                    <td className="picking-tally__num">
                      {String(tiles.picked)}
                      <small>
                        /{String(tiles.target)} {uomOf(line.uomId)}
                      </small>
                    </td>
                  </tr>
                );
              }

              return (
                <tr
                  key={line.shipmentRequestLineId}
                  data-current={line.shipmentRequestLineId === currentLineId}
                  data-duplicate={line.shipmentRequestLineId === duplicateLineId}
                  data-reached={tiles.kind === 'over'}
                >
                  <td className="picking-tally__no">{line.lineNo}</td>
                  <td className="picking-tally__item">
                    <button
                      type="button"
                      className="picking-tally__open"
                      aria-label={t.open(item.itemCode, item.itemName)}
                      onClick={() => {
                        onOpen(line.shipmentRequestLineId);
                      }}
                    >
                      <span className="picking-tally__code">
                        {item.itemCode}
                        {rejected === 0 ? null : (
                          <span className="picking-tally__rejected">{t.rejected(rejected)}</span>
                        )}
                      </span>
                      <FitName
                        className="picking-tally__name"
                        text={item.itemName}
                        min={7}
                        lines={1}
                        whole
                      />
                      {/* 줄 출고 창고(피처 012) — 이 창고의 LOT 만 이 줄로 들어간다. */}
                      <span
                        className="picking-tally__warehouse"
                        data-unassigned={line.warehouse === null || line.warehouse === undefined}
                      >
                        {tag}
                      </span>
                    </button>
                  </td>
                  <td className="picking-tally__num picking-tally__lots">{live.length}</td>
                  <td className="picking-tally__num">
                    {String(tiles.picked)}
                    <small>
                      /{String(tiles.target)} {uomOf(line.uomId)}
                    </small>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
};
