import type { components } from '@omf-mes/api-client';

type WorkerQualification = components['schemas']['WorkerQualification'];

/**
 * 치환 본문의 항목 하나. **계약의 요청 항목은 여섯뿐이고 식별자가 없다** —
 * `workerQualificationId`도 `workerId`도 담지 않는다(W-06-01·W-06-02의 치환과 반대다).
 */
export interface QualificationItemPayload {
  qualificationTypeCode: string;
  processId?: number | null;
  certificateNo?: string | null;
  validFrom: string;
  validTo?: string | null;
  /** **기존 행에만 실린다.** 새 행에는 이 키 자체를 두지 않는다 */
  certifiedBy?: number | null;
}

/**
 * 자격 한 줄의 로컬 초안.
 *
 * 값이 문자열인 이유는 디자인 시스템 입력·선택이 문자열을 다루기 때문이다.
 * `certifiedBy`만 예외로 숫자·널을 그대로 들고 다닌다 — **화면에 입력칸이 없는 값**이라
 * 사용자가 고칠 일이 없고, 문자열로 바꿨다 되돌리는 변환이 값을 잃을 여지만 만든다.
 */
export interface QualificationDraft {
  /**
   * 초안 안에서 줄을 구분하는 안정된 키. 표의 행 식별자·React key로 쓴다.
   * 아직 저장되지 않은 줄에도 있어야 하므로 서버 식별자와 별개로 둔다.
   * **서버로 나가지 않는다** — 계약의 요청 항목에 식별자가 없다.
   */
  draftId: string;
  qualificationTypeCode: string;
  /** 비우면 「(전체 공정)」이다 — 계약이 그 뜻을 널로 표현한다(A-7). */
  processId: string;
  certificateNo: string;
  validFrom: string;
  /** 비우면 무기한이다. */
  validTo: string;
  /**
   * 서버가 준 인증자. **화면에 입력칸이 없다.**
   * 되돌려 싣지 않으면 저장할 때 서버에 있던 값이 조용히 지워진다 —
   * `certifiedBy`는 FK가 없는 정수라 화면이 뜻을 만들 수도, 다시 만들 수도 없다(omf-mes#64).
   */
  certifiedBy: number | null;
}

const optionalText = (value: string | null | undefined): string => value ?? '';

export const toQualificationDrafts = (
  items: readonly WorkerQualification[],
): QualificationDraft[] =>
  items.map((item) => ({
    draftId: `saved:${String(item.workerQualificationId)}`,
    qualificationTypeCode: item.qualificationTypeCode,
    processId:
      item.processId === null || item.processId === undefined ? '' : String(item.processId),
    certificateNo: optionalText(item.certificateNo),
    validFrom: item.validFrom,
    validTo: optionalText(item.validTo),
    certifiedBy: item.certifiedBy ?? null,
  }));

/**
 * 아직 저장되지 않은 줄의 초안 키. 저장된 줄(`saved:<id>`)과 겹치지 않기만 하면 되고,
 * 한 세션 안에서만 유일하면 된다 — 서버로 나가지 않는 값이다.
 */
let newDraftSequence = 0;

export const createQualificationDraft = (): QualificationDraft => {
  newDraftSequence += 1;

  return {
    draftId: `new:${String(newDraftSequence)}`,
    qualificationTypeCode: '',
    processId: '',
    certificateNo: '',
    validFrom: '',
    validTo: '',
    // 화면이 만들 수 없는 값이다 — 저장 본문에서는 키 자체를 뺀다.
    certifiedBy: null,
  };
};

/**
 * 초안 하나를 더하거나 갈아 끼운다.
 * 이미 있는 키는 **자리를 지킨 채** 값만 바꾼다 — 수정이 순서를 흔들면 사용자가 다시 찾아야 한다.
 */
export const upsertQualificationDraft = (
  drafts: QualificationDraft[],
  draft: QualificationDraft,
): QualificationDraft[] => {
  const index = drafts.findIndex((item) => item.draftId === draft.draftId);

  if (index === -1) return [...drafts, draft];

  const next = [...drafts];
  next[index] = draft;

  return next;
};

export const removeQualificationDraft = (
  drafts: QualificationDraft[],
  draftId: string,
): QualificationDraft[] => drafts.filter((draft) => draft.draftId !== draftId);

/** 빈 문자열은 「지정하지 않음」이라 계약의 널로 옮긴다. */
const textToOptionalNumber = (value: string): number | null =>
  value === '' ? null : Number(value);

const textToOptionalText = (value: string): string | null =>
  value.trim() === '' ? null : value.trim();

/**
 * 전체 치환 요청 본문의 항목 목록.
 *
 * **식별자를 싣지 않는다** — 계약의 요청 항목이 여섯뿐이다(§5.2 실측).
 * **기존 행의 인증자는 되돌려 싣고, 새 행에는 그 키 자체를 두지 않는다** —
 * 새 행에 널을 실으면 「인증자를 비우라」는 뜻이 되는데 화면이 그것을 정한 적이 없다.
 */
export const toQualificationsPayload = (
  drafts: readonly QualificationDraft[],
): QualificationItemPayload[] =>
  drafts.map((draft) => ({
    qualificationTypeCode: draft.qualificationTypeCode,
    processId: textToOptionalNumber(draft.processId),
    // 앞뒤 공백이 붙은 인증번호는 눈으로 구분되지 않는 다른 값이 된다.
    certificateNo: textToOptionalText(draft.certificateNo),
    validFrom: draft.validFrom,
    validTo: textToOptionalText(draft.validTo),
    ...(draft.certifiedBy === null ? {} : { certifiedBy: draft.certifiedBy }),
  }));

/**
 * 유일 제약의 판정 키.
 *
 * 계약의 `uq_worker_qualification`이 **`COALESCE(process_id,0)`으로 접는다** —
 * 공정을 비운 두 줄은 서버에게 같은 짝이다. 화면이 그것을 다르게 세면
 * 사용자가 만든 줄이 저장 시점에야 거부된다.
 */
export const duplicateKeyOf = (draft: QualificationDraft): string => {
  const process = draft.processId === '' ? 0 : Number(draft.processId);

  return `${draft.qualificationTypeCode}#${String(process)}`;
};

const isSameDraft = (a: QualificationDraft, b: QualificationDraft | undefined): boolean =>
  b !== undefined &&
  a.draftId === b.draftId &&
  a.qualificationTypeCode === b.qualificationTypeCode &&
  a.processId === b.processId &&
  a.certificateNo === b.certificateNo &&
  a.validFrom === b.validFrom &&
  a.validTo === b.validTo &&
  a.certifiedBy === b.certifiedBy;

/** 「고친 것이 있는가」의 판정 근거. 순서도 자료의 일부는 아니지만 목록 비교라 위치로 맞춘다. */
export const isSameQualificationDrafts = (
  a: readonly QualificationDraft[],
  b: readonly QualificationDraft[],
): boolean => a.length === b.length && a.every((draft, index) => isSameDraft(draft, b[index]));
