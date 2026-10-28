/**
 * BOM 조회 (ERP). ERP 에서 받은 BOM 을 모품목 아래 하이라키로 읽기만 한다 — MES 확장 열은 보이지 않는다.
 */
export const erpBom = {
  title: 'BOM 조회 (ERP)',
  breadcrumbRoot: '시스템 관리',
  fields: {
    parentItem: '모품목',
  },
  actions: {
    pickParent: '모품목 선택',
    confirmPick: '선택',
  },
  panes: {
    filter: '조회 조건',
    components: '구성품',
  },
  /** 모품목 상세 — 하이라키 위 한 줄(품목 칸 · 그 BOM 칸). */
  parent: {
    label: '모품목 상세',
    itemCode: '품목코드',
    itemName: '품목명',
    itemType: '유형',
    spec: '규격',
    baseUom: '기본 단위',
    bomCode: 'BOM 코드',
    bomVersion: 'Rev',
    status: '상태',
    effective: '유효 기간',
    effectiveRange: (from: string, to: string): string => `${from} ~ ${to}`,
    baseQty: '기준 수량',
  },
  componentTable: {
    requiredQty: '소요량',
    scrapRate: '손실률',
    isMandatory: '필수',
  },
  /** 하이라키 — 모품목 아래로 자품목, 자품목의 기본 BOM 구성을 한 단계씩 들여 쓴다. */
  tree: {
    item: '품목',
    expand: (label: string): string => `${label} 펼치기`,
    collapse: (label: string): string => `${label} 접기`,
    loading: '불러오는 중',
    failed: '하위 구성을 불러오지 못했습니다',
    /** 같은 품목이 위 단계에 이미 있다 — 더 내려가지 않는다. */
    cycle: '위 단계와 같은 품목',
  },
  values: {
    empty: '—',
    yes: '예',
    no: '아니오',
    notPicked: '선택 안 함',
    loadingName: '불러오는 중',
    failedName: '불러오지 못함',
    unknown: '알 수 없음',
  },
  loading: {
    boms: 'BOM 을 불러오는 중',
  },
  empty: {
    noParentTitle: '모품목을 고르세요',
    noBomTitle: '이 품목에는 BOM 이 없습니다',
  },
} as const;
