import type { components } from '@omf-mes/api-client';

/**
 * W-CO-04 가 다루는 모양들.
 *
 * ⭐ **확인 대상 인원(분모)이 없을 수 있다** — 작업지시 범위는 사람을 배정하는 자리가 없어
 * 셀 수 없다. ⛔ **0으로 채우지 않는다**: 「셀 수 없음」과 「아무도 안 봤음」이 화면에서 같아
 * 보이면 관리자가 독촉할 대상을 잘못 고른다.
 *
 * ⭐ **확인 상태는 셋이다** — 확인 · 열람(미확인) · 미확인. 「닫기」로 남은 행에도 시각이
 * 찍히므로 시각 유무만으로는 가를 수 없다.
 *
 * 이 화면이 소유한다 — 다른 화면 슬라이스의 같은 이름 파일을 참조하지 않는다.
 */

type Notice = components['schemas']['Notice'];
type NoticeAcknowledgement = components['schemas']['NoticeAcknowledgement'];

export interface PageMeta {
  page: number;
  size: number;
  total: number;
}

export interface LookupEntry {
  value: string;
  label: string;
  isActive: boolean;
}

export interface SelectOption {
  value: string;
  label: string;
}

export interface NoticeView {
  noticeId: number;
  title: string;
  body: string;
  statusCode: string;
  scopeCode: string;
  startDate: string;
  endDate: string | null;
  acknowledgeRequired: boolean;
  acknowledgedCount: number;
  /** ⛔ 셀 수 없으면 `null` 이다 — 0으로 채우지 않는다. */
  targetCount: number | null;
  publishedAt: string | null;
  targetWorkOrderId: number | null;
  targetWorkOrderNo: string | null;
}

export interface NoticeListResult {
  items: NoticeView[];
  page: PageMeta;
}

/** 한 사람의 확인 상태 — 셋 중 하나다. */
export type AckState = 'done' | 'opened' | 'pending';

export interface AckView {
  /** 화면에 보일 이름. 계정이면 이름, 현장 단말이면 사번이다. */
  who: string;
  state: AckState;
  at: string | null;
  /** 현장 작업자인가 — 계정을 갖지 않아 사번으로 온다. */
  isWorker: boolean;
}

export interface AckListResult {
  items: AckView[];
  page: PageMeta;
}

const nullable = <T>(value: T | null | undefined): T | null => value ?? null;

export const toNoticeView = (source: Notice): NoticeView => ({
  noticeId: source.noticeId,
  title: source.title,
  body: source.body ?? '',
  statusCode: source.statusCode,
  scopeCode: source.scopeCode,
  startDate: source.startDate,
  endDate: nullable(source.endDate),
  acknowledgeRequired: source.acknowledgeRequired ?? false,
  acknowledgedCount: source.acknowledgedCount ?? 0,
  targetCount: nullable(source.targetCount),
  publishedAt: nullable(source.publishedAt),
  targetWorkOrderId: nullable(source.targetWorkOrderId),
  targetWorkOrderNo: nullable(source.targetWorkOrderNo),
});

/**
 * ⭐ **셋을 가른다.** 확인=참이면 확인, 확인=거짓인데 시각이 있으면 열람(미확인), 시각도
 * 없으면 미확인이다. 「닫기」로 남은 행이 두 번째다 — 그 사람은 공지를 보긴 봤다.
 */
export const toAckState = (source: NoticeAcknowledgement): AckState => {
  if (source.acknowledged) return 'done';

  return (source.acknowledgedAt ?? null) === null ? 'pending' : 'opened';
};

export const toAckView = (source: NoticeAcknowledgement): AckView => {
  const workerNo = nullable(source.workerNo);
  const workerName = nullable(source.workerName);
  const isWorker = workerNo !== null;

  return {
    who: isWorker ? (workerName ?? workerNo ?? '') : source.userName,
    state: toAckState(source),
    at: nullable(source.acknowledgedAt),
    isWorker,
  };
};

const RFC3339_PATTERN = /^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})/;

/** 서버가 준 벽시계를 옮기지 않고 자른다. 알아볼 수 없으면 원문 그대로 낸다. */
export const formatMoment = (value: string): string => {
  const matched = RFC3339_PATTERN.exec(value);

  if (matched === null) return value;

  return `${matched[1] ?? ''} ${matched[2] ?? ''}`;
};

/** 게시 기간 표기. 종료일이 없으면 그 사실을 적는다 — 빈칸으로 두지 않는다. */
export const formatPeriod = (start: string, end: string | null, noEnd: string): string =>
  end === null ? `${start} ~ ${noEnd}` : `${start} ~ ${end}`;
