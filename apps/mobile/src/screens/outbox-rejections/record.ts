import type { ApiError } from '@omf-mes/api-client';
import { messages } from '@omf-mes/i18n';

const t = messages.outboxRejections.reason;

/** 앞 건이 못 가 붙을 곳이 없던 건. 큐가 상태 없는 오류로 표시해 둔 값이다. */
const NO_LEADER_STATUS = 0;

/**
 * 되돌아온 이유를 사람이 읽는 한 줄로 바꾼다.
 *
 * 서버가 준 문구가 있으면 그것을 쓴다 - 어느 칸이 왜 걸렸는지는 서버만 안다. 없을 때만
 * 갈래별 문구로 대신한다.
 */
export const reasonOf = (error: ApiError): string => {
  switch (error.kind) {
    case 'validation':
      return error.errors.map((item) => item.message).join(' ') || t.invalid;
    case 'stateLocked':
      return error.errors.map((item) => item.message).join(' ') || t.stateLocked;
    case 'conflict':
      return error.message || t.conflict;
    case 'http':
      return error.status === NO_LEADER_STATUS
        ? t.noLeader
        : (error.message ?? `${t.unknown} (${String(error.status)})`);
    case 'network':
      return t.unknown;
  }
};

const pad = (value: number): string => String(value).padStart(2, '0');

/**
 * 적은 때를 단말 시각으로 보인다.
 *
 * 연도를 적지 않는다 - 되돌아온 기록은 방금 것이라 월일과 시각이면 어느 것인지 가려진다.
 */
export const whenOf = (iso: string): string => {
  const at = new Date(iso);

  if (Number.isNaN(at.getTime())) {
    return iso;
  }

  return `${pad(at.getMonth() + 1)}-${pad(at.getDate())} ${pad(at.getHours())}:${pad(at.getMinutes())}`;
};
