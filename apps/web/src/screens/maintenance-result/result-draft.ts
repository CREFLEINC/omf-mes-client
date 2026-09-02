import type { components } from '@omf-mes/api-client';
import { messages } from '@omf-mes/i18n';

import { EQUIPMENT_TARGET } from './types';

/**
 * 실적 등록 폼의 편집 상태와 그 판정.
 *
 * ⭐ **수행자와 외주는 짝 제약이다** — 계약이 「짝 제약은 화면이 진다」로 넘겼다. 외주면
 * 수행자를 비우고 업체 이름을 채운다. 화면이 막지 않으면 둘 다 채운 실적이 남고, 나중에
 * 「누가 했는가」를 셀 때 같은 건이 양쪽에 잡힌다.
 *
 * ⛔ **누계 리셋을 다루지 않는다** — 툴 예방보전 실적의 몫이다. 여기서 함께 다루면 낙관적
 * 잠금이 필요한 쓰기와 아닌 쓰기가 한 폼에 섞인다.
 *
 * **순수 함수만 둔다.** 「지금」을 읽지 않는다 — 시작 시각에 미래를 막는 규칙은 계약에도
 * 스펙에도 없고, 화면이 지어내면 늦게 적는 건을 못 적는다.
 *
 * 이 화면이 소유한다 — 다른 화면 슬라이스의 같은 이름 파일을 참조하지 않는다.
 */

const t = messages.maintenanceResult;

type MaintenanceResultCreate = components['schemas']['MaintenanceResultCreate'];

/** 폼이 들고 있는 예비품 한 줄. **출고 건은 고르기만 한다** — 만들지 않는다. */
export interface PartDraft {
  key: string;
  sparePartId: string;
  /**
   * 고를 때 마스터에서 푼 이름. 계약이 이 칸을 **필수**로 두어 비워 보낼 수 없다.
   * ⛔ 사용자가 고치는 칸이 아니다 — 고친 이름이 마스터와 갈리면 같은 예비품이 두 이름으로 남는다.
   */
  partName: string;
  usedQty: string;
  goodsIssueId: string;
}

export interface ResultDraft {
  target: string;
  order: string;
  startedAt: string;
  finishedAt: string;
  resultNote: string;
  performer: string;
  isOutsourced: boolean;
  vendorName: string;
  closed: boolean;
  parts: PartDraft[];
}

export const EMPTY_DRAFT: ResultDraft = {
  target: '',
  order: '',
  startedAt: '',
  finishedAt: '',
  resultNote: '',
  performer: '',
  isOutsourced: false,
  vendorName: '',
  closed: false,
  parts: [],
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

/** 수량은 0보다 큰 수여야 한다. 0을 적는 것은 「쓰지 않았다」이고 그 줄은 없어야 한다. */
const isPositiveQty = (value: string): boolean => {
  const parsed = Number(value);

  return value.trim() !== '' && Number.isFinite(parsed) && parsed > 0;
};

export type DraftErrors = Partial<Record<keyof ResultDraft, string>>;

export const validateDraft = (draft: ResultDraft): DraftErrors => {
  const errors: DraftErrors = {};

  if (draft.target === '') errors.target = t.form.requiredTarget;

  if (draft.startedAt === '') {
    errors.startedAt = t.form.requiredStartedAt;
  } else if (!isCalendarDate(draft.startedAt)) {
    errors.startedAt = t.filters.periodInvalid;
  }

  if (draft.finishedAt !== '') {
    if (!isCalendarDate(draft.finishedAt)) {
      errors.finishedAt = t.filters.periodInvalid;
    } else if (draft.startedAt !== '' && draft.finishedAt < draft.startedAt) {
      errors.finishedAt = t.form.invalidFinishedAt;
    }
  }

  if (draft.resultNote.trim() === '') errors.resultNote = t.form.requiredResultNote;

  /*
   * ⭐ 짝 제약. 외주면 수행자를 **비워야** 하고, 외주가 아니면 수행자가 **있어야** 한다 —
   * 둘 다 채운 실적이 남으면 「누가 했는가」를 셀 때 같은 건이 양쪽에 잡힌다.
   */
  if (draft.isOutsourced) {
    if (draft.vendorName.trim() === '') errors.vendorName = t.form.requiredVendor;
    if (draft.performer !== '') errors.performer = t.form.outsourcedPerformer;
  } else if (draft.performer === '') {
    errors.performer = t.form.requiredPerformer;
  }

  if (draft.parts.some((part) => !isPositiveQty(part.usedQty))) {
    errors.parts = t.form.requiredPartQty;
  } else {
    const ids = draft.parts.map((part) => part.sparePartId).filter((id) => id !== '');

    /* 같은 예비품이 두 줄이면 합계가 갈려 「얼마나 썼는가」가 두 값이 된다. */
    if (new Set(ids).size !== ids.length) errors.parts = t.form.duplicatePart;
  }

  return errors;
};

export const hasErrors = (errors: DraftErrors): boolean => Object.keys(errors).length > 0;

/**
 * 날짜만 고른 값을 계약이 받는 시각으로 만든다.
 *
 * ⚠ **DST가 없는 시간대를 전제로 고정 오프셋을 찍는다.** 대상 지역(한국 UTC+9 · 베트남 UTC+7)에
 * 서머타임이 없어 성립한다. 화면이 날짜만 받는 이유는 보전 실적의 시각이 분 단위로 다투는 값이
 * 아니어서이고, 시각까지 받아야 하면 이 함수부터 고친다.
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
 * ⛔ **누계 리셋을 싣지 않는다** — 이 화면의 일이 아니다. 실으면 낙관적 잠금이 필요해지는데
 * 이 폼은 그 토큰을 갖고 있지 않다.
 * ⛔ **항목·부위별 결과(`lines`)를 싣지 않는다** — 결과 값 목록이 아직 없어 채울 수 없다.
 * 지어낸 값을 실으면 서버가 거부하거나 아무도 모르는 결과가 원장에 남는다.
 */
export const toCreateBody = (
  draft: ResultDraft,
  offsetMinutes: number,
): MaintenanceResultCreate => ({
  targetTypeCode: EQUIPMENT_TARGET,
  targetId: Number(draft.target),
  startedAt: toMoment(draft.startedAt, offsetMinutes),
  resultNote: draft.resultNote.trim(),
  isOutsourced: draft.isOutsourced,
  closed: draft.closed,
  ...(draft.order === '' ? {} : { maintenanceOrderId: Number(draft.order) }),
  ...(draft.finishedAt === '' ? {} : { finishedAt: toMoment(draft.finishedAt, offsetMinutes) }),
  ...(draft.isOutsourced
    ? { outsourceVendorName: draft.vendorName.trim() }
    : { performedByUserId: Number(draft.performer) }),
  ...(draft.parts.length === 0
    ? {}
    : {
        parts: draft.parts.map((part) => ({
          sparePartId: Number(part.sparePartId),
          /* 고를 때 마스터에서 푼 이름을 그대로 보낸다 — 계약이 필수로 두었다. */
          partName: part.partName,
          usedQty: Number(part.usedQty),
          ...(part.goodsIssueId === '' ? {} : { goodsIssueId: Number(part.goodsIssueId) }),
        })),
      }),
});
