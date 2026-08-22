import type { Mold } from './types';

/**
 * 타수 값 하나를 세 모양으로 가른다.
 *
 * ⛔ **없는 값을 0 으로 채우지 않는다.** 사용 가능 타수 0 은 「지금 다 썼다」는 사실이라
 * 예방보전이 즉시 도래한 것처럼 보인다 — 값이 없는 것과 0 인 것은 다른 사실이다(G-9).
 * ⭐ **못 세는 이유를 가른다** — 「적정타수가 비어서」는 사용자가 채우면 풀리는 것이고,
 * 그 밖의 이유는 사용자가 할 수 있는 일이 없다. 한 말로 뭉개면 채워야 할 것이 묻힌다.
 */
export type ShotFigure =
  { kind: 'value'; value: number } | { kind: 'guaranteedMissing' } | { kind: 'notCalculable' };

export type ShotTarget = Pick<
  Mold,
  'guaranteedShotCount' | 'availableShotCount' | 'shotUsageRatio'
>;

/** 값이 실제로 왔는가. **0 도 온 값이다** — `??` 하나로 뭉개면 0 이 사라진다. */
const arrived = (value: number | null | undefined): value is number =>
  value !== null && value !== undefined;

/**
 * 적정타수가 비었으면 그 사실이 먼저다. 적정타수가 있는데도 값이 없으면 그때는
 * 사용자가 할 수 있는 일이 없어 「산출 불가」로 남긴다.
 */
const figureOf = (tool: ShotTarget, value: number | null | undefined): ShotFigure => {
  if (arrived(value)) return { kind: 'value', value };

  return arrived(tool.guaranteedShotCount)
    ? { kind: 'notCalculable' }
    : { kind: 'guaranteedMissing' };
};

/** 사용 가능 타수 = 적정타수 − 누계. **서버가 셈한다** — 화면이 다시 세지 않는다. */
export const availableShots = (tool: ShotTarget): ShotFigure =>
  figureOf(tool, tool.availableShotCount);

/** 누계 ÷ 적정타수 백분율. 100 을 넘을 수 있다 — 넘은 것이 바로 위험 크기다. */
export const shotUsage = (tool: ShotTarget): ShotFigure => figureOf(tool, tool.shotUsageRatio);

/** 초과율이 적정타수를 넘어섰는가. **판정 기준을 한 자리에 둔다.** */
export const FULL_USAGE_PERCENT = 100;

export const isOverUsed = (figure: ShotFigure): boolean =>
  figure.kind === 'value' && figure.value >= FULL_USAGE_PERCENT;
