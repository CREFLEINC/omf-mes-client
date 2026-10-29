import type { NavEntry, NavGroup } from './nav-tree';
import { localizedLabel } from '../patterns/localized-label';
import type { WebAccess } from '../patterns/web-access';

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

/**
 * 이 항목이 검색어에 걸리는가. 비교하는 것은 **그 항목의 이름 하나**다(탭 이름은 `searchNavEntry` 가 따로 잰다).
 *
 * ⭐ **보이는 이름으로 잰다**(#1113). 두 언어를 다 보면 베트남어 화면에서 한국어를 쳐도 걸리는데,
 * 그러면 **화면에 없는 글자가 결과를 만든다** — 걸린 까닭을 화면에서 읽을 수 없다. 반대로 늘
 * 한국어로만 재면 베트남어 화면의 검색이 통째로 죽는다.
 */
const matches = (entry: NavEntry, needle: string): boolean =>
  normalize(localizedLabel(entry)).includes(needle);

/**
 * 펼친 탭의 보이는 이름 — **묶음 이름을 앞에 붙인다**(「ERP 연동 현황·이력 › ERP W/O」).
 *
 * ⭐ 탭 이름은 묶음 안에서만 홀로 설 수 있다 — 「사원」·「BOM」은 묶음 밖에서 무엇의 사원인지
 * 모르고, 「ERP W/O」를 치면 생산 관리의 「ERP W/O 변경 확인」 탭과 ERP 연동 현황·이력의 「ERP W/O」
 * 탭이 함께 걸린다. 걸린 글자(탭 이름)는 그대로 보이므로 「왜 걸렸는가」도 읽힌다.
 */
const SPREAD_SEPARATOR = ' › ';

/**
 * 검색에 걸린 결과로 **이 항목 자리에 설 것들**.
 *
 * ⭐ **탭 묶음은 탭 이름으로도 찾는다.** 「타발수」를 치는 사람은 그 화면이 「툴·금형」 묶음에
 * 들어간 것을 모른다 — 묶음 이름만 재면 옛 화면 이름으로 찾던 길이 끊긴다.
 *
 * ⛔ **탭 이름으로 걸렸으면 묶음이 아니라 그 탭을 세운다.** 묶음 이름(「툴·금형」)만 서면 걸린
 * 글자가 화면에 없어 **왜 걸렸는지 읽을 수 없다**(위 `matches` 의 원칙과 같다). 묶음 이름으로
 * 걸렸으면 묶음 그대로 선다.
 */
const searchNavEntry = (entry: NavEntry, needle: string): readonly NavEntry[] => {
  if (matches(entry, needle)) return [entry];

  return (
    (entry.tabs ?? [])
      /* 거르기는 **탭 이름 자체**로 한다 — 묶음 이름으로 걸렸으면 위에서 묶음이 이미 섰다. */
      .filter((tab) => matches({ ...tab, icon: entry.icon }, needle))
      .map((tab) => ({
        to: tab.to,
        icon: entry.icon,
        label: `${entry.label}${SPREAD_SEPARATOR}${tab.label}`,
        labelVi: `${entry.labelVi}${SPREAD_SEPARATOR}${tab.labelVi}`,
      }))
  );
};

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
      .map((group) => ({
        ...group,
        items: group.items.flatMap((item) => searchNavEntry(item, needle)),
      }))
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

  return needle !== '' && !entries.some((entry) => searchNavEntry(entry, needle).length > 0);
};

/**
 * 로그인한 사람이 갈 수 있는 항목만 남긴 묶음 목록. **맞는 항목이 없는 묶음은 빠진다.**
 *
 * ⭐ **검색과 따로 돈다.** 검색은 「지금 무엇을 찾는가」이고 이것은 「무엇을 볼 수 있는가」다 —
 * 한 함수로 합치면 검색 결과가 0건일 때 그것이 못 찾은 것인지 권한이 없는 것인지 갈리지 않는다.
 * 읽는 쪽은 **권한으로 먼저 거르고 그 결과에서 검색**한다.
 *
 * ⚠ **판정할 근거가 없으면(`unknown`) 거르지 않는다.** 계약이 「필드가 없으면 값 목록이 아직
 * 정해지지 않았다는 뜻」이라고 갈라 두었다 — 모르는 것을 「없다」로 다루면 목록을 못 받은 세션이
 * 텅 빈 메뉴를 보고 원인이 가려진다.
 */
export const filterNavGroupsByAccess = (
  groups: readonly NavGroup[],
  access: WebAccess,
): readonly NavGroup[] => {
  if (access.state === 'unknown') return groups;

  return (
    groups
      /* ⛔ 필드를 손으로 다시 적지 않는다 — `NavGroup` 에 무언가 늘면 조용히 떨어진다. */
      .map((group) => ({
        ...group,
        items: group.items.flatMap((item) => {
          const allowed = narrowNavEntryByAccess(item, access);

          return allowed === null ? [] : [allowed];
        }),
      }))
      .filter((group) => group.items.length > 0)
  );
};

/** 탭 없는 항목 — 제 주소나, 품은 옛 화면(`alsoFor`) 중 하나라도 볼 수 있으면 선다. */
const allowsEntry = (entry: NavEntry, access: WebAccess): boolean =>
  access.allows(entry.to) || (entry.alsoFor ?? []).some((path) => access.allows(path));

/**
 * 항목 하나를 권한으로 좁힌다 — 볼 수 없으면 `null`.
 *
 * 탭 묶음은 **볼 수 있는 탭만 남기고, 그 첫 탭으로 건다.** 탭이 하나도 남지 않으면 묶음째
 * 감춘다. 첫 탭을 못 보는 사람에게 묶음 주소(첫 탭)를 그대로 걸면 누르는 순간 막힌 화면이
 * 선다.
 */
const narrowNavEntryByAccess = (entry: NavEntry, access: WebAccess): NavEntry | null => {
  if (entry.tabs === undefined) return allowsEntry(entry, access) ? entry : null;

  const tabs = entry.tabs.filter(
    (tab) => access.allows(tab.to) || (tab.alsoFor ?? []).some((path) => access.allows(path)),
  );
  const [first] = tabs;

  return first === undefined ? null : { ...entry, to: first.to, tabs };
};

/**
 * 섹션 밖 항목을 볼 수 있는가.
 *
 * ⛔ **묶음과 따로 묻는다** — `filterNavGroupsByAccess` 와 같은 이유다.
 */
export const isNavEntryAllowed = (entry: NavEntry, access: WebAccess): boolean =>
  allowsEntry(entry, access);
