import { messages } from '@omf-mes/i18n';

/**
 * 사용자 등록의 **초기 비밀번호 정책 한 곳.** 이 화면이 소유한다 — 다른 화면 슬라이스의 같은
 * 이름 파일을 참조하지 않는다.
 *
 * ⚠ **`screens/` 안에서 `import.meta.env.VITE_*` 를 읽는 첫 파일이다.** 지금 그 독해는
 * `app/api.ts` 와 vite 설정뿐이다. 그쪽 `resolveBaseUrl` 을 부르지 않고 **형태만 옮긴** 이유는
 * 의존 규칙(`dep:check` 의 `app-inner-direction`)상 `screens/` 가 `app/` 을 부를 수 없기
 * 때문이다 — 못 불러서 베낀 것이며, 같은 형태가 둘이 된 것을 숨기지 않는다.
 *
 * 다른 화면이 같은 값을 필요로 하게 되면 **그때 `patterns/` 로 올린다.** 지금 미리 올리지 않는
 * 이유는 쓰는 곳이 한 화면뿐이어서, 공용 자리에 두면 「어느 화면의 정책인가」가 흐려진다.
 */

const t = messages.usersRoles.user.validation;

/**
 * 서버가 등록 요청의 `password` 에 요구하는 최소 길이 — **서버 검증값의 실측이다.**
 * 화면이 지어낸 자리표시 값이 아니다.
 *
 * ⚠ **생성 타입(`api.d.ts`)에서 이 값을 찾지 마라.** `openapi-typescript` 는 `minLength` 를
 * TypeScript 타입으로 내보내지 않는다 — 그 파일에 없는 것은 서버에 하한이 없다는 뜻이 아니라
 * **그 도구로는 잴 수 없다**는 뜻이다(선례 `password-change/password-draft.ts` 의
 * `MIN_NEW_PASSWORD_LENGTH` 와 같은 사정이며, 그쪽 상수와 이 상수는 잣대가 서로 다른 요청의
 * 것이라 공유하지 않는다).
 *
 * 서버가 이 칸에 대해 재는 것은 **길이(8자 미만이면 400 RANGE)와 타입(문자열이 아니면 400
 * INVALID)뿐이다.** 아래 「숫자+알파벳」 규칙은 서버가 아니라 **이 화면이 세운 것**이다.
 *
 * ⛔ **짝이 되는 상한을 두지 않는다.** 서버에서 전달받은 검증에 상한이 없고 `maxLength` 는
 * 생성 타입으로 잴 수 없다 — 못 재는 값을 화면이 지어내 막으면 서버가 받아 주는 값을 쓸 수
 * 없게 된다. 상한이 정말 있다면 서버 400 이 그 칸에 인라인으로 서는 길로 드러난다
 * (`user-validation.ts` 의 `USER_CREATE_FORM_FIELDS` 가 그 길이다).
 *
 * 서버 하한이 바뀌면 이 상수를 교체한다 — 문구는 이 값을 주입받아 만들어지므로
 * (`t.initialPasswordWeak`) 여기만 고치면 화면이 따라온다.
 */
export const INITIAL_PASSWORD_MIN_LENGTH = 8;

/**
 * 숫자 한 자 이상을 품었는가.
 *
 * 서버가 재지 않는 규칙을 화면이 더 세우는 이유는, 이 값이 **만든 사람이 골라 남에게 알려 주는
 * 초기 비밀번호**라는 사정에 있다 — 서버가 강제 변경을 걸지 않아 아무도 바꾸지 않으면 그대로
 * 남으므로, 길이만 채운 값(`aaaaaaaa`)이 계정의 영구 비밀번호가 될 수 있다.
 */
const HAS_DIGIT = /\d/;

/**
 * 알파벳 한 자 이상을 품었는가.
 *
 * ⚠ **`A-Za-z` 로 좁힌다 — 유니코드 글자 전체가 아니다.** `\p{L}` 로 넓히면 한글·베트남어
 * 성조 글자가 「알파벳」으로 세어져 `비밀번호1` 같은 값이 규칙을 채운 것이 된다. 이 값은
 * **관리자가 받아 적어 옮기고 다른 사람이 다른 자판으로 다시 쳐야 하는 값**이라, 옮기는
 * 과정에서 잃기 쉬운 글자를 규칙의 만족 근거로 삼지 않는다.
 *
 * 그런 글자를 **쓰는 것은 막지 않는다** — 이 규칙은 금지가 아니라 하한이다. `비밀번호1a` 는
 * 통과하고, 서버도 길이만 재므로 받아 준다.
 */
const HAS_ALPHA = /[A-Za-z]/;

/**
 * 환경변수가 없을 때 등록 폼이 처음 담는 값.
 *
 * ⛔ **이 값은 공개 저장소에 실린다.** 서버가 강제 변경을 걸지 않으므로 아무도 바꾸지 않으면
 * 유효한 비밀번호로 남는다 — **실운영 배포는 `VITE_DEFAULT_INITIAL_PASSWORD` 로 덮는 것을
 * 전제로 한다.** 덮지 않은 배포본으로 만든 계정은 누구나 아는 비밀번호를 갖는다.
 *
 * 그럼에도 값을 비워 두지 않는 이유는, 비우면 등록할 때마다 관리자가 즉석에서 값을 지어내야
 * 하고 그 값을 어디에도 적어 두지 않아 **알려 줄 값을 잃는 쪽**이 더 흔하기 때문이다.
 */
export const FALLBACK_INITIAL_PASSWORD = 'Crefle2026';

/**
 * 등록 폼의 초기 비밀번호 기본값.
 *
 * 형태는 `app/api.ts` 의 `resolveBaseUrl` 을 따른다 — 환경변수를 **`unknown` 으로 받아**
 * 문자열이고 빈 문자열이 아닐 때만 쓴다. `import.meta.env` 의 값은 타입이 보장되지 않으므로
 * 좁히지 않고 쓰면 `undefined` 가 폼 값으로 들어간다.
 *
 * ⛔ **모듈 최상위 상수로 굳히지 마라.** 부를 때마다 읽어야 시험이 `vi.stubEnv` 로 이 갈림을
 * 짚을 수 있다 — 최상위에서 한 번 읽으면 모듈이 실린 시점의 값이 박혀, 환경변수 갈림은
 * 「시험할 수 없는 코드」가 된다.
 */
export const defaultInitialPassword = (): string => {
  const configured: unknown = import.meta.env.VITE_DEFAULT_INITIAL_PASSWORD;
  return typeof configured === 'string' && configured !== ''
    ? configured
    : FALLBACK_INITIAL_PASSWORD;
};

/**
 * 보내기 전에 화면이 잡을 수 있는 것만 잡는다. 통과하면 `undefined`.
 *
 * ⛔ **`trim()` 하지 않는다.** 근거는 두 갈래다 — 서버가 길이만 재므로 **공백도 값의 일부**이고,
 * 이 칸은 가려진 칸이라 공백이 점으로 **보인다.** 다듬은 값으로 재면 화면이 「8자다」라고 센
 * 값과 서버가 받는 값이 갈리고, 다듬은 값을 보내면 **사용자가 친 것과 다른 비밀번호가
 * 저장되어** 그 값으로는 다음 로그인이 되지 않는다(선례 `password-change/password-draft.ts`
 * 의 `isEmpty` 가 같은 근거로 다듬지 않는다).
 *
 * 그래서 「빈 칸」은 `value === ''` 뿐이다 — 공백만 친 칸은 빈 칸이 아니라 **규칙을 못 채운
 * 값**이다(숫자도 알파벳도 없다). 무언가 친 칸을 화면이 「비었다」고 말하면 사용자는 자기가
 * 친 것을 보면서 왜 잠겼는지 알 수 없다.
 *
 * ⛔ **특수문자·공백을 요구하지도 금지하지도 않는다.** 서버가 재지 않는 축을 화면이 금지하면
 * 서버가 받아 주는 값을 쓸 수 없게 만든다.
 */
export const validateInitialPassword = (value: string): string | undefined => {
  if (value === '') return t.required;

  const isStrongEnough =
    value.length >= INITIAL_PASSWORD_MIN_LENGTH && HAS_DIGIT.test(value) && HAS_ALPHA.test(value);

  /*
   * 세 갈래를 한 문장으로 모은다 — **한 칸에 한 문장**이고(이 화면 슬라이스의 규율), 가려진
   * 칸에서 「숫자가 없다」만 따로 말해도 사용자는 자기 값을 눈으로 확인할 수 없어 규칙 전부를
   * 다시 읽어야 한다.
   */
  return isStrongEnough ? undefined : t.initialPasswordWeak(INITIAL_PASSWORD_MIN_LENGTH);
};
