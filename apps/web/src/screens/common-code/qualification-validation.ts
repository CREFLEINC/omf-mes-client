import { messages } from '@omf-mes/i18n';

import { duplicateKeyOf, type QualificationDraft } from './qualification-draft';

const t = messages.commonCode.qualification.validation;

/** 계약이 정한 상한. 상한 자체는 허용값이며 그것을 **넘을 때만** 막는다. */
const CERTIFICATE_NO_MAX = 100;

/**
 * 자격 편집 창이 소유한 입력칸 이름. 서버가 준 필드 오류를 인라인으로 낼지
 * 배너로 올릴지 가르는 기준이며, 목록에 없는 필드명은 삼키지 않고 배너로 간다.
 */
export const QUALIFICATION_FORM_FIELDS: readonly string[] = [
  'qualificationTypeCode',
  'processId',
  'certificateNo',
  'validFrom',
  'validTo',
];

/**
 * 창의 확인을 막을 수 있는 것만 잡는다.
 *
 * **중복 짝은 `COALESCE(process_id,0)`으로 접어 센다** — 계약의 유일 제약이 그렇게 접히므로
 * 공정을 비운 두 줄은 서버에게 같은 짝이다. 화면이 다르게 세면 저장 시점에야 거부된다.
 *
 * **자기 자신은 중복으로 세지 않는다** — 수정할 때 유형·공정을 그대로 두는 것이 정상이다.
 *
 * 유효기간은 **둘 다 있을 때만** 앞뒤를 본다. 한쪽만 있는 것은 계약이 허용한다
 * (종료를 비우면 무기한이다).
 */
export const validateQualificationDraft = (
  draft: QualificationDraft,
  others: readonly QualificationDraft[],
): Record<string, string> => {
  const errors: Record<string, string> = {};

  if (draft.qualificationTypeCode === '') {
    errors.qualificationTypeCode = t.required;
  }

  if (draft.validFrom === '') {
    errors.validFrom = t.required;
  }

  if (draft.certificateNo.trim().length > CERTIFICATE_NO_MAX) {
    errors.certificateNo = t.certificateNoTooLong;
  }

  if (draft.validFrom !== '' && draft.validTo !== '' && draft.validTo < draft.validFrom) {
    // 어느 칸을 고쳐야 하는지 한쪽만 짚으면 다른 칸이 옳다는 뜻이 된다 — 짝 오류는 두 칸에 낸다.
    errors.validFrom = t.validRangeReversed;
    errors.validTo = t.validRangeReversed;
  }

  if (errors.qualificationTypeCode === undefined) {
    const key = duplicateKeyOf(draft);
    const isDuplicate = others.some(
      (other) => other.draftId !== draft.draftId && duplicateKeyOf(other) === key,
    );

    if (isDuplicate) errors.qualificationTypeCode = t.duplicatePair;
  }

  return errors;
};

/**
 * 이미 겹쳐 있는 줄의 초안 키.
 *
 * **서버가 준 목록에 이미 중복 짝이 있을 수 있다**(옛 자료). 그대로 보내면 서버가 거부하므로
 * 저장을 막고 어느 줄이 문제인지 표에서 짚는다 — 저장을 눌러야 알게 하지 않는다.
 */
export const duplicateDraftIds = (drafts: readonly QualificationDraft[]): Set<string> => {
  const byKey = new Map<string, string[]>();

  for (const draft of drafts) {
    const key = duplicateKeyOf(draft);
    const ids = byKey.get(key);

    if (ids === undefined) {
      byKey.set(key, [draft.draftId]);
    } else {
      ids.push(draft.draftId);
    }
  }

  const duplicates = new Set<string>();

  for (const ids of byKey.values()) {
    if (ids.length > 1) {
      for (const id of ids) duplicates.add(id);
    }
  }

  return duplicates;
};
