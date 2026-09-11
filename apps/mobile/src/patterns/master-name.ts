import { activeLocale, type Locale } from '@omf-mes/i18n';

/**
 * 마스터 명칭의 언어별 자리.
 *
 * 화면 문구를 다 옮겨도 품목·사유·작업자 이름이 한국어로 남으면 화면 절반이 읽히지 않는다.
 * 계약이 한국어와 베트남어를 함께 내리므로 고른 언어의 자리를 읽는다.
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
 * 고른 언어의 이름. 그 언어 이름이 비어 있으면 원본으로 되돌린다.
 *
 * 비었을 때 빈칸을 내면 무엇을 가리키는지조차 사라진다. 마스터가 아직 옮겨지지 않은 동안에는
 * 원본이라도 보이는 것이 낫다.
 */
export const masterName = (names: LocalizedName, original: string): string =>
  names[FIELD[activeLocale()]] ?? original;
