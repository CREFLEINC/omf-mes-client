import { Select } from '@crefle/web-ui';
import { activeLocale, LOCALES, type Locale } from '@omf-mes/i18n';

import { rememberLocale } from './locale-preference';
import { localizedLabel, type LocalizedLabel } from './localized-label';

/**
 * 이 칸의 접근명.
 *
 * ⭐ **고를 언어의 이름(`한국어` · `Tiếng Việt`)과는 다른 것이다** — 그쪽은 아래
 * `LOCALE_NAMES` 가 갖고 **옮기지 않는다.** 이 이름은 「무엇을 고르는 칸인가」라서 지금 읽고
 * 있는 언어를 따라간다.
 *
 * ⚠ **`@omf-mes/i18n` 이 아니라 여기 있다.** 셸이 제 손으로 드는 이름들과 같은 규칙이다
 * (`localized-label.ts` 머리말).
 */
export const LOCALE_CHOICE: LocalizedLabel = { label: '언어', labelVi: 'Ngôn ngữ' };

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
 * 화면 언어를 고르는 칸 — **상단 바의 로그아웃 옆**(#1113)과 **로그인 카드의 머리**(#1126).
 *
 * ⭐ **고르면 새로고침한다.** 세션 도중 전환을 만들지 않는 까닭은 `patterns/locale-preference.ts`
 * 에 적혀 있다 — 소비 형태가 모듈 최상위 붙잡기라, 다시 세우지 않으면 **이미 붙잡은 자리만
 * 옛 언어로 남아** 한 화면에 두 언어가 섞인다. 반쯤 바뀐 화면이 안 바뀐 화면보다 나쁘다.
 *
 * ⚠ **같은 언어를 다시 고르면 아무것도 하지 않는다.** 새로고침은 사람이 보고 있던 것을 버리는
 * 일이라, 바뀌는 것이 없는데 치르게 하지 않는다.
 *
 * ⭐ **로그인 화면도 이 칸을 쓴다 — 그래서 `app/` 이 아니라 `patterns/` 에 산다**(#1126).
 * 로그인은 셸을 쓰지 않는 유일한 화면이라(`ko/login.ts`) 상단 바가 없고, `screens/` 는 `app/`
 * 을 부를 수 없다(`dep:check` 의 `app-inner-direction`). 두 자리가 **같은 부품**을 써야 고를
 * 언어의 이름이 갈리지 않는다.
 *
 * ⚠ **그 화면에서는 카드 머리에 선다 — 칸을 치기 전에 만나는 자리다.** 고르면 새로고침하므로
 * 폼 아래에 두면 이미 친 값을 잃는다.
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
