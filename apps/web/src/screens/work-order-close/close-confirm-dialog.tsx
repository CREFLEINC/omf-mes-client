import { Button, Chip, Dialog, Icon } from '@crefle/web-ui';
import type { components } from '@omf-mes/api-client';
import { messages } from '@omf-mes/i18n';
import type { ReactNode } from 'react';
import { Link } from 'react-router';

import { InfoFacts, type InfoFact } from '../../patterns/info-facts';
import './close-confirm-dialog.css';

type WorkOrderCloseCompletionJudgment =
  components['schemas']['WorkOrderProgress']['completionJudgmentCode'];

export interface WorkOrderCloseConfirmDetail {
  label: string;
  value: string;
  /** 판정 칸이면 그 코드 — 값을 상태 칩으로 그린다(정상 초록, 미달·초과 노랑 · POP 마감과 같다). */
  judgment?: WorkOrderCloseCompletionJudgment;
}

/** ERP 송신 결과를 보는 화면의 경로. 메뉴 이름이 바뀌어도 어긋나지 않게 그 화면의 문구로 짓는다. */
export const erpResultMenuPath = (): string => messages.integrationSync.menuPath;

/** ERP 연동 현황·이력 화면(app/nav-tree.ts) — 확인 팝업의 메뉴 링크. */
const ERP_RESULT_PATH = '/master-data/integration-sync';

export interface WorkOrderCloseConfirmDialogProps {
  workOrderNo: string;
  /** 고른 내용을 한 칸에 한 값씩 되풀이한다 — 되돌릴 수 없으니 누르기 전에 다시 본다 */
  details: readonly WorkOrderCloseConfirmDetail[];
  /** 마감해도 미마감으로 남는 LOT 번호. 없으면 구획을 내지 않는다. */
  openLotNos: readonly string[];
  /** 마감과 함께 일어나는 그 밖의 일(폐번·LOT 확인 사정) */
  warnings: readonly string[];
  banner: ReactNode;
  isSubmitting: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

const toFact = (detail: WorkOrderCloseConfirmDetail): InfoFact =>
  detail.judgment === undefined
    ? { label: detail.label, value: detail.value }
    : {
        label: detail.label,
        title: detail.value,
        value: (
          <Chip
            size="sm"
            variant="status"
            status={detail.judgment === 'NORMAL' ? 'success' : 'warning'}
          >
            {detail.value}
          </Chip>
        ),
      };

/**
 * 작업지시 마감 확인(#360 확인 팝업 시안). 정보 상자 첫 줄은 작업지시 번호 · 판정, 둘째 줄은 판정이 요구한 입력.
 * 남는 LOT 이 있을 때만 그 구획, 단추 바로 위에 되돌릴 수 없다는 경고 한 줄. 보내는 본문 · 마감 조건은 부르는 쪽 그대로다.
 */
export const WorkOrderCloseConfirmDialog = ({
  workOrderNo,
  details,
  openLotNos,
  warnings,
  banner,
  isSubmitting,
  onClose,
  onConfirm,
}: WorkOrderCloseConfirmDialogProps) => {
  const t = messages.workOrderClose.confirm;
  const judgment = details.filter((detail) => detail.judgment !== undefined);
  const others = details.filter((detail) => detail.judgment === undefined);

  return (
    <Dialog
      closeOnBackdropClick={false}
      footer={
        <>
          <Button disabled={isSubmitting} variant="outlined" onClick={onClose}>
            {t.cancel}
          </Button>
          <Button loading={isSubmitting} variant="filled" onClick={onConfirm}>
            {t.confirm}
          </Button>
        </>
      }
      open
      showCloseButton={false}
      title={t.title}
      onClose={() => {
        if (!isSubmitting) onClose();
      }}
    >
      <div className="users-roles-worker-dialog work-order-close-confirm-body">
        {banner === null || banner === undefined ? null : <div>{banner}</div>}
        <InfoFacts
          rows={[
            [{ label: t.workOrderNo, value: workOrderNo }, ...judgment.map(toFact)],
            others.map(toFact),
          ]}
        />
        <p>{t.question}</p>
        {openLotNos.length === 0 ? null : (
          <section
            className="work-order-close-confirm-lots"
            aria-label={t.openLotsHeading(openLotNos.length)}
          >
            <h3 className="info-table-title">{t.openLotsHeading(openLotNos.length)}</h3>
            <p className="field-note">{t.openLotsNote}</p>
            <ul className="work-order-close-confirm-lot-list">
              {openLotNos.map((lotNo) => (
                <li key={lotNo}>{lotNo}</li>
              ))}
            </ul>
          </section>
        )}
        {warnings.map((warning) => (
          <p key={warning}>{warning}</p>
        ))}
        <p className="iqc-inspection-action-note users-roles-dialog-note" data-tone="info">
          <Icon name="info" size={16} aria-hidden />
          <span>
            {t.erp.queued} {t.erp.resultBefore}
            <Link to={ERP_RESULT_PATH}>{t.erp.menu}</Link>
            {t.erp.resultAfter}
          </span>
        </p>
        {/* 되돌릴 수 없다는 경고도 본문 안내 줄로 — 다른 확인 창과 같은 자리(사용자 지시 · #360). */}
        <p className="iqc-inspection-action-note users-roles-dialog-note" data-tone="warning">
          <Icon name="warning" size={16} aria-hidden />
          {t.irreversible}
        </p>
      </div>
    </Dialog>
  );
};
