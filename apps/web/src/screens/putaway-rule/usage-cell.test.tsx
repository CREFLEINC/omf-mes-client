import { messages } from '@omf-mes/i18n';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { toBalanceView, type RuleBalance } from './balance-lookup';
import {
  OWNERSHIP_A,
  OWNERSHIP_B,
  RULE_WITH_LOCATION,
  UOM_LABEL,
  balanceRow,
  uomFixtures,
} from './fixtures';
import { USAGE_FALLBACK_TONE, USAGE_THRESHOLDS, UsageCell } from './usage-cell';

const t = messages.putawayRule;

const OTHER_UOM_LABEL = 'SYN-UOM-02 · 합성단위 나';

const uomLabel = (uomId: number): string =>
  uomFixtures.find((uom) => uom.uomId === uomId) === undefined
    ? t.values.unknown
    : uomId === 9401
      ? UOM_LABEL
      : OTHER_UOM_LABEL;

const known = (...overrides: Parameters<typeof balanceRow>[0][]): RuleBalance => ({
  kind: 'known',
  rows: overrides.map((override) => toBalanceView(balanceRow(override))),
});

const renderCell = (balance: RuleBalance, rule = RULE_WITH_LOCATION) =>
  render(<UsageCell rule={rule} balance={balance} uomLabel={uomLabel} />);

/**
 * 막대의 톤 — **산출물 쪽을 잰다**(사본 체크리스트 8번).
 *
 * 디자인 시스템 `Progress`가 채움 span의 class로 톤을 드러낸다(`fill-<톤>`). 선언(`thresholds`)만
 * 읽으면 규약과 실제 렌더가 어긋나도 잡히지 않으므로 선언과 산출물 두 자리를 각각 잰다.
 */
const renderedTone = (): string => {
  const fill = screen.getByRole('progressbar').querySelector('span > span');
  const matched = /fill-([a-z]+)/.exec(fill?.getAttribute('class') ?? '');

  return matched?.[1] ?? '';
};

describe('UsageCell — 사용률 막대의 규약', () => {
  /**
   * **선언 쪽.** 색 전환은 `thresholds`에 맡기고 화면이 조건 분기를 쓰지 않는다.
   * 100% 이상은 어떤 구간에도 걸리지 않아 폴백 톤으로 떨어지므로 **폴백을 경고로 둔다.**
   */
  it('구간은 100% 하나이고 폴백 톤이 경고다', () => {
    expect(USAGE_THRESHOLDS).toEqual([{ upTo: 100, tone: 'success' }]);
    expect(USAGE_FALLBACK_TONE).toBe('warning');
  });

  it('100% 미만은 정상 톤이다', () => {
    renderCell(known({ onHandQty: 320 }));

    expect(renderedTone()).toBe('success');
  });

  /** 정확히 100%도 경고다 — 구간이 `percent < upTo`라 100은 걸리지 않고 폴백으로 떨어진다. */
  it('정확히 100%는 경고 톤이다', () => {
    renderCell(known({ onHandQty: 500 }));

    expect(renderedTone()).toBe('warning');
  });

  it('100%를 넘으면 경고 톤이다', () => {
    renderCell(known({ onHandQty: 640 }));

    expect(renderedTone()).toBe('warning');
  });
});

describe('UsageCell — 막대는 잘리고 수치는 잘리지 않는다', () => {
  /**
   * `clampValue`가 값을 `max`로 자르므로 **막대에서는 128%와 100%가 구분되지 않는다.**
   * 그래서 수치 텍스트를 화면이 직접 그린다 — 두 자리를 따로 잰다.
   */
  it('막대 값은 100에서 잘린다', () => {
    renderCell(known({ onHandQty: 640 }));

    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '100');
  });

  it('수치 텍스트는 자르지 않은 실제 비율을 보인다', () => {
    renderCell(known({ onHandQty: 640 }));

    expect(screen.getByText(t.values.usageSummary('640', UOM_LABEL, '128'))).toBeInTheDocument();
  });

  /**
   * **100과 128을 수치로 정면으로 가른다.** 막대는 둘 다 `aria-valuenow=100`이라 구분이 지워지고,
   * 그 구분이 남는 유일한 자리가 이 문자열이다 — 초과 쪽만 재면 「막대에서 지워진 구분이
   * 수치에 남는다」의 절반만 잰 것이 된다.
   */
  it('정확히 100%는 수치도 100으로 적힌다', () => {
    renderCell(known({ onHandQty: 500 }));

    expect(screen.getByText(t.values.usageSummary('500', UOM_LABEL, '100'))).toBeInTheDocument();
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '100');
  });

  /** 낭독까지 잘린 값을 읽으면 화면을 보지 않는 사용자에게는 초과 사실이 사라진다. */
  it('낭독 문자열도 자르지 않은 비율을 말한다', () => {
    renderCell(known({ onHandQty: 640 }));

    expect(screen.getByRole('progressbar')).toHaveAttribute(
      'aria-valuetext',
      t.values.usagePercent('128'),
    );
  });

  /**
   * **내림으로 적는다.** 반올림하면 99.6%가 「100%」로 적히는데 막대는 아직 정상 톤이라
   * 문자열과 색이 어긋난다 — 내림은 `floor(x) >= 100`과 `x >= 100`이 같아 경계가 어긋나지 않는다.
   */
  it('99.9%는 99%로 적히고 톤도 정상이다', () => {
    /* 용량 500 · 적재 499.5 → 99.9% */
    renderCell(known({ onHandQty: 499.5 }));

    expect(screen.getByText(t.values.usageSummary('499.5', UOM_LABEL, '99'))).toBeInTheDocument();
    expect(renderedTone()).toBe('success');
  });

  it('막대에 접근 이름이 있다', () => {
    renderCell(known({ onHandQty: 320 }));

    expect(screen.getByRole('progressbar', { name: t.values.usageBarLabel })).toBeInTheDocument();
  });

  /** 자체 수치 표시를 쓰지 않는다 — 그것은 잘린 값을 그려 실제 비율과 어긋난다. */
  it('디자인 시스템의 자체 수치 표시를 켜지 않는다', () => {
    renderCell(known({ onHandQty: 640 }));

    expect(screen.queryByText('100%')).not.toBeInTheDocument();
  });
});

describe('UsageCell — 잔액 없음과 잔액 0', () => {
  /** 「없다」와 「0이다」는 다른 사실이다 — 0은 확인한 결과이고 없음은 줄 자체가 없는 것이다. */
  it('잔액 줄이 없으면 대시가 서고 막대가 없다', () => {
    renderCell({ kind: 'known', rows: [] });

    expect(screen.getByText(t.values.onHandNone)).toBeInTheDocument();
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
  });

  it('잔액 0은 수량과 0%로 선다', () => {
    renderCell(known({ onHandQty: 0 }));

    expect(screen.getByText(t.values.usageSummary('0', UOM_LABEL, '0'))).toBeInTheDocument();
    expect(screen.getByRole('progressbar')).toBeInTheDocument();
  });
});

describe('UsageCell — 판정 불가', () => {
  /**
   * 단위가 다르면 **환산하지 않는다**(이슈 §6). 비율을 만들지 않고 두 값을 단위와 함께 둔다 —
   * 규칙 용량은 옆 칸이 이미 단위와 함께 말하고 있다.
   */
  it('단위가 다르면 막대 없이 수량과 사유가 선다', () => {
    renderCell(known({ uomId: 9402, onHandQty: 300 }));

    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
    expect(screen.getByText(t.values.onHandQty('300', OTHER_UOM_LABEL))).toBeInTheDocument();
    expect(screen.getByText(t.notes.usageUnitMismatch)).toBeInTheDocument();
  });

  /**
   * 소유 구분은 어떤 축에서도 합치지 않는다(공유계약 L-7). 소유별로 나눠 보이고
   * **서버가 준 코드를 번역하지 않고 그대로 낸다**(값 목록 미확정 — 공유계약 G-2).
   */
  it('소유가 둘이면 소유별로 나뉘고 사유가 선다', () => {
    renderCell(
      known(
        { ownershipTypeCode: OWNERSHIP_A, onHandQty: 300 },
        { ownershipTypeCode: OWNERSHIP_B, onHandQty: 120 },
      ),
    );

    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
    expect(
      screen.getByText(t.values.ownershipQty(OWNERSHIP_A, '300', UOM_LABEL)),
    ).toBeInTheDocument();
    expect(
      screen.getByText(t.values.ownershipQty(OWNERSHIP_B, '120', UOM_LABEL)),
    ).toBeInTheDocument();
    expect(screen.getByText(t.notes.usageOwnershipSplit)).toBeInTheDocument();
  });

  /** 용량이 0이면 나눌 수 없다 — 무한대를 사용률로 그리지 않는다. */
  it('용량이 0이면 막대 없이 수량과 사유가 선다', () => {
    renderCell(known({ onHandQty: 320 }), { ...RULE_WITH_LOCATION, capacityQty: 0 });

    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
    expect(screen.getByText(t.values.onHandQty('320', UOM_LABEL))).toBeInTheDocument();
    expect(screen.getByText(t.notes.usageCapacityNotPositive)).toBeInTheDocument();
  });

  /**
   * **아래쪽 경계.** 음수 적재에 비율을 내면 막대가 `0`으로 잘려 **가장 비어 있는 위치와 같은
   * 모양**이 되고, 톤은 정상(`success`)이 된다 — 장부가 어긋난 상태를 「비어 있고 여유롭다」로
   * 보이는 셈이다. 막대를 아예 그리지 않고 수량만 사실대로 낸다.
   */
  it('적재가 음수면 막대 없이 음수 수량과 사유가 선다', () => {
    renderCell(known({ onHandQty: -40 }));

    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
    expect(screen.getByText(t.values.onHandQty('-40', UOM_LABEL))).toBeInTheDocument();
    expect(screen.getByText(t.notes.usageNegativeOnHand)).toBeInTheDocument();
  });

  /** 음수는 「없음」이 아니다 — 확인한 결과가 음수인 것이고, 대시로 뭉개면 사실이 사라진다. */
  it('음수 적재를 없음으로 뭉개지 않는다', () => {
    renderCell(known({ onHandQty: -40 }));

    expect(screen.getByText(t.notes.usageNegativeOnHand)).toBeInTheDocument();
    expect(screen.queryByText(t.values.onHandNone)).not.toBeInTheDocument();
  });

  /**
   * 내림이 음수에서 0에서 멀어지는 쪽으로 구르는 문제도 이 갈래가 닫는다 —
   * −0.2%가 「−1%」로 적히던 자리다. 비율 문자열 자체가 서지 않는다.
   */
  it('음수 적재에 비율 문자열이 서지 않는다', () => {
    renderCell(known({ onHandQty: -1 }));

    expect(screen.queryByText(/%/)).not.toBeInTheDocument();
  });
});

describe('UsageCell — 확인하지 못한 상태', () => {
  /** 네 갈래의 문구가 서로 달라야 뜻이 구분된다 — 하나로 뭉치면 조치가 갈리지 않는다. */
  it('미도착은 불러오는 중으로 말한다', () => {
    renderCell({ kind: 'loading' });

    expect(screen.getByText(t.values.onHandLoading)).toBeInTheDocument();
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
  });

  it('실패는 실패로 말한다 — 없음으로 뭉개지 않는다', () => {
    renderCell({ kind: 'unknown', reason: 'failed' });

    expect(screen.getByText(t.values.onHandFailed)).toBeInTheDocument();
    expect(screen.queryByText(t.values.onHandNone)).not.toBeInTheDocument();
  });

  it('잘림은 잘림으로 말한다', () => {
    renderCell({ kind: 'unknown', reason: 'truncated' });

    expect(screen.getByText(t.values.onHandTruncated)).toBeInTheDocument();
  });

  it('축 섞임은 축 섞임으로 말한다', () => {
    renderCell({ kind: 'unknown', reason: 'axisMixed' });

    expect(screen.getByText(t.values.onHandAxisMixed)).toBeInTheDocument();
  });
});
