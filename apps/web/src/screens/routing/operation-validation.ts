import { messages } from '@omf-mes/i18n';

import type { OperationDraft } from './types';

const t = messages.routing.validation;

/**
 * 공정 라인 편집 창이 소유한 입력칸 이름.
 *
 * 라인 저장(전체 치환)의 서버 오류는 **어느 행의 오류인지 계약이 알려 주지 않는다** —
 * 그래서 그 실패는 전부 배너로 올리고, 이 목록은 편집 창 안의 로컬 검증에만 쓴다.
 */
export const OPERATION_FORM_FIELDS: readonly string[] = [
  'processId',
  'operationName',
  'standardCycleTimeSec',
  'standardYieldRate',
];

/** 빈 값은 「지정하지 않음」이라 검사 대상이 아니다. 0과 구분해야 한다. */
const isBlank = (value: string): boolean => value === '';

/**
 * 보내기 전에 화면에서 잡을 수 있는 것만 잡는다.
 *
 * 라인 저장은 목록 전체를 한 번에 보내므로 **한 행의 잘못이 전체 저장을 무르게 한다** —
 * 그래서 행이 표에 들어오기 전에 여기서 거른다.
 *
 * 공정 중복·순서 충돌은 검사하지 않는다. 계약이 그 판정을 서버 몫으로 두었고
 * 화면이 흉내 내면 서버와 다른 답을 낼 수 있다.
 */
export const validateOperationDraft = (draft: OperationDraft): Record<string, string> => {
  const errors: Record<string, string> = {};

  if (isBlank(draft.processId)) {
    errors.processId = t.required;
  }

  if (isBlank(draft.operationName)) {
    errors.operationName = t.required;
  } else if (draft.operationName.trim() === '') {
    errors.operationName = t.operationNameBlank;
  }

  // 단위는 초이고 계약이 CHECK > 0을 걸었다 — 0은 「없음」이 아니라 위반이다.
  if (!isBlank(draft.standardCycleTimeSec)) {
    const seconds = Number(draft.standardCycleTimeSec);

    if (!Number.isFinite(seconds) || seconds <= 0) {
      errors.standardCycleTimeSec = t.cycleTimeInvalid;
    }
  }

  // 0~1 비율이며 퍼센트가 아니다. 98이 들어오면 여기서 막힌다.
  if (!isBlank(draft.standardYieldRate)) {
    const rate = Number(draft.standardYieldRate);

    if (!Number.isFinite(rate) || rate < 0 || rate > 1) {
      errors.standardYieldRate = t.yieldRateInvalid;
    }
  }

  return errors;
};

/**
 * 목록에 저장할 수 없는 행이 섞여 있는가.
 *
 * 서버가 준 값도 대상이다 — 화면이 만든 행만 검사하면, 값이 어긋난 채 저장된 옛 행이
 * 전체 치환에 그대로 실려 나가 저장 전체가 거부된다.
 */
export const hasIncompleteDraft = (drafts: OperationDraft[]): boolean =>
  drafts.some((draft) => Object.keys(validateOperationDraft(draft)).length > 0);
