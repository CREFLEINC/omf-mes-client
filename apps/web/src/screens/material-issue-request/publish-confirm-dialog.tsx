import { Button, Dialog } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';

const t = messages.materialIssueRequest;

/** 확인 창이 되보일 것 — 화면에 이미 있는 값만 받는다. 창이 다시 세거나 지어내지 않는다. */
export interface PublishSummary {
  workOrderNo: string;
  /** 고른 창고 이름. 고르지 않았으면 `null`(칸을 내지 않는다). */
  warehouse: string | null;
  /** 출발 생산 창고(생산 창고 공장에서만 · 「자동」 포함). 해당 없으면 `null`. */
  sourceWarehouse: string | null;
  /** 고른 도착 위치 이름. 고르지 않았으면 `null`. */
  destination: string | null;
  /** 필요일시(공장 시각 글자). 비었으면 `null`. */
  requiredAt: string | null;
  /** 이번 요청에 실릴 품목 줄 수 — 본문 조립이 고른 줄 수 그대로. */
  lineCount: number;
}

export interface PublishConfirmDialogProps {
  summary: PublishSummary;
  onConfirm: () => void;
  onClose: () => void;
}

/**
 * [요청 발행] 확인(#360). 확인을 누르면 창을 닫고 **종전 발행 호출을 그대로** 부른다 — 본문
 * 조립·멱등 도장·실패 배너·예정분 경고 창은 모두 종전 길을 탄다.
 */
export const PublishConfirmDialog = ({
  summary,
  onConfirm,
  onClose,
}: PublishConfirmDialogProps) => (
  <Dialog
    open
    onClose={onClose}
    size="md"
    closeOnBackdropClick={false}
    showCloseButton={false}
    title={t.confirm.title}
    footer={
      <div className="confirm-foot">
        <span className="confirm-foot-actions">
          <Button variant="outlined" onClick={onClose}>
            {messages.common.cancel}
          </Button>
          <Button onClick={onConfirm}>{t.confirm.submit}</Button>
        </span>
      </div>
    }
  >
    <dl className="confirm-facts is-stacked">
      <div>
        <dt>{t.confirm.workOrder}</dt>
        <dd>{summary.workOrderNo}</dd>
      </div>
      {summary.warehouse !== null && (
        <div>
          <dt>{t.confirm.warehouse}</dt>
          <dd>{summary.warehouse}</dd>
        </div>
      )}
      {summary.sourceWarehouse !== null && (
        <div>
          <dt>{t.lineTable.sourceWarehouse}</dt>
          <dd>{summary.sourceWarehouse}</dd>
        </div>
      )}
      {summary.destination !== null && (
        <div>
          <dt>{t.confirm.destination}</dt>
          <dd>{summary.destination}</dd>
        </div>
      )}
      {summary.requiredAt !== null && (
        <div>
          <dt>{t.confirm.requiredAt}</dt>
          <dd>{summary.requiredAt}</dd>
        </div>
      )}
      <div>
        <dt>{t.confirm.lines}</dt>
        <dd>{t.confirm.lineCount(summary.lineCount)}</dd>
      </div>
    </dl>
  </Dialog>
);
