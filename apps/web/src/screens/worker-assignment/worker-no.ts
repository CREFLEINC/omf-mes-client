/**
 * 사번 형식 — **전부 화면 책임이다**(스펙 §5-2).
 *
 * ```
 * worker_no  varchar(50) CHECK (VALUE <> '')      ← 저장소가 막는 것은 이것뿐이다
 * ```
 *
 * ⛔ **자릿수를 강제하지 않는다.** 실물 형식은 6자리 숫자로 보이지만 **극히 일부만**
 * 확인됐다. 강제했다가 5자리 사번이 하나라도 있으면 **그 사람이 단말을 못 쓴다.** 자릿수가
 * 다르면 경고를 띄우되 **확인은 눌리게** 한다.
 *
 * ⭐ 「저장소에 제약이 없다」가 「규칙이 없다」는 뜻은 아니다 — 다만 **표본이 작으면 등급을
 * 한 단계 낮춘다**(A-9 · §9-2).
 *
 * 이 화면이 소유한다 — 다른 화면 슬라이스의 같은 이름 파일을 참조하지 않는다.
 */

/** 실물에서 확인된 형태. **강제가 아니라 기대값이다.** */
const EXPECTED_LENGTH = 6;

const DIGITS_ONLY = /^\d+$/;

/**
 * 확인을 누를 수 있는가 — **길이가 1 이상이면 된다**(§5-8).
 *
 * ⛔ 자릿수·형식을 여기서 보지 않는다. 그것을 보면 자릿수 강제가 된다.
 */
export const canSubmit = (workerNo: string): boolean => workerNo.trim() !== '';

/**
 * 기대 형태와 다른가 — **경고를 띄울지만 정하는 값이다.** 막는 값이 아니다.
 *
 * 비어 있으면 아직 아무것도 치지 않은 것이라 경고하지 않는다 — 치기 시작하자마자 틀렸다고
 * 말하면 맞게 치는 사람에게 틀렸다고 하는 셈이다.
 */
export const looksUnusual = (workerNo: string): boolean => {
  const trimmed = workerNo.trim();

  if (trimmed === '') return false;

  return trimmed.length !== EXPECTED_LENGTH || !DIGITS_ONLY.test(trimmed);
};
