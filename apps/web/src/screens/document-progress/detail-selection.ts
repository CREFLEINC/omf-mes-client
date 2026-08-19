import { findSelectableDocumentType, type DocumentTypeEntry } from './document-types';
import { normalizeText, type ProgressFilters } from './filters';

/**
 * 고른 문서 — **주소가 정본이다.**
 *
 * ⭐ **상세를 가리키려면 유형과 번호가 둘 다 있어야 한다.** 계약의 상세 경로가
 * `/logistics/document-progress/{documentTypeCode}/{documentId}`라 둘을 열쇠로 쓴다.
 *
 * ⭐ **유형은 조회 조건에서 온다 — 고른 행에서 읽지 않는다.** 목록 조회가 유형을 필수 질의값으로
 * 두어 한 응답의 모든 행이 같은 유형이므로 둘은 언제나 같은 값이고, 조건에서 읽으면 **목록 응답이
 * 오기 전에도** 상세를 부를 수 있다. 새로고침(주소만 들고 처음 그리는 경우)이 상세도 다시 부르는
 * 것이 그 결과다 — 행에서 읽으면 목록이 도착할 때까지 상세가 나가지 않고, 목록이 실패하면
 * 영영 나가지 않는다.
 *
 * ⭐ **잣대가 목록과 같다.** 유형 표가 비어 있거나 고를 수 없는 유형이면 목록도 상세도 나가지
 * 않는다(`findSelectableDocumentType` 한 곳이 판정한다) — 갈리면 목록은 못 부르는데 상세만
 * 나가는 화면이 된다.
 *
 * **선택 키를 `filters.ts`가 만들지 않는다.** 조건·쪽을 다시 쓰는 길(`toSearchParams`)이 이 키를
 * 만들지 않으므로 조건 변경·초기화·쪽 이동이 **저절로** 선택을 비운다 — 남겨 두면 아래 구획이
 * 위에 보이지 않는 문서를 가리킨 채 열려 있다. 고르는 쪽만 여기서 덧붙인다.
 *
 * 이 화면이 소유한다 — 다른 화면 슬라이스의 같은 이름 파일을 참조하지 않는다.
 */

/** 고른 문서의 주소 키. 조건 키와 달리 **이 파일이 소유한다**(위 머리말). */
export const DETAIL_SELECTION_KEY = 'sel';

export interface DetailSelection {
  documentTypeCode: string;
  documentId: number;
}

/**
 * 조건으로 받아들이는 번호의 모양 — `filters.ts`와 같은 규칙이다.
 *
 * 15자리로 끊는 이유도 같다: 안전 정수 범위 안이라 `Number()`가 값을 조용히 바꾸지 않고,
 * 지수 표기가 나타나는 21자리에도 한참 못 미친다. 여기서 새면 이상한 값이 **경로 조각**으로
 * 나가 상세 조회가 늘 실패하는데 화면에는 무언가 고른 것처럼 보인다.
 */
const POSITIVE_INTEGER = /^\d{1,15}$/;

/** 주소가 가리키는 문서 번호. 고르지 않았거나 이상한 값이면 `null`이다. */
export const readSelectedDocumentId = (params: URLSearchParams): number | null => {
  const raw = params.get(DETAIL_SELECTION_KEY) ?? '';

  return POSITIVE_INTEGER.test(raw) && Number(raw) >= 1 ? Number(raw) : null;
};

/**
 * 지금 상세를 부를 수 있는 대상 — 없으면 `null`이다.
 *
 * ⭐ **유형 표를 인자로 받는다**(자리표시 규율). 함수 안에서 상수를 읽으면 「표를 채우면 상세도
 * 살아난다」를 감지기가 잴 수 없다.
 */
export const toDetailSelection = (
  filters: ProgressFilters,
  entries: readonly DocumentTypeEntry[],
  params: URLSearchParams,
): DetailSelection | null => {
  const selected = findSelectableDocumentType(normalizeText(filters.documentType), entries);

  if (selected === null) return null;

  const documentId = readSelectedDocumentId(params);

  if (documentId === null) return null;

  return { documentTypeCode: selected.code, documentId };
};

/**
 * 고른 문서를 주소에 덧붙인다. **받은 주소를 바꾸지 않는다** — 부르는 쪽이 만든 조건 주소를
 * 뒤에서 고치면 같은 값에서 두 결과가 나온다.
 */
export const withSelection = (params: URLSearchParams, documentId: number): URLSearchParams => {
  const next = new URLSearchParams(params);

  next.set(DETAIL_SELECTION_KEY, String(documentId));

  return next;
};

/**
 * 고른 문서만 뗀다 — **조건은 그대로 둔다.**
 *
 * 없어진 문서 하나 때문에 사용자가 좁혀 둔 조건까지 되돌리지 않는다.
 */
export const withoutSelection = (params: URLSearchParams): URLSearchParams => {
  const next = new URLSearchParams(params);

  next.delete(DETAIL_SELECTION_KEY);

  return next;
};
