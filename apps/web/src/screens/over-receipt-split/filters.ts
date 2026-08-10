import { messages } from '@omf-mes/i18n';

/**
 * 조회 조건 — **주소가 정본이다.** 새로고침·뒤로가기·공유가 같은 결과를 내게 하려면
 * 화면 상태가 아니라 주소가 조건을 들고 있어야 한다.
 *
 * **초안(라인별 도착 수량)은 주소에 싣지 않는다.** 수량을 주소에 두면 글자마다 뒤로가기 기록이
 * 쌓이고, 화면이 조회 조건과 입력을 같은 통로로 다루게 된다. 초안의 수명은 `screen.tsx`의
 * 수명 표가 따로 정한다.
 *
 * 이 화면이 소유한다 — 다른 화면 슬라이스의 같은 이름 파일을 참조하지 않는다.
 */

const t = messages.overReceiptSplit;

export interface PoFilters {
  /** 공급사 번호. 정수만 뜻이 있다 — 계약이 `supplierId`를 정수로 요구한다. */
  supplier: string;
  /** 발주번호 검색어 */
  q: string;
  /**
   * 아직 입하가 끝나지 않은 발주만 본다.
   *
   * **화면 기본이 켬이다.** 이 화면의 대상은 「받을 것이 남은 발주」이고, 계약 기본은 `false`라
   * 싣지 않으면 이미 끝난 발주까지 온다 — 그중에서 초과 도착을 고를 이유가 없다.
   */
  openOnly: boolean;
}

/**
 * 화면이 아무 조건도 걸지 않은 상태. **「빈」이 아니라 「기본」이다** —
 * `openOnly`가 켜져 있는 것이 이 화면의 시작점이고, 초기화도 여기로 돌아온다.
 */
export const DEFAULT_FILTERS: PoFilters = { supplier: '', q: '', openOnly: true };

/** 주소 키는 짧게 쓰고 계약 이름과 분리한다 — 주소는 사람이 읽고 고치는 자리다. */
const URL_KEYS = {
  supplier: 'sup',
  q: 'q',
  openOnly: 'open',
  page: 'page',
  selectedPo: 'po',
} as const;

/** 켬이 기본이라 **끔만 주소에 적는다.** 이 값이 그 표식이다. */
const OPEN_ONLY_OFF = '0';

const POSITIVE_INTEGER = /^\d+$/;

/**
 * 정수가 아닌 번호는 조건으로 받지 않는다. 그대로 `Number()`에 넘기면 `NaN`이 요청 URL에 실려
 * **조회 전체가 400으로 실패**하고, 사용자에게는 「조회가 늘 안 된다」로만 보인다.
 * 주소를 손으로 고친 경우가 이 자리다.
 */
const readNumberFilter = (raw: string): string => (POSITIVE_INTEGER.test(raw) ? raw : '');

/** 공백만 친 검색어는 조건이 아니다 — 주소에 남기면 조건이 걸린 것처럼 보인다. */
const normalizeQuery = (raw: string): string => raw.trim();

export const readFilters = (params: URLSearchParams): PoFilters => ({
  supplier: readNumberFilter(params.get(URL_KEYS.supplier) ?? ''),
  q: params.get(URL_KEYS.q) ?? '',
  /*
   * 알 수 없는 값은 기본(켬)으로 본다. 주소를 손으로 고쳤을 때 화면이 못 알아듣는 값 때문에
   * **대상이 아닌 발주까지 보이는** 것보다, 기본으로 되돌아가는 편이 놀랍지 않다.
   */
  openOnly: params.get(URL_KEYS.openOnly) !== OPEN_ONLY_OFF,
});

/** 주소가 가리키는 쪽. 이상한 값은 첫 쪽으로 본다 — 주소는 손으로 고쳐지는 자리다. */
export const readPage = (params: URLSearchParams): number => {
  const raw = params.get(URL_KEYS.page) ?? '';

  return POSITIVE_INTEGER.test(raw) && Number(raw) >= 1 ? Number(raw) : 1;
};

/**
 * 고른 발주의 번호. **요청 쿼리에 실리지 않는다** — 라인 조회의 경로 조각으로만 쓴다.
 *
 * 주소에 두는 이유는 새로고침·뒤로가기·공유가 같은 발주를 열어야 하기 때문이다.
 */
export const readSelectedPoId = (params: URLSearchParams): number | null => {
  const raw = params.get(URL_KEYS.selectedPo) ?? '';

  return POSITIVE_INTEGER.test(raw) && Number(raw) >= 1 ? Number(raw) : null;
};

/**
 * 조건 전체를 주소로 옮긴다. **빈 조건은 키 자체를 두지 않는다** —
 * 주소가 조건을 그대로 드러내야 무엇으로 조회했는지 읽을 수 있다.
 *
 * 첫 쪽이면 `page`를, 켜진 미완료만이면 `open`을 적지 않는다. 기본값을 주소에 적으면
 * 같은 화면의 주소가 두 가지가 된다.
 *
 * **`po`(고른 발주)를 만들지 않는다.** 조건·쪽이 바뀌면 그 발주가 새 결과에 없을 수 있어
 * 함께 비워져야 하고(수명 표 1~3행), 고르는 쪽만 이 결과에 `po`를 덧붙인다.
 */
export const toSearchParams = (filters: PoFilters, page: number): URLSearchParams => {
  const next = new URLSearchParams();

  const entries: [string, string][] = [
    [URL_KEYS.supplier, readNumberFilter(filters.supplier)],
    [URL_KEYS.q, normalizeQuery(filters.q)],
  ];

  for (const [key, value] of entries) {
    if (value !== '') next.set(key, value);
  }

  if (!filters.openOnly) next.set(URL_KEYS.openOnly, OPEN_ONLY_OFF);
  if (page > 1) next.set(URL_KEYS.page, String(page));

  return next;
};

/** 계약이 쓰는 쿼리 이름. 공급사만 숫자로 보낸다 — 계약이 정수를 요구한다. */
export interface PoFilterQuery {
  supplierId?: number;
  q?: string;
  openOnly?: boolean;
}

export const toFilterQuery = (filters: PoFilters): PoFilterQuery => {
  const supplier = readNumberFilter(filters.supplier);
  const query = normalizeQuery(filters.q);

  return {
    ...(supplier === '' ? {} : { supplierId: Number(supplier) }),
    ...(query === '' ? {} : { q: query }),
    /* 끄면 싣지 않는다 — 계약 기본이 `false`라 보내는 것과 결과가 같고 요청 URL이 짧아진다. */
    ...(filters.openOnly ? { openOnly: true } : {}),
  };
};

/** 칩이 되는 조건. **미완료만은 칩이 아니다** — 확인칸 자체가 켬·끔을 그대로 보인다. */
export type ChipFilterKey = 'supplier' | 'q';

export interface FilterChip {
  key: ChipFilterKey;
  label: string;
  /** 제거 버튼의 접근 이름. 「제거」가 둘이면 어느 조건을 푸는 것인지 알 수 없다. */
  removeLabel: string;
}

/**
 * 참조 조건의 표시 이름. **화면이 이름으로 풀어 넘긴다.**
 *
 * 이 모듈이 번호를 문구로 바꾸지 않는 것이 #44를 구조로 막는 형태다 —
 * 내부 번호를 문자열로 만드는 자리가 아예 없으면 그 값이 화면에 샐 경로도 없다.
 */
export interface FilterChipNames {
  supplier: string;
}

/**
 * 적용된 조건마다 칩 하나. 순서는 조건 줄의 컨트롤 순서와 같다.
 *
 * **칩의 판정 기준을 요청의 판정 기준과 같게 둔다.** 둘이 갈리면 손으로 고친 주소
 * (`?q=%20%20`)에서 **조건은 걸리지 않는데 칩만 뜬다** — 사용자는 칩을 보고 조건이 걸린 줄 알고,
 * 결과가 그대로인 이유를 화면 어디에서도 읽을 수 없다. 다듬은 값으로 재고 다듬은 값을 보인다.
 */
export const toFilterChips = (filters: PoFilters, names: FilterChipNames): FilterChip[] => {
  const query = normalizeQuery(filters.q);

  const candidates: [FilterChip, string][] = [
    [
      {
        key: 'supplier',
        label: t.filters.chipSupplier(names.supplier),
        removeLabel: t.filters.chipRemoveSupplier,
      },
      readNumberFilter(filters.supplier),
    ],
    [{ key: 'q', label: t.filters.chipQ(query), removeLabel: t.filters.chipRemoveQ }, query],
  ];

  return candidates.filter(([, value]) => value !== '').map(([chip]) => chip);
};
