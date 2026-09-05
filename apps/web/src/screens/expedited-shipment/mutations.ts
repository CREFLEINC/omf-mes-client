import type { components } from '@omf-mes/api-client';

import { useApiClient } from '../../patterns/api-context';
import { useMasterWrite, type MasterWriteResult } from '../../patterns/master';
import { expeditedShipmentKeys } from './queries';
import type { ShipmentCreateBody } from './submission';

type Shipment = components['schemas']['Shipment'];

/**
 * `POST /logistics/shipments` — `expedited: true`.
 *
 * ⭐ **한 트랜잭션이다**(공유계약 B-8). 서버가 제품 입고 전표와 입고 전기를 출하와 함께 만들고,
 * 하나라도 실패하면 전부 되돌아간다. ⛔ **화면이 01 계약을 따로 부르지 않는다** — 두 번 부르면
 * 그 둘 사이가 트랜잭션 밖이 되어, 이 화면이 피하려던 「들어왔는데 안 나간」 상태가 생긴다.
 *
 * ⭐ **`keyLifetime: 'until-applied'`** — 되돌릴 수 없는 쓰기다. 통신이 끊긴 뒤 다시 눌러도 같은
 * 멱등 키가 나가야 원장의 `uq_inventory_idempotency`가 중복을 막는다(§5-6 · 공유계약 C-1).
 * 키를 새로 만들면 **전표가 두 벌 생긴다.**
 *
 * ⚠ **`business_date`가 멱등 키의 일부다**(C-8). 계약의 `ShipmentCreate`가 `businessDate`·
 * `occurredAt`을 필수로 두어(2026-09-01 신설) 화면이 제출 순간의 값을 정해 보낸다 — `submission.ts`가
 * 만든다. 재시도 때는 **처음 보낸 값을 그대로** 보내야 멱등이 선다(자정을 넘겨 다시 계산하지 않는다).
 *
 * baseline에서 이 오퍼레이션은 `Idempotency-Key`만 요구한다 — `If-Match`·`X-Worker-No` 없음.
 * 그래서 `etagPath: null`이다.
 *
 * 이 화면이 소유한다 — 다른 화면 슬라이스의 같은 이름 파일을 참조하지 않는다.
 */

export interface ExpeditedShipmentMutationOptions {
  onSuccess: (data: Shipment) => void;
}

export const useExpeditedShipmentMutation = (
  options: ExpeditedShipmentMutationOptions,
): MasterWriteResult<ShipmentCreateBody> => {
  const { client } = useApiClient();

  return useMasterWrite<ShipmentCreateBody, Shipment>({
    request: (body, headers) =>
      client.POST('/logistics/shipments', {
        params: { header: { 'Idempotency-Key': headers['Idempotency-Key'] } },
        body,
      }),
    etagPath: null,
    invalidateKeys: [expeditedShipmentKeys.all],
    /*
     * 대응하는 입력칸이 확인 창 안에 없다(폼은 창 뒤에 그대로 남아 있다) — 서버가 필드 오류를
     * 돌려줘도 칸 옆에 붙일 자리가 없으므로 배너로 올린다.
     */
    knownFields: [],
    keyLifetime: 'until-applied',
    onSuccess: options.onSuccess,
  });
};
