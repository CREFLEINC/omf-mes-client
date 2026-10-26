import { messages } from '@omf-mes/i18n';

/**
 * 긴급 IQC 생략은 고정 OpenAPI의 `IQC_SKIP` 승인 유형만 조회한다. 요청 상태는 탭 줄 상태 칩(#186)이 고른다.
 */

/**
 * 긴급 IQC 생략의 **승인 유형 코드** — 이 화면의 정체이자 유일한 고정 축.
 *
 * `string | null`로 넓혀 두는 것은 의도다. `null` 리터럴로 좁으면 「값이 있을 때」를 다루는
 * 코드가 닿을 수 없는 가지로 보이고, 그러면 전환을 재는 시험이 성립하지 않는다.
 */
export const IQC_SKIP_APPROVAL_TYPE_CODE: string | null = 'IQC_SKIP';

/**
 * 승인 유형 코드가 **없는 동안** 목록 위에 서는 안내.
 *
 * 좁히지 못한다는 사실을 화면이 스스로 밝힌다 — 감추면 사용자가 「여기 있는 것은 전부 IQC
 * 생략 건」이라고 믿고 남의 유형을 결재한다. **값이 차면 `undefined`가 되어 안내가 사라진다.**
 *
 * **공백만인 값은 채워지지 않은 것으로 본다.** 그 값을 조건으로 실으면 어떤 요청도 걸리지
 * 않아 화면이 늘 0건이 되는데, 사용자에게는 「내 결재 대기가 없다」로 읽힌다.
 */
export const typePendingNote = (approvalTypeCode: string | null): string | undefined =>
  approvalTypeCode === null || approvalTypeCode.trim() === ''
    ? messages.iqcSkipApproval.typePendingNote
    : undefined;
