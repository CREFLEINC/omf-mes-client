import { ko, type Messages } from './ko';
import { vi } from './vi';

export { ko, type Messages } from './ko';
export { vi } from './vi';

/** 이 저장소가 내는 언어. 새 언어는 여기 한 줄을 더한다. */
export const LOCALES = { ko, vi } as const;

export type Locale = keyof typeof LOCALES;

const FALLBACK: Locale = 'ko';

let active: Locale = FALLBACK;

/**
 * 기기가 주는 언어표를 우리가 내는 묶음으로 옮긴다.
 *
 * 기기는 선호 순서대로 여럿을 주고(`vi-VN, ko-KR, en-US`) 지역까지 붙여 준다. 아는 것이
 * 나올 때까지 앞에서부터 보고, 하나도 없으면 한국어로 둔다 - 모르는 언어를 빈 화면으로
 * 두는 것보다 읽을 수 있는 글이 낫다.
 */
export const resolveLocale = (preferred: readonly string[]): Locale => {
  for (const tag of preferred) {
    const base = tag.toLowerCase().split('-')[0];

    /* in 은 프로토타입까지 본다. constructor 가 통과해 없는 묶음을 고르게 된다. */
    if (base !== undefined && Object.hasOwn(LOCALES, base)) {
      return base as Locale;
    }
  }

  return FALLBACK;
};

export const activeLocale = (): Locale => active;

/**
 * 쓸 묶음을 정한다.
 *
 * ⛔ 화면 모듈을 싣기 전에 부른다. 화면 33곳이 `const t = messages.xxx` 로 모듈이 실릴 때
 * 값을 붙잡으므로, 뒤에 부르면 이미 붙잡은 자리는 바뀌지 않는다. 세션 도중 바꿀 일은 없다 -
 * 기기 언어를 바꾸면 운영체제가 앱을 다시 띄운다.
 */
export const setLocale = (locale: Locale): void => {
  active = locale;
};

/**
 * 화면이 쓰는 문구.
 *
 * 고른 묶음으로 넘겨 준다. 이름과 쓰는 법은 그대로다 - 웹·POP 1,540개 파일이 같은 이름을
 * 쓰고 있어, 소비 형태를 바꾸면 다른 팀 작업을 함께 건드리게 된다. 고르는 자리를 부르지
 * 않으면 한국어라 그쪽은 달라지는 것이 없다.
 */
export const messages: Messages = new Proxy({} as Messages, {
  get: (_target, key) => LOCALES[active][key as keyof Messages],
  has: (_target, key) => key in LOCALES[active],
  ownKeys: () => Reflect.ownKeys(LOCALES[active]),
  getOwnPropertyDescriptor: (_target, key) =>
    Reflect.getOwnPropertyDescriptor(LOCALES[active], key),
});
