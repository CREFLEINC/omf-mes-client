/**
 * 쪽 이동 계산 — 화면 구성 규범 C-8의 공용 부품이 쓰는 값.
 *
 * 서버 응답의 쪽 정보(`page`·`size`·`total`)만 받는다. 리소스 이름을 알지 않는다.
 */
export interface PageMetaInput {
  page: number;
  size: number;
  total: number;
}

export interface PageView {
  /** 1부터 센 현재 쪽 */
  page: number;
  /** 결과가 없으면 0이다 */
  totalPages: number;
  total: number;
  size: number;
  canPrev: boolean;
  canNext: boolean;
  /** 결과가 있는데 이 쪽에는 없다 — 주소 조작·조건 변경으로 생긴다. 빈 상태의 안내가 갈린다. */
  isBeyondLast: boolean;
}

export const toPageView = (meta: PageMetaInput): PageView => {
  // 서버가 0을 주면 나눗셈이 무한대가 된다. 계산이 깨지지 않게 하한을 둔다.
  const size = meta.size > 0 ? meta.size : 1;
  const page = meta.page > 0 ? meta.page : 1;
  const totalPages = Math.ceil(meta.total / size);

  return {
    page,
    totalPages,
    total: meta.total,
    size: meta.size,
    canPrev: page > 1,
    canNext: page < totalPages,
    isBeyondLast: meta.total > 0 && page > totalPages,
  };
};
