/**
 * 거래처 조회 (ERP). 거래처 본체와 역할은 ERP 수신본이라 이 화면은 읽기만 한다.
 *
 * 역할 표시명은 계약의 다섯 코드(고객사·공급사·외주 제작사·폐기 업체·기타)에 붙는다.
 * 어휘 밖 코드는 서버가 준 이름이나 코드값 그대로 낸다 — 이름을 지어내지 않는다.
 */
export const erpPartner = {
  title: '거래처 조회 (ERP)',
  breadcrumbRoot: '시스템 관리',
  panes: {
    filter: '조회 조건',
    list: '거래처 목록',
  },
  fields: {
    q: '거래처 코드·명',
    role: '역할',
    includeInactive: '미사용 포함',
  },
  table: {
    partnerCode: '거래처 코드',
    partnerName: '거래처명',
    erpPartnerCode: 'ERP 거래처 코드',
    countryCode: '국가',
    roles: '역할',
    isActive: '사용',
  },
  roleNames: {
    customer: '고객사',
    supplier: '공급사',
    subcontractor: '외주 제작사',
    disposal: '폐기 업체',
    other: '기타',
  },
  values: {
    all: '전체',
    empty: '—',
    active: '사용',
    inactive: '미사용',
    rolesLoading: '불러오는 중',
    rolesFailed: '불러오지 못함',
    roleSeparator: ', ',
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
    list: '거래처 목록을 불러오는 중',
  },
  empty: {
    noResultTitle: '조건에 맞는 거래처가 없습니다',
    beyondLastTitle: '이 쪽에는 거래처가 없습니다',
  },
} as const;
