import type { components } from '@omf-mes/api-client';
import { messages } from '@omf-mes/i18n';

/** 상세 응답이 함께 내려 주는 코드 필드 수정 가능 여부. */
export type Editability = components['schemas']['Editability'];

/**
 * 코드 입력을 잠글지와 그 사유 문구를 정한다. 잠그지 않으면 null.
 *
 * **판정의 주인은 codeEditable이다.** reason은 문구 선택에만 쓴다 —
 * codeEditable=false인데 reason=EDITABLE인 어긋난 조합이 실제로 내려온다.
 * 그때 reason을 따라 「편집 가능」으로 읽으면 사용자가 고친 값이 저장 시점에야 거부된다.
 */
export const codeLockMessage = (editability: Editability): string | null => {
  if (editability.codeEditable) return null;

  const t = messages.editability;

  switch (editability.reason) {
    case 'REFERENCED':
      return t.referenced(editability.referenceCount ?? null);
    case 'NOT_COUNTABLE':
      return t.notCountable(null);
    case 'RECEIVED_FROM_ERP':
      return t.receivedFromErp(null);
    case 'EDITABLE':
      // 잠긴 것은 확실하나 사유가 특정되지 않았다. 사유를 지어내지 않는다.
      return t.locked;
  }
};
