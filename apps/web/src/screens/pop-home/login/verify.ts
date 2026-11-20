import type { components } from '@omf-mes/api-client';

/**
 * 사번 확인 — **존재와 재직만 본다**(스펙 §5-5).
 *
 * ⛔ **자격을 검증하지 않는다.** 요구도 데이터도 있지만 자격 자료가 **아직 비어 있어**, 켜면
 * 전원이 무자격이 되어 현장이 선다. 자격 표시도 하지 않는다 — 비어 있는 자료를 보이면
 * 「자격 없음」이 모두에게 뜬다.
 *
 * ⛔ **권한을 판정하지 않는다.** 이 화면은 인증이 아니라 **귀속**이다(§5-1) — 「누가 한
 * 일로 기록할 것인가」만 정한다.
 *
 * ⛔ **계정 연결(`appUserId`)을 쓰지 않는다**(§5-3). 현장 작업자 대부분은 계정이 없고,
 * 계정이 있다고 권한을 주면 사용자×기능과 단말×공정 두 축이 섞인다.
 *
 * 이 화면이 소유한다 — 다른 화면 슬라이스의 같은 이름 파일을 참조하지 않는다.
 */

export type WorkerResponse = components['schemas']['Worker'];

/** 확인 결과. **거부 두 가지를 가른다** — 문구가 다르고 사용자가 할 일이 다르다. */
export type VerifyResult =
  | { kind: 'unknown' }
  | { kind: 'inactive'; worker: WorkerResponse }
  | { kind: 'ok'; worker: WorkerResponse; isOtherPlant: boolean };

/**
 * 조회 결과 한 건을 확인 결과로 옮긴다.
 *
 * ⛔ **재직 여부는 `isActive` 로 본다.** 계약이 「화면은 `statusCode` 로 판정하지 않는다」고
 * 못박았다 — 상태 코드는 값 목록이 열려 있어 화면이 뜻을 지어내게 된다.
 *
 * ⚠ **다른 공장 사번은 막지 않는다**(§6). 사번이 전역에서 유일해 조회가 되고, 현장에서
 * 사람이 옮겨 다니는 일이 실제로 있다 — **표시만 하고 통과시킨다.**
 *
 * `homePlantId` 가 없으면 견줄 기준이 없으므로 **다른 공장이라고 말하지 않는다** — 모르는
 * 것을 아는 것처럼 그리지 않는다.
 */
export const verifyWorker = (
  found: WorkerResponse | undefined,
  homePlantId: number | null,
): VerifyResult => {
  if (found === undefined) return { kind: 'unknown' };
  if (!found.isActive) return { kind: 'inactive', worker: found };

  return {
    kind: 'ok',
    worker: found,
    isOtherPlant: homePlantId !== null && found.plantId !== homePlantId,
  };
};

/**
 * 조회 응답에서 그 사번의 한 건을 고른다.
 *
 * ⛔ **첫 줄을 그냥 쓰지 않는다.** 정확 일치 조회라 0건 또는 1건이지만, 계약이 그것을
 * 보증한다고 화면이 확인을 생략하면 **응답이 달라졌을 때 엉뚱한 사람으로 귀속된다.**
 * 이 화면이 남기는 것은 「누가 했는가」이므로 그 한 번의 확인을 아끼지 않는다.
 */
export const pickExact = (
  items: readonly WorkerResponse[],
  workerNo: string,
): WorkerResponse | undefined => items.find((item) => item.workerNo === workerNo.trim());
