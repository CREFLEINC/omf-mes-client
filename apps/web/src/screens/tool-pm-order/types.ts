import type { components } from '@omf-mes/api-client';
import { messages } from '@omf-mes/i18n';

/**
 * W-05-02가 다루는 모양들.
 *
 * ⭐ **도래 판정을 서버가 한다.** 화면은 날짜도 초과율도 계산하지 않는다 — 계산하면 서버가
 * 준 값과 갈리고, 갈린 순간 어느 쪽이 맞는지 화면에서 확인할 수단이 없다. 여기서 하는 일은
 * **없는 값을 0으로 채우지 않는 것**뿐이다.
 *
 * 이 화면이 소유한다 — 다른 화면 슬라이스의 같은 이름 파일을 참조하지 않는다.
 */

const t = messages.toolPmOrder;

type Mold = components['schemas']['Mold'];

export interface PageMeta {
  page: number;
  size: number;
  total: number;
}

export interface LookupEntry {
  value: string;
  label: string;
  isActive: boolean;
}

export interface SelectOption {
  value: string;
  label: string;
}

/** 이 화면이 만드는 오더의 대상은 툴이다. */
export const MOLD_TARGET = 'MOLD';

/** 주기 도래 트리거. 툴 예방보전 오더의 유일한 트리거다. */
export const PM_DUE_TRIGGER = 'PM_DUE';

/** 먼저 도달한 축 — 서버가 밝힌다. 화면이 판정하지 않는다. */
export const SHOT_AXIS = 'SHOT';
export const DATE_AXIS = 'DATE';

/** 초과율이 이 값을 넘으면 「초과」다. 진행 표시는 여기서 멈추되 색으로 가른다. */
export const FULL_RATIO = 100;

export interface MoldView {
  moldId: number;
  moldCode: string;
  moldName: string;
  currentShotCount: number;
  /** 없으면 예방보전이 돌지 않는다 — ⛔ 0으로 채우지 않는다. */
  guaranteedShotCount: number | null;
  /** 적정타수가 없으면 `null`이다. ⛔ 0으로 채우지 않는다. */
  availableShotCount: number | null;
  /** 적정타수가 없으면 `null`이다. 100을 넘을 수 있다. */
  shotUsageRatio: number | null;
  /** 기준일이나 주기가 없으면 `null`이다. */
  nextPmDate: string | null;
  pmDue: boolean;
  /** 도래하지 않았으면 `null`. 도래했으면 먼저 도달한 축을 서버가 밝힌다. */
  pmDueAxisCode: Exclude<Mold['pmDueAxisCode'], undefined>;
}

export interface MoldListResult {
  items: MoldView[];
  page: PageMeta;
}

const nullable = <T>(value: T | null | undefined): T | null => value ?? null;

export const toMoldView = (source: Mold): MoldView => ({
  moldId: source.moldId,
  moldCode: source.moldCode,
  moldName: source.moldName,
  currentShotCount: source.currentShotCount,
  guaranteedShotCount: nullable(source.guaranteedShotCount),
  availableShotCount: nullable(source.availableShotCount),
  shotUsageRatio: nullable(source.shotUsageRatio),
  nextPmDate: nullable(source.nextPmDate),
  pmDue: source.pmDue ?? false,
  pmDueAxisCode: nullable(source.pmDueAxisCode),
});

/** 천 단위 자리 구분. */
const groupThousands = (digits: string): string => digits.replace(/\B(?=(\d{3})+(?!\d))/g, ',');

export const formatCount = (value: number): string => groupThousands(String(Math.round(value)));

/** 소수 첫째 자리까지. 끝자리가 0이면 소수점을 뗀다. */
export const formatRatio = (value: number): string => {
  const rounded = Math.round(value * 10) / 10;
  const whole = Math.trunc(rounded);
  const fraction = Math.round((rounded - whole) * 10);

  return fraction === 0
    ? groupThousands(String(whole))
    : `${groupThousands(String(whole))}.${String(fraction)}`;
};

/**
 * 「왜 도래했는가」 한 줄.
 *
 * ⭐ **서버가 밝힌 축을 그대로 옮긴다.** 둘 다 쓰는 툴이 있어 화면이 추측하면 틀린 사유를
 * 적게 된다 — 사용자는 그것을 보고 엉뚱한 축을 손본다.
 */
export const dueAxisLabel = (view: MoldView): string => {
  if (!view.pmDue) return t.table.notDue;

  switch (view.pmDueAxisCode) {
    case SHOT_AXIS:
      return t.table.axisShot;
    case DATE_AXIS:
      return t.table.axisDate;
    default:
      /* 도래는 했는데 축이 오지 않았다 — 지어내지 않고 없음으로 둔다. */
      return t.table.notAvailable;
  }
};

/**
 * 진행 표시에 넣을 값. **100에서 멈춘다.**
 *
 * ⭐ 초과율은 100을 넘을 수 있는데 막대가 칸 밖으로 자라면 다른 줄과 견줄 수 없다. 넘었다는
 * 사실은 **색과 글자**가 말한다 — 막대 길이만으로 말하지 않는다.
 */
export const toProgressValue = (ratio: number | null): number => {
  if (ratio === null) return 0;

  return Math.max(0, Math.min(FULL_RATIO, ratio));
};

/** 초과했는가. `null`은 초과가 아니라 **모름**이다. */
export const isOverLimit = (ratio: number | null): boolean => ratio !== null && ratio > FULL_RATIO;
