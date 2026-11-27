import type { PageMeta } from './types';

/**
 * 쪽 계산 — 「지금 어디를 보고 있는가」. 쪽 이동 줄은 공용 `PageNav`가 그린다(#361).
 *
 * 서버가 준 `page`를 정본으로 쓴다. 주소의 쪽 번호를 쓰면 서버가 다른 쪽을 돌려줬을 때
 * 표시와 내용이 어긋난다.
 *
 * 이 화면이 소유한다 — 다른 화면 슬라이스의 같은 이름 파일을 참조하지 않는다.
 */

export interface PageView {
  /** 1부터 센 현재 쪽 */
  page: number;
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
    totalPages,
    isBeyondLast: meta.total > 0 && page > totalPages,
  };
};
