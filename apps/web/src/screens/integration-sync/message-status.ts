import type { ChipStatus } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';

import type { IntegrationMessageRow } from './types';

/**
 * 상태 열의 표시 산출 — 칩 하나와 보조 한 줄.
 *
 * 계약이 `statusCode`를 「공통코드 — 값 목록 미정」으로 두었다. **실서버의 어휘를 화면이 알 수 없다.**
 * 그래서 모르는 코드에는 이름을 붙이지 않고 코드 문자열을 그대로 낸다.
 *
 * 시각 표기도 여기 둔다 — 표·상세가 쓰는 유일한 날짜 표기 지점이라 규칙이 한 곳에 있어야 한다.
 */

const t = messages.integrationSync;

/**
 * 목 서버·계약 예시에서 확인된 값. 확정되면 **이 상수만** 채운다 — 값을 지어내지 않는다.
 */
export const KNOWN_STATUS = { failed: 'FAILED' } as const;

export interface StatusView {
  /** 디자인 시스템 `Chip`의 상태. 모르는 코드는 색을 정하지 않는다. */
  tone: ChipStatus;
  /** 칩에 넣을 글자. 모르는 코드는 코드 문자열 그대로다. */
  label: string;
  /** 칩 아래 보조 한 줄. 없으면 null. */
  note: string | null;
}

/**
 * 계약의 date-time 문자열에서 표기용 조각을 뽑는다.
 *
 * **실행 환경 시간대로 옮기지 않는다.** 서버가 적어 보낸 벽시계 시각이 현장이 쓰는 시각이고,
 * 옮기면 같은 자료가 보는 사람마다 다른 시각으로 보인다.
 */
const RFC3339_PATTERN = /^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})/;

const parseParts = (value: string | null | undefined): { date: string; time: string } | null => {
  if (value === null || value === undefined) return null;

  const matched = RFC3339_PATTERN.exec(value);
  if (matched === null) return null;

  return { date: matched[1] ?? '', time: matched[2] ?? '' };
};

/** `2026-08-04 09:12`. 값이 없거나 형식이 아니면 null — 호출부가 「—」로 바꾼다. */
export const formatDateTime = (value: string | null | undefined): string | null => {
  const parts = parseParts(value);

  return parts === null ? null : `${parts.date} ${parts.time}`;
};

/** `09:12`. 값이 없거나 형식이 아니면 null. */
export const formatTime = (value: string | null | undefined): string | null => {
  const parts = parseParts(value);

  return parts === null ? null : parts.time;
};

/** 미래인지 판정할 때만 실제 시점으로 다룬다 — 벽시계 표기와 달리 비교는 순간으로 해야 맞다. */
const isFuture = (value: string | null | undefined, now: Date): boolean => {
  if (value === null || value === undefined) return false;

  const at = new Date(value).getTime();

  return !Number.isNaN(at) && at > now.getTime();
};

/**
 * 보조 한 줄. 계약이 정의한 **사실 두 가지**만 옮긴다.
 *
 * 「잠금이 오래됐다」·「재시도 한도를 넘었다」 같은 판정은 하지 않는다 — 몇 회에서 멈추는지도,
 * 죽은 워커의 잠금을 언제 회수하는지도 정해지지 않았다(이슈 omf-mes-client#11 §4).
 *
 * 둘이 겹치면 처리 중이 이긴다. 지금 벌어지고 있는 일이 예정보다 먼저 읽혀야 한다.
 */
const toNote = (row: IntegrationMessageRow, now: Date): string | null => {
  const lockedBy = row.lockedBy ?? '';

  if (lockedBy !== '') {
    const at = formatTime(row.lockedAt);

    return at === null ? t.status.processingNoTime : t.status.processing(at);
  }

  if (isFuture(row.availableAt, now)) {
    const at = formatTime(row.availableAt);

    return at === null ? null : t.status.autoRetry(at);
  }

  return null;
};

export const toStatusView = (row: IntegrationMessageRow, now: Date): StatusView => {
  const isFailed = row.statusCode === KNOWN_STATUS.failed;

  return {
    tone: isFailed ? 'error' : 'idle',
    label: isFailed ? t.status.failed : row.statusCode,
    note: toNote(row, now),
  };
};
