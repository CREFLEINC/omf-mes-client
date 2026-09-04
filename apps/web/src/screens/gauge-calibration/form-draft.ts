import type { components } from '@omf-mes/api-client';
import { messages } from '@omf-mes/i18n';

import { CALIBRATION_TYPE_CODE, PASS_RESULT_CODE } from './code-options';
import { isCalendarDate } from './filters';

/**
 * 등록 폼의 편집 상태와 그 판정.
 *
 * ⛔ **이력은 저장하면 고칠 수 없다.** 그래서 판정을 서버에 미루지 않고 화면이 먼저 본다 —
 * 저장 뒤에 「날짜를 잘못 넣었다」를 알아도 지울 길이 없고, 남는 것은 정정 이력 한 줄이 더
 * 붙은 원장이다.
 *
 * **순수 함수만 둔다.** 「오늘」을 읽지 않는다 — 실시일에 미래를 막는 규칙은 계약에도 스펙에도
 * 없고, 화면이 지어내면 성적서가 늦게 도착한 건을 못 적는다.
 *
 * 이 화면이 소유한다 — 다른 화면 슬라이스의 같은 이름 파일을 참조하지 않는다.
 */

const t = messages.gaugeCalibration;

type CalibrationCreate = components['schemas']['CalibrationCreate'];

export interface CalibrationDraft {
  equipment: string;
  historyTypeCode: string;
  performedOn: string;
  resultCode: string;
  certificateNo: string;
  agencyTypeCode: string;
  agencyName: string;
  nextDueOn: string;
  toleranceNote: string;
  remarks: string;
  /**
   * 이 이력이 계측기 사용을 막는가. 계약 필수(2026-09-02 사용자 결정) — 사용 가부 판정이
   * 이력 유형 문자열 대신 이 값과 `clearedAt`을 읽는다(W-05-11 §5-2). 기본은 막지 않음이다.
   */
  blocksUse: boolean;
}

export const EMPTY_DRAFT: CalibrationDraft = {
  equipment: '',
  historyTypeCode: '',
  performedOn: '',
  resultCode: '',
  certificateNo: '',
  agencyTypeCode: '',
  agencyName: '',
  nextDueOn: '',
  toleranceNote: '',
  remarks: '',
  blocksUse: false,
};

/**
 * 검교정 전용 칸이 열리는가. ⭐ **유형이 검교정일 때만** 열린다.
 *
 * ⛔ 감추지 않고 **비활성 + 사유**로 둔다 — 감추면 「이 칸이 있었나」를 사용자가 알 수 없고,
 * 다른 유형을 고른 뒤 왜 사라졌는지도 모른다.
 */
export const isCalibrationType = (draft: CalibrationDraft): boolean =>
  draft.historyTypeCode === CALIBRATION_TYPE_CODE;

/**
 * 이 이력이 계측기 마스터를 갱신하는가.
 *
 * ⭐ **검교정 유형이고 결과가 합격일 때만**이다. 불합격이면 갱신하지 않는다 — 유효기한이
 * 늘어나면 안 된다. 점검·수리·폐기도 갱신하지 않는다.
 *
 * 판정을 서버가 하지만 **화면도 같은 판정을 한다** — 저장 전에 「무엇이 함께 바뀌는가」를
 * 사람에게 말해야 하기 때문이다. 둘이 갈리면 화면 쪽이 틀린 것이니 이 함수를 고친다.
 */
export const updatesMaster = (draft: CalibrationDraft): boolean =>
  isCalibrationType(draft) && draft.resultCode === PASS_RESULT_CODE;

/** 칸별 오류. 비어 있으면 저장할 수 있다. */
export type DraftErrors = Partial<Record<keyof CalibrationDraft, string>>;

export const validateDraft = (draft: CalibrationDraft): DraftErrors => {
  const errors: DraftErrors = {};

  if (draft.equipment === '') errors.equipment = t.form.requiredEquipment;
  if (draft.historyTypeCode === '') errors.historyTypeCode = t.form.requiredHistoryType;
  if (draft.resultCode === '') errors.resultCode = t.form.requiredResult;

  if (draft.performedOn === '') {
    errors.performedOn = t.form.requiredPerformedOn;
  } else if (!isCalendarDate(draft.performedOn)) {
    errors.performedOn = t.form.invalidPerformedOn;
  }

  if (draft.nextDueOn !== '') {
    if (!isCalendarDate(draft.nextDueOn)) {
      errors.nextDueOn = t.form.invalidNextDueOn;
    } else if (draft.performedOn !== '' && draft.nextDueOn < draft.performedOn) {
      /*
       * ⭐ 유효기한이 실시일보다 앞설 수 없다. 계약이 막지 않는 짝 제약이라 화면이 진다 —
       * 막지 않으면 이미 지난 기한으로 계측기가 갱신되고, 되돌릴 길이 없다.
       */
      errors.nextDueOn = t.form.nextDueBeforePerformed;
    }
  }

  return errors;
};

export const hasErrors = (errors: DraftErrors): boolean => Object.keys(errors).length > 0;

/** 빈 문자열은 「값 없음」이다 — 서버에 빈 글자를 보내면 그것이 값으로 저장된다. */
const optionalText = (value: string): string | undefined => {
  const trimmed = value.trim();

  return trimmed === '' ? undefined : trimmed;
};

/**
 * 편집 상태를 요청 본문으로 옮긴다.
 *
 * ⭐ **검교정이 아니면 검교정 전용 칸을 아예 싣지 않는다.** 화면이 잠가 둔 칸에 값이 남아
 * 있을 수 있는데(유형을 바꾸기 전에 적었다면), 그것을 그대로 보내면 점검 이력에 성적서 번호가
 * 붙는다 — 화면에는 보이지 않으므로 아무도 눈치채지 못한다.
 */
export const toCreateBody = (draft: CalibrationDraft): CalibrationCreate => {
  const calibrationOnly = isCalibrationType(draft);

  return {
    equipmentId: Number(draft.equipment),
    historyTypeCode: draft.historyTypeCode,
    performedOn: draft.performedOn,
    resultCode: draft.resultCode,
    ...(calibrationOnly
      ? {
          ...(optionalText(draft.certificateNo) === undefined
            ? {}
            : { certificateNo: optionalText(draft.certificateNo) }),
          ...(optionalText(draft.agencyTypeCode) === undefined
            ? {}
            : { agencyTypeCode: optionalText(draft.agencyTypeCode) }),
          ...(optionalText(draft.agencyName) === undefined
            ? {}
            : { agencyName: optionalText(draft.agencyName) }),
          ...(draft.nextDueOn === '' ? {} : { nextDueOn: draft.nextDueOn }),
          ...(optionalText(draft.toleranceNote) === undefined
            ? {}
            : { toleranceNote: optionalText(draft.toleranceNote) }),
        }
      : {}),
    ...(optionalText(draft.remarks) === undefined ? {} : { remarks: optionalText(draft.remarks) }),
    blocksUse: draft.blocksUse,
  };
};
