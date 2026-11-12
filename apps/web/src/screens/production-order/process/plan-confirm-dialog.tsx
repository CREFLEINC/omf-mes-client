import { AlertBanner, Button, Dialog } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';

import { EffectList } from '../../../patterns/process-page';

const t = messages.erpWorkOrderFlow.process.planConfirm;

export interface PlanConfirmDialogProps {
  /** 확정할 계획 이름(저장 전 새 계획은 「신규 계획 N」) */
  plans: string[];
  groups?: { orderNo: string; plans: string[]; operations: string[] }[];
  /** Routing 공정 이름(전개되는 W/O 하나에 공정 하나) */
  operations: string[];
  running: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

/**
 * C-9 중간 단계 확정 확인(T-W-C 중간 단계의 확정). 대상, 생기는 것과 수, 반영 사항, 되돌릴 수 없다는 안내.
 * 데이터 구조가 아니라 사용자가 보는 결과로 쓴다(C-13).
 */
export const PlanConfirmDialog = ({
  plans,
  groups,
  operations,
  running,
  onCancel,
  onConfirm,
}: PlanConfirmDialogProps) => (
  <Dialog
    open
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
    <div className="bulk-dialog-body">
      {groups ? (
        <div className="erp-wo-preview-scroll">
          <table className="erp-wo-revision-table">
            <thead>
              <tr>
                <th>ERP W/O</th>
                <th>생산계획</th>
                <th>공정</th>
                <th>작업지시</th>
              </tr>
            </thead>
            <tbody>
              {groups
                .filter((group) => group.plans.length)
                .map((group) => (
                  <tr key={group.orderNo}>
                    <td>{group.orderNo}</td>
                    <td>{group.plans.join(', ')}</td>
                    <td>
                      {group.operations.length
                        ? group.operations.join(', ')
                        : '공정 정보 확인 필요'}
                    </td>
                    <td>
                      {group.operations.length
                        ? `${group.plans.length * group.operations.length}건`
                        : '확인 필요'}
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      ) : (
        <>
          <p className="bulk-dialog-target">{t.target(plans.join(', '))}</p>
          <EffectList
            task={t.task}
            items={[
              { key: 'plans', label: t.effects.plans(plans.length) },
              {
                key: 'workOrders',
                label: t.effects.workOrders(
                  plans.length * operations.length,
                  operations.join(', '),
                ),
              },
            ]}
          />
        </>
      )}
      <p className="field-note">ERP W/O와 계획별로 처리하므로 일부만 완료될 수 있습니다.</p>
      <AlertBanner variant="info">{t.irreversible}</AlertBanner>
    </div>
  </Dialog>
);
