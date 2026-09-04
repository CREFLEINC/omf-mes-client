import type { ControlLevelCode, DecisionCode, OverallResultCode } from './codes';

/**
 * 작업 전 점검 통제의 **판정식 한 곳**(스펙 §5-5 · §5-7 · §5-8).
 *
 * ⭐ **순수 함수로 떼어 둔다** — 이 판정이 작업을 막는다. 화면 안에 섞여 있으면 무엇이
 * 막았는지 시험으로 고정할 수 없다.
 *
 * ⛔ **「모르면 통과」가 없다.** 조회가 실패했거나 통제 수준을 못 읽은 상태는 이 함수에
 * 오지 않는다 — 부르는 쪽이 먼저 막고, 정책이 없으면 `WARN` 으로 바꿔 넘긴다(F-6 · §6).
 *
 * 이 화면이 소유한다 — 다른 화면 슬라이스의 같은 이름 파일을 참조하지 않는다.
 */

/** 판정에 쓰는 점검 한 유형 — 주기 창과 그 창 «안의» 가장 최근 한 건. */
export interface PrecheckTarget {
  inspectionTypeCode: string;
  /** 이 유형의 주기 창이 언제부터인가(`YYYY-MM-DD`). 화면이 「주기 내」를 그릴 때 쓴다. */
  windowFrom: string;
  latest: {
    inspectionId: number;
    inspectedAt: string;
    overallResultCode: OverallResultCode;
    workerNo?: string | null;
  } | null;
}

export interface VerdictInput {
  /** 화면이 읽은 통제 수준. ⚠ 적용 정책이 없으면 부르는 쪽이 `WARN` 으로 바꿔 넘긴다. */
  controlLevel: ControlLevelCode;
  /** 긴급 작업지시인가 — 우회가 열리는 유일한 조건이다(§5-8). */
  isEmergency: boolean;
  /** 이 설비에 부여된 점검 유형별 판정 재료. 비어 있으면 **점검 대상이 아니다.** */
  targets: readonly PrecheckTarget[];
}

/** 무엇이 판정을 갈랐는가 — 화면이 문구를 고르는 축이다. */
export type VerdictReason = 'passed' | 'failed' | 'missing';

export interface Verdict {
  decisionCode: DecisionCode;
  reason: VerdictReason;
  /** 게이트가 화면에 뜨는가. ⭐ **통과면 뜨지 않는다** — 게이트는 막을 때만 보인다(§9-3). */
  isGateShown: boolean;
  /** 이 판정으로 작업 세션을 열 수 있는가. 경고는 확인 다이얼로그를 거친다. */
  canProceed: boolean;
  /** 「우회하고 시작」이 열리는가. ⛔ NG 면 긴급이어도 열리지 않는다(§5-7). */
  canOverride: boolean;
  /** 근거로 삼은 점검 헤더. ⚠ 이력이 없으면 비운다 — 0 으로 채우지 않는다. */
  basisInspectionId: number | null;
}

/** 가장 최근 것이 통제 판정에 쓰인다(§5-5 · §6-2). */
const latestOf = (targets: readonly PrecheckTarget[]): PrecheckTarget['latest'] =>
  targets.reduce<PrecheckTarget['latest']>((newest, target) => {
    if (target.latest === null) return newest;
    if (newest === null) return target.latest;

    return target.latest.inspectedAt > newest.inspectedAt ? target.latest : newest;
  }, null);

export const decide = ({ controlLevel, isEmergency, targets }: VerdictInput): Verdict => {
  const failures = targets.filter((target) => target.latest?.overallResultCode === 'FAIL');

  /*
   * ⛔ **NG 는 통제 수준과 무관하게 막는다**(§5-7). 「미적용」은 「점검을 안 해도 된다」는
   *    뜻이지 「NG 인데 돌려도 된다」가 아니다 — 한 값이 두 가지를 정하게 하지 않는다(A-14).
   */
  if (failures.length > 0) {
    return {
      decisionCode: 'BLOCKED',
      reason: 'failed',
      isGateShown: true,
      canProceed: false,
      canOverride: false,
      basisInspectionId: latestOf(failures)?.inspectionId ?? null,
    };
  }

  const hasMissing = targets.some((target) => target.latest === null);

  if (!hasMissing) {
    /* 부여가 없으면 점검 대상이 아니라 여기로 온다 — 근거 점검도 없다. */
    return {
      decisionCode: 'PASSED',
      reason: 'passed',
      isGateShown: false,
      canProceed: true,
      canOverride: false,
      basisInspectionId: latestOf(targets)?.inspectionId ?? null,
    };
  }

  if (controlLevel === 'OFF') {
    return {
      decisionCode: 'PASSED',
      reason: 'passed',
      isGateShown: false,
      canProceed: true,
      canOverride: false,
      basisInspectionId: null,
    };
  }

  /*
   * ⭐ **우회는 긴급 W/O + 「이력 없음」일 때만 열린다**(§5-8). 경고 수준에서도 마찬가지로
   *    열어 둔다 — 경고는 「진행」으로도 풀리지만, 긴급 지시라는 사실은 기록이 달라야 한다.
   */
  return {
    decisionCode: controlLevel === 'BLOCK' ? 'BLOCKED' : 'WARNED',
    reason: 'missing',
    isGateShown: true,
    canProceed: controlLevel === 'WARN',
    canOverride: isEmergency,
    basisInspectionId: null,
  };
};
