import type { components } from '@omf-mes/api-client';

import type { LoginDraft } from './login-draft';
import type { LoginFailure, Session } from './types';

/**
 * 테스트 전용 예시 데이터. 런타임 코드는 이 모듈을 참조하지 않는다 —
 * 참조하면 예시 값이 배포 번들에 들어간다.
 *
 * ⛔ **이 슬라이스의 픽스처에는 자격이 들어간다.** 그래서 규칙이 다른 화면보다 하나 더 엄하다 —
 * **그럴듯한 자격을 짓지 않는다.** 접두 `SYN-`이 값 자체로 합성임을 드러내게 두고, 실제로 쓰일
 * 법한 아이디·비밀번호 모양(사람 이름·흔한 낱말·기본 비밀번호)을 쓰지 않는다. 계약도 같은 이유로
 * 비밀번호 칸에 예시를 두지 않았다.
 *
 * **계약의 예시값(`1001`·`hong.gd`·`홍길동`)을 쓰지 않는다.** 계약 예시가 픽스처로 새어 들어오면
 * 「목이 채워 준 값」과 「화면이 만든 값」이 구분되지 않는다.
 *
 * 내부 번호는 겹치지 않는 대역으로 나눈다 — 8100대(사용자) · 8200대(부서) · 8300대(사업부) ·
 * 8400대(공장). 「화면 어디에도 내부 번호가 렌더되지 않는다」를 검사할 때 다른 숫자와 헷갈리지
 * 않게 하기 위해서다.
 */

type ErrorResponse = components['schemas']['ErrorResponse'];

const BASE_DRAFT: LoginDraft = {
  loginId: 'SYN-LOGIN-01',
  password: 'SYN-PW-VALUE-01',
};

/** 폼이 들고 있는 초안. 한 항목만 다른 값을 만들 때 인자를 준다. */
export const loginDraftFixture = (overrides: Partial<LoginDraft> = {}): LoginDraft => ({
  ...BASE_DRAFT,
  ...overrides,
});

/**
 * 로그인 성공 응답.
 *
 * **권한 범위는 사업부·공장 두 축뿐이다** — 법인 축을 두지 않는다. 두 축을 담은 항목 하나를
 * 기본으로 두어, 세션을 보관하는 회차가 그 사실을 그대로 잴 수 있게 한다.
 */
const BASE_SESSION: Session = {
  userId: 8101,
  loginId: 'SYN-LOGIN-01',
  userName: '합성 사용자 가',
  departmentId: 8201,
  lastLoginAt: '2026-08-17T09:12:00+09:00',
  scopes: [{ businessUnitId: 8301, plantId: 8401 }],
  roles: ['SYN_ROLE_A'],
};

export const sessionBody = (overrides: Partial<Session> = {}): Session => ({
  ...BASE_SESSION,
  ...overrides,
});

/**
 * 401 본문.
 *
 * `remainingAttempts`를 **기본값으로 두지 않는다** — 계약이 선택 필드로 두었고 없는 계정에는
 * 오지 않는다. 기본으로 실어 두면 「값이 없을 때」를 재는 시험이 일부러 지워야 성립하고,
 * 지우는 것을 잊으면 그 갈래가 조용히 사라진다.
 */
const BASE_FAILURE: LoginFailure = {
  /*
   * ⚠ **계약의 `@example` 문구를 쓰지 않는다** — 이 파일 머리의 금지가 그대로 걸린다.
   *
   * 하필 이 자리에서 그 금지가 겨눈 혼동이 실제로 성립한다: 서버가 준 `message`와 화면이 내는
   * 문구가 거의 같아지면, 배너 시험이 「화면이 자기 문구를 냈다」와 「서버 본문이 그대로
   * 흘러나왔다」를 가리지 못한다. 이 회차는 401 본문을 버리지만 뒤따르는 회차가 그 본문을
   * 읽기 시작한다 — 그때 이 값이 정본이었던 것처럼 읽힌다.
   */
  message: '합성 실패 문구입니다.',
};

export const loginFailureBody = (overrides: Partial<LoginFailure> = {}): LoginFailure => ({
  ...BASE_FAILURE,
  ...overrides,
});

/** 400·423이 주는 일반 오류 본문. 목 서버도 이 자리에 같은 모양을 준다(실측). */
export const errorResponseBody = (overrides: Partial<ErrorResponse> = {}): ErrorResponse => ({
  errors: [{ scope: 'screen', code: 'SYN_CODE_A', message: '합성 오류 문구입니다.' }],
  ...overrides,
});
