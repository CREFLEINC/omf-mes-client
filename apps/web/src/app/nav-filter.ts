import type { NavEntry, NavGroup } from './nav-tree';

/**
 * 사이드바 화면 검색 — **이름으로만 찾는다**(#1079).
 *
 * ⭐ **주소·섹션명으로 찾지 않는다.** 사람이 치는 것은 화면 이름이다. 주소를 섞으면 「출하」에
 * `/shipment/**` 열 개가 통째로 걸려 **검색이 필터를 흉내 내다 아무것도 좁히지 못하고**, 섹션명을
 * 섞으면 맞는 항목이 하나도 없는 묶음이 열린 채 선다. 초성 검색(`ㅊㄱ` → 창고)도 이번에는 없다 —
 * 없는 것이 틀린 것보다 낫고, 필요해지면 이 한 함수만 고친다.
 *
 * ⭐ **대소문자와 둘레 공백만 고른다.** 라벨에 `Routing(공정)`·`P/O`·`IQC` 처럼 영문·기호가 섞여
 * 있어 소문자로 맞추지 않으면 「iqc」가 「IQC 수입검사」를 못 찾는다. 그 이상(자모 분해·유사도)은
 * 들이지 않는다 — 맞는 이유를 사람이 설명할 수 없는 검색은 결과를 의심하게 만든다.
 */
const normalize = (value: string): string => value.trim().toLowerCase();

/** 이 항목이 검색어에 걸리는가. 비교하는 것은 **이름 하나**다. */
const matches = (entry: NavEntry, needle: string): boolean =>
  normalize(entry.label).includes(needle);

/**
 * 검색어에 맞는 항목만 남긴 묶음 목록. **맞는 항목이 없는 묶음은 빠진다.**
 *
 * 빈 검색어는 **원본을 그대로** 돌려준다(같은 참조다) — 「검색 중이 아니다」와 「검색했는데 전부
 * 맞았다」를 가르지 않아도 되게 하려는 것이고, 읽는 쪽이 접힘 상태를 그대로 쓸 수 있다.
 */
export const filterNavGroups = (
  groups: readonly NavGroup[],
  query: string,
): readonly NavGroup[] => {
  const needle = normalize(query);

  if (needle === '') return groups;

  return (
    groups
      /* ⛔ 필드를 손으로 다시 적지 않는다 — `NavGroup` 에 무언가 늘면 조용히 떨어진다. */
      .map((group) => ({ ...group, items: group.items.filter((item) => matches(item, needle)) }))
      .filter((group) => group.items.length > 0)
  );
};

/**
 * 섹션 밖 항목이 검색어에 걸리는가.
 *
 * ⛔ **묶음과 따로 묻는다.** `NAV_GROUPS` 만 훑으면 이 항목이 조용히 빠져 「대시보드」를 쳤을 때
 * 0건이 된다 — `nav-tree.ts` 가 `NAV_ENTRIES` 를 내보내는 것도 같은 사고를 막으려는 것이다.
 */
export const matchesNavEntry = (entry: NavEntry, query: string): boolean => {
  const needle = normalize(query);

  return needle === '' || matches(entry, needle);
};

/**
 * 검색어에 걸리는 것이 **하나도 없는가**. 비어 있으면 화면이 그 사실을 한 줄로 알린다.
 *
 * 묶음과 섹션 밖 항목을 **둘 다** 담은 목록을 받는다(`NAV_ENTRIES`) — 묶음만 보면 섹션 밖 항목이
 * 걸렸는데도 「없다」고 말한다.
 *
 * ⭐ **자료를 인자로 받는다.** 위 `filterNavGroups` 와 짝이 맞아야 하고, 모듈 상수를 직접 읽으면
 * 시험이 다른 트리로 경계를 재 볼 수 없다.
 */
export const hasNoNavMatch = (entries: readonly NavEntry[], query: string): boolean => {
  const needle = normalize(query);

  return needle !== '' && !entries.some((entry) => matches(entry, needle));
};
