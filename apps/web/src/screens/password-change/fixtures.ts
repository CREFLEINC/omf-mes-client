import type { components } from '@omf-mes/api-client';

import type { PasswordDraft } from './password-draft';

/**
 * 테스트 전용 예시 데이터. 런타임 코드는 이 모듈을 참조하지 않는다 —
 * 참조하면 예시 값이 배포 번들에 들어간다.
 *
 * ⛔ **이 슬라이스의 픽스처는 세 칸이 전부 자격이다.** 그래서 규칙이 다른 화면보다 엄하다 —
 * **그럴듯한 비밀번호를 짓지 않는다.** 접두 `SYN-`이 값 자체로 합성임을 드러내게 두고, 실제로
 * 쓰일 법한 모양(사람 이름·흔한 낱말·기본 비밀번호·자판 배열)을 쓰지 않는다. 전례
 * (`login/fixtures.ts`)가 같은 이유로 같은 규칙을 세웠다.
 *
 * **계약의 예시값을 쓰지 않는다** — 계약은 이 두 칸에 아예 예시를 두지 않았고, 그 판단을
 * 픽스처가 되돌리지 않는다. **이 저장소에서 확인할 수 있는 근거**는 생성 타입이다:
 * `api.d.ts`의 `PasswordChangeRequest` 두 칸에는 다른 스키마와 달리 `@example`이 없다
 * (계약 정본에는 그 사정이 벤더 확장으로 적혀 있으나 생성물에는 남지 않는다).
 *
 * 기준값은 **보낼 수 있는 초안**이다 — 규칙을 어기는 초안은 어긴 자리만 인자로 바꿔 만든다.
 * 반대로 두면(기준이 규칙 위반) 정상 경로 시험마다 세 칸을 다시 채워야 한다.
 */
const BASE_DRAFT: PasswordDraft = {
  currentPassword: 'SYN-CURRENT-01',
  newPassword: 'SYN-NEXT-0001',
  confirmPassword: 'SYN-NEXT-0001',
};

/** 폼이 들고 있는 초안. 한 칸만 다른 값을 만들 때 인자를 준다. */
export const passwordDraftFixture = (overrides: Partial<PasswordDraft> = {}): PasswordDraft => ({
  ...BASE_DRAFT,
  ...overrides,
});

type ErrorResponse = components['schemas']['ErrorResponse'];

/**
 * 401이 주는 본문. 계약은 이 자리에 **일반 오류 형태**만 두었다 — 화면은 상태 코드로 갈래를
 * 정하고 이 본문을 읽지 않으므로, 값은 「읽지 않는다」를 재기 위한 자리 채움이다.
 */
export const currentMismatchBody = (overrides: Partial<ErrorResponse> = {}): ErrorResponse => ({
  errors: [{ scope: 'screen', code: 'SYN_CODE_A', message: '합성 실패 문구입니다.' }],
  ...overrides,
});

/**
 * ⭐ **계약에 없는 필드를 일부러 실은 401 본문.**
 *
 * 이 화면은 계정을 잠그지 않으므로 남은 시도 횟수라는 개념이 없고, 계약도 이 경로에 그 필드를
 * 두지 않았다. 그런데 전례(로그인)의 401 본문에는 그 필드가 있어 **사본이 읽는 코드를 함께 데려올
 * 위험**이 실재한다. 서버가 실어 보내더라도 화면이 읽지 않음을 재려면 **실려 온 본문**이 있어야
 * 한다 — 그것이 이 픽스처다. 제품 코드는 이 이름을 어디서도 참조하지 않아야 한다.
 */
export const mismatchBodyWithAttemptsHint = (): ErrorResponse & { remainingAttempts: number } => ({
  ...currentMismatchBody(),
  remainingAttempts: 3,
});

/**
 * ⭐ **칸을 지목하는 400 본문** — 서버가 실제로 주는 모양이다(계약 `ErrorItem.scope='field'`).
 *
 * 400 시험을 `scope: 'screen'`만으로 재면 **가장 그럴듯한 실수**(서버가 준 `field` 이름을 보고
 * 아무 칸에나 붙이는 것)를 전혀 건드리지 못한 채 통과한다. 지목하는 이름은 계약 본문의 칸
 * 그대로다 — 화면이 그 이름을 아는 것이 문제의 출발점이다.
 */
export const fieldErrorBody = (
  field = 'currentPassword',
  message = '합성 칸 오류 문구입니다.',
): ErrorResponse => ({
  errors: [{ scope: 'field', field, code: 'SYN_CODE_B', message }],
});

/** 여러 항목을 한 응답에 싣는다 — 계약의 `errors`는 배열이다. */
export const errorItemsBody = (items: ErrorResponse['errors']): ErrorResponse => ({
  errors: items,
});
