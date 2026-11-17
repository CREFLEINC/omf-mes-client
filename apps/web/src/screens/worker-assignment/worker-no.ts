/**
 * 사번 형식 — **전부 화면 책임이다**(스펙 §5-2).
 *
 * ```
 * worker_no  varchar(50) CHECK (VALUE <> '')      ← 저장소가 막는 것은 이것뿐이다
 * ```
 *
 * ⛔ **6자리 숫자가 아니면 [사번 확인] 때 조회하지 않고 다시 입력하게 한다**(사용자 지시
 * 2026-11-17 · omf-all-around#288). 전에는 표본이 작아 경고만 했으나, 시연 DB 작업자 786명이
 * 모두 6자리 숫자임을 확인하고 막는 쪽으로 바꿨다. [사번 확인] 단추 자체는 1자 이상이면 눌린다.
 *
 * ⭐ 「저장소에 제약이 없다」가 「규칙이 없다」는 뜻은 아니다 — 다만 **표본이 작으면 등급을
 * 한 단계 낮춘다**(A-9 · §9-2).
 *
 * 이 화면이 소유한다 — 다른 화면 슬라이스의 같은 이름 파일을 참조하지 않는다.
 */

/** 사번 형태 — 6자리 숫자. */
const EXPECTED_LENGTH = 6;

const DIGITS_ONLY = /^\d+$/;

/**
 * 확인을 누를 수 있는가 — **길이가 1 이상이면 된다**(§5-8).
 *
 * ⛔ 자릿수·형식을 여기서 보지 않는다. 그것을 보면 자릿수 강제가 된다.
 */
export const canSubmit = (workerNo: string): boolean => workerNo.trim() !== '';

/**
 * 6자리 숫자와 다른가 — [사번 확인]을 눌렀을 때 조회 대신 다시 입력하게 할지 정한다.
 *
 * 비어 있으면 아직 아무것도 치지 않은 것이라 걸지 않는다.
 */
export const looksUnusual = (workerNo: string): boolean => {
  const trimmed = workerNo.trim();

  if (trimmed === '') return false;

  return trimmed.length !== EXPECTED_LENGTH || !DIGITS_ONLY.test(trimmed);
};
