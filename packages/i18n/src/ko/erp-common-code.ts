/**
 * 공통코드 조회 (ERP). ERP 가 보낸 공통코드 그룹과 값을 읽기만 한다.
 *
 * MES 자체 코드 그룹은 여기 나오지 않는다 — 고치는 곳은 기준정보의 공통코드 화면이다.
 */
export const erpCommonCode = {
  title: '공통코드 조회 (ERP)',
  breadcrumbRoot: '시스템 관리',
  panes: {
    filter: '조회 조건',
    detail: '코드그룹 상세',
  },
  groups: {
    label: 'ERP 코드그룹 목록',
    groupCode: '그룹코드',
    groupName: '그룹명',
    description: '설명',
    isActive: '사용 여부',
  },
  values: {
    label: '코드값',
    labelOf: (groupCode: string): string => `${groupCode} 코드값`,
    filterLabel: '코드값 조회 조건',
    code: '코드',
    codeName: '코드명',
    displayOrder: '정렬 순서',
    effectiveFrom: '유효 시작일',
    effectiveTo: '유효 종료일',
    isActive: '사용 여부',
  },
  fields: {
    groupSearch: '코드그룹 검색',
    groupSearchPlaceholder: '그룹코드 또는 그룹명을 입력하세요',
    q: '코드값 검색',
    /** 코드값 검색 칸의 흐린 안내 — 그룹 검색 칸과 같은 모양(사용자 지시 2026-11-24 · 용어 통일). */
    qPlaceholder: '코드 또는 코드명을 입력하세요',
    includeInactive: '미사용 포함',
  },
  display: {
    empty: '—',
    active: '사용',
    inactive: '미사용',
  },
  actions: {
    goFirstPage: '첫 쪽으로',
  },
  loading: {
    groups: 'ERP 코드그룹을 불러오는 중',
    values: '코드값을 불러오는 중',
  },
  empty: {
    noGroupsTitle: 'ERP에서 받은 코드그룹이 없습니다',
    noValuesTitle: '조건에 맞는 코드값이 없습니다',
    beyondLastTitle: '이 쪽에는 코드값이 없습니다',
    noMatchTitle: '조건에 맞는 코드그룹이 없습니다',
    pickTitle: '코드그룹을 선택하세요.',
    pickDescription: '목록에서 코드그룹을 고르면 그 그룹의 정보와 코드값을 볼 수 있습니다.',
  },
} as const;
