/**
 * POP 목록의 쪽 넘김 문구 — 여러 화면이 함께 쓴다(공유계약 G-34).
 *
 * ⚠ 무엇의 쪽인지는 부르는 화면이 정한다(랜드마크 이름). 여기 두는 것은 두 단추와 현재
 * 위치뿐이다 — 화면마다 다른 말을 만들면 같은 조작이 다르게 읽힌다.
 */
export const popPageNav = {
  /*
   * 쪽 이동은 관리웹 페이지 이동(`screenPatterns.pageNav`)과 같은 말이다. 목록은 스크롤로 움직이므로
   * 「위」, 「아래」처럼 스크롤로 읽히는 이름을 쓰지 않는다(화면 용어집).
   */
  prev: '이전',
  next: '다음',
  position: (page: number, totalPages: number): string =>
    `${String(page)} / ${String(Math.max(totalPages, 1))}`,
};
