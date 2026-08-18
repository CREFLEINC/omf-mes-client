import type { components } from '@omf-mes/api-client';

/**
 * W-CO-10이 상대하는 계약 타입의 별칭.
 *
 * 화면 슬라이스는 서로 import하지 않고 자기 타입을 소유한다(`screens/README.md`). 계약 타입은
 * 생성물이라 여기서 다시 만들지 않고 **이름만 이 슬라이스의 말로 옮긴다** — 생성 파일의
 * `components['schemas'][…]` 표기가 화면 코드 곳곳에 퍼지면 계약이 바뀔 때 고칠 자리가 흩어진다.
 */

/**
 * 비밀번호 변경 요청 본문.
 *
 * 칸이 둘(`currentPassword`·`newPassword`)뿐이다 — **확인 재입력은 계약에 없다.** 그것은
 * 사용자가 잘못 친 것을 화면이 잡기 위한 칸이라 서버로 나갈 이유가 없고, 실어 보내면 계약에
 * 없는 값을 보내는 요청이 된다.
 *
 * ⛔ **누구의 비밀번호인지는 주소가 정한다**(`…/users/me:…`). 본문에도 질의에도 식별자가 없어
 * 이 화면은 세션을 읽지 않는다.
 */
export type PasswordChangeRequestBody = components['schemas']['PasswordChangeRequest'];
