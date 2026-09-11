/**
 * 관리웹 사이드바의 **조작 문구**.
 *
 * 화면 이름과 묶음 이름은 여기 없다 - 그것은 차례와 배치 근거가 함께 사는
 * apps/web/src/app/nav-tree.ts 가 갖는다. 여기 있는 것은 검색·접기처럼
 * 사람이 사이드바에 하는 일의 이름뿐이다.
 */
export const shellNav = {
  search: {
    /* 보이는 라벨을 두지 않는다 - 사이드바에서 한 줄이 비싸다. 접근명으로만 쓴다. */
    label: '화면 검색',
    placeholder: '화면 이름으로 찾기',
    /* 맞는 것이 없을 때. 「없다」로 끝내지 않고 무엇을 하면 되는지 말한다. */
    empty: '일치하는 화면이 없습니다. 이름의 일부만 입력해 보세요.',
  },
  group: {
    /* 펼치기·접기 버튼의 접근명. 묶음 이름과 항목 수를 함께 읽어 준다. */
    expand: (label: string, count: number) => `${label} 펼치기 (화면 ${count}개)`,
    collapse: (label: string, count: number) => `${label} 접기 (화면 ${count}개)`,
  },
} as const;
