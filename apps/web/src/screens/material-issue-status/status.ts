import { messages } from '@omf-mes/i18n';

import { toPlantDateTimeParts } from '../../patterns/plant-time';
import type {
  MaterialIssueDisplayStatus,
  MaterialIssueRequestHistoryItem,
  MaterialIssueRequestLineView,
  MaterialIssueRequestView,
} from './api-types';

const t = messages.materialIssueStatus;

export const DISPLAY_STATUSES: readonly MaterialIssueDisplayStatus[] = [
  'WAITING',
  'RELEASED',
  'IN_PROGRESS',
  'DONE',
  'CANCELLED',
];

/** 칩 색 — 대기 파랑, 배포 주 색, 진행 중 노랑, 완료 초록, 취소 회색(screens/W-02-11.md 「상태 표시」). */
export const STATUS_TONE: Record<
  MaterialIssueDisplayStatus,
  'info' | 'success' | 'warning' | 'idle' | 'error'
> = {
  WAITING: 'info',
  RELEASED: 'info',
  IN_PROGRESS: 'warning',
  DONE: 'success',
  CANCELLED: 'idle',
};

/** 「완료」 칩에 닫힘 사유를 붙인다 — 「완료, W/O 취소」. 모르는 사유 코드는 붙이지 않는다. */
export const statusLabel = (
  request: Pick<MaterialIssueRequestView, 'displayStatus' | 'closeReasonCode'>,
): string => {
  const label = t.status[request.displayStatus];
  const reason =
    request.closeReasonCode === null || request.closeReasonCode === undefined
      ? undefined
      : t.closeReasons[request.closeReasonCode];
  return reason === undefined ? label : t.statusWithReason(label, reason);
};

export const isReleaseFailed = (request: MaterialIssueRequestView): boolean =>
  request.displayStatus === 'WAITING' &&
  request.releaseErrorText !== null &&
  request.releaseErrorText !== undefined &&
  request.releaseErrorText !== '';

/** 화면이 고칠 수 있는 범위(screens/W-02-11.md 「규칙」). */
export type EditScope = 'all' | 'quantity' | 'none';

/**
 * 생산 창고 규칙으로 만든 요청(`sourceWarehouseId` 있음)만 고친다 — 지금 방식 요청은 보기만(R-17).
 * 대기 · 배포는 전부, 진행 중은 수량만(기출고 이상), 완료 · 취소는 보기만.
 */
export const editScope = (request: MaterialIssueRequestView): EditScope => {
  if (request.sourceWarehouseId === null || request.sourceWarehouseId === undefined) return 'none';
  switch (request.displayStatus) {
    case 'WAITING':
    case 'RELEASED':
      return 'all';
    case 'IN_PROGRESS':
      return 'quantity';
    default:
      return 'none';
  }
};

/** 줄 부족 — 저장 부족 + 동적 부족(서버 S8e). */
export const lineShortage = (line: MaterialIssueRequestLineView): number =>
  (line.shortageQty ?? 0) + (line.dynamicShortageQty ?? 0);

/** 요청 「부족 N」 — 저장 부족 합 + 동적 부족 합. */
export const requestShortage = (
  request: Pick<MaterialIssueRequestView, 'shortageQtyTotal' | 'dynamicShortageQtyTotal'>,
): number => request.shortageQtyTotal + request.dynamicShortageQtyTotal;

/** 수량 칸 검사 — 기출고 미만이면 첫 줄의 오류 문구. */
export const quantityError = (
  lines: readonly MaterialIssueRequestLineView[],
  drafts: ReadonlyMap<number, string>,
  itemText: (line: MaterialIssueRequestLineView) => string,
): string | null => {
  for (const line of lines) {
    const draft = drafts.get(line.materialIssueRequestLineId);
    if (draft === undefined) continue;
    const value = Number(draft);
    if (draft.trim() === '' || !Number.isFinite(value) || value < line.issuedQty) {
      return t.detail.lines.belowIssued(itemText(line), formatQty(line.issuedQty));
    }
  }
  return null;
};

export const formatQty = (value: number): string => value.toLocaleString('ko-KR');

/** `YYYY-MM-DD` → `MM-DD(요일)`. 요일 글자는 W-CO-15 와 같은 문구를 쓴다. */
export const formatDay = (iso: string | null | undefined): string => {
  if (iso === null || iso === undefined || iso === '') return '—';
  const day = new Date(`${iso}T12:00:00Z`).getUTCDay();
  return `${iso.slice(5)}(${messages.plantWorkingDays.weekdays[day] ?? ''})`;
};

/** `MM-DD HH:mm`(공장 시각) — 이력 시각은 UTC 로 올 수 있다(G2 3). */
export const plantMinute = (value: string): string => {
  const parts = toPlantDateTimeParts(value);
  return parts === null ? value : `${parts.date.slice(5)} ${parts.time}`;
};

/** 이력 한 줄의 문장 — 서버는 사건 코드와 값만 준다(계약 §1 history). 날짜 값은 `MM-DD(요일)` 로. */
export const historyText = (
  entry: MaterialIssueRequestHistoryItem,
  /** 요청 사유 코드 → 이름(공통코드). 모르면 코드 그대로. */
  reasonName: (code: string) => string = (code) => code,
): string => {
  const e = t.detail.events;
  const d = entry.detail;
  const text = (value: unknown): string =>
    typeof value === 'string' || typeof value === 'number' ? String(value) : '';
  const dayOrText = (value: unknown): string => {
    const raw = text(value);
    return /^\d{4}-\d{2}-\d{2}$/.test(raw) ? formatDay(raw) : raw;
  };
  switch (entry.eventCode) {
    case 'RELEASE_FAILED':
      return e.RELEASE_FAILED(d.errorText ?? '');
    case 'ISSUE_DATE_CHANGED':
      return e.ISSUE_DATE_CHANGED(dayOrText(d.before), dayOrText(d.after));
    case 'SOURCE_CHANGED':
      return e.SOURCE_CHANGED(text(d.before), text(d.after));
    case 'DESTINATION_CHANGED':
      return e.DESTINATION_CHANGED(text(d.before), text(d.after));
    case 'QTY_CHANGED':
      return d.shortageBefore === undefined || d.shortageAfter === undefined
        ? e.QTY_CHANGED(d.itemCode ?? '', text(d.before), text(d.after))
        : e.QTY_CHANGED_SHORTAGE(
            d.itemCode ?? '',
            text(d.before),
            text(d.after),
            String(d.shortageBefore),
            String(d.shortageAfter),
          );
    case 'CANCELLED':
      return e.CANCELLED(d.reason ?? '');
    case 'CLOSED':
      return e.CLOSED(
        d.reason === undefined || d.reason === null ? '' : (t.closeReasons[d.reason] ?? d.reason),
      );
    case 'PLANNED_OVERRIDE':
      return e.PLANNED_OVERRIDE(
        d.reason === undefined || d.reason === null ? '' : reasonName(d.reason),
      );
    default:
      return e[entry.eventCode]();
  }
};

/** 출고 작업일을 고르면 무엇이 일어나는가(날짜 변경 창 안내). */
export const dateEffect = (
  next: string,
  today: string,
  displayStatus: MaterialIssueDisplayStatus,
): string => {
  if (next === '') return t.dateDialog.pickFirst;
  if (next <= today) return t.dateDialog.releaseNow;
  if (displayStatus === 'RELEASED') return t.dateDialog.backToWaiting(formatDay(next));
  return t.dateDialog.scheduled(formatDay(next));
};
