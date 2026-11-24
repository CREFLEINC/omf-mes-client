/**
 * BOM 조회 (ERP). ERP 에서 받은 BOM 을 모품목 아래 하이라키로 읽기만 한다 — MES 확장 열은 보이지 않는다.
 */
export const erpBom = {
  title: 'BOM 조회 (ERP)',
  breadcrumbRoot: '시스템 관리',
  fields: {
    hasBom: 'BOM이 있는 품목',
    itemType: '품목 유형 선택',
    q: '품목 검색',
    qPlaceholder: '품목코드 또는 품목명을 입력하세요',
  },
  panes: {
    parents: '상위 품목 목록',
    filter: '조회 조건',
    components: '구성품',
  },
  /** 모품목 상세 — 하이라키 위 한 줄(품목 칸 · 그 BOM 칸). */
  parent: {
    label: '상위 품목 상세',
    itemCode: '품목코드',
    itemName: '품목명',
    itemType: '품목 유형',
    spec: '규격',
    baseUom: '기본 단위',
    bomCode: 'BOM 코드',
    bomVersion: '개정 번호',
    status: '상태',
    effective: '적용 기간',
    effectiveRange: (from: string, to: string): string => `${from} ~ ${to}`,
    baseQty: '기준 수량',
  },
  componentTable: {
    requiredQty: '소요량',
    scrapRate: '손실률',
    isMandatory: '필수 여부',
  },
  /** 하이라키 — 모품목 아래로 자품목, 자품목의 기본 BOM 구성을 한 단계씩 들여 쓴다. */
  tree: {
    /** 깊이 한도(20단계)에 닿아 더 펴지 않는다. */
    depthLimit: '더 깊은 단계는 펴지 않습니다',
    retry: (label: string): string => `${label} 하위 구성 다시 불러오기`,
    expand: (label: string): string => `${label} 펼치기`,
    collapse: (label: string): string => `${label} 접기`,
    loading: '불러오는 중',
    failed: '하위 구성을 불러오지 못했습니다',
    /** 같은 품목이 위 단계에 이미 있다 — 더 내려가지 않는다. */
    cycle: '상위에 같은 품목이 있어 더 펼치지 않음',
  },
  values: {
    empty: '—',
    /** 필수 여부 열 — 품목 확장속성의 구성품 표와 같은 말(「예 · 아니오」가 어색하다 — 사용자 지시 2026-11-24). */
    mandatory: '필수',
    optional: '선택',
    loadingName: '불러오는 중',
    failedName: '불러오지 못함',
    unknown: '등록되지 않은 품목',
  },
  loading: {
    parents: '상위 품목 목록을 불러오는 중',
    boms: 'BOM 을 불러오는 중',
  },
  empty: {
    parentsBeyondLast: '이 쪽에는 상위 품목이 없습니다',
    noParentsTitle: '조건에 맞는 상위 품목이 없습니다',
    noParentTitle: '상위 품목을 선택하세요.',
    noParentDescription: '목록에서 상위 품목을 고르면 품목 · BOM 정보와 구성품을 볼 수 있습니다.',
    noBomTitle: '이 품목에는 BOM 이 없습니다',
  },
} as const;
