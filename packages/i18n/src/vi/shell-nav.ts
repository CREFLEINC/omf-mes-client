import type { ko } from '../ko';
import type { Translated } from './translated';

/**
 * 관리웹 사이드바의 **조작 문구**.
 *
 * 화면 이름과 묶음 이름은 여기 없다 - 그것은 차례와 배치 근거가 함께 사는
 * apps/web/src/app/nav-tree.ts 가 `label`·`labelVi` 로 나란히 갖는다.
 */
export const shellNav: Translated<typeof ko.shellNav> = {
  search: {
    label: 'Tìm màn hình',
    placeholder: 'Tìm theo tên màn hình',
    empty: 'Không có màn hình nào khớp. Hãy thử nhập một phần của tên.',
  },
  group: {
    /* 항목 수만 싣는다 - 펼쳤는지는 aria-expanded 가 말한다(원문과 같은 규율). */
    name: (label: string, count: number) => `${label} (${String(count)} màn hình)`,
  },
};
