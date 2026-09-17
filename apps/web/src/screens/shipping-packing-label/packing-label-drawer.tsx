/**
 * 포장 라벨을 그리는 손 — **두 화면이 같은 것을 쓴다.**
 *
 * 포장 확정 뒤 자동으로(P-04-01 `packing-result/automatic-labels`)도, 재발행 화면에서 손으로
 * (P-04-02)도 같은 라벨이 나가야 한다. 훅 하나로 묶어 두 자리가 **값을 따로 조립하지 않게**
 * 한다 — 따로 조립하면 같은 상자의 라벨이 경로에 따라 달라지고, 한쪽만 고쳐도 아무도 모른다.
 *
 * ⛔ **납품 라벨은 여기서 그리지 않는다.** 아직 서버 렌디션 경로를 쓴다(대상이 출하 단위로
 *    바뀌는 것은 P4·P5 — 서버 전달본 뒤다). 종류가 포장 라벨이 아니면 `null` 을 돌려주고,
 *    그러면 부르는 쪽이 예전 길로 간다.
 *
 * ⛔ **값이 모자라면 그리지 않는다.** 출하 번호를 아직 못 받았는데 그리면 그 칸이 빈 라벨이
 *    종이로 나간다 — 되돌릴 수 없다. 모자랄 때는 `null` 이 아니라 **던진다**: `null` 은
 *    「서버에 맡긴다」는 뜻이고, 서버는 이 종류를 그려 주지 않아 엉뚱한 사유로 멈춘다.
 */

import { useCallback } from 'react';

import { PACKING_LABEL, type LabelKind } from './codes';
import { toPackingLabelFields, type PackingLabelAllocation } from './packing-label-fields';
import { renderPackingLabel } from './packing-label-image';
import { buildPackingLabel } from './packing-label-tspl';
import { useUomCodes } from './queries';
import type { IssueView, TargetRow } from './types';

export interface PackingLabelDrawerInput {
  /** 아직 못 받았으면 `null`. 그 상태로는 그리지 않는다. */
  shipmentNo: string | null;
  /** 이 출하의 배분 전건. 상자에 담긴 것만 이 안에서 골라 쓴다. */
  allocations: readonly PackingLabelAllocation[];
}

export type PackingLabelDrawer = (
  kind: LabelKind,
  row: TargetRow,
  issue: IssueView,
) => Uint8Array<ArrayBuffer> | null;

export const usePackingLabelDrawer = (input: PackingLabelDrawerInput): PackingLabelDrawer => {
  const uomCodeOf = useUomCodes();
  const { shipmentNo, allocations } = input;

  return useCallback(
    (kind, row, issue) => {
      if (kind !== PACKING_LABEL) return null;

      if (shipmentNo === null) {
        throw new Error('출하 번호를 아직 받지 못해 포장 라벨을 그릴 수 없습니다.');
      }

      return renderPackingLabel(
        toPackingLabelFields({
          /* 포장 라벨의 대상 식별자가 곧 취급 단위다(`types.ts` 의 `toPackingRow`). */
          handlingUnitId: row.issueTargetId,
          handlingUnitNo: row.displayName,
          shipmentNo,
          issueSeq: issue.issueSeq,
          allocations,
          uomCodeOf,
        }),
      );
    },
    [allocations, shipmentNo, uomCodeOf],
  );
};

/**
 * 포장 라벨의 **인쇄용 TSPL 명령** — 그림과 같은 값으로 짠다(사용자 지시 2026-09-17).
 *
 * ⭐ 그림은 미리보기에만 쓰고 종이는 이 명령으로 나간다 — 그림 인쇄가 80 × 30 mm 라벨지와
 *   크기가 어긋났다(`packing-label-tspl` 머리말). 두 자리(P-04-01·P-04-02)가 함께 쓴다.
 */
export const usePackingLabelCommand = (
  input: PackingLabelDrawerInput,
): ((kind: LabelKind, row: TargetRow, issue: IssueView) => string | null) => {
  const uomCodeOf = useUomCodes();
  const { shipmentNo, allocations } = input;

  return useCallback(
    (kind, row, issue) => {
      if (kind !== PACKING_LABEL) return null;

      if (shipmentNo === null) {
        throw new Error('출하 번호를 아직 받지 못해 포장 라벨을 그릴 수 없습니다.');
      }

      return buildPackingLabel(
        toPackingLabelFields({
          handlingUnitId: row.issueTargetId,
          handlingUnitNo: row.displayName,
          shipmentNo,
          issueSeq: issue.issueSeq,
          allocations,
          uomCodeOf,
        }),
      );
    },
    [allocations, shipmentNo, uomCodeOf],
  );
};
