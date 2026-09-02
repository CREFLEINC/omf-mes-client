import type { components } from '@omf-mes/api-client';
import { messages } from '@omf-mes/i18n';

/**
 * 툴 PM 실적 폼의 편집 상태와 그 판정.
 *
 * ⭐ **누계 리셋은 「바꾸기」다.** 사용실적 입력(더하기)과 축이 달라, 이쪽에만 저장 충돌
 * 보호가 걸린다 — 더하기는 여러 단말이 동시에 기여하므로 잠그면 현장이 멎는다.
 *
 * ⛔ **화면이 툴 마스터를 고치지 않는다.** 보내는 것은 「되돌린다」는 뜻(`resetCounter`)과
 * 되돌린 뒤의 시작값뿐이고, 누계를 직접 쓰지 않는다. 리셋 직전 누계도 **서버가** 얼려 둔다.
 *
 * **순수 함수만 둔다.** 「지금」을 읽지 않는다.
 *
 * 이 화면이 소유한다 — 다른 화면 슬라이스의 같은 이름 파일을 참조하지 않는다.
 */

const t = messages.toolPmResult;

type MaintenanceResultCreate = components['schemas']['MaintenanceResultCreate'];

/** 이 화면이 만드는 실적의 대상은 툴이다. */
export const MOLD_TARGET = 'MOLD';

export interface ToolResultDraft {
  tool: string;
  order: string;
  startedAt: string;
  finishedAt: string;
  resultNote: string;
  performer: string;
  isOutsourced: boolean;
  vendorName: string;
  resetCounter: boolean;
  /** 되돌린 뒤 시작값. **0도 값이다** — 빈 문자열과 가른다. */
  shotAfterReset: string;
  closed: boolean;
}

export const EMPTY_DRAFT: ToolResultDraft = {
  tool: '',
  order: '',
  startedAt: '',
  finishedAt: '',
  resultNote: '',
  performer: '',
  isOutsourced: false,
  vendorName: '',
  resetCounter: false,
  shotAfterReset: '0',
  closed: false,
};

const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

export const isCalendarDate = (value: string): boolean => {
  const match = DATE_PATTERN.exec(value);
  if (match === null) return false;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(year, month - 1, day);

  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
};

/** 0 이상의 정수인가. **0을 빈 값과 가른다** — 되돌린 뒤 시작값은 보통 0이다. */
const isNonNegativeInteger = (value: string): boolean => /^\d+$/.test(value.trim());

/** 마감은 오더가 있을 때만 뜻이 있다 — 없으면 닫을 것이 없다. */
export const canClose = (draft: ToolResultDraft): boolean => draft.order !== '';

export type DraftErrors = Partial<Record<keyof ToolResultDraft, string>>;

export const validateDraft = (draft: ToolResultDraft): DraftErrors => {
  const errors: DraftErrors = {};

  if (draft.tool === '') errors.tool = t.form.requiredTool;

  if (draft.startedAt === '') {
    errors.startedAt = t.form.requiredStartedAt;
  } else if (!isCalendarDate(draft.startedAt)) {
    errors.startedAt = t.form.invalidDate;
  }

  if (draft.finishedAt !== '') {
    if (!isCalendarDate(draft.finishedAt)) {
      errors.finishedAt = t.form.invalidDate;
    } else if (draft.startedAt !== '' && draft.finishedAt < draft.startedAt) {
      errors.finishedAt = t.form.invalidFinishedAt;
    }
  }

  if (draft.resultNote.trim() === '') errors.resultNote = t.form.requiredResultNote;

  /* 짝 제약 — 외주면 수행자를 비우고, 아니면 수행자가 있어야 한다. */
  if (draft.isOutsourced) {
    if (draft.vendorName.trim() === '') errors.vendorName = t.form.requiredVendor;
    if (draft.performer !== '') errors.performer = t.form.outsourcedPerformer;
  } else if (draft.performer === '') {
    errors.performer = t.form.requiredPerformer;
  }

  /*
   * ⭐ 되돌리기를 켰으면 시작값이 **반드시** 있어야 한다(계약: 「참이면 shotCountAfterReset 을
   * 함께 보낸다」). 0도 값이므로 빈 문자열과 가른다.
   */
  if (draft.resetCounter) {
    if (draft.shotAfterReset.trim() === '') {
      errors.shotAfterReset = t.form.requiredShotAfterReset;
    } else if (!isNonNegativeInteger(draft.shotAfterReset)) {
      errors.shotAfterReset = t.form.invalidShotAfterReset;
    }
  }

  return errors;
};

export const hasErrors = (errors: DraftErrors): boolean => Object.keys(errors).length > 0;

/**
 * 날짜만 고른 값을 계약이 받는 시각으로 만든다.
 *
 * ⚠ DST가 없는 시간대를 전제로 고정 오프셋을 찍는다 — 대상 지역에 서머타임이 없어 성립한다.
 */
export const toMoment = (date: string, offsetMinutes: number): string => {
  const sign = offsetMinutes < 0 ? '-' : '+';
  const absolute = Math.abs(offsetMinutes);
  const hours = String(Math.floor(absolute / 60)).padStart(2, '0');
  const minutes = String(absolute % 60).padStart(2, '0');

  return `${date}T00:00:00${sign}${hours}:${minutes}`;
};

/**
 * 편집 상태를 요청 본문으로 옮긴다.
 *
 * ⛔ **누계를 보내지 않는다** — 보내는 것은 「되돌린다」는 뜻과 되돌린 뒤의 시작값뿐이다.
 * 리셋 직전 누계는 서버가 저장 시점 값으로 얼린다.
 * ⛔ **되돌리기를 끄면 시작값을 싣지 않는다** — 실으면 서버가 되돌린 것으로 읽을 수 있다.
 * ⛔ **오더가 없으면 마감을 싣지 않는다** — 닫을 것이 없는데 참을 보내면 뜻이 없다.
 * ⛔ **부위(`lines`)를 싣지 않는다** — 결과 값 목록이 아직 없어 채울 수 없다.
 */
export const toCreateBody = (
  draft: ToolResultDraft,
  offsetMinutes: number,
): MaintenanceResultCreate => ({
  targetTypeCode: MOLD_TARGET,
  targetId: Number(draft.tool),
  startedAt: toMoment(draft.startedAt, offsetMinutes),
  resultNote: draft.resultNote.trim(),
  isOutsourced: draft.isOutsourced,
  resetCounter: draft.resetCounter,
  closed: canClose(draft) && draft.closed,
  ...(draft.order === '' ? {} : { maintenanceOrderId: Number(draft.order) }),
  ...(draft.finishedAt === '' ? {} : { finishedAt: toMoment(draft.finishedAt, offsetMinutes) }),
  ...(draft.isOutsourced
    ? { outsourceVendorName: draft.vendorName.trim() }
    : { performedByUserId: Number(draft.performer) }),
  ...(draft.resetCounter ? { shotCountAfterReset: Number(draft.shotAfterReset.trim()) } : {}),
});
