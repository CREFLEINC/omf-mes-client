import type { components } from '@omf-mes/api-client';

import { useApiClient } from '../../patterns/api-context';
import { useMasterWrite, type MasterWriteResult } from '../../patterns/master';
import { shipmentProcessingKeys } from './queries';

type ShipmentCreate = components['schemas']['ShipmentCreate'];
type Shipment = components['schemas']['Shipment'];

/**
 * `POST /logistics/shipments` — 출하·라인·LOT 배분을 한 트랜잭션으로 만든다. 되돌릴 수 없는
 * 쓰기라 `keyLifetime: 'until-applied'`(계획서 결정) — 통신이 끊긴 뒤 다시 눌러도 같은 키가
 * 나가 서버가 중복 실행을 막는다.
 *
 * baseline에서 이 오퍼레이션은 `Idempotency-Key`만 요구한다 — `If-Match`·`X-Worker-No` 없음
 * (계획서 확정 사항). 그래서 `etagPath: null`이다.
 *
 * 이 화면이 소유한다 — 다른 화면 슬라이스의 같은 이름 파일을 참조하지 않는다.
 */

export interface ShipmentProcessingMutationOptions {
  onSuccess: (data: Shipment) => void;
}

export const useShipmentProcessingMutation = (
  options: ShipmentProcessingMutationOptions,
): MasterWriteResult<ShipmentCreate> => {
  const { client } = useApiClient();

  return useMasterWrite<ShipmentCreate, Shipment>({
    request: (body, headers) =>
      client.POST('/logistics/shipments', {
        params: { header: { 'Idempotency-Key': headers['Idempotency-Key'] } },
        body,
      }),
    etagPath: null,
    invalidateKeys: [shipmentProcessingKeys.all],
    // 대응하는 입력칸이 확인 창 안에 없다(폼은 창 뒤에 그대로 남아 있다) — 필드 오류도 배너로 올린다.
    knownFields: [],
    keyLifetime: 'until-applied',
    onSuccess: options.onSuccess,
  });
};
