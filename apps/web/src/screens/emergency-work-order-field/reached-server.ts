import { ApiRequestError } from '../../patterns/request';

/**
 * 마지막 조회가 **서버에 닿았는가** — 머리띠의 `연결됨 / 오프라인` 이 이 값이다.
 *
 * ⛔ **실패했다는 사실만으로 「오프라인」이라고 말하지 않는다.** `401`·`403`·`5xx` 는 서버가
 * «답으로» 보낸 것이므로 닿은 것이다. 실패를 뭉뚱그리면 권한·서버 오류를 만난 작업자가
 * 네트워크를 확인하러 간다 — 고칠 수 없는 곳을 보게 만든다.
 *
 * ⭐ **닿지 못한 실패는 이미 갈라져 있다** — `ApiError` 의 `network` 가 그것이고
 * 「응답 자체가 없는 실패라 상태 코드를 갖지 않는다」고 정의돼 있다
 * (`packages/api-client/src/errors.ts`). 이 판정을 여기서 다시 만들지 않고 그것을 읽는다.
 *
 * ⚠ **요청 경로 밖에서 생긴 오류는 「모른다」로 둔다**(`undefined`). 렌더 중 예외 같은 것은
 * 연결에 대해 아무것도 말해 주지 않으므로, 그것을 근거로 「연결됨」이라고 말하면 틀린 안심을
 * 준다. 머리띠는 `undefined` 일 때 표시 자체를 내지 않는다(`pop-header.tsx`).
 */
export const reachedServer = (query: {
  isSuccess: boolean;
  isError: boolean;
  error: unknown;
}): boolean | undefined => {
  if (query.isSuccess) return true;
  if (!query.isError) return undefined;
  if (!(query.error instanceof ApiRequestError)) return undefined;

  return query.error.apiError.kind !== 'network';
};
