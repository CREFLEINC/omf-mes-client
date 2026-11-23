import type { InboundLotDetail } from '@omf-mes/api-client';
import { messages } from '@omf-mes/i18n';

import { FitName } from '../../patterns/fit-name';
import { rowNumberStyle } from '../../patterns/row-number';
import { putawayProgressOf, type PendingLotGroup } from './direct';

const d = messages.putaway.direct;

/** 수량 숫자 — 천 단위 쉼표. 단위는 작게 따로 붙인다. */
const qtyNumber = (qty: number): string =>
  qty.toLocaleString('ko-KR', { maximumFractionDigits: 6 });

/** 공급사 머리 줄 묶음 — 처음 나온 차례 그대로(서버 정렬: 입하 마감 오래된 순). */
const bySupplier = (
  groups: readonly PendingLotGroup[],
): { supplierName: string; groups: PendingLotGroup[] }[] => {
  const suppliers = new Map<string, PendingLotGroup[]>();

  for (const group of groups) {
    suppliers.set(group.supplierName, [...(suppliers.get(group.supplierName) ?? []), group]);
  }

  return [...suppliers].map(([supplierName, rows]) => ({ supplierName, groups: rows }));
};

/**
 * 적치 대기 표(사용자 지시 2026-11-23) — 공급사 머리 줄 › No · 품목코드 / 품목명 · 수량 · 진척(적치 완료 / 자재 관리
 * LOT). 입하 등록 · 입하 마감 표와 같은 모양이다. 입하 LOT 번호 · 자재 관리 LOT 번호는 적지 않는다.
 *
 * 품목 칸을 누르면 적치(위치 스캔)로 간다(사용자 지시 2026-11-23) — 그 줄의 적치 대기 LOT 이 하나면 곧바로, 여럿이면
 * 고르는 시트를 먼저 띄운다(`onOpen` 이 정한다). 아무 LOT 이나 열면 손에 든 것과 다른 LOT 이 그 위치에 기록된다.
 *
 * 수량은 입하 LOT 의 받은 수량, 진척은 입하 LOT 상세로 센다 — 상세를 아직 못 읽었으면 적치 대기 LOT 의 합과 「—」.
 */
export const PendingLotTable = ({
  groups,
  detailOf,
  onOpen,
}: {
  groups: readonly PendingLotGroup[];
  detailOf: (inboundLotId: number) => InboundLotDetail | undefined;
  onOpen: (group: PendingLotGroup) => void;
}) => {
  let no = 0;

  return (
    <div className="putaway-table__box">
      <table className="putaway-table" style={rowNumberStyle(groups.length)}>
        <colgroup>
          <col className="putaway-table__col-no" />
          <col />
          <col className="putaway-table__col-qty" />
          <col className="putaway-table__col-progress" />
        </colgroup>
        <thead>
          <tr>
            <th scope="col">{d.columns.no}</th>
            <th scope="col">{d.columns.item}</th>
            <th scope="col">{d.columns.qty}</th>
            <th scope="col">{d.columns.progress}</th>
          </tr>
        </thead>
        {bySupplier(groups).map((supplier) => (
          <tbody key={supplier.supplierName}>
            <tr className="putaway-table__group">
              <th scope="colgroup" colSpan={4}>
                {supplier.supplierName}
              </th>
            </tr>
            {supplier.groups.map((group) => {
              no += 1;
              const detail =
                group.inboundLotId === undefined ? undefined : detailOf(group.inboundLotId);
              const progress = detail === undefined ? null : putawayProgressOf(detail);
              const qty = detail?.receivedQty ?? group.lots.reduce((sum, lot) => sum + lot.qty, 0);
              const uom = detail?.uomCode ?? group.lots[0]?.uomCode ?? '';

              return (
                <tr key={group.key}>
                  <td className="putaway-table__no">{no}</td>
                  <td className="putaway-table__item">
                    <button
                      type="button"
                      className="putaway-table__open"
                      aria-label={d.open(group.itemCode, group.itemName)}
                      onClick={() => {
                        onOpen(group);
                      }}
                    >
                      <span className="putaway-table__code">{group.itemCode}</span>
                      <FitName
                        className="putaway-table__name"
                        text={group.itemName}
                        min={7}
                        lines={1}
                        whole
                      />
                    </button>
                  </td>
                  <td className="putaway-table__num">
                    {qtyNumber(qty)}
                    <small>{uom}</small>
                  </td>
                  <td
                    className="putaway-table__num putaway-table__progress"
                    aria-label={
                      progress === null ? undefined : d.progressLabel(progress.done, progress.total)
                    }
                  >
                    {progress === null ? '—' : d.progress(progress.done, progress.total)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        ))}
      </table>
    </div>
  );
};
