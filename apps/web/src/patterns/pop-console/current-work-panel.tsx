import { messages } from '@omf-mes/i18n';

import type { CurrentWork } from './current-work';
import { clockText } from './device-state';

const t = messages.popChrome.console.currentWork;

const quantity = new Intl.NumberFormat();

export interface PopCurrentWorkPanelProps {
  workOrderId: number | null;
  current: CurrentWork;
}

/**
 * 작업장 콘솔 왼쪽의 **현재작업 패널** — 목표 · 양품 · 불량 · 달성률 · 세션.
 *
 * ⭐ **화면을 옮겨도 그대로 남는다.** 투입·실적·중단 화면을 오가는 동안 「지금 몇 개를 만들었고
 *    몇 개가 남았나」가 늘 같은 자리에 보인다 — SAP POD·Plex 가 작업 카드를 고정하는 이유다.
 *
 * ⭐ **숫자는 크게, 색은 줄인다**(ISA-101). 목표·양품·불량은 멀리서도 읽혀야 하고, 색은 불량처럼
 *    눈이 가야 할 값에만 쓴다.
 *
 * ⛔ **누계가 없으면 0 으로 적지 않는다.** 「아직 안 만들었다」와 「모른다」는 다르다 —
 *    서버가 누계를 주지 않았으면 그 사실을 적는다(선례 `production-result/quantity-draft`).
 */
export const PopCurrentWorkPanel = ({ workOrderId, current }: PopCurrentWorkPanelProps) => {
  const { workOrder, session } = current;

  if (workOrderId === null) {
    return (
      <aside className="pop-console-work-panel" aria-label={t.title}>
        <h2 className="pop-console-work-panel__title">{t.title}</h2>
        <p className="pop-console-work-panel__empty">{t.empty}</p>
      </aside>
    );
  }

  if (workOrder.isPending || workOrder.isError) {
    return (
      <aside className="pop-console-work-panel" aria-label={t.title}>
        <h2 className="pop-console-work-panel__title">{t.title}</h2>
        <p className="pop-console-work-panel__empty" role={workOrder.isError ? 'alert' : undefined}>
          {workOrder.isError ? t.failed : t.loading}
        </p>
      </aside>
    );
  }

  const order = workOrder.data;
  const progress = order.progress;
  const rate = progress === undefined ? null : Math.max(0, Math.min(100, progress.achievementRate));
  const startedAt = session.data?.startedAt;

  return (
    <aside className="pop-console-work-panel" aria-label={t.title}>
      <h2 className="pop-console-work-panel__title">{t.title}</h2>
      <p className="pop-console-work-panel__order">{order.workOrderNo}</p>

      <dl className="pop-console-work-panel__facts">
        {order.itemCode !== undefined && order.itemCode.trim() !== '' && (
          <div>
            <dt>{t.item}</dt>
            <dd>{order.itemCode}</dd>
          </div>
        )}
        {order.routingOperationName !== undefined && order.routingOperationName.trim() !== '' && (
          <div>
            <dt>{t.operation}</dt>
            <dd>{order.routingOperationName}</dd>
          </div>
        )}
      </dl>

      <dl className="pop-console-work-panel__numbers">
        <div>
          <dt>{t.target}</dt>
          <dd>{quantity.format(order.orderQty)}</dd>
        </div>
        <div>
          <dt>{t.good}</dt>
          <dd>{progress === undefined ? '—' : quantity.format(progress.goodQty)}</dd>
        </div>
        <div data-tone={(progress?.defectQty ?? 0) > 0 ? 'error' : undefined}>
          <dt>{t.defect}</dt>
          <dd>{progress?.defectQty === undefined ? '—' : quantity.format(progress.defectQty)}</dd>
        </div>
      </dl>

      {rate === null ? (
        <p className="pop-console-work-panel__empty">{t.progressUnknown}</p>
      ) : (
        <div className="pop-console-work-panel__progress">
          <div
            className="pop-console-progress"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={rate}
          >
            <span style={{ width: `${String(rate)}%` }} />
          </div>
          <p>{t.rate(rate.toFixed(0))}</p>
        </div>
      )}

      {startedAt !== undefined && (
        <p className="pop-console-work-panel__session">
          {t.sessionStarted(clockText(new Date(startedAt)))}
        </p>
      )}
    </aside>
  );
};
