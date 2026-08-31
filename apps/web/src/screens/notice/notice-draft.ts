import type { components } from '@omf-mes/api-client';
import { messages } from '@omf-mes/i18n';

import { isSupportedScope, needsWorkOrder } from './codes';
import type { NoticeView } from './types';

/**
 * 공지 작성·수정 폼의 편집 상태.
 *
 * ⭐ **범위와 작업지시는 짝이다.** 범위가 작업지시면 작업지시가 있어야 하고, 아니면 비워야
 * 한다 — 짝이 어긋나면 서버가 거부한다. 화면이 먼저 가른다.
 *
 * ⚠ **1차에 쓸 수 없는 범위를 고르면 저장 전에 막는다** — 보내면 서버가 거부하는데, 그때는
 * 이미 사람이 본문을 다 쓴 뒤다.
 *
 * **순수 함수만 둔다.** 「지금」을 읽지 않는다.
 *
 * 이 화면이 소유한다 — 다른 화면 슬라이스의 같은 이름 파일을 참조하지 않는다.
 */

const t = messages.notice;

type NoticeCreate = components['schemas']['NoticeCreate'];

export interface NoticeDraft {
  title: string;
  body: string;
  startDate: string;
  endDate: string;
  acknowledgeRequired: boolean;
  scopeCode: string;
  workOrder: string;
}

export const EMPTY_DRAFT: NoticeDraft = {
  title: '',
  body: '',
  startDate: '',
  endDate: '',
  acknowledgeRequired: false,
  scopeCode: '',
  workOrder: '',
};

export const toDraft = (view: NoticeView): NoticeDraft => ({
  title: view.title,
  body: view.body,
  startDate: view.startDate,
  endDate: view.endDate ?? '',
  acknowledgeRequired: view.acknowledgeRequired,
  scopeCode: view.scopeCode,
  workOrder: view.targetWorkOrderId === null ? '' : String(view.targetWorkOrderId),
});

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

export type DraftErrors = Partial<Record<keyof NoticeDraft, string>>;

export const validateDraft = (draft: NoticeDraft): DraftErrors => {
  const errors: DraftErrors = {};

  if (draft.title.trim() === '') errors.title = t.form.requiredTitle;
  if (draft.body.trim() === '') errors.body = t.form.requiredBody;

  if (draft.startDate === '') {
    errors.startDate = t.form.requiredStartDate;
  } else if (!isCalendarDate(draft.startDate)) {
    errors.startDate = t.form.invalidDate;
  }

  if (draft.endDate !== '') {
    if (!isCalendarDate(draft.endDate)) {
      errors.endDate = t.form.invalidDate;
    } else if (draft.startDate !== '' && draft.endDate < draft.startDate) {
      errors.endDate = t.form.invalidEndDate;
    }
  }

  if (draft.scopeCode === '') {
    errors.scopeCode = t.form.requiredScope;
  } else if (!isSupportedScope(draft.scopeCode)) {
    errors.scopeCode = t.form.unsupportedScope;
  }

  /* ⭐ 짝 제약 — 어긋나면 서버가 거부한다. */
  if (needsWorkOrder(draft.scopeCode)) {
    if (draft.workOrder === '') errors.workOrder = t.form.requiredWorkOrder;
  } else if (draft.workOrder !== '') {
    errors.workOrder = t.form.workOrderNotAllowed;
  }

  return errors;
};

export const hasErrors = (errors: DraftErrors): boolean => Object.keys(errors).length > 0;

/**
 * 편집 상태를 요청 본문으로 옮긴다.
 *
 * ⛔ **상태를 싣지 않는다** — 서버가 게시 여부와 오늘 날짜로 파생한다.
 * ⛔ **범위가 작업지시가 아니면 작업지시를 싣지 않는다** — 짝이 어긋나면 거부된다.
 * ⛔ **종료일이 비면 싣지 않는다** — 「종료일 없이 계속」과 「빈 날짜」는 다른 뜻이다.
 */
export const toCreateBody = (draft: NoticeDraft): NoticeCreate => ({
  title: draft.title.trim(),
  body: draft.body.trim(),
  startDate: draft.startDate,
  acknowledgeRequired: draft.acknowledgeRequired,
  /*
   * 계약이 값 목록을 다섯으로 좁혀 두었다. 여기까지 온 값은 `validateDraft` 가 이미
   * 「1차에 쓸 수 있는 둘」로 걸러 낸 것이라 안전하다.
   */
  scopeCode: draft.scopeCode as NoticeCreate['scopeCode'],
  ...(draft.endDate === '' ? {} : { endDate: draft.endDate }),
  ...(needsWorkOrder(draft.scopeCode) ? { targetWorkOrderId: Number(draft.workOrder) } : {}),
});
