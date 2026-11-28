import { Progress } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';

import { servedDelay } from './delay';
import { toDetailSteps } from './detail-steps';
import { DelayChip, StatusChip } from './status-chips';
import type { WorkOrder, WorkOrderProgressFact } from './types';
import { InfoFacts, InfoQty, type InfoFact } from '../../patterns/info-facts';
import { formatPlantDateTime } from '../../patterns/plant-time';

const t = messages.workOrderProgress.detail;

const RATE_FORMAT = new Intl.NumberFormat('ko-KR', { style: 'percent', maximumFractionDigits: 1 });

/** 값이 있을 때만 여는 수량 칸 — 목록의 보류 · 스크랩 · 재작업 열과 같은 규칙이다. */
const extraQty = (label: string, value: number | undefined): InfoFact[] =>
  value === undefined || value === 0
    ? []
    : [{ label, value: <InfoQty value={value} />, isKey: true }];

/**
 * 실적 칸 — 양품 · 불량 · 달성률(값이 있으면 보류 · 스크랩 · 재작업도). 실적 누계를 받지 못했으면 칸째 뺀다.
 *
 * ⛔ 달성률은 서버가 준 값이다 — 양품을 지시 수량으로 다시 나누지 않는다(L-2).
 */
const progressFacts = (progress: WorkOrderProgressFact | undefined): InfoFact[] => {
  if (progress === undefined) return [];

  const percent = Math.min(100, Math.max(0, progress.achievementRate * 100));
  const text = RATE_FORMAT.format(progress.achievementRate);

  return [
    { label: t.goodQty, value: <InfoQty value={progress.goodQty} />, isKey: true },
    ...(progress.defectQty === undefined
      ? []
      : [{ label: t.defectQty, value: <InfoQty value={progress.defectQty} />, isKey: true }]),
    ...extraQty(t.holdQty, progress.holdQty),
    ...extraQty(t.scrapQty, progress.scrapQty),
    ...extraQty(t.reworkQty, progress.reworkQty),
    {
      label: t.achievementRate,
      /* 숫자를 먼저 크게, 막대는 상자의 남는 폭을 다 쓴다 — 창을 열자마자 「얼마나 됐는가」가 읽힌다. */
      value: (
        <span className="work-order-progress-hero-rate">
          <span>{text}</span>
          <Progress
            className="work-order-progress-hero-rate-bar"
            label={t.achievementRate}
            tone={percent >= 100 ? 'success' : 'info'}
            value={percent}
            valueText={text}
          />
        </span>
      ),
      title: text,
      isKey: true,
    },
  ];
};

export interface DetailHeroProps {
  workOrder: WorkOrder;
  /** 표의 상태 열과 같은 표시명 — 상태 칩과 단계 이름이 함께 쓴다. */
  statusLabel: (statusCode: string) => string;
}

/**
 * 상세 창 맨 위 — 「얼마나 만들었고 어느 단계인가」를 먼저 답한다(사용자 선택 2026-11-28 · 시안 B).
 *
 * 윗줄은 상태 · 지시 수량 · 실적을 큰 글자로, 아랫줄은 편성부터 마감까지의 단계다. 배포 · 완료 · 마감 시각은
 * 그 단계 아래에 적는다.
 */
export const DetailHero = ({ workOrder, statusLabel }: DetailHeroProps) => (
  <div className="work-order-progress-hero">
    <InfoFacts
      className="work-order-progress-hero-facts"
      rows={[
        [
          {
            label: t.statusCode,
            /* 지연 · 판정 불가는 상태 칩 옆에 칩으로 — 「지연」 이름 아래 「지연」 값을 되풀이하지 않는다. */
            value: (
              <>
                <StatusChip
                  label={statusLabel(workOrder.statusCode)}
                  statusCode={workOrder.statusCode}
                />
                <DelayChip delay={servedDelay(workOrder) ?? 'onTime'} />
              </>
            ),
            isKey: true,
          },
          { label: t.orderQty, value: <InfoQty value={workOrder.orderQty} />, isKey: true },
          ...progressFacts(workOrder.progress),
        ],
      ]}
    />

    <ol aria-label={t.steps} className="work-order-progress-steps">
      {toDetailSteps(workOrder).map((step) => (
        <li
          aria-current={step.state === 'current' ? 'step' : undefined}
          className={`work-order-progress-step is-${step.state}`}
          key={step.code}
        >
          <span aria-hidden="true" className="work-order-progress-step-dot" />
          <span className="work-order-progress-step-name">{statusLabel(step.code)}</span>
          <span className="work-order-progress-step-at">
            {step.at === undefined ? '' : (formatPlantDateTime(step.at) ?? step.at)}
          </span>
        </li>
      ))}
    </ol>
  </div>
);
