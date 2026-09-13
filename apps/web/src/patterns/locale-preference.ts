import { LOCALES, resolveLocale, type Locale } from '@omf-mes/i18n';

/**
 * 이 브라우저가 고른 화면 언어 — **사람이 고르고, 브라우저가 기억한다**(#1113).
 *
 * ⭐ **기기 언어를 그대로 믿지 않는다.** 모바일은 단말이 한 사람의 것이라 기기 언어가 곧 그
 * 사람의 언어지만, 관리웹은 **공용 PC 와 크롬 기본값**이 흔하다 — 한국인 관리자와 베트남인
 * 관리자가 같은 자리를 번갈아 쓰는데 그 자리의 크롬은 둘 중 누구의 언어도 아닐 수 있다.
 * 그래서 **고른 값이 먼저**이고 기기 언어는 고른 적이 없는 첫 방문에만 쓴다.
 *
 * ⛔ **세션 도중 전환을 만들지 않는다.** 화면 1,539곳이 `const t = messages.xxx` 로 모듈이
 * 실릴 때 값을 붙잡으므로, 고른 뒤에 바꾸려면 그 소비 형태를 웹·POP·모바일에서 한꺼번에
 * 갈아야 한다. 고르면 새로고침한다(`app/locale-select.tsx`).
 */

/**
 * 저장 키 — 이 저장소의 관례는 `omf-mes.<주인>.<무엇>` 이다(화면들의 `STORAGE_KEY`).
 *
 * 주인이 `shell` 인 것은 이 값이 화면 하나의 것이 아니라 **셸 전체**의 것이기 때문이다.
 */
export const LOCALE_STORAGE_KEY = 'omf-mes.shell.locale';

const isLocale = (value: string): value is Locale => Object.hasOwn(LOCALES, value);

/**
 * 사람이 골라 둔 언어. 고른 적이 없거나 모르는 값이면 `null`.
 *
 * ⚠ **읽기를 감싼다.** 사생활 보호 모드·저장 차단 설정에서는 `localStorage` 에 **닿는 것만으로**
 * 던지는 브라우저가 있다 — 그 자리에서 던지면 진입점이 멈추고 **화면이 아예 서지 않는다.**
 *
 * ⛔ **모르는 값을 그대로 쓰지 않는다.** 저장값은 사람이 손으로 고칠 수 있는 자리라, 검사 없이
 * 넘기면 없는 묶음을 고르게 되어 문구 프록시가 `undefined` 를 내놓는다.
 */
export const storedLocale = (): Locale | null => {
  try {
    const raw = globalThis.localStorage.getItem(LOCALE_STORAGE_KEY);

    return raw !== null && isLocale(raw) ? raw : null;
  } catch {
    return null;
  }
};

/** 고른 언어를 남긴다. 남기지 못해도 **고른 것 자체는 되돌리지 않는다** — 이번 판은 선다. */
export const rememberLocale = (locale: Locale): void => {
  try {
    globalThis.localStorage.setItem(LOCALE_STORAGE_KEY, locale);
  } catch {
    /* 저장이 막힌 브라우저다. 새로고침하면 첫 방문으로 돌아가지만 화면은 서 있다. */
  }
};

/**
 * 이번 판을 세울 언어. **고른 값이 먼저, 없으면 기기 언어**다.
 *
 * `navigator.languages` 가 빈 배열일 수 있다(일부 브라우저·자동화 환경) — `resolveLocale` 이
 * 아는 것을 못 찾으면 한국어로 두므로 여기서 따로 가르지 않는다.
 */
export const startingLocale = (): Locale =>
  storedLocale() ?? resolveLocale(globalThis.navigator.languages);
