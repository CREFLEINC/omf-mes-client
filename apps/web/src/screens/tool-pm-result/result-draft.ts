import type { components } from '@omf-mes/api-client';
import { messages } from '@omf-mes/i18n';

/**
 * 툴 PM 실적 폼의 편집 상태와 그 판정.
 *
 * ⛔ **누계 리셋·마감을 드러내지 않는다.** 서버 v0.1.2 는 `POST /maintenance/results`의
 * `resetCounter=true`·`closed=true`를 **항상 422 INVALID**로 거부한다(통보 113·114 · 대응표
 * 「보전 실적 마감·리셋」). 그래서 이 화면은 두 동작을 폼에서 아예 걷어냈다 — 절대 성공할 수
 * 없는 조작을 보여 주면 사용자가 누른 뒤에야 실패를 안다.
 *
 * ⭐ 응답 필드(`resetCounter`·`shotCountBeforeReset`·`shotCountAfterReset`)는 **기존 이력을
 * 보여주는 읽기 전용으로만** 남는다 — 막힌 것은 새로 리셋을 «거는» 쓰기뿐이다(`types.ts`
 * `toToolResultView`, 이 화면 목록 칸).
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
 * ⛔ **누계 리셋·마감을 싣지 않는다** — 서버 v0.1.2 는 `resetCounter=true`·`closed=true`를
 * 항상 422 INVALID 로 거부한다(통보 113·114). 이 화면은 두 필드를 아예 보내지 않는다(생략) —
 * 계약이 둘 다 선택 필드로 두어 생략이 허용된다.
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
  ...(draft.order === '' ? {} : { maintenanceOrderId: Number(draft.order) }),
  ...(draft.finishedAt === '' ? {} : { finishedAt: toMoment(draft.finishedAt, offsetMinutes) }),
  ...(draft.isOutsourced
    ? { outsourceVendorName: draft.vendorName.trim() }
    : { performedByUserId: Number(draft.performer) }),
});
