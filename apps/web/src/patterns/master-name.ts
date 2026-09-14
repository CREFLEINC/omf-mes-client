import { activeLocale, type Locale } from '@omf-mes/i18n';

/**
 * 마스터 명칭의 언어별 자리(공유계약 G-33 · #1113).
 *
 * 화면 문구를 다 옮겨도 품목·사유·작업자 이름이 한국어로 남으면 화면 절반이 읽히지 않는다.
 * 계약이 `nameKo`·`nameVi` 를 함께 내리므로 고른 언어의 자리를 읽는다.
 *
 * ⛔ **화면마다 고르는 식을 적지 않는다.** 이 저장소에는 「`nameKo` 가 먼저, 없으면 원본」을
 * 손으로 적은 자리가 열대여섯 곳 있었고 전부 「로케일 스위치가 생기면 여기를 고친다」는 주석을
 * 달고 있었다 — 그 자리가 늘어난 채로 스위치가 오면 빠뜨린 화면만 한국어로 남는다.
 */
interface LocalizedName {
  nameKo?: string | null;
  nameVi?: string | null;
}

const FIELD: Record<Locale, keyof LocalizedName> = {
  ko: 'nameKo',
  vi: 'nameVi',
};

/**
 * 고른 언어의 이름. 그 언어 이름이 **비어 있으면 원본으로 되돌린다.**
 *
 * 비었을 때 빈칸을 내면 무엇을 가리키는지조차 사라진다. 마스터가 아직 옮겨지지 않은 동안에는
 * 원본이라도 보이는 것이 낫다.
 *
 * ⚠ **공백만 있는 것도 빈 것이다.** 모바일의 같은 패턴은 `??` 만 보는데, 관리웹이 읽는 코드값은
 * ERP 수신본이라 **빈 문자열로 오는 자리가 실제로 있다**(그래서 화면들이 하나같이 `.trim()` 을
 * 먼저 걸고 있었다). 널만 보면 이름 자리에 빈칸이 그려진다.
 */
export const masterName = (names: LocalizedName, original: string): string => {
  const localized = names[FIELD[activeLocale()]]?.trim() ?? '';

  return localized === '' ? original : localized;
};
