/**
 * 이 화면이 검사할 **대상을 어떻게 받는가.**
 *
 * ⭐ **목록을 두지 않는다.** 스펙 §5-9 의 액션 표에 조회·필터가 없고, 화면 전이가
 * 「작업 화면에서 진입」이다 — 대상이 **이미 정해진 채로** 열리는 화면이다. 목록을 얹으면
 * 설계에 없는 액션이 화면의 첫 인상이 된다.
 *
 * ⚠ **그 작업 화면이 아직 없다**(POP 진입점·작업 시작이 미완). 답이 올 때까지 진입 인자로
 * 의뢰 식별자를 받고, 없으면 **안내만 그린다**(검토 요청 omf-mes#257 — A안).
 * ⛔ 임시 목록을 만들어 메우지 않는다: 그것이 처음 만들었다가 걷어낸 것이고, 설계가 B안을
 * 고르면 그때 «설계가 정한 형태»로 얹는 편이 두 번 짓는 것보다 싸다.
 *
 * 이 화면이 소유한다 — 다른 화면 슬라이스의 같은 이름 파일을 참조하지 않는다.
 */

/** 진입 인자의 이름. 주소는 사람이 읽고 고치는 자리라 짧게 쓴다. */
export const TARGET_KEY = 'ir';

const POSITIVE_INTEGER = /^\d+$/;

/**
 * 진입 인자에서 검사 의뢰를 읽는다.
 *
 * 자원 번호는 1부터 매겨지므로 `0`·음수·소수·문자는 **어떤 자원도 가리키지 않는다.**
 * 그대로 실어 보내면 서버가 무엇을 하는지 계약이 말하지 않는다.
 */
export const readTargetId = (params: URLSearchParams): number | null => {
  const raw = params.get(TARGET_KEY);

  if (raw === null || !POSITIVE_INTEGER.test(raw)) return null;

  const value = Number(raw);

  return value >= 1 ? value : null;
};
