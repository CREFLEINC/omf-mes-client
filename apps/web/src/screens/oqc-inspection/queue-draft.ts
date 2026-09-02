import type { QueueFilters } from './filters';

/**
 * 조건 줄이 편집 중인 값. **전부 문자열이다** — 사용자가 치는 동안에는 아직 번호가 아니다.
 *
 * 주소·요청이 쓰는 `QueueFilters` 와 갈라 두는 이유는, 「비어 있음」과 「번호가 아님」이
 * 초안에서는 서로 다른 상태이고 요청에서는 둘 다 「좁히지 않음」이기 때문이다. 한 타입으로
 * 묶으면 **번호가 아닌 값을 조용히 무시**하게 되고, 사용자는 자기가 좁혔다고 믿는데 결과는
 * 좁혀지지 않은 상태가 된다.
 *
 * ⭐ **「대기·진행만 보기」는 초안에 없다.** boolean 이라 「치는 중」이 없고 잘못 칠 수도 없다 —
 * 검증할 것이 없는 값을 초안에 넣으면 검증 대상인 칸과 같은 자리에 서서, 읽는 사람이 이것도
 * 틀릴 수 있는 값이라고 읽는다. 조건으로 옮길 때 `toFilters` 가 인자로 받는다.
 *
 * 이 화면이 소유한다 — 다른 화면 슬라이스의 같은 이름 파일을 참조하지 않는다.
 */
export interface QueueDraft {
  item: string;
  keyword: string;
}

export const EMPTY_DRAFT: QueueDraft = { item: '', keyword: '' };

const POSITIVE_INTEGER = /^\d+$/;

/** 비었거나 1 이상 정수인가. 자원 번호는 1부터 매겨지므로 `0`·음수·소수·문자는 번호가 아니다. */
const isIdentifierOrEmpty = (raw: string): boolean => {
  const trimmed = raw.trim();

  if (trimmed === '') return true;

  return POSITIVE_INTEGER.test(trimmed) && Number(trimmed) >= 1;
};

/** 어느 번호 칸이 번호가 아닌가. 비어 있으면 그 칸은 조건이 아니므로 잘못된 것도 아니다. */
export interface DraftErrors {
  item: boolean;
}

export const validateDraft = (draft: QueueDraft): DraftErrors => ({
  item: !isIdentifierOrEmpty(draft.item),
});

export const hasError = (errors: DraftErrors): boolean => errors.item;

const toIdentifier = (raw: string): number | null => {
  const trimmed = raw.trim();

  return trimmed === '' ? null : Number(trimmed);
};

/**
 * 초안을 조건으로 옮긴다. **번호가 아닌 값이 없다는 전제**이며, 부르는 쪽이 `validateDraft`
 * 로 먼저 막는다 — 여기서 다시 판정하면 두 자리가 갈린다.
 */
export const toFilters = (draft: QueueDraft, pendingOnly: boolean): QueueFilters => ({
  itemId: toIdentifier(draft.item),
  keyword: draft.keyword.trim(),
  pendingOnly,
});

/** 주소가 담은 조건을 편집 초안으로 되돌린다 — 뒤로가기·초기화로 주소가 바뀌면 초안도 따라간다. */
export const toDraft = (filters: QueueFilters): QueueDraft => ({
  item: filters.itemId === null ? '' : String(filters.itemId),
  keyword: filters.keyword,
});
