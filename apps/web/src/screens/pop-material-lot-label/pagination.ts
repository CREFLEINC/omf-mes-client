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
 * 소유한다(V3 워크플로 디자인 시스템 규칙).
 */

const t = messages.popMaterialLotLabel.pageNav;

/**
 * 한 쪽에 세우는 줄 수 — **고정이다**(사용자 지시 2026-09-19).
 *
 * ⭐ **줄이 중간에 잘리지 않게 하는 것이 이 값의 일이다.** 넘치는 줄은 잘라 보이는 대신 다음
 *    쪽으로 넘긴다 — 목록에 스크롤을 두지 않기로 했으므로(같은 지시), 잘린 줄은 «닿을 수 없는»
 *    줄이 된다.
 *
 * ⚠ **실기 해상도(1920×1080)에서 잰 값이다**(실측 2026-09-19). 줄 하나가 76px 인데 목록에 남는
 *   높이가 화면 상태에 따라 달라진다 — 사번 미확인 띠가 떠 있으면 653px, 없으면 717px 다.
 *   **띠가 있는 쪽에 맞춘다**: 아홉 줄(692px)은 그 상태에서 39px 넘쳐 마지막 줄이 반쯤 잘렸다.
 *
 * ⚠ 화면 스펙이 그린 1024×768 예산에서는 줄이 더 높아(104px) 이만큼 들어가지 않는다 — 그
 *   해상도를 쓰는 단말이 생기면 이 값을 화면 높이에서 «재는» 쪽으로 바꾼다.
 */
export const ROWS_PER_PAGE = 8;

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

/**
 * 줄 쪽까지 셈한 쪽 보기.
 *
 * ⭐ **쪽 나눔이 두 겹이다.** 서버는 입하 «건»을 쪽으로 자르고(기본 50건), 목록에 서는 것은 그
 *    건들이 품은 «자재 라인»이다. 건이 한 쪽 안에 다 들어가면 서버 쪽은 늘 1쪽이라, 줄이 아무리
 *    많아도 이전·다음이 영영 꺼져 있었다(omf-all-around#32 — 사용자 지적 2026-09-19).
 *
 * 그래서 **화면이 줄을 다시 쪽으로 자른다.** 줄 쪽을 다 넘기면 다음 «건 쪽»으로 이어 넘어간다 —
 * 사용자에게는 「다음」이 계속 동작하는 것으로 보인다.
 */
export interface LinePageView extends PageView {
  /** 이 쪽에 세울 줄의 구간(`rows.slice(start, end)`). */
  start: number;
  end: number;
}

/**
 * @param meta      서버가 준 **건** 쪽 정보
 * @param rowCount  이 건 쪽이 품은 **줄** 수(모든 건의 라인을 합친 것)
 * @param linePage  화면이 들고 있는 줄 쪽. 범위를 벗어나면 잡아 준다 — 앞 건 쪽으로 돌아갈 때
 *                  「마지막 줄 쪽」을 가리키려고 큰 수를 넣기 때문이다.
 */
export const toLinePageView = (
  meta: PageMeta,
  rowCount: number,
  linePage: number,
): LinePageView => {
  const serverView = toPageView(meta, rowCount);
  const linePages = Math.max(1, Math.ceil(rowCount / ROWS_PER_PAGE));
  const page = Math.min(Math.max(1, linePage), linePages);
  const start = (page - 1) * ROWS_PER_PAGE;

  return {
    ...serverView,
    page,
    totalPages: linePages,
    /*
     * ⚠ **세는 것은 「이 건 쪽 안의 줄 쪽」이다.** 다른 건 쪽이 줄을 몇 개 품었는지는 받아 보기
     *   전에는 알 수 없어, 전체를 통틀어 셀 방법이 없다 — 틀린 수를 말하느니 이 쪽 안에서만 센다
     *   (머리말의 「틀린 수를 말하지 않는다」와 같은 규율).
     *
     * ⚠ **줄이 없어도 자리는 말한다.** 이 건 쪽에 미발행 자재가 하나도 없을 수 있고(#1241),
     *   그때 「이 쪽에는 없다 · 다음 쪽을 보라」는 안내와 함께 지금 어디인지가 보여야 한다.
     *   받은 건이 아예 없을 때만 자리를 비운다.
     */
    rangeLabel: serverView.totalPages > 0 ? t.position(page, linePages) : '',
    canPrev: page > 1 || serverView.canPrev,
    canNext: page < linePages || serverView.canNext,
    start,
    end: start + ROWS_PER_PAGE,
  };
};

export const toPageView = (meta: PageMeta, shown: number): PageView => {
  // 서버가 0을 주면 나눗셈이 무한대가 된다. 계산이 깨지지 않게 하한을 둔다.
  const size = meta.size > 0 ? meta.size : 1;
  const page = meta.page > 0 ? meta.page : 1;
  const totalPages = Math.ceil(meta.total / size);

  return {
    page,
    totalPages,
    /*
     * 보이는 것이 없으면 자리를 지어내지 않는다 — 쪽 수가 0이면 「어디에 있는지」가 없다.
     * ⛔ 그 자리에 문구도 세우지 않는다(사용자 지시 2026-09-15) — 빈 목록 안내가 이미 말한다.
     */
    rangeLabel: totalPages > 0 ? t.position(page, totalPages) : '',
    canPrev: page > 1,
    canNext: page < totalPages,
    isBeyondLast: meta.total > 0 && page > totalPages,
  };
};
