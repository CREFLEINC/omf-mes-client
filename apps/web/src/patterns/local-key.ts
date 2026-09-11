import { createIdempotencyKey } from '@omf-mes/api-client';

/**
 * 화면 안에서만 쓰는 초안·목록 키 — 추가한 행을 서로 가르는 값이다.
 *
 * ⛔ **`crypto.randomUUID()` 를 직접 부르지 않는다**(#1066). 그 함수는 보안 컨텍스트에만 있어
 * 평문 HTTP 배포본에서는 「추가」를 누르는 자리가 던진다.
 *
 * 서버로 가는 값이 아니라 멱등 키일 까닭은 없지만, 평문에서도 겹치지 않는 값을 짓는 생성기가
 * 그것 하나라 같은 것을 쓴다. 이름을 따로 두는 것은 읽는 사람이 이 값을 계약의 멱등 키로
 * 오해하지 않게 하려는 것이다.
 */
export const createLocalKey = (): string => createIdempotencyKey();
