import type { components } from '@omf-mes/api-client';

/**
 * W-CO-01이 상대하는 계약 타입의 별칭.
 *
 * 화면 슬라이스는 서로 import하지 않고 자기 타입을 소유한다(`screens/README.md`). 계약 타입은
 * 생성물이라 여기서 다시 만들지 않고 **이름만 이 슬라이스의 말로 옮긴다** — 생성 파일의
 * `components['schemas'][…]` 표기가 화면 코드 곳곳에 퍼지면 계약이 바뀔 때 고칠 자리가 흩어진다.
 */

/**
 * 로그인 결과이자 「지금 나는 누구이고 어디까지 보는가」.
 *
 * ⚠ **권한 범위(`SessionScope`) 별칭을 따로 두지 않는다.** 네 회차를 지나며 그 이름을 쓰는
 * 자리가 끝내 생기지 않았다 — 화면은 응답을 **깎지 않고 통째로** 세션에 담고, 축이 둘뿐이라는
 * 사실은 그 담긴 값을 훑는 감지기가 잰다. 쓰지 않는 별칭은 정의째 두지 않는다.
 */
export type Session = components['schemas']['Session'];

/**
 * 로그인 실패 본문.
 *
 * ⛔ 아이디가 틀렸는지 비밀번호가 틀렸는지 말하지 않는다. `remainingAttempts`는 **선택 필드이며
 * 없는 계정에는 오지 않는다** — 화면은 값이 없을 때 숫자를 지어내지 않는다.
 */
export type LoginFailure = components['schemas']['LoginFailure'];

/** 로그인 요청 본문. 이 슬라이스의 초안(`LoginDraft`)이 담는 칸이 그대로 이 본문의 칸이다. */
export type LoginRequestBody = components['schemas']['LoginRequest'];
