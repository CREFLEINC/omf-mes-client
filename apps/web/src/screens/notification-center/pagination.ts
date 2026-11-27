import type { PageMeta } from './types';

/**
 * 쪽 계산 — 「지금 어디를 보고 있는가」. 쪽 이동 줄은 공용 `PageNav`가 그린다(#361).
 *
 * **서버가 준 `page`를 정본으로 쓴다.** 주소의 쪽 번호를 쓰면 서버가 다른 쪽을 돌려줬을 때
 * 표시와 내용이 어긋난다.
 *
 * **쪽 수는 응답의 `size`로만 센다** — 화면이 상수를 심으면 서버 기본이 바뀔 때 두 값이 갈려
 * 쪽 수가 실제와 어긋난다.
 *
 * 이 화면이 소유한다 — 다른 화면 슬라이스의 같은 이름 파일을 참조하지 않는다.
 */

export interface PageView {
  /** 1부터 센 현재 쪽 */
  page: number;
  /** 한 쪽 건수 · 전체 건수 — 공용 쪽 이동 줄(총 N건 · n / m)에 그대로 넘긴다(#360). */
  size: number;
  total: number;
  totalPages: number;
  /** 결과가 있는데 이 쪽에는 없다 — 주소 조작·조건 변경으로 생긴다. 빈 상태의 안내가 갈린다. */
  isBeyondLast: boolean;
}

export const toPageView = (meta: PageMeta): PageView => {
  // 서버가 0을 주면 나눗셈이 무한대가 된다. 계산이 깨지지 않게 하한을 둔다.
  const size = meta.size > 0 ? meta.size : 1;
  const page = meta.page > 0 ? meta.page : 1;
  const totalPages = Math.ceil(meta.total / size);

  return {
    page,
    size,
    total: meta.total,
    totalPages,
    isBeyondLast: meta.total > 0 && page > totalPages,
  };
};
