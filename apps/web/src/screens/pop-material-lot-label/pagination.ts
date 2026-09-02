import { messages } from '@omf-mes/i18n';

import type { PageMeta } from './types';

/**
 * 쪽 계산 — 「지금 어디를 보고 있는가」와 「어디로 갈 수 있는가」.
 *
 * 서버가 준 `page`를 정본으로 쓴다. 화면이 들고 있는 쪽 번호를 쓰면 서버가 다른 쪽을
 * 돌려줬을 때 표시와 내용이 어긋난다.
 *
 * **이 화면 슬라이스가 소유한다** — 다른 화면 슬라이스의 같은 이름 파일을 참조하지 않는다.
 * 디자인 시스템에 페이지 이동 부품이 없어 조합으로 만드는 자리이고, 조합물은 쓰는 화면이
 * 소유한다(루트 CLAUDE.md 갭 분류 `c`).
 */

const t = messages.popMaterialLotLabel.pageNav;

export interface PageView {
  /** 1부터 센 현재 쪽 */
  page: number;
  totalPages: number;
  /**
   * 「3쪽 중 1쪽」 — **세는 단위를 두지 않는다.**
   *
   * ⛔ 「N–M / 전체 K건」으로 적지 않는다. 쪽 나눔은 «입하 건» 단위인데 목록의 줄은 «자재»라
   * (스펙 §3-6 — 한 건에 자재가 여럿이면 라벨도 여러 장이다) 두 수가 영영 맞지 않는다.
   * 「1–5 / 전체 12건」 옆에 줄이 일곱이면 사용자는 화면을 의심한다.
   *
   * 계약이 «자재» 단위로 쪽을 잘라 주지 않아 이 어긋남을 화면이 없앨 수 없다 — 그래서
   * **틀린 수를 말하지 않는 쪽**을 고른다. 쪽 번호는 어느 단위로 세든 같다.
   */
  rangeLabel: string;
  canPrev: boolean;
  canNext: boolean;
  /** 결과가 있는데 이 쪽에는 없다 — 조건이 바뀌면 생긴다. 빈 상태의 안내가 갈린다. */
  isBeyondLast: boolean;
}

export const toPageView = (meta: PageMeta, shown: number): PageView => {
  // 서버가 0을 주면 나눗셈이 무한대가 된다. 계산이 깨지지 않게 하한을 둔다.
  const size = meta.size > 0 ? meta.size : 1;
  const page = meta.page > 0 ? meta.page : 1;
  const totalPages = Math.ceil(meta.total / size);

  return {
    page,
    totalPages,
    // 보이는 것이 없으면 자리를 지어내지 않는다 — 쪽 수가 0이면 「어디에 있는지」가 없다.
    rangeLabel: totalPages > 0 ? t.position(page, totalPages) : t.empty,
    canPrev: page > 1,
    canNext: page < totalPages,
    isBeyondLast: meta.total > 0 && page > totalPages,
  };
};
