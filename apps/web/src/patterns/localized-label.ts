import { activeLocale } from '@omf-mes/i18n';

/**
 * 화면이 **제 손으로 드는** 이름의 형 — 화면 이름 · 묶음 이름 · 제품 이름 · 언어칸(#1113).
 *
 * ⛔ **`@omf-mes/i18n` 으로 옮기지 않는다.** 이 문구들은 `app/nav-tree.ts` 가 차례·배치 근거와
 * 함께 갖는 **이름**이고, 그 규칙의 근거는 저 파일 머리말에 있다. 옮기면 이름과 근거가 두
 * 파일로 갈려 「왜 이 자리인가」를 적어 둔 주석이 이름에서 멀어진다.
 *
 * ⭐ **그래서 번역도 이름 옆에 나란히 둔다**(`label` · `labelVi`). 사전을 따로 두면 이름을
 * 옮길 때 번역이 따라오지 않고, 짝이 어긋난 것을 아무도 못 본다.
 *
 * ⚠ **언어 하나만 든 이름은 이 형을 쓰지 않는다.** 채워야 할 자리가 비면 `typecheck` 가 짚는
 * 것이 이 형의 쓸모다 — `labelVi` 를 선택 항목으로 두는 순간 빠뜨린 자리가 조용해진다.
 *
 * ⭐ **`app/` 이 아니라 여기 산다**(#1126). 셸(`app/layout.tsx`)과 로그인 화면
 * (`screens/login/`)이 **함께** 쓰기 때문이다 — `screens/` 는 `app/` 을 부를 수 없다
 * (`dep:check` 의 `app-inner-direction`). 셸만 쓰던 것이 둘의 것이 된 자리다.
 */
export interface LocalizedLabel {
  readonly label: string;
  readonly labelVi: string;
}

/**
 * 활성 언어의 이름.
 *
 * ⚠ **모듈 최상위에서 붙잡지 않는다.** 언어는 진입점(`app/main.tsx`)이 화면을 싣기 전에
 * 정하지만, 이 함수를 부르는 쪽은 그리는 순간마다 묻는다 — 값을 상수로 굳혀 두면 정하기 전에
 * 읽은 한 벌이 화면에 남는다.
 */
export const localizedLabel = (named: LocalizedLabel): string =>
  activeLocale() === 'vi' ? named.labelVi : named.label;
