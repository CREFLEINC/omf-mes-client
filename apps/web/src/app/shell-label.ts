import { activeLocale } from '@omf-mes/i18n';

/**
 * 셸이 **제 손으로 드는** 이름 — 화면 이름 · 묶음 이름 · 제품 이름(#1113).
 *
 * ⛔ **`@omf-mes/i18n` 으로 옮기지 않는다.** 이 문구들은 `nav-tree.ts` 가 차례·배치 근거와 함께
 * 갖는 **이름**이고, 그 규칙의 근거는 저 파일 머리말에 있다. 옮기면 이름과 근거가 두 파일로
 * 갈려 「왜 이 자리인가」를 적어 둔 주석이 이름에서 멀어진다.
 *
 * ⭐ **그래서 번역도 이름 옆에 나란히 둔다**(`label` · `labelVi`). 사전을 따로 두면 이름을
 * 옮길 때 번역이 따라오지 않고, 짝이 어긋난 것을 아무도 못 본다.
 *
 * ⚠ **언어 하나만 든 이름은 이 형을 쓰지 않는다.** 채워야 할 자리가 비면 `typecheck` 가 짚는
 * 것이 이 형의 쓸모다 — `labelVi` 를 선택 항목으로 두는 순간 빠뜨린 자리가 조용해진다.
 */
export interface LocalizedLabel {
  readonly label: string;
  readonly labelVi: string;
}

/**
 * 활성 언어의 이름.
 *
 * ⚠ **모듈 최상위에서 붙잡지 않는다.** 언어는 진입점(`main.tsx`)이 화면을 싣기 전에 정하지만,
 * 이 함수를 부르는 쪽은 그리는 순간마다 묻는다 — 값을 상수로 굳혀 두면 정하기 전에 읽은 한
 * 벌이 화면에 남는다.
 */
export const localizedLabel = (named: LocalizedLabel): string =>
  activeLocale() === 'vi' ? named.labelVi : named.label;

/**
 * 상단 바의 제품 이름.
 *
 * **화면 이름이 아니라 셸 자신의 이름이라 `nav-tree.ts` 가 아니라 여기 있다** — 저 파일은
 * 「무엇을 어느 차례로 그릴지」를 갖고, 이 이름은 그 목록의 항목이 아니다.
 *
 * ⛔ **`common.shell.brand` 를 쓰지 않는다.** 그 자리는 모바일의 이름(`OMF-MES 모바일`)을 들고
 * 있고, 셸마다 다른 이름을 한 칸에 담으면 어느 한쪽이 남의 이름으로 선다.
 */
export const SHELL_BRAND: LocalizedLabel = {
  label: 'OMF-MES 관리웹',
  labelVi: 'OMF-MES Quản trị',
};

/**
 * 언어 선택칸의 접근명.
 *
 * ⭐ **고를 언어의 이름(`한국어` · `Tiếng Việt`)은 옮기지 않는다** — 그것은 `locale-select.tsx`
 * 가 갖는다. 자기 언어로 적혀 있어야 **지금 읽을 수 없는 화면에서도** 제 언어를 찾는다.
 */
export const LOCALE_CHOICE: LocalizedLabel = { label: '언어', labelVi: 'Ngôn ngữ' };
