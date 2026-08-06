import type { ApiClient } from '@omf-mes/api-client';

import type { WriteHeaders } from '../../patterns/master';
import type { ApiCallResult } from '../../patterns/request';
import type { IntegrationMessageRow } from './types';

/**
 * 이 화면의 쓰기 — 재처리 요청 두 가지. 쓰기 경로 리터럴이 사는 유일한 자리다.
 *
 * **`If-Match`를 보내지 않는다.** 이 리소스에는 `version_no`가 없어 낙관적 잠금 자체가 없고,
 * 계약이 요구하는 필수 헤더는 `Idempotency-Key` 하나뿐이다. 상세 응답에 `ETag`도 오지 않으므로
 * 잠금 토큰을 꺼내려 하면 영영 비어 있어 재처리가 시작조차 되지 않는다.
 *
 * 워커가 이미 잡고 있는 건은 서버가 409(`conflictCause=workerLease`)로 거부한다 —
 * 낙관적 잠금 대신 그것이 이 리소스의 충돌 규약이다.
 */

type Client = ApiClient['client'];

/**
 * 단건 재처리. **본문이 없다** — 무엇을 다시 보낼지는 경로의 번호가 정한다.
 * 메시지 키가 유일해 재처리는 중복 전송이 아니다. 새 건을 만들지 않는다.
 */
export const retryMessage = (
  client: Client,
  id: number,
  headers: WriteHeaders,
): Promise<ApiCallResult<IntegrationMessageRow>> =>
  client.POST('/integration/messages/{integrationMessageId}:retry', {
    params: {
      path: { integrationMessageId: id },
      header: { 'Idempotency-Key': headers['Idempotency-Key'] },
    },
  });
