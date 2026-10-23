import type { ApiError } from '@omf-mes/api-client';

/**
 * 서버가 실어 준 이유 문구. 없으면 null — 일반 문구로 지어내지 않는다.
 *
 * ⭐ 검증·잠금 거부의 항목 문구와 충돌 문구는 서버가 사용자에게 보이려고 쓴 말이라 그대로 쓴다.
 * ⛔ `http` 갈래는 401(단말 권한) 일 때만 쓴다 — 서버가 조치를 적어 보내는 자리다. 그 밖의
 *    5xx·404 몸체는 사용자에게 보일 말이 아니어서(영어 원문 등) 화면의 일반 문구에 맡긴다.
 */
export const serverReasonOf = (error: ApiError): string | null => {
  const lines =
    error.kind === 'validation' || error.kind === 'stateLocked'
      ? error.errors.map((item) => item.message)
      : error.kind === 'conflict' || (error.kind === 'http' && error.status === HTTP_UNAUTHORIZED)
        ? [error.message ?? '']
        : [];
  const text = lines
    .map((line) => line.trim())
    .filter((line) => line !== '')
    .join(' ');

  return text === '' ? null : text;
};

const HTTP_UNAUTHORIZED = 401;
