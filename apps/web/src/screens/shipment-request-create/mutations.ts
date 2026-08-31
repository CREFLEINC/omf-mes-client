import type { components } from '@omf-mes/api-client';

import { useApiClient } from '../../patterns/api-context';
import { useMasterWrite, type MasterWriteResult } from '../../patterns/master';
import { sourceQueryKeys } from './source-queries';
import { toCreatedShipmentRequestView, type CreatedShipmentRequestView } from './types';
import type { ShipmentRequestCreate } from './types';
import { HEADER_FORM_FIELDS } from './validation';

type ShipmentRequestResponse = components['schemas']['ShipmentRequest'];

/**
 * 편성 — **이 화면에서 되돌릴 수 없는 유일한 쓰기**다(계획서 검증 수준 「보통」의 근거이기도
 * 하다 — 낙관적 잠금이 걸리는 상태 전이가 아니라 단순 생성).
 *
 * **잠금 토큰을 보내지 않는다**(`etagPath: null`). 새 전표라 견줄 판이 없다 — 계약 parameters에
 * `If-Match`가 없다(계획서 「확정된 것」).
 *
 * **멱등 키의 수명이 `until-applied`다.** 편성은 되돌릴 수 없는 쓰기라 통신이 끊긴 뒤 같은 값을
 * 다시 보내도 서버가 같은 요청으로 알아보게 한다(`patterns/master`의 규율).
 *
 * **좌측 목록을 무효화한다.** 「미편성만」 조건이 이번에 편성한 지시서를 걸러내야 하므로,
 * 성공 뒤 목록을 다시 받아야 그 지시서가 사라진다. 지시서 상세는 무효화하지 않는다 — 다시
 * 받으면 이미 채워 둔 라인 초안이 재조회 한 번에 되돌아간다(다른 화면들의 승계 초안 규율과 같다).
 */
export const useShipmentRequestCreateMutation = (options: {
  onSuccess: (data: CreatedShipmentRequestView) => void;
}): MasterWriteResult<ShipmentRequestCreate> => {
  const { client } = useApiClient();

  return useMasterWrite<ShipmentRequestCreate, ShipmentRequestResponse>({
    request: (body, headers) =>
      client.POST('/logistics/shipment-requests', {
        params: { header: { 'Idempotency-Key': headers['Idempotency-Key'] } },
        body,
      }),
    etagPath: null,
    invalidateKeys: [sourceQueryKeys.listAll],
    knownFields: HEADER_FORM_FIELDS,
    keyLifetime: 'until-applied',
    onSuccess: (data) => {
      options.onSuccess(toCreatedShipmentRequestView(data));
    },
  });
};
