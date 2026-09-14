import type { LocalizedLabel } from '../patterns/localized-label';

/**
 * 셸 자신의 이름.
 *
 * ⭐ **이름의 형(`LocalizedLabel`)과 활성 언어를 고르는 함수(`localizedLabel`)는
 * `patterns/localized-label.ts` 에 있다**(#1126) — 로그인 화면도 그 둘을 쓰는데 `screens/` 는
 * `app/` 을 부를 수 없기 때문이다(`dep:check` 의 `app-inner-direction`). 여기 남은 것은
 * **셸만 쓰는 이름** 하나다.
 */

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
