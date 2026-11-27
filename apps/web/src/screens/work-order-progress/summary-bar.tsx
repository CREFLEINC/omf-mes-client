import { messages } from '@omf-mes/i18n';

import { InfoFacts, type InfoFact, InfoQty } from '../../patterns/info-facts';
import { RateCell } from './rate-cell';
import type { WorkOrderListSummary } from './types';

const t = messages.workOrderProgress.summary;

const RATE_FORMAT = new Intl.NumberFormat('ko-KR', { style: 'percent', maximumFractionDigits: 1 });

const qtyFact = (label: string, value: number | undefined): InfoFact[] =>
  value === undefined ? [] : [{ label, value: <InfoQty value={value} />, isKey: true }];

/** 값이 있을 때만 여는 칸 — 0 을 늘어놓지 않는다(목록의 보류 · 스크랩 · 재작업 열과 같은 규칙). */
const extraFact = (label: string, value: number | undefined): InfoFact[] =>
  value === undefined || value === 0 ? [] : qtyFact(label, value);

export interface SummaryBarProps {
  /** 목록과 함께 받은 요약. 아직 못 받았으면 줄째 그리지 않는다 — 빈 칸을 0 으로 읽게 두지 않는다. */
  summary: WorkOrderListSummary | undefined;
}

/**
 * 요약 줄 — 조건에 맞는 W/O **전체**의 건수 · 달성률 · 수량 · 지연 건수.
 *
 * ⭐ **쪽과 무관하다.** 서버가 조건 전체를 세어 목록과 같은 트랜잭션에서 준다(계약의 `summary`) —
 * 화면이 이 쪽의 줄을 더해 만들지 않는다. 50건 안에서의 합은 128건의 합이 아니다.
 *
 * ⛔ **달성률을 다시 나누지 않는다**(L-2). 서버가 준 값을 모양만 바꾼다.
 *
 * ⚠ 수량 합계의 기간 축은 「계획 시작」이다 — 그 기간에 시작하기로 한 W/O 의 실적 합이다.
 *
 * 모양은 정보 표시 상자(`InfoFacts`)를 그대로 쓴다 — 이름 위, 값 아래, 칸 사이 세로선.
 */
export const SummaryBar = ({ summary }: SummaryBarProps) => {
  if (summary === undefined) return null;

  const rate = summary.achievementRate;
  const delayed = summary.delayedCount;
  const undeterminable = summary.undeterminableDelayCount;

  const facts: InfoFact[] = [
    {
      label: t.total,
      value: <InfoQty unit={t.countUnit} value={summary.totalCount} />,
      isKey: true,
    },
    ...(rate === undefined || !Number.isFinite(rate)
      ? []
      : [
          {
            label: t.achievementRate,
            value: (
              <RateCell
                label={t.achievementRate}
                percent={Math.min(100, Math.max(0, rate * 100))}
                text={RATE_FORMAT.format(rate)}
              />
            ),
            isKey: true,
          },
        ]),
    ...qtyFact(t.goodQty, summary.goodQty),
    ...qtyFact(t.defectQty, summary.defectQty),
    ...extraFact(t.holdQty, summary.holdQty),
    ...extraFact(t.scrapQty, summary.scrapQty),
    ...extraFact(t.reworkQty, summary.reworkQty),
    ...(delayed === undefined
      ? []
      : [
          {
            label: t.delayed,
            /* 지연이 있을 때만 빨강 — 0 건은 여느 값처럼 적는다. */
            value: (
              <span className={delayed > 0 ? 'work-order-progress-late' : undefined}>
                <InfoQty unit={t.countUnit} value={delayed} />
              </span>
            ),
            isKey: true,
          },
        ]),
    ...(undeterminable === undefined || undeterminable === 0
      ? []
      : [
          {
            label: t.undeterminable,
            value: <InfoQty unit={t.countUnit} value={undeterminable} />,
            isKey: true,
          },
        ]),
  ];

  return (
    <section aria-label={t.label} className="work-order-progress-summary">
      <InfoFacts rows={[facts]} />
    </section>
  );
};
