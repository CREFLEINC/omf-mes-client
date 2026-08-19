import type { ApiError } from '@omf-mes/api-client';

/**
 * 취소 요청이 **왜 거절됐는가** — 갈래는 둘뿐이다.
 *
 * | 갈래 | 화면이 하는 일 |
 * | --- | --- |
 * | **후속 때문에 막혔다** | 후속 목록을 **다시 부르고** 그 사실을 말한다 |
 * | 그 밖 | **서버 문구를 그대로** 낸다 |
 *
 * ⭐ **그 밖을 갈래로 쪼개지 않는다.** 계약이 이 400에 네 사유를 함께 적었으나
 * (후속 존재 · 이미 취소됨 · 취소 요청 진행 중 · 취소 결재선 없음) **코드가 붙은 것은
 * `SUCCESSOR_EXISTS` 하나**다. 나머지를 화면이 코드 없이 갈라 문면을 지어내면, 다른 이유로 온
 * 400에도 같은 안내가 붙는다 — 원인을 화면이 지어내는 것이 이 자리의 가장 큰 위험이다.
 *
 * ⛔ **후속 갈래의 문면에 「승인」이라는 낱말이 들어가지 않는다.** 이 단계는 **승인을 올리는**
 * 단계이고 아직 승인이 없다 — 「승인은 유효하지만…」은 취소 **실행**(단위 ④)의 문면이며 여기에
 * 쓰면 있지도 않은 승인을 있다고 말하게 된다.
 *
 * 이 화면이 소유한다 — 다른 화면 슬라이스의 같은 이름 파일을 참조하지 않는다.
 */

/** 계약이 400 설명에 **직접 적은** 코드. 이 화면이 견주는 유일한 오류 코드다. */
export const SUCCESSOR_EXISTS_CODE = 'SUCCESSOR_EXISTS';

/**
 * 정규화된 오류에 실려 온 **항목 코드들**.
 *
 * 코드를 담아 오는 갈래가 둘이다 — `validation`과 `stateLocked`. 정규화가 항목 중에
 * `STATE_LOCKED`가 하나라도 있으면 통째로 `stateLocked`로 옮기므로(`normalizeApiError` 실측),
 * **한 응답에 두 사유가 함께 실려 오면** `validation`만 보는 판정은 후속 사유를 놓친다.
 * 계약의 오류 본문이 **배열**인 것이 그 갈래가 실재한다는 뜻이다.
 */
const errorItemCodesOf = (error: ApiError): readonly string[] => {
  if (error.kind !== 'validation' && error.kind !== 'stateLocked') return [];

  return error.errors.map((item) => item.code);
};

/**
 * 이 거절이 **후속 문서 때문인가.**
 *
 * ⚠ **상태 코드로 좁히지 못한다 — 정규화가 그것을 버렸기 때문이다.** `normalizeApiError`는 본문에
 * 유효한 `errors` 배열이 있으면 **상태와 무관하게** `validation`·`stateLocked`를 내고 상태 코드를
 * 담지 않는다. 그래서 이 판정의 잣대는 **항목 코드 하나**이며, 그것은 상태보다 **좁은** 잣대다 —
 * 400 전체에 후속 문면을 붙이는 실패(계획 위험 R3)를 정확히 막는다.
 *
 * **남는 한계**: 계약이 `SUCCESSOR_EXISTS`를 400에만 두었으므로 다른 상태에 같은 코드가 실려 오면
 * 이 판정도 참이 된다. 상태를 잃지 않는 정규화가 있어야 그 자리까지 좁힐 수 있고, 그 고침은
 * `packages/api-client` 소관이라 이 슬라이스에서 하지 않는다(목록 쪽 400 판정과 같은 한계).
 */
export const isSuccessorBlocked = (error: ApiError): boolean =>
  errorItemCodesOf(error).includes(SUCCESSOR_EXISTS_CODE);
