import { Button, Dialog, Icon } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';

const t = messages.erpWorkOrderFlow.process.planConfirm;

/** 확정할 생산계획 한 건 — 화면이 이미 만든 표시값을 받는다(창이 다시 계산하지 않는다). */
export interface PlanConfirmPlan {
  key: string;
  /** 계획 번호. 저장 전 새 계획이면 null */
  planNo: string | null;
  planDate: string;
  /** 「100 EA」처럼 단위까지 붙인 계획 수량 */
  quantity: string;
}

export interface PlanConfirmGroup {
  orderNo: string;
  plans: PlanConfirmPlan[];
  /** Routing 공정 이름(전개되는 W/O 하나에 공정 하나). 못 받았으면 빈 목록 */
  operations: string[];
}

export interface PlanConfirmDialogProps {
  groups: PlanConfirmGroup[];
  running: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

/**
 * C-9 중간 단계 확정 확인(T-W-C 중간 단계의 확정) — 확인 팝업 시안(사용자 지시 · #360).
 * ERP W/O 한 줄, 사실 상자(계획일 · 계획 수량 · 공정), 생기는 작업지시 수 한 문장, 되돌릴 수 없다는 파란 안내.
 * 계획이 여러 건이면 사실 상자를 표 한 장(계획마다 한 줄)으로 바꾸고, 일부만 완료될 수 있다는 안내를 더한다.
 * 확정 요청 자체는 부르는 화면이 그대로 보낸다 — 이 창은 보이기만 한다.
 */
export const PlanConfirmDialog = ({
  groups,
  running,
  onCancel,
  onConfirm,
}: PlanConfirmDialogProps) => {
  const shown = groups.filter((group) => group.plans.length > 0);
  const plans = shown.flatMap((group) => group.plans.map((plan) => ({ group, plan })));
  const multiOrder = shown.length > 1;
  const single = plans.length === 1 ? plans[0] : undefined;
  /* 공정을 못 받은 ERP W/O 가 있으면 생길 작업지시 수를 지어내지 않는다. */
  const countKnown = shown.every((group) => group.operations.length > 0);
  const workOrderCount = shown.reduce(
    (sum, group) => sum + group.plans.length * group.operations.length,
    0,
  );
  const operationsOf = (group: PlanConfirmGroup): string =>
    group.operations.length > 0 ? group.operations.join(', ') : t.operationUnknown;

  return (
    <Dialog
      open
      size={plans.length > 1 ? 'lg' : 'md'}
      title={t.title}
      closeOnBackdropClick={false}
      onClose={() => !running && onCancel()}
      footer={
        <>
          <Button variant="outlined" disabled={running} onClick={onCancel}>
            {messages.common.cancel}
          </Button>
          <Button loading={running} onClick={onConfirm}>
            {t.confirm}
          </Button>
        </>
      }
    >
      <div className="plan-confirm-body">
        {!multiOrder && shown[0] !== undefined && (
          <p className="plan-confirm-order">
            <span>{t.order}</span>
            <strong className="nowrap-cell">{shown[0].orderNo}</strong>
          </p>
        )}
        {single !== undefined ? (
          <dl className="confirm-facts is-stacked">
            <div>
              <dt>{t.planDate}</dt>
              <dd>{single.plan.planDate}</dd>
            </div>
            <div>
              <dt>{t.plannedQty}</dt>
              <dd>{single.plan.quantity}</dd>
            </div>
            <div>
              <dt>{t.operation}</dt>
              <dd>{operationsOf(single.group)}</dd>
            </div>
          </dl>
        ) : (
          <div className="plan-confirm-table">
            <table>
              <thead>
                <tr>
                  {multiOrder && <th>{t.order}</th>}
                  <th>{t.plan}</th>
                  <th>{t.planDate}</th>
                  <th>{t.plannedQty}</th>
                  <th>{t.operation}</th>
                </tr>
              </thead>
              <tbody>
                {plans.map(({ group, plan }) => (
                  <tr key={`${group.orderNo}:${plan.key}`}>
                    {multiOrder && <td className="nowrap-cell">{group.orderNo}</td>}
                    <td className="nowrap-cell">{plan.planNo ?? t.newPlan}</td>
                    <td className="nowrap-cell">{plan.planDate}</td>
                    <td className="nowrap-cell">{plan.quantity}</td>
                    <td>{operationsOf(group)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="plan-confirm-effect">
          {countKnown ? (
            <>
              {t.effectBefore}
              <strong>{t.workOrders(workOrderCount)}</strong>
              {t.effectAfter}
            </>
          ) : (
            t.effectUnknown
          )}
        </p>
        {plans.length > 1 && <p className="field-note">{t.partial}</p>}
        <p className="iqc-inspection-action-note" data-tone="info">
          <Icon name="info" size={14} aria-hidden />
          {t.irreversible}
        </p>
      </div>
    </Dialog>
  );
};
