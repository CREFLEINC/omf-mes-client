import { Select } from '@crefle/web-ui';
import { activeLocale, LOCALES, type Locale } from '@omf-mes/i18n';

import { rememberLocale } from '../patterns/locale-preference';
import { localizedLabel, LOCALE_CHOICE } from './shell-label';

/**
 * 고를 수 있는 언어의 이름 — **각자 제 언어로 적는다.**
 *
 * ⛔ **번역하지 않는다.** 지금 화면이 읽히지 않아서 언어를 바꾸러 온 사람인데, 고를 언어의
 * 이름까지 읽을 수 없는 언어로 적혀 있으면 무엇을 고를지 알 수 없다. 「한국어」는 한국어로,
 * 「Tiếng Việt」는 베트남어로 선다.
 *
 * ⚠ **`LOCALES` 의 키를 그대로 훑는다.** 목록을 손으로 적으면 `packages/i18n` 에 언어가 늘어도
 * 이 칸에는 나타나지 않고, 그 빠짐은 새 언어를 쓰는 사람에게만 보인다.
 */
const LOCALE_NAMES: Record<Locale, string> = {
  ko: '한국어',
  vi: 'Tiếng Việt',
};

interface LocaleSelectProps {
  /**
   * 고른 뒤 화면을 다시 세우는 일. 기본은 새로고침이다.
   *
   * ⚠ **시험에서만 갈아 끼운다.** jsdom 은 `location.reload` 를 구현하지 않아, 진짜를 부르면
   * 시험 출력에 「Not implemented」가 섞여 **진짜 오류와 구별되지 않는다.**
   */
  reload?: () => void;
}

const reloadPage = (): void => {
  globalThis.location.reload();
};

/**
 * 화면 언어를 고르는 칸 — **상단 바의 로그아웃 옆**(#1113).
 *
 * ⭐ **고르면 새로고침한다.** 세션 도중 전환을 만들지 않는 까닭은 `patterns/locale-preference.ts`
 * 에 적혀 있다 — 소비 형태가 모듈 최상위 붙잡기라, 다시 세우지 않으면 **이미 붙잡은 자리만
 * 옛 언어로 남아** 한 화면에 두 언어가 섞인다. 반쯤 바뀐 화면이 안 바뀐 화면보다 나쁘다.
 *
 * ⚠ **같은 언어를 다시 고르면 아무것도 하지 않는다.** 새로고침은 사람이 보고 있던 것을 버리는
 * 일이라, 바뀌는 것이 없는데 치르게 하지 않는다.
 *
 * ⛔ **로그인 화면에는 서지 않는다.** 이 칸은 셸 안에 있고 로그인은 셸을 쓰지 않는 유일한
 * 화면이다(`ko/login.ts`). 로그인 화면의 언어는 **지난번에 고른 값**이 정한다 — 고르지 않은
 * 첫 방문만 브라우저 언어를 본다.
 */
export const LocaleSelect = ({ reload = reloadPage }: LocaleSelectProps) => {
  const current = activeLocale();

  return (
    <Select
      size="sm"
      aria-label={localizedLabel(LOCALE_CHOICE)}
      value={current}
      options={Object.keys(LOCALES).map((locale) => ({
        value: locale,
        label: LOCALE_NAMES[locale as Locale],
      }))}
      onChange={(value) => {
        if (value === current || !Object.hasOwn(LOCALES, value)) return;

        rememberLocale(value as Locale);
        reload();
      }}
    />
  );
};
