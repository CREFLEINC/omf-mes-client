/**
 * **납품 라벨을 POP 이 그린다** — 이 화면의 재출력 갈래.
 *
 * ⛔ **서버는 이 유형을 그려 주지 않는다.** 종전에는 배분의 `delivery_label_no` 로 서버가 PNG 를
 *    그렸는데, 주인이 출하 단위로 옮겨가며 그 코드가 걷혔다 — 지금 그 렌디션은 **422** 다
 *    (전달본 v4 · `2e9f234b`). 포장 라벨이 현장에서 한 장도 안 나오던 까닭과 같은 모양이라,
 *    같은 함정에 두 번 빠지지 않으려고 그리기를 여기로 들였다.
 *
 * ⭐ **마감 직후 발행과 같은 그림이 나온다.** 값 조립(`toDeliveryLabelFields`)과 그리기
 *    (`renderDeliveryLabel`)를 P-04-05 와 **그대로 나눠 쓴다** — 따로 조립하면 같은 출하 단위의
 *    라벨이 「마감하며 나온 것」과 「여기서 다시 뽑은 것」으로 갈리고, 한쪽만 고쳐도 아무도 모른다.
 */

import { useCallback } from 'react';

import { toDeliveryLabelFields } from '../shipping-unit/delivery-label-fields';
import { renderDeliveryLabel } from '../shipping-unit/delivery-label-image';
import type { ShippingUnitDetail } from '../shipping-unit/types';

import { DELIVERY_LABEL, type LabelKind } from './codes';
import type { IssueView, TargetRow } from './types';

export interface DeliveryLabelDrawerInput {
  /** 이 출하의 출하 단위 상세. 상세가 곧 라벨 값 전부다(`queries.ts` 의 `useShippingUnits`). */
  units: readonly ShippingUnitDetail[];
}

/**
 * 종류가 납품 라벨이면 그리고, 아니면 `null` 을 준다 — 부르는 쪽이 포장 라벨 그리개로 넘긴다.
 *
 * ⛔ **값이 모자라면 그리지 않고 «던진다».** 상세를 못 찾았는데 그리면 품목 칸이 빈 라벨이
 *    종이로 나가고, 그것은 되돌릴 수 없다. `null` 은 「다른 그리개가 맡는다」는 뜻이라 여기서
 *    쓰면 모자란 값이 조용히 다음 자리로 흘러간다.
 */
export const useDeliveryLabelDrawer = ({
  units,
}: DeliveryLabelDrawerInput): ((
  kind: LabelKind,
  row: TargetRow,
  issue: IssueView,
) => Uint8Array<ArrayBuffer> | null) =>
  useCallback(
    (kind, row, issue) => {
      if (kind !== DELIVERY_LABEL) return null;

      const unit = units.find((each) => each.shippingUnitId === row.issueTargetId);

      if (unit === undefined) {
        throw new Error(
          `출하 단위 ${row.displayName} 의 상세를 찾지 못해 납품 라벨을 그릴 수 없습니다.`,
        );
      }

      /*
       * ⚠ **회차는 발행 응답이 준 값이다.** 화면이 세지 않는다 — 같은 단위를 다른 단말에서도
       *   찍으므로 화면이 센 값은 곧 틀리고, 그 수가 종이에 찍힌다.
       */
      return renderDeliveryLabel(toDeliveryLabelFields(unit, issue.issueSeq));
    },
    [units],
  );
