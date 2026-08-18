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
