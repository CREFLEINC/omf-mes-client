/**
 * 공통코드 조회 (ERP). ERP 가 보낸 공통코드 그룹과 값을 읽기만 한다.
 *
 * MES 자체 코드 그룹은 여기 나오지 않는다 — 고치는 곳은 기준정보의 공통코드 화면이다.
 */
export const erpCommonCode = {
  title: '공통코드 조회 (ERP)',
  breadcrumbRoot: '시스템 관리',
  /** 두 구획 사이 끌기 막대(키보드 ←·→ 로도 움직인다). */
  splitter: '끌어서 그룹·코드값 폭 조절',
  /** 막대 위쪽 끝의 단추 — 그룹 목록을 왼쪽으로 완전히 접고 편다. */
  listCollapse: 'ERP 코드 그룹 접기',
  listExpand: 'ERP 코드 그룹 펼치기',
  groups: {
    label: 'ERP 코드 그룹',
    groupCode: '그룹 코드',
    groupName: '그룹명',
    description: '설명',
    isActive: '사용',
    openAction: (groupCode: string): string => `${groupCode} 코드값 보기`,
    count: (count: number): string => `${String(count)}개 그룹`,
  },
  values: {
    label: '코드값',
    labelOf: (groupCode: string): string => `${groupCode} 코드값`,
    selectHint: '코드 그룹을 고르세요',
    code: '코드',
    codeName: '코드명',
    displayOrder: '표시 순서',
    effectiveFrom: '적용 시작',
    effectiveTo: '적용 종료',
    isActive: '사용',
  },
  fields: {
    q: '코드·코드명',
    includeInactive: '미사용 포함',
  },
  display: {
    empty: '—',
    active: '사용',
    inactive: '미사용',
  },
  actions: {
    prevPage: '이전',
    nextPage: '다음',
    goFirstPage: '첫 쪽으로',
  },
  pageNav: {
    label: '쪽 이동',
    range: (start: number, end: number, total: number): string =>
      `${String(start)}–${String(end)} / 전체 ${String(total)}건`,
    totalOnly: (total: number): string => `전체 ${String(total)}건`,
  },
  loading: {
    groups: 'ERP 코드 그룹을 불러오는 중',
    values: '코드값을 불러오는 중',
  },
  empty: {
    noGroupsTitle: 'ERP 에서 받은 코드 그룹이 없습니다',
    noValuesTitle: '조건에 맞는 코드값이 없습니다',
    beyondLastTitle: '이 쪽에는 코드값이 없습니다',
  },
} as const;
