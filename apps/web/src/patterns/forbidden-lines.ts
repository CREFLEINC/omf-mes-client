import type { ApiError } from '@omf-mes/api-client';
import { messages } from '@omf-mes/i18n';

import { serverReasonOf } from './server-reason';

/**
 * 쓰기가 권한 없음(403)으로 거절됐을 때 보일 줄(omf-all-around#242).
 *
 * 첫 줄은 늘 할 일(담당자에게 권한 요청)을 말하는 공용 문구다. 서버가 봉투에 사유를 실었으면
 * 그것을 둘째 줄로 덧붙인다 — 「승인자도 상신자도 아닙니다」·「이 공장에 대한 데이터 권한이
 * 없습니다」처럼 **무엇이 막혔는지**는 서버만 안다. 몸체 없는 403 은 공용 문구 한 줄이다.
 *
 * 판정은 `isForbidden` 으로 먼저 한다 — 이 함수는 갈래를 가르지 않는다.
 */
export const forbiddenLines = (error: ApiError): string[] => {
  const reason = serverReasonOf(error);

  return reason === null || reason === messages.httpError.forbidden
    ? [messages.httpError.forbidden]
    : [messages.httpError.forbidden, reason];
};
