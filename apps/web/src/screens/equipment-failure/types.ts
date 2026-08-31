import type { components } from '@omf-mes/api-client';
import { messages } from '@omf-mes/i18n';

/**
 * W-05-04가 다루는 모양들.
 *
 * ⭐ **이 화면의 자료는 사건 기록이다.** 전표와 달리 상태를 되돌리는 길이 없고, 현장이 적은
 * 칸과 사무가 적는 칸이 갈려 있다. 그 갈림을 타입이 드러내도록 뷰를 둘로 나눈다.
 *
 * 이 화면이 소유한다 — 다른 화면 슬라이스의 같은 이름 파일을 참조하지 않는다.
 */

const t = messages.equipmentFailure;

type Breakdown = components['schemas']['Breakdown'];

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

/** 접수 → 처리중 → 완료. **되돌리는 경로가 없다.** */
export const RECEIVED_STATUS = 'RECEIVED';
export const HANDLING_STATUS = 'HANDLING';
export const DONE_STATUS = 'DONE';

/** 발생 상태 — 계약이 이름을 준 둘이다. */
export const STOPPED_STATE = 'STOPPED';
export const ABNORMAL_STATE = 'ABNORMAL';

/** 상태 코드의 이름. 모르는 값이면 코드를 그대로 보인다 — 「알 수 없음」을 쓰지 않는다. */
export const statusLabel = (code: string): string => {
  switch (code) {
    case RECEIVED_STATUS:
      return t.status.received;
    case HANDLING_STATUS:
      return t.status.handling;
    case DONE_STATUS:
      return t.status.done;
    default:
      return code;
  }
};

export const occurrenceLabel = (code: string): string => {
  switch (code) {
    case STOPPED_STATE:
      return t.occurrence.stopped;
    case ABNORMAL_STATE:
      return t.occurrence.abnormal;
    default:
      return code;
  }
};

/** 현장이 적은 것 — **사무가 고치지 않는다.** */
export interface BreakdownReportView {
  breakdownId: number;
  breakdownNo: string | null;
  equipmentId: number;
  equipmentCode: string | null;
  symptom: string;
  occurrenceStateCode: string;
  stoppedAt: string | null;
  reportedAt: string;
  reporterWorkerNo: string;
  statusCode: string;
}

/** 사무가 적는 것. 상세 응답에서만 온다. */
export interface BreakdownHandlingView {
  causeCode: string | null;
  handlingNote: string | null;
  handledAt: string | null;
  maintenanceOrderId: number | null;
}

export interface BreakdownDetailView extends BreakdownReportView {
  handling: BreakdownHandlingView;
  /** ⚠ 목록에서는 늘 0이다 — 상세 응답에서만 채워진다. */
  linkedDowntimeCount: number;
  /** 끝나지 않은 구간이 있으면 그 몫이 빠져 `null`이다. */
  linkedDowntimeMinutes: number | null;
  openLinkedDowntimeCount: number;
  attachmentCount: number;
}

export interface BreakdownListResult {
  items: BreakdownReportView[];
  page: PageMeta;
}

const nullable = <T>(value: T | null | undefined): T | null => value ?? null;

export const toReportView = (source: Breakdown): BreakdownReportView => ({
  breakdownId: source.breakdownId,
  breakdownNo: nullable(source.breakdownNo),
  equipmentId: source.equipmentId,
  equipmentCode: nullable(source.equipmentCode),
  symptom: source.symptom,
  occurrenceStateCode: source.occurrenceStateCode,
  stoppedAt: nullable(source.stoppedAt),
  reportedAt: source.reportedAt,
  reporterWorkerNo: source.reporterWorkerNo,
  statusCode: source.statusCode,
});

export const toDetailView = (source: Breakdown): BreakdownDetailView => ({
  ...toReportView(source),
  handling: {
    causeCode: nullable(source.handling?.causeCode),
    handlingNote: nullable(source.handling?.handlingNote),
    handledAt: nullable(source.handling?.handledAt),
    maintenanceOrderId: nullable(source.handling?.maintenanceOrderId),
  },
  linkedDowntimeCount: source.linkedDowntimeCount ?? 0,
  linkedDowntimeMinutes: nullable(source.linkedDowntimeMinutes),
  openLinkedDowntimeCount: source.openLinkedDowntimeCount ?? 0,
  attachmentCount: source.attachments?.length ?? 0,
});

const RFC3339_PATTERN = /^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})/;

/**
 * 서버가 준 시각을 「YYYY-MM-DD HH:mm」으로 자른다.
 *
 * ⭐ **옮기지 않고 자른다.** 현장이 고장을 본 시각이라 보고한 쪽의 벽시계가 정본이다 —
 * 보는 사람의 시간대로 옮기면 같은 사건이 사람마다 다른 시각으로 보인다.
 * 알아볼 수 없으면 원문을 그대로 낸다 — 감추면 되짚을 단서가 사라진다.
 */
export const formatMoment = (value: string): string => {
  const matched = RFC3339_PATTERN.exec(value);

  if (matched === null) return value;

  return `${matched[1] ?? ''} ${matched[2] ?? ''}`;
};
