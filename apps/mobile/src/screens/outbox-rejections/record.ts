import { STATE_LOCKED_CODE, type ApiError, type ErrorItem } from '@omf-mes/api-client';
import { messages } from '@omf-mes/i18n';

import type { RejectedRecord } from '../../patterns/outbox';

const t = messages.outboxRejections.reason;
const d = messages.outboxRejections.details;

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
      return (
        error.errors
          .map((item) => item.message)
          .join(' ')
          .trim() || t.invalid
      );
    case 'stateLocked':
      return (
        error.errors
          .map((item) => item.message)
          .join(' ')
          .trim() || t.stateLocked
      );
    case 'conflict':
      return error.message || t.conflict;
    case 'http':
      return error.status === NO_LEADER_STATUS
        ? t.noLeader
        : error.message || `${t.unknown} (${String(error.status)})`;
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

export interface DetailRow {
  label: string;
  value: string;
}

/**
 * 담당자에게 물을 때 적을 값들.
 *
 * 사유 한 줄만으로는 무엇을 물어야 할지 정해지지 않는다 - 서버는 단말 토큰이 죽은 것과
 * 권한이 없는 것을 같은 401 문구로 보내고, 그 문구는 로그인을 찾으라고 한다. 현장 단말에는
 * 로그인이 없다. 어디로 무엇을 보내 무엇이 돌아왔는지를 함께 낸다.
 */
const serverMessageOf = (error: ApiError): string | null => {
  switch (error.kind) {
    case 'conflict':
      return error.message || null;
    case 'validation':
    case 'stateLocked':
      return (
        error.errors
          .map((item) => item.message)
          .join(' ')
          .trim() || null
      );
    case 'http':
      return error.message || null;
    case 'network':
      return null;
  }
};

/**
 * 서버가 돌려준 응답 코드.
 *
 * 갈래마다 자리가 달라, 한 갈래만 읽으면 나머지가 조용히 빈다 - 계약 오류 봉투는 validation
 * 으로 접히는데 그 갈래를 안 보아 400 중복이 상태 없이 남았다.
 *
 * 없을 수 있다. 응답이 아예 없는 network 말고도, 화면이 스스로 지은 검증 오류는 보내지도
 * 못한 것이라 실을 상태가 없다.
 */
const statusOf = (error: ApiError): number | null =>
  error.kind === 'network' ? null : (error.status ?? null);

const trimmed = (value: string | undefined): string | null => value?.trim() || null;

/**
 * 봉투에서 이 거절을 대표하는 항목.
 *
 * 코드와 걸린 칸을 같은 항목에서 뽑아야 한다. 각각 따로 찾으면 항목이 섞여 올 때 서버가
 * 한 적 없는 짝이 화면에 선다 - 담당자에게 엉뚱한 칸 이름을 전하게 되고, 그것은 빈 칸보다
 * 나쁘다.
 *
 * 잠긴 갈래는 그 코드를 가진 항목을 먼저 찾는다. 갈래를 정한 근거가 그 항목이라, 다른 것을
 * 대표로 세우면 카드가 말하는 사유와 상세의 코드가 서로 다른 것을 가리킨다.
 *
 * 코드가 하나도 없으면 첫 항목을 쓴다 - 칸은 짚어 놓고 코드만 빈 봉투가 와도 그 칸은 보인다.
 */
const culpritOf = (error: ApiError): ErrorItem | null => {
  switch (error.kind) {
    case 'validation':
    case 'stateLocked': {
      const locked =
        error.kind === 'stateLocked'
          ? error.errors.find((item) => item.code === STATE_LOCKED_CODE)
          : undefined;

      return (
        locked ?? error.errors.find((item) => item.code.trim() !== '') ?? error.errors[0] ?? null
      );
    }
    case 'http':
    case 'conflict':
    case 'network':
      return null;
  }
};

const codeOf = (error: ApiError, culprit: ErrorItem | null): string | null => {
  switch (error.kind) {
    case 'http':
    case 'conflict':
      return trimmed(error.code);
    case 'validation':
    case 'stateLocked':
      return trimmed(culprit?.code);
    case 'network':
      return null;
  }
};

/**
 * 어느 칸이 걸렸는가.
 *
 * 서버는 칸 하나가 걸리면 field 로 짚고, 여러 칸이 함께 묶인 유일 제약이면 field 를 일부러
 * 비우고 uniqueScope 로 범위만 알린다 - 복합 키에서 한 칸을 짚으면 절반은 엉뚱한 칸을 가리킨다.
 * 비우는 방식이 키를 빼는 것일 수도 빈 문자열일 수도 있어 둘 다 없는 것으로 본다.
 */
const scopeOf = (culprit: ErrorItem | null): string | null => {
  if (culprit === null) {
    return null;
  }

  return trimmed(culprit.field) ?? (culprit.uniqueScope?.join(', ').trim() || null);
};

export const detailsOf = (record: RejectedRecord): DetailRow[] => {
  const error = record.error;
  /*
   * 앞 건이 못 가 붙을 곳이 없던 건은 상태 없는 오류로 표시돼 있다. 그 0 을 그대로 내면
   * 담당자가 있지도 않은 응답 코드를 찾는다 - 없는 것은 없다고 적는다.
   */
  const answered = statusOf(error);
  const status = answered === null || answered === NO_LEADER_STATUS ? d.none : String(answered);
  const culprit = culpritOf(error);
  const code = codeOf(error, culprit) ?? d.none;
  const scope = scopeOf(culprit);
  /*
   * 서버가 준 말만 낸다. 갈래별 안내는 우리가 지은 말이라, 이 이름표를 달고 나가면 작업자가
   * 서버가 그렇게 말했다고 담당자에게 전한다. 그 안내는 카드 본문에 이미 있다.
   */
  const message = serverMessageOf(error);

  return [
    { label: d.request, value: `${record.entry.method} ${record.entry.path}` },
    { label: d.status, value: status },
    { label: d.code, value: code },
    ...(scope === null ? [] : [{ label: d.scope, value: scope }]),
    { label: d.message, value: message ?? d.none },
    { label: d.key, value: record.entry.idempotencyKey },
    { label: d.rejectedAt, value: whenOf(record.rejectedAt) },
  ];
};
