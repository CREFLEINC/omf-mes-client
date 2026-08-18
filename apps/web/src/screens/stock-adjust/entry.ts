/**
 * 진입 맥락 — **주소가 정본이다**(D-2).
 *
 * 이 화면은 재고실사(W-01-04)의 마감 결과에서 넘어오는 자리라, 무엇을 조정하는지가 화면 상태가
 * 아니라 주소에 있어야 한다. 새로고침·뒤로가기·즐겨찾기·공유가 같은 실사를 열어야 하기 때문이다.
 * 라우터 `state`로 넘기면 그 넷에서 모두 사라진다.
 *
 * **친 값(라인 초안·사유)은 주소에 싣지 않는다.** 글자마다 뒤로가기 기록이 쌓이고,
 * 화면이 진입 맥락과 입력을 같은 통로로 다루게 된다.
 *
 * **조정 전표 번호를 받지 않는다.** 결재함이 문서를 지목해 여는 주소 규약이 계약에도 이
 * 저장소에도 없다(D-20) — 규약 없이 자리부터 만들면 「열었더니 그 문서가 아니다」가 된다.
 *
 * 이 화면이 소유한다 — 다른 화면 슬라이스의 같은 이름 파일을 참조하지 않는다.
 */

/** 주소 키는 짧게 쓰고 계약 이름과 분리한다 — 주소는 사람이 읽고 고치는 자리다. */
const URL_KEYS = {
  count: 'count',
} as const;

const POSITIVE_INTEGER = /^\d+$/;

/**
 * 대상 실사. **없으면 「직접 등록」으로 연다** — 맥락 없이 들어오는 것이 정상 경로다
 * (현장 실측·직접 등록은 실사를 거치지 않는다).
 *
 * 못 알아듣는 값은 없는 것으로 본다. 그대로 `Number()`에 넘기면 `NaN`이 조회 경로의 조각으로
 * 나가 요청이 늘 실패하고, 사용자에게는 「이 화면은 안 된다」로만 보인다. 주소를 손으로 고친
 * 경우가 이 자리다.
 */
export const readInventoryCountId = (params: URLSearchParams): number | null => {
  const raw = params.get(URL_KEYS.count) ?? '';

  return POSITIVE_INTEGER.test(raw) && Number(raw) >= 1 ? Number(raw) : null;
};

/**
 * 대상 실사만 지운 주소 — **가리키는 실사가 목록에 없을 때의 정리**다.
 *
 * **받은 것을 고치지 않는다** — `URLSearchParams`는 가변이라 그대로 고치면 화면이 읽던 값이
 * 렌더 밖에서 바뀐다. 이 결과는 반드시 `replace`로 넣는다(사본 체크리스트 1번) — 정리가
 * 히스토리에 칸을 쌓으면 뒤로가기가 없는 실사 주소로 되돌아가 같은 정리가 되풀이되고
 * 사용자가 갇힌다.
 */
export const withoutInventoryCountId = (params: URLSearchParams): URLSearchParams => {
  const next = new URLSearchParams(params);
  next.delete(URL_KEYS.count);

  return next;
};

/**
 * 고른 실사만 갈아 끼운 주소.
 *
 * 고르는 것도 **주소가 정본이다** — 고른 뒤 새로고침하면 같은 실사가 서야 하고, 재고실사에서
 * 넘어온 주소와 화면에서 고른 주소가 같은 모양이어야 두 경로가 갈리지 않는다.
 * 이 결과도 `replace`로 넣는다 — 고를 때마다 히스토리가 쌓이면 뒤로가기가 앞선 선택으로
 * 되돌아가 세운 대상이 말없이 사라진다.
 */
export const withInventoryCountId = (
  params: URLSearchParams,
  inventoryCountId: number,
): URLSearchParams => {
  const next = new URLSearchParams(params);
  next.set(URL_KEYS.count, String(inventoryCountId));

  return next;
};
