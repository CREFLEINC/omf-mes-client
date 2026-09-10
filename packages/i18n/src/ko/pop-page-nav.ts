/**
 * POP 목록의 쪽 넘김 문구 — 여러 화면이 함께 쓴다(공유계약 G-34).
 *
 * ⚠ 무엇의 쪽인지는 부르는 화면이 정한다(랜드마크 이름). 여기 두는 것은 두 단추와 현재
 * 위치뿐이다 — 화면마다 다른 말을 만들면 같은 조작이 다르게 읽힌다.
 */
export const popPageNav = {
  pageUp: '페이지 위',
  pageDown: '페이지 아래',
  position: (page: number, totalPages: number): string =>
    `${String(page)} / ${String(totalPages)} 쪽`,
};
