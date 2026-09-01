/**
 * ③ 누계 구획이 그리는 값들.
 *
 * ⛔ **여기서 나오는 「저장 후」 값은 전부 예상치다.** 실제로 더하는 것은 서버이고(스펙 §5-2),
 * 화면은 저장 전에 사용자가 판단할 수 있도록 미리 셈해 보일 뿐이다. 그 사실을 ④ 안내가 상시
 * 말한다 — 예상치를 확정값처럼 그리면 다른 단말이 동시에 더한 몫이 조용히 빠진다.
 */

/**
 * 값 하나를 세 모양으로 가른다.
 *
 * ⛔ **없는 값을 0 으로 채우지 않는다**(공유계약 G-9 · G-15). 사용 가능 0 은 「지금 다 썼다」는
 * 사실이라 예방보전이 도래한 것처럼 보인다 — 값이 없는 것과 0 인 것은 다른 사실이다.
 * ⭐ **못 세는 이유를 가른다** — 「적정타수가 비어서」는 마스터에서 채우면 풀리고,
 * 「연결이 끊겨서」는 연결이 돌아오면 풀린다. 한 말로 뭉개면 할 일이 묻힌다.
 */
export type ShotFigure =
  { kind: 'value'; value: number } | { kind: 'guaranteedMissing' } | { kind: 'offline' };

export interface FigureInput {
  /** 서버가 들고 있는 누계 */
  currentShotCount: number;
  /** 적정타수. 마스터에서 비워 둘 수 있다 */
  guaranteedShotCount: number | null | undefined;
  /** 이번에 더할 값. 아직 기입 전이면 `null` */
  increment: number | null;
  isOnline: boolean;
}

const arrived = (value: number | null | undefined): value is number =>
  value !== null && value !== undefined;

/**
 * 저장 후 누계 = 서버 누계 + 이번 입력.
 *
 * ⛔ **연결이 끊기면 그리지 않는다**(스펙 §6-2). 캐시 누계에 내 입력을 더한 값은 그 사이 다른
 * 단말이 더한 몫을 빼먹은 숫자라, 「사용 가능」이 실제보다 커 보인다 — 작업자는 그 숫자를 보고
 * 계속 돌린다. 모르는 값은 그럴듯한 숫자로 그리지 않는다.
 */
export const projectedTotal = (input: FigureInput): ShotFigure => {
  if (!input.isOnline) return { kind: 'offline' };

  return { kind: 'value', value: input.currentShotCount + (input.increment ?? 0) };
};

/** 사용 가능 = 적정타수 − 저장 후 누계. **음수가 그대로 나온다** — 넘긴 만큼이 곧 위험 크기다. */
export const availableShots = (input: FigureInput): ShotFigure => {
  const projected = projectedTotal(input);

  if (projected.kind !== 'value') return projected;
  if (!arrived(input.guaranteedShotCount)) return { kind: 'guaranteedMissing' };

  return { kind: 'value', value: input.guaranteedShotCount - projected.value };
};

/** 저장 후 누계 ÷ 적정타수 백분율. 100 을 넘을 수 있다 — 넘은 것이 바로 위험 크기다. */
export const usagePercent = (input: FigureInput): ShotFigure => {
  const projected = projectedTotal(input);

  if (projected.kind !== 'value') return projected;
  if (!arrived(input.guaranteedShotCount) || input.guaranteedShotCount === 0) {
    return { kind: 'guaranteedMissing' };
  }

  return { kind: 'value', value: (projected.value / input.guaranteedShotCount) * 100 };
};

/**
 * 적정타수를 넘겼는가. **경고이지 차단이 아니다**(스펙 §6-1 · QA #11 은 예방보전 트리거이지
 * 작업 차단이 아니다). 산출할 수 없으면 넘겼다고 말하지 않는다 — 모르는 것과 넘긴 것은 다르다.
 */
export const isOverGuaranteed = (input: FigureInput): boolean => {
  const available = availableShots(input);

  return available.kind === 'value' && available.value < 0;
};

/** 사람이 읽는 자릿수 표기. 타발수는 수십만까지 가므로 천단위 구분이 없으면 자릿수를 못 센다. */
export const formatShots = (value: number): string => value.toLocaleString('ko-KR');
