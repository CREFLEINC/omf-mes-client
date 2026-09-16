/**
 * POP 화면 위에 늘 서 있는 공통 조작 문구 — 모든 POP 화면이 함께 쓴다(공유계약 G-34).
 *
 * ⚠ 화면마다 다른 말을 만들지 않는다. 같은 조작이 화면마다 다르게 읽히면 작업자가 헷갈린다.
 */
export const popChrome = {
  /** 머리줄의 화면 이동 선택 단추. */
  screenNav: '화면 이동',
  /** 머리줄의 사번 놓기 단추. */
  userSwitch: '사용자 전환',
  /** 선택 단추가 따로 이름을 받지 않았을 때의 기본 이름. */
  select: '선택',

  /** 선택 팝업(`patterns/pop-select`). 쪽 넘김 단추는 `popPageNav` 를 쓴다. */
  selectDialog: {
    /** 무엇을 고르는지 이름을 알 수 없을 때. */
    fallbackName: '항목',
    title: (name: string): string => `${name} 선택`,
    searchLabel: '목록 검색',
    searchPlaceholder: '목록에서 검색',
    clearSearch: '검색어 지우기',
    empty: '표시할 항목이 없습니다.',
    position: (page: number, totalPages: number, count: number): string =>
      `${String(page)} / ${String(totalPages)} · 전체 ${String(count)}건`,
  },
};
