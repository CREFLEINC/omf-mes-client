import type { components } from '@omf-mes/api-client';
import { messages } from '@omf-mes/i18n';

/**
 * 이 화면이 기다리는 코드 값들.
 *
 * ⭐ **`W-01-06`(자재 폐기 요청)이 세운 형태를 그대로 쓴다** — 값 목록이 비어 있는 것이 지금의
 * 사실이고, **자리표시 값을 하나도 넣지 않는다.** 넣으면 사용자가 그것을 고를 수 있고, 고르면
 * **서버가 모르는 코드가 되돌릴 수 없는 전표에 실린다.**
 *
 * 값이 도착하면 **이 파일의 상수만 채우면** 화면 전체가 열린다.
 */

/**
 * 기타출고 전표를 만들 때 계약이 **필수**로 요구하는 코드.
 *
 * ⚠ `sourceDocumentType` 이 눈에 걸릴 수 있다 — 원천이 **처분 결정**임을 가리키는 «구조 값»이라
 * 사용자가 고를 성질이 아니다. 그런데도 자리표시로 두는 이유는 **그 값이 무엇이어야 하는지가
 * 아직 확정되지 않았기** 때문이다(계약: 「확정된 값 목록이 아직 없다」).
 *
 * ⭐ `issueType`·`reason` 은 사정이 다르다 — 계약이 **값 목록을 받는 길**을 명시했다
 * (`GET /mdm/code-values?codeGroupCode=ISSUE_TYPE|GOODS_ISSUE_REASON` · 공유계약 G-32).
 * 그래서 그 둘은 조회로 채우고 여기 두지 않는다.
 */
export const SOURCE_DOCUMENT_TYPE_CODE: string = '';

/** 결재선·승인 유형을 가리키는 코드. 값 목록이 확정되기 전에는 결재선을 물을 수 없다. */
export const DISPOSAL_APPROVAL_TYPE_CODE: string = '';

/**
 * 폐기 거래처를 좁히는 역할 코드 — **계약이 값을 좁혀 두었다.**
 *
 * ⛔ **생성물 타입에서 파생한다** — 손으로 적은 문자열을 두면 계약이 값을 바꿔도 아무것도 울지
 * 않는다. `W-01-06` 이 같은 자리에서 같은 방법을 쓴다.
 */
type PartnerRoleCode = components['schemas']['PartnerRole']['roleTypeCode'];

export const DISPOSAL_PARTNER_ROLE: PartnerRoleCode = 'DISPOSAL';

/**
 * 쓰기가 잠긴 사유. 잠기지 않았으면 `undefined`.
 *
 * ⭐ **값 목록이 없어 잠긴 것**이지 권한이나 입력 때문이 아니다. 그 사실을 그대로 말하지 않으면
 * 「선택하세요」라고만 하게 되는데, **고를 것이 없는데 고르라는 말**이 된다.
 */
export const codeLockReason = (): string | undefined =>
  SOURCE_DOCUMENT_TYPE_CODE === '' || DISPOSAL_APPROVAL_TYPE_CODE === ''
    ? messages.productDisposalRequest.lock.codesPending
    : undefined;
