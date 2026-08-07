import { messages } from '@omf-mes/i18n';

import { duplicateKeyOf, type DataScopeDraft } from './data-scope-draft';

const t = messages.usersRoles.actionReasons;

/**
 * 접근범위 한 줄을 만들 수 없는 이유. `null`이면 만들 수 있다.
 *
 * 인라인 오류가 아니라 **확인 버튼의 비활성 사유**다(배치 규범 4) — 두 축이 모두 비었거나
 * 이미 있는 범위와 겹치는 줄은 애초에 만들 수 있는 값이 아니라, 눌러 본 뒤에 알려 줄 일이 아니다.
 */
export type DataScopeBlockReason = 'targetRequired' | 'duplicatePair';

/**
 * 창의 확인을 막을 수 있는 것만 잡는다.
 *
 * **최소 1축** — 계약의 `ck_user_data_scope_target`이 두 축 중 하나 이상을 요구한다.
 * **목 서버가 이것을 강제하지 않는다**(둘 다 널인 본문에도 200을 준다). 화면이 막지 않으면
 * 실서버에 붙기 전까지 아무도 이 결함을 보지 못한다.
 *
 * **중복** — `uq_user_data_scope`가 `COALESCE(…,0)`으로 빈 축을 접어 유일을 판정한다.
 * 사업부만 고른 두 줄은 서버에게 같은 짝이므로 화면도 그렇게 세야 한다.
 *
 * **자기 자신은 중복으로 세지 않는다** — 수정할 때 축을 그대로 두는 것이 정상 조작이다.
 *
 * 순서가 있다. 두 축이 비었으면 그것을 먼저 낸다 — 아직 아무 축도 고르지 않은 사용자에게
 * 「겹친다」고 말하면 무엇을 고쳐야 하는지 알 수 없다.
 */
export const dataScopeBlockReason = (
  draft: DataScopeDraft,
  others: readonly DataScopeDraft[],
): DataScopeBlockReason | null => {
  if (draft.businessUnitId === '' && draft.plantId === '') return 'targetRequired';

  const key = duplicateKeyOf(draft);
  const isDuplicate = others.some(
    (other) => other.draftId !== draft.draftId && duplicateKeyOf(other) === key,
  );

  return isDuplicate ? 'duplicatePair' : null;
};

/** 사유 문구. 화면이 분기를 다시 쓰지 않도록 한 곳에 둔다. */
export const dataScopeBlockMessage = (reason: DataScopeBlockReason): string =>
  reason === 'targetRequired' ? t.dataScopeTargetRequired : t.dataScopeDuplicate;
