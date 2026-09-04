import { messages } from '@omf-mes/i18n';

import { duplicateKeyOf, type ExternalCodeDraft } from './external-code-draft';

/**
 * 외부 코드 편집 창의 검증.
 *
 * **계약의 제약 이름을 그대로 옮긴 것만 만든다**(결정 7).
 *
 * | 로컬에서 막는 것 | 계약 근거 |
 * | --- | --- |
 * | 필수 둘(외부 시스템·외부 품목코드) | 스키마 `required` |
 * | 외부 품목코드 길이 100 | `maxLength` |
 * | 중복(외부 시스템 + `COALESCE(거래처,0)`) | `uq_item_external_code` — **A-7** |
 *
 * **거래처는 필수가 아니다.** 비우는 것이 「(전체)」라는 정상 값이다.
 * **외부 시스템 코드는 OpenAPI enum을 그대로 쓴다.** 화면이 별도 값을 만들지 않는다.
 */

const t = messages.itemExtendedAttrs.externalCode.validation;

/** 계약이 정한 상한. 상한 자체는 허용값이며 그것을 **넘을 때만** 막는다. */
const EXTERNAL_ITEM_CODE_MAX = 100;

export const validateExternalCodeDraft = (
  draft: ExternalCodeDraft,
  others: readonly ExternalCodeDraft[],
): Record<string, string> => {
  const errors: Record<string, string> = {};

  const itemCode = draft.externalItemCode.trim();

  if (draft.externalSystemCode === '') {
    errors.externalSystemCode = t.required;
  }

  if (itemCode === '') {
    errors.externalItemCode = t.required;
  } else if (itemCode.length > EXTERNAL_ITEM_CODE_MAX) {
    errors.externalItemCode = t.externalItemCodeTooLong;
  }

  /*
   * `uq_item_external_code`의 `COALESCE(partner_id,0)` — **거래처를 비운 두 줄은 같은 짝이다.**
   * 외부 품목코드는 키가 아니라 코드만 다른 두 줄도 서버가 거부한다.
   * 자기 자신은 세지 않는다 — 수정할 때 두 값을 그대로 두는 것이 정상이다.
   */
  if (errors.externalSystemCode === undefined) {
    const key = duplicateKeyOf(draft);
    const isDuplicate = others.some(
      (other) => other.draftId !== draft.draftId && duplicateKeyOf(other) === key,
    );

    if (isDuplicate) errors.externalSystemCode = t.duplicateKey;
  }

  return errors;
};

/**
 * 이미 겹쳐 있는 줄의 초안 키.
 *
 * **서버가 준 목록에 이미 중복이 있을 수 있다**(옛 자료). 그대로 보내면 서버가 거부하므로
 * 저장을 눌러야 알게 하지 않고 **표 위 안내와 저장 차단 사유**로 먼저 밝힌다.
 *
 * **지금 소비되는 것은 「겹친 줄이 있는가」(`size > 0`)까지다** — 단위 환산과 같다.
 */
export const duplicateDraftIds = (drafts: readonly ExternalCodeDraft[]): Set<string> => {
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
