import { useApiClient } from '../../patterns/api-context';
import { requireIfMatch, useMasterWrite, type MasterWriteResult } from '../../patterns/master';
import type { AcknowledgeBody } from './decision';
import { poChangeKeys, productionOrderPath } from './queries';

/**
 * 이 화면의 쓰기 — `POST /planning/production-orders/{id}:acknowledge`.
 *
 * ⭐ **낙관적 잠금이 이 화면의 핵심이다**(§5-3). 관리자가 판정하는 사이 **ERP 배치가 같은 P/O 를
 * 또 바꿔 보낼 수 있고**, 그러면 판번호가 올라 409 가 온다. 이 화면은 공유계약 B-1 의 충돌
 * 원인 셋 중 **「ERP 배치」가 정면으로 걸리는 첫 화면**이다.
 *
 * ⚠ **그래서 충돌 문구가 다르다** — 「남이 고쳤다」가 아니라 **「ERP 가 다시 변경했습니다」**다.
 * 부딪치는 상대가 사람이 아니라서, G-1 의 기본 문구를 그대로 쓰면 사용자가 동료를 찾으러 간다.
 *
 * ⛔ **되돌릴 수 없는 판정이다** — 확인 기록이 P/O 행에 남고 강행이면 W/O 에 불일치 표식이
 * 선다. 그래서 멱등 키를 적용될 때까지 붙든다(C-1).
 *
 * 이 화면이 소유한다 — 다른 화면 슬라이스의 같은 이름 파일을 참조하지 않는다.
 */

export interface AcknowledgeOptions {
  /** 겨눈 P/O. 잠금 토큰이 이 건의 상세에서 나온다 — 고르기 전에는 `null`이다. */
  productionOrderId: number | null;
  onSuccess: () => void;
}

export const useAcknowledgeMutation = (
  options: AcknowledgeOptions,
): MasterWriteResult<AcknowledgeBody> => {
  const { client } = useApiClient();
  const { productionOrderId } = options;

  return useMasterWrite<AcknowledgeBody, unknown>({
    request: (body, headers) => {
      if (productionOrderId === null) {
        throw new Error('P/O를 고르기 전에는 확인 처리를 보내지 않습니다.');
      }

      return client.POST('/planning/production-orders/{productionOrderId}:acknowledge', {
        params: {
          path: { productionOrderId },
          header: {
            'Idempotency-Key': headers['Idempotency-Key'],
            /* ⛔ 계약이 필수로 둔다 — 없으면 빈 값을 채우지 않고 멈춘다. */
            'If-Match': requireIfMatch(headers),
          },
        },
        body,
      });
    },
    /* ⭐ 토큰은 «그 P/O 의 상세»가 내린다(B-1-1). 고르기 전에는 열지 않는다. */
    etagPath: productionOrderId === null ? null : productionOrderPath(productionOrderId),
    invalidateKeys: [poChangeKeys.all],
    /* 사유는 계약의 필드 이름이 그대로다 — 서버 오류를 그 칸 옆에 붙일 수 있다. */
    knownFields: ['reason'],
    keyLifetime: 'until-applied',
    onSuccess: options.onSuccess,
  });
};
