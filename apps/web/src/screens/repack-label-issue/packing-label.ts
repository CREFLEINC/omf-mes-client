import { useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';

import { useApiClient } from '../../patterns/api-context';
import { runRequest } from '../../patterns/request';
import { toPackingLabelFields } from '../shipping-packing-label/packing-label-fields';
import { renderPackingLabel } from '../shipping-packing-label/packing-label-image';
import { buildPackingLabel } from '../shipping-packing-label/packing-label-tspl';
import { repackLabelKeys, type HandlingUnitView } from './queries';

/**
 * 포장 라벨 한 장 — **POP 이 그린다**(omf-all-around#327).
 *
 * ⛔ **서버 렌디션을 부르지 않는다.** 포장 라벨(`PACKING_LABEL`)은 서버가 그리지 않는 출력물이다
 *    (출하 포장 라벨 화면과 같은 원칙 · `shipping-packing-label/packing-label-image` 머리말).
 *    이 화면이 `GET /app/document-issues/{id}/rendition` 을 불러 단말 범위 401 이 났고,
 *    [미리보기·재인쇄]가 「라벨 이미지를 받지 못했습니다」로 멈췄다.
 *
 * ⭐ **같은 판을 쓴다.** 그림(`renderPackingLabel`)과 인쇄 명령(`buildPackingLabel`)을 출하 포장
 *    라벨과 같은 함수로 만든다 — 경로마다 따로 조립하면 같은 상자의 라벨이 달라진다.
 *
 * ⚠ **내용물은 포장 «자신»의 내용물이다.** 재구성은 내용물을 바꾸므로 출하 배분이 아니라
 *   `GET /inventory/handling-units/{id}` 의 `contents` 를 싣는다. 출하 번호는 그 포장이 배분된
 *   출하에서 읽고, 배분이 없으면 「-」(값이 없다는 표식 — `packing-label-fields` 규약)로 둔다.
 */
export interface PackingLabelDrawing {
  /** 미리보기·단말 저장용 그림. */
  png: Uint8Array<ArrayBuffer>;
  /** 프린터로 보내는 TSPL 명령. */
  command: string;
}

export type PackingLabelDraw = (
  handlingUnitId: number,
  issueSeq: number,
) => Promise<PackingLabelDrawing>;

const UNKNOWN = '-';

export const usePackingLabelDraw = (): PackingLabelDraw => {
  const { client } = useApiClient();
  const queryClient = useQueryClient();

  return useCallback(
    async (handlingUnitId, issueSeq) => {
      /* 화면의 대상 포장·내용물 이름 조회와 같은 키·같은 응답이다 — 이미 받았으면 다시 부르지 않는다. */
      const detail = await queryClient.fetchQuery({
        queryKey: repackLabelKeys.handlingUnit(handlingUnitId),
        queryFn: async (): Promise<HandlingUnitView> => {
          const data = await runRequest(() =>
            client.GET('/inventory/handling-units/{handlingUnitId}', {
              params: { path: { handlingUnitId } },
            }),
          );

          return { handlingUnit: data.handlingUnit, contents: data.contents };
        },
      });

      const [lots, items, uoms, shipmentNo] = await Promise.all([
        Promise.all(
          detail.contents.map((content) =>
            queryClient.fetchQuery({
              queryKey: repackLabelKeys.lot(content.lotId),
              queryFn: () =>
                runRequest(() =>
                  client.GET('/trace/lots/{lotId}', { params: { path: { lotId: content.lotId } } }),
                ),
            }),
          ),
        ),
        Promise.all(
          detail.contents.map((content) =>
            queryClient.fetchQuery({
              queryKey: repackLabelKeys.item(content.itemId),
              queryFn: () =>
                runRequest(() =>
                  client.GET('/mdm/items/{itemId}', {
                    params: { path: { itemId: content.itemId } },
                  }),
                ),
            }),
          ),
        ),
        queryClient.fetchQuery({
          queryKey: repackLabelKeys.uoms,
          queryFn: () =>
            runRequest(() =>
              client.GET('/mdm/uoms', { params: { query: { includeInactive: true } } }),
            ),
        }),
        (async (): Promise<string> => {
          const allocations = await runRequest(() =>
            client.GET('/logistics/shipment-lot-allocations', {
              params: { query: { handlingUnitId, page: 1, size: 1 } },
            }),
          );
          const shipmentId = allocations.items[0]?.shipmentId;
          if (shipmentId === undefined) return UNKNOWN;

          const shipment = await runRequest(() =>
            client.GET('/logistics/shipments/{shipmentId}', {
              params: { path: { shipmentId } },
            }),
          );

          return shipment.shipmentNo;
        })(),
      ]);

      const uomCodes = new Map(uoms.items.map((uom) => [uom.uomId, uom.uomCode] as const));
      const fields = toPackingLabelFields({
        handlingUnitId,
        handlingUnitNo: detail.handlingUnit.handlingUnitNo,
        shipmentNo,
        issueSeq,
        allocations: detail.contents.map((content, index) => ({
          handlingUnitId,
          itemCode: items[index]?.item.itemCode ?? UNKNOWN,
          lotNo: lots[index]?.lot.lotNo ?? null,
          allocatedQty: content.qty,
          uomId: content.uomId,
        })),
        uomCodeOf: (uomId) => uomCodes.get(uomId) ?? null,
      });

      return { png: renderPackingLabel(fields), command: buildPackingLabel(fields) };
    },
    [client, queryClient],
  );
};
