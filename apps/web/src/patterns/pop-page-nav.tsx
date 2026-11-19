/**
 * 서버가 쪽으로 주는 목록의 쪽 정보(공유계약 G-34). 쪽 넘김 화면 부품은 POP 공통 쪽 넘김
 * (`patterns/pop-uniform` 의 `PuPager` · #295)으로 옮겼다.
 */
export interface PageMetaLike {
  page: number;
  size: number;
  total: number;
}
