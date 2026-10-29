import type { ChipStatus } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';

import { statusName } from './message-labels';
import type { IntegrationMessageRow } from './types';
import { toPlantDateTimeParts, type PlantDateTimeParts } from '../../patterns/plant-time';

/**
 * 상태 열의 표시 산출 — 칩 하나와 보조 한 줄.
 *
 * 상태는 넷이다 — 대기(PENDING) · 처리 중(PROCESSING) · 완료(DONE) · 실패(FAILED)(계약 확정 · 공통코드
 * INTEGRATION_MESSAGE_STATUS). 이름은 `message-labels.ts` 가 붙이고, 모르는 코드는 코드 그대로 · 색 없이 낸다.
 *
 * 시각 표기도 여기 둔다 — 표·상세가 쓰는 유일한 날짜 표기 지점이라 규칙이 한 곳에 있어야 한다.
 */

const t = messages.integrationSync;

/** 계약이 확정한 상태 넷. */
export const KNOWN_STATUS = {
  pending: 'PENDING',
  processing: 'PROCESSING',
  done: 'DONE',
  failed: 'FAILED',
} as const;

/** 상태 칩의 색 — 완료는 초록, 실패는 빨강, 처리 중은 파랑, 대기는 회색. */
const TONE: Readonly<Record<string, ChipStatus>> = {
  [KNOWN_STATUS.pending]: 'idle',
  [KNOWN_STATUS.processing]: 'info',
  [KNOWN_STATUS.done]: 'success',
  [KNOWN_STATUS.failed]: 'error',
};

export interface StatusView {
  /** 디자인 시스템 `Chip`의 상태. 모르는 코드는 색을 정하지 않는다. */
  tone: ChipStatus;
  /** 칩에 넣을 글자. 모르는 코드는 코드 문자열 그대로다. */
  label: string;
  /** 칩 아래 보조 한 줄. 없으면 null. */
  note: string | null;
}

/**
 * 계약의 date-time 문자열을 **공장 시각**의 날짜·시각으로 나눈다(`patterns/plant-time` ·
 * omf-all-around#20). 보는 사람(실행 환경)의 시간대로 옮기지 않는다 — 같은 자료가 사람마다 다른
 * 시각으로 보이면 안 된다.
 */
const parseParts = (value: string | null | undefined): PlantDateTimeParts | null =>
  toPlantDateTimeParts(value);

/** `2026-08-04 09:12`. 값이 없거나 형식이 아니면 null — 호출부가 「—」로 바꾼다. */
export const formatDateTime = (value: string | null | undefined): string | null => {
  const parts = parseParts(value);

  return parts === null ? null : `${parts.date} ${parts.time}`;
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
    const at = formatDateTime(row.lockedAt);

    return at === null ? t.status.processingNoTime : t.status.processing(at);
  }

  if (isFuture(row.availableAt, now)) {
    const at = formatDateTime(row.availableAt);

    return at === null ? null : t.status.autoRetry(at);
  }

  return null;
};

export const toStatusView = (row: IntegrationMessageRow, now: Date): StatusView => ({
  tone: TONE[row.statusCode] ?? 'idle',
  label: statusName(row.statusCode),
  note: toNote(row, now),
});
