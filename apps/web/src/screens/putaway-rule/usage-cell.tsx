import { Progress, type ProgressTone, type ThresholdStop } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import type { ReactNode } from 'react';

import type { BalanceUnknownReason, RuleBalance } from './balance-lookup';
import type { RuleView } from './types';
import { judgeUsage, type UsageGroup, type UsageJudgment } from './usage-ratio';

const t = messages.putawayRule;

/**
 * 사용률 구간.
 *
 * **색 전환을 디자인 시스템에 맡기고 화면이 조건 분기를 쓰지 않는다.** `Progress`는 오름차순
 * 구간에서 `percent < upTo`인 첫 구간을 고르고, 어디에도 걸리지 않으면 `tone`으로 떨어진다 —
 * 그래서 구간을 100 하나만 두고 **폴백을 경고로 두면** 100% 이상이 저절로 경고가 된다.
 * 화면이 `percent >= 100`을 따로 재면 같은 경계가 두 자리에 생겨 한쪽만 고쳐진다.
 */
export const USAGE_THRESHOLDS: ThresholdStop[] = [{ upTo: 100, tone: 'success' }];
export const USAGE_FALLBACK_TONE: ProgressTone = 'warning';

/**
 * 눈에 보이는 비율은 **내림**이다.
 *
 * 반올림하면 99.6%가 「100%」로 적히는데 막대는 아직 정상 톤이라 문자열과 색이 어긋난다.
 * 내림은 `floor(x) >= 100`과 `x >= 100`이 같은 뜻이라 **경고 경계에서** 두 자리가 어긋날 수 없다.
 *
 * ⚠ **이 성질은 0 이상에서만 성립한다.** 음수에서 `Math.floor`는 0에서 멀어지는 쪽으로 굴러
 * −0.2%가 「−1%」로 적힌다. 그래서 음수는 여기 오기 전에 접힌다(`judgeUsage`의 `negative` 갈래) —
 * **이 함수는 0 이상만 받는다는 전제 위에 서 있다.**
 */
const toPercentText = (percent: number): string => String(Math.floor(percent));

export interface UsageCellProps {
  rule: RuleView;
  balance: RuleBalance;
  /**
   * 단위 이름 풀이. **화면이 풀어 넘긴다** — 이 칸이 참조 조회를 알면 이름을 못 풀었을 때의
   * 네 갈래가 칸 안으로 흘러 들어오고, 내부 번호가 새는 자리도 함께 는다(`omf-mes#44`).
   */
  uomLabel: (uomId: number) => string;
}

const unknownText = (reason: BalanceUnknownReason): string => {
  switch (reason) {
    case 'failed':
      return t.values.onHandFailed;
    case 'truncated':
      return t.values.onHandTruncated;
    case 'axisMixed':
      return t.values.onHandAxisMixed;
  }
};

type IncomparableReason = Extract<UsageJudgment, { kind: 'incomparable' }>['reason'];

/** 왜 비율을 만들지 않았는지. **갈래마다 문구가 다르다** — 사용자가 손댈 자리가 다르다. */
const incomparableNote = (reason: IncomparableReason): string => {
  switch (reason) {
    case 'ownership':
      return t.notes.usageOwnershipSplit;
    case 'unit':
      return t.notes.usageUnitMismatch;
    case 'capacity':
      return t.notes.usageCapacityNotPositive;
    case 'negative':
      return t.notes.usageNegativeOnHand;
  }
};

/**
 * 소유가 갈린 갈래에서만 소유 코드를 함께 낸다. 다른 갈래는 소유가 하나뿐이라
 * 코드를 붙이면 **갈래를 가른 축이 무엇인지가 흐려진다.**
 */
const groupText = (
  group: UsageGroup,
  reason: IncomparableReason,
  uomLabel: (uomId: number) => string,
): string =>
  reason === 'ownership'
    ? t.values.ownershipQty(group.ownershipTypeCode, String(group.qty), uomLabel(group.uomId))
    : t.values.onHandQty(String(group.qty), uomLabel(group.uomId));

/**
 * 목록의 「현재 적재」 칸.
 *
 * ## 막대와 수치를 둘 다 그리는 이유
 *
 * 디자인 시스템 `Progress`는 값을 `max`로 자른다(`clampValue`) — **128%와 100%가 막대에서
 * 구분되지 않는다.** 그래서 자체 수치 표시(`showValue`)를 쓰지 않고 화면이 **자르지 않은 실제
 * 비율**을 직접 그리며, 낭독 문자열(`valueText`)에도 그 값을 싣는다. 싣지 않으면 화면을 보지
 * 않는 사용자에게는 초과 사실이 아예 사라진다(`aria-valuenow`는 잘린 값이다).
 *
 * ## 비율이 서지 않는 자리
 *
 * 판정 불가와 확인 불가에는 **막대를 그리지 않는다.** 막대가 있으면 길이가 곧 답으로 읽히는데,
 * 그 자리들은 답이 없는 자리다 — 0%짜리 빈 막대를 그리면 「비어 있다」는 틀린 사실이 선다.
 *
 * 이 화면 슬라이스가 소유한다 — 다른 화면 슬라이스의 같은 이름 부품을 참조하지 않는다.
 */
export const UsageCell = ({ rule, balance, uomLabel }: UsageCellProps) => {
  /* 확인하지 못한 것이 먼저다 — 실패를 「없음」으로 뭉개면 빈 위치라는 틀린 사실이 선다. */
  if (balance.kind === 'loading') return <span>{t.values.onHandLoading}</span>;
  if (balance.kind === 'unknown') return <span>{unknownText(balance.reason)}</span>;

  const judgment = judgeUsage(rule, balance.rows);

  if (judgment.kind === 'none') return <span>{t.values.onHandNone}</span>;

  if (judgment.kind === 'incomparable') {
    const { reason, groups } = judgment;

    return (
      <div className="field-cell">
        {groups.map((group): ReactNode => {
          /* 묶음의 축(소유·단위)이 곧 열쇠다 — 자리로 세면 줄이 늘 때 값이 다른 줄로 옮겨 붙는다. */
          const key = `${group.ownershipTypeCode}|${String(group.uomId)}`;

          return <span key={key}>{groupText(group, reason, uomLabel)}</span>;
        })}
        <span className="field-note">{incomparableNote(reason)}</span>
      </div>
    );
  }

  const percentText = toPercentText(judgment.percent);

  return (
    <div className="field-cell">
      <Progress
        size="sm"
        label={t.values.usageBarLabel}
        value={judgment.percent}
        thresholds={USAGE_THRESHOLDS}
        tone={USAGE_FALLBACK_TONE}
        valueText={t.values.usagePercent(percentText)}
      />
      <span>
        {t.values.usageSummary(String(judgment.qty), uomLabel(judgment.uomId), percentText)}
      </span>
    </div>
  );
};
