/**
 * 쪽으로 나뉘어 오는 목록을 **끝까지 받는다.**
 *
 * 이름을 푸는 참조 목록은 첫 쪽만 받으면 그 뒤의 값이 표에서 「알 수 없음」으로 찍히고
 * 선택지에서도 고를 수 없다. 그 문구는 이 저장소가 *값이 잘못됐다*는 신호로 정의해 둔
 * 말이라(`omf-mes#47`) 정상 값에 붙으면 사용자에게 정반대로 읽힌다 —
 * 거래처 936건 중 첫 50건만 받아 여섯 줄이 그렇게 섰다(omf-all-around#38).
 *
 * ⛔ **아무 목록에나 쓰지 않는다.** 마스터가 수천 건이면 첫 진입에 수십 번을 부르게 되고,
 *    얻는 것은 화면에 실제로 뜬 몇 줄의 이름뿐이다. 그런 자리(품목 9,269건)는
 *    **번호로 하나씩** 푼다(omf-all-around#37). 이 헬퍼는 **목록 자체가 필요한 자리**의
 *    것이다 — 표에 이름을 내면서 조건 줄의 선택지로도 쓰는 참조.
 * ⭐ 같은 루프가 `goods-receipt` · `pop-material-lot-label` 에 두 벌 복사돼 있었다.
 *    세 벌째를 적기 전에 여기로 모았다.
 *
 * **멈추는 조건이 셋이다.** 하나라도 빠지면 끝나지 않거나 덜 받는다.
 *
 * | 조건 | 왜 |
 * | --- | --- |
 * | 받은 수가 총계에 닿음 | 정상 종료 |
 * | 쪽 수 상한 | 서버가 **잘못된 총계**를 주면 끝없이 부른다 |
 * | 빈 쪽 · 엉뚱한 쪽 번호 | 더 받아도 **새 사실이 없다**(서버가 쪽 크기를 낮춰 적용할 수 있다) |
 *
 * ⛔ **`size` 로 세지 않는다.** 서버가 요청한 쪽 크기를 낮춰 적용할 수 있어 「받은 수 === size」를
 *    이어 받는 조건으로 삼으면 두 쪽째에서 멈춘다. 받은 **누계와 총계**를 견준다.
 */

/** 이 목록 조회들이 공통으로 내려주는 쪽 정보. 화면 슬라이스의 같은 이름 타입과 모양이 같다. */
export interface PageMeta {
  page: number;
  size: number;
  total: number;
}

export interface PagedResponse<Item> {
  items: Item[];
  page: PageMeta;
}

export interface AllPagesResult<Item> {
  items: Item[];
  /** **첫 쪽의 것**이다 — `total` 이 전체 건수라 잘림 판정의 잣대가 된다. */
  page: PageMeta;
  /**
   * 다 받지 못했는가. 쪽 수 상한에 걸렸거나 서버가 도중에 멈춘 경우다.
   *
   * 읽는 쪽이 이 사실을 밝혀야 한다 — 밝히지 않으면 사용자가 **불완전한 목록을 완전한 것으로
   * 읽고** 찾는 값이 없으면 「그런 거래처가 없다」로 결론짓는다.
   */
  truncated: boolean;
}

/** 한 번에 받는 건수 — 서버 상한과 같다. 이보다 크게 요청해도 서버가 잘라 적용한다. */
export const PAGE_SIZE = 200;

/**
 * 끝까지 받되 이 쪽 수에서 멈춘다(200 × 25 = 5,000건).
 *
 * 서버가 잘못된 총계를 줄 때 끝없이 부르지 않게 하는 방어선이다. 여기에 걸리면 `truncated` 다.
 */
export const MAX_PAGES = 25;

export const fetchAllPages = async <Item>(
  fetchPage: (page: number, size: number) => Promise<PagedResponse<Item>>,
  options: { size?: number; maxPages?: number } = {},
): Promise<AllPagesResult<Item>> => {
  const size = options.size ?? PAGE_SIZE;
  const maxPages = options.maxPages ?? MAX_PAGES;

  const first = await fetchPage(1, size);
  const items = [...first.items];

  for (let page = 2; page <= maxPages && items.length < first.page.total; page += 1) {
    const next = await fetchPage(page, size);

    /* 빈 쪽이나 엉뚱한 쪽이 오면 더 받아도 새 사실이 없다. */
    if (next.items.length === 0 || next.page.page !== page) break;

    items.push(...next.items);
  }

  return { items, page: first.page, truncated: items.length < first.page.total };
};
