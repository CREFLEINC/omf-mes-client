import { Button, Dialog, Icon, SkeletonText } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useQuery } from '@tanstack/react-query';
import { useId } from 'react';

import { useApiClient } from '../../patterns/api-context';
import { runRequest } from '../../patterns/request';
import { dispositionKeys } from './queries';

const t = messages.dispositionDecision;

/** 폐기 · 선별은 처분(DISPOSITION) 결재, 특채는 특채(CONCESSION) 결재(omf-all-around#352). */
export const approvalTypeOf = (dispositionTypeCode: string): 'DISPOSITION' | 'CONCESSION' =>
  dispositionTypeCode === 'CONCESSION' ? 'CONCESSION' : 'DISPOSITION';

/** 처분 · 특채 결재선이 있는지와 결재자 — 판정 확인 팝업이 열릴 때만 부른다. */
export const useDispositionApprovalRoutes = (enabled: boolean) => {
  const { client } = useApiClient();
  return useQuery({
    queryKey: [...dispositionKeys.all, 'approval-routes'] as const,
    enabled,
    /* 결재선은 관리자가 바꾼다 — 팝업을 열 때마다 새로 본다. */
    staleTime: 0,
    queryFn: () =>
      runRequest(() => client.GET('/quality/disposition-approval-routes')).then(
        (response) => response.items,
      ),
  });
};

export interface DecisionConfirmRow {
  label: string;
  value: string;
}

export interface DecisionConfirmDialogProps {
  dispositionTypeCode: string;
  /** 처분 유형 · 대상 · 수량 · 사유 등 저장할 내용 — 화면이 고른 유형에 맞춰 만든다. */
  rows: DecisionConfirmRow[];
  isSaving: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * 판정 확인 팝업(omf-all-around#352 사용자 지시) — 폐기 · 선별 · 특채 저장 전에 늘 띄운다. 결재선이 있으면 결재자와 「결재 요청」,
 * 없으면 「바로 반영」을 알린다. 결재선을 확인하지 못하면 확인 단추를 잠근다 — 무엇이 일어날지 모른 채 저장하지 않는다.
 */
export const DecisionConfirmDialog = ({
  dispositionTypeCode,
  rows,
  isSaving,
  onConfirm,
  onCancel,
}: DecisionConfirmDialogProps) => {
  const titleId = useId();
  const routes = useDispositionApprovalRoutes(true);
  const route = routes.data?.find(
    (item) => item.approvalTypeCode === approvalTypeOf(dispositionTypeCode),
  );
  const applyLabel = dispositionTypeCode === 'CONCESSION' ? t.concession.apply : t.approval.apply;

  return (
    <Dialog
      open
      onClose={onCancel}
      size="md"
      title={<span id={titleId}>{t.confirm.title}</span>}
      aria-labelledby={titleId}
      showCloseButton={false}
      closeOnBackdropClick={false}
      footer={
        <>
          <Button
            variant="outlined"
            className="app-button-neutral"
            disabled={isSaving}
            onClick={onCancel}
          >
            {messages.common.cancel}
          </Button>
          <Button disabled={route === undefined || isSaving} loading={isSaving} onClick={onConfirm}>
            {t.confirm.ok}
          </Button>
        </>
      }
    >
      <div className="disposition-confirm">
        <dl className="disposition-confirm-rows">
          {rows.map((row) => (
            <div key={row.label}>
              <dt>{row.label}</dt>
              <dd>{row.value}</dd>
            </div>
          ))}
          {route?.hasRoute === true && (
            <div>
              <dt>{t.confirm.approvers}</dt>
              <dd>
                {route.steps
                  .map((step) => t.confirm.approverStep(step.stepNo, step.approverName))
                  .join(', ')}
              </dd>
            </div>
          )}
        </dl>
        {routes.isPending ? (
          <div role="status" aria-label={t.confirm.loading}>
            <SkeletonText lines={1} />
          </div>
        ) : route === undefined ? (
          <p className="iqc-inspection-action-note" data-tone="warning" role="alert">
            <Icon name="warning" size={14} aria-hidden />
            {t.confirm.loadFailed}
          </p>
        ) : (
          <p className="iqc-inspection-action-note" data-tone="info">
            <Icon name="info" size={14} aria-hidden />
            {route.hasRoute ? t.confirm.routed(applyLabel) : t.confirm.direct}
          </p>
        )}
      </div>
    </Dialog>
  );
};
