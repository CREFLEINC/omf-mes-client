import { AlertBanner, Button, Chip, Dialog, Skeleton, useToast } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useId, useState } from 'react';

import { SaveErrorBanner } from '../../patterns/master';
import { toApiError } from '../../patterns/request';
import type { ApiError } from '@omf-mes/api-client';
import { CloseDialog } from './close-dialog';
import { useCancelRequest, useCloseRemaining } from './mutations';
import { OriginChip, StatusChips } from './progress-view';
import { useDetail, useHistory } from './queries';
import {
  detailAction,
  formatQty,
  hasErrorCode,
  lineClosedQty,
  pickedNotIssued,
  plantMinute,
  qtyWithUom,
} from './types';

const t = messages.productionWarehouseReplenishment;
const td = t.detail;

type DialogState = 'cancel' | 'close' | null;

export interface DetailPanelProps {
  requestId: number;
  onClose: () => void;
}

/** 쓰기 실패 안내 — 409 판 충돌은 다시 불러오기, 상태 잠김은 사유별 문구. */
const writeErrorText = (error: ApiError): string | null => {
  if (hasErrorCode(error, 'VERSION_CONFLICT') || error.kind === 'conflict') {
    return t.errors.versionConflict;
  }
  if (hasErrorCode(error, 'PICKED_NOT_ISSUED')) return t.errors.pickedFirst;
  if (error.kind === 'stateLocked') return t.errors.stateLocked;
  return null;
};

/**
 * 진행 상세 — 오른쪽 덮개(screens/W-02-12.md 보기 2). 진행 없음은 [요청 취소], 진행 있음은 [잔량 마감](집고 출고 안 한
 * 양이 있으면 잠김), 완료 · 마감 · 취소는 보기만.
 */
export const DetailPanel = ({ requestId, onClose }: DetailPanelProps) => {
  const toast = useToast();
  const lockId = useId();
  const detail = useDetail(requestId);
  const history = useHistory(requestId);
  const [dialog, setDialog] = useState<DialogState>(null);

  const cancel = useCancelRequest(requestId, (saved) => {
    setDialog(null);
    toast.show({
      variant: 'success',
      description: t.toast.cancelled(saved.materialIssueRequest.issueRequestNo),
    });
  });
  const close = useCloseRemaining(requestId, (saved) => {
    setDialog(null);
    toast.show({ variant: 'success', description: t.toast.closed(saved.issueRequestNo) });
  });

  const reload = (): void => {
    cancel.reset();
    close.reset();
    void detail.refetch();
    void history.refetch();
  };

  const request = detail.data?.request;

  const body = () => {
    if (detail.isError) {
      const error = toApiError(detail.error);
      if (error.kind === 'http' && error.status === 404) {
        return <AlertBanner variant="error">{td.notFound}</AlertBanner>;
      }
      return (
        <AlertBanner
          variant="error"
          title={td.loadFailed}
          action={
            <Button variant="outlined" size="sm" onClick={() => void detail.refetch()}>
              {messages.common.retry}
            </Button>
          }
        >
          {messages.httpError.description}
        </AlertBanner>
      );
    }
    if (detail.data === undefined || request === undefined) {
      return <Skeleton variant="rect" height="20rem" />;
    }

    const lines = detail.data.lines;
    const action = detailAction(request, lines);
    const picked = pickedNotIssued(lines);
    const uom = lines.length === 1 ? (lines[0]?.uomCode ?? '') : '';
    const closedEntry = history.data?.find((entry) => entry.eventCode === 'CLOSED');

    const notice = (() => {
      if (request.releaseFailed) {
        return <AlertBanner variant="error">{request.releaseErrorText}</AlertBanner>;
      }
      if (request.status === 'CLOSED') {
        const issued = lines.reduce((sum, line) => sum + line.issued, 0);
        const closedQty = lines.reduce((sum, line) => sum + lineClosedQty(request, line), 0);
        const reason =
          request.closeReasonDetailCode === null
            ? ''
            : ((t.closeReasons as Record<string, string>)[request.closeReasonDetailCode] ??
              request.closeReasonDetailCode);
        const text = [
          td.closed(qtyWithUom(issued, uom), qtyWithUom(closedQty, uom), reason),
          request.closeRemark ?? '',
          closedEntry === undefined
            ? ''
            : td.closedBy(
                plantMinute(closedEntry.occurredAt),
                closedEntry.actorName ?? td.systemActor,
              ),
        ]
          .filter((part) => part !== '')
          .join(' ');
        return <AlertBanner variant="success">{text}</AlertBanner>;
      }
      if (request.status === 'CANCELLED') return <AlertBanner variant="info">{td.cancelled}</AlertBanner>;
      if (request.status === 'DONE') return <AlertBanner variant="info">{td.done}</AlertBanner>;
      if (action === 'close' && picked > 0) {
        return (
          <AlertBanner variant="info">{td.pickedNotIssued(qtyWithUom(picked, uom))}</AlertBanner>
        );
      }
      return null;
    })();

    const errorBanner = (() => {
      const error = cancel.error ?? (dialog === 'close' ? null : close.error);
      if (error === null) return null;
      const text = writeErrorText(error);
      if (text === null) return <SaveErrorBanner error={error} />;
      return (
        <AlertBanner
          variant="error"
          action={
            <Button variant="outlined" size="sm" onClick={reload}>
              {t.common.reload}
            </Button>
          }
        >
          {text}
        </AlertBanner>
      );
    })();

    return (
      <div className="replenishment-detail">
        {notice}
        {errorBanner}
        <dl className="replenishment-head">
          <dt>{td.head.productionWarehouse}</dt>
          <dd>{request.productionWarehouseName}</dd>
          <dt>{td.head.destination}</dt>
          <dd>{request.destinationName}</dd>
          <dt>{td.head.source}</dt>
          <dd>{request.sourceWarehouseName}</dd>
          <dt>{td.head.requestedAt}</dt>
          <dd>
            {`${plantMinute(request.requestedAt)} ${
              request.origin === 'AUTO' ? td.autoActor : ''
            }`.trim()}
          </dd>
          {request.remarks !== null && request.remarks !== '' && (
            <>
              <dt>{td.head.remarks}</dt>
              <dd>{request.remarks}</dd>
            </>
          )}
        </dl>

        <table className="replenishment-table" aria-label={td.lines.label}>
          <thead>
            <tr>
              <th scope="col">{td.lines.item}</th>
              <th scope="col" className="is-number">
                {td.lines.requested}
              </th>
              <th scope="col" className="is-number">
                {td.lines.picked}
              </th>
              <th scope="col" className="is-number">
                {td.lines.issued}
              </th>
              <th scope="col" className="is-number">
                {td.lines.closed}
              </th>
              <th scope="col" className="is-number">
                {td.lines.shortage}
              </th>
            </tr>
          </thead>
          <tbody>
            {lines.map((line) => {
              const closedQty = lineClosedQty(request, line);
              return (
                <tr key={line.id}>
                  <td>
                    <span className="replenishment-code">{line.itemCode}</span>{' '}
                    <span>{line.itemName}</span>
                  </td>
                  <td className="is-number">{qtyWithUom(line.requested, line.uomCode)}</td>
                  <td className="is-number">{formatQty(line.picked)}</td>
                  <td className="is-number">{formatQty(line.issued)}</td>
                  <td className="is-number">
                    {closedQty > 0 ? formatQty(closedQty) : t.common.none}
                  </td>
                  <td className="is-number">
                    {line.shortage > 0 ? formatQty(line.shortage) : t.common.none}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        <section aria-label={td.goodsIssues.title}>
          <h3 className="subsection-title">{td.goodsIssues.title}</h3>
          {request.goodsIssues.length === 0 ? (
            <p className="field-note">{td.goodsIssues.empty}</p>
          ) : (
            <table className="replenishment-table" aria-label={td.goodsIssues.label}>
              <thead>
                <tr>
                  <th scope="col">{td.goodsIssues.no}</th>
                  <th scope="col">{td.goodsIssues.issuedAt}</th>
                  <th scope="col">{td.goodsIssues.received}</th>
                </tr>
              </thead>
              <tbody>
                {request.goodsIssues.map((issue) => (
                  <tr key={issue.goodsIssueId}>
                    <td className="replenishment-code">{issue.goodsIssueNo}</td>
                    <td>{plantMinute(issue.issuedAt)}</td>
                    <td>
                      <Chip size="sm" status={issue.received ? 'success' : 'info'}>
                        {issue.received ? td.goodsIssues.receivedYes : td.goodsIssues.receivedNo}
                      </Chip>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        <section aria-label={td.history}>
          <h3 className="subsection-title">{td.history}</h3>
          {history.isError ? (
            <AlertBanner
              variant="error"
              action={
                <Button variant="outlined" size="sm" onClick={() => void history.refetch()}>
                  {messages.common.retry}
                </Button>
              }
            >
              {td.historyFailed}
            </AlertBanner>
          ) : history.isPending ? (
            <Skeleton variant="rect" height="3rem" />
          ) : history.data.length === 0 ? (
            <p className="field-note">{td.noHistory}</p>
          ) : (
            <ul className="replenishment-history">
              {history.data.map((entry, index) => (
                <li key={`${entry.occurredAt}-${String(index)}`}>
                  <span className="field-note">
                    {`${plantMinute(entry.occurredAt)} ${entry.actorName ?? td.systemActor}`}
                  </span>
                  <span>{td.events[entry.eventCode] ?? entry.eventCode}</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <div className="form-actions">
          {action === 'cancel' && (
            <Button
              variant="outlined"
              onClick={() => {
                cancel.reset();
                setDialog('cancel');
              }}
            >
              {td.cancel}
            </Button>
          )}
          {action === 'close' && (
            <>
              {picked > 0 && (
                <span id={lockId} className="field-note">
                  {td.pickedLock(qtyWithUom(picked, uom))}
                </span>
              )}
              <Button
                disabled={picked > 0}
                aria-describedby={picked > 0 ? lockId : undefined}
                onClick={() => {
                  close.reset();
                  setDialog('close');
                }}
              >
                {td.closeRemaining}
              </Button>
            </>
          )}
        </div>

        <Dialog
          open={dialog === 'cancel'}
          onClose={() => setDialog(null)}
          title={t.cancelDialog.title(request.no)}
          size="sm"
          footer={
            <>
              <Button variant="outlined" onClick={() => setDialog(null)}>
                {t.cancelDialog.close}
              </Button>
              <Button
                loading={cancel.isSaving}
                onClick={() => cancel.write({ versionNo: request.versionNo })}
              >
                {t.cancelDialog.submit}
              </Button>
            </>
          }
        >
          <p className="dialog-text">{t.cancelDialog.body}</p>
        </Dialog>
        {dialog === 'close' && (
          <CloseDialog open detail={detail.data} close={close} onClose={() => setDialog(null)} />
        )}
      </div>
    );
  };

  return (
    <Dialog
      open
      onClose={onClose}
      placement="right"
      size="lg"
      className="replenishment-panel"
      aria-label={td.label}
      title={
        request === undefined ? (
          td.label
        ) : (
          <span className="replenishment-chips">
            <span>{request.no}</span>
            <StatusChips request={request} />
            <OriginChip origin={request.origin} />
          </span>
        )
      }
    >
      {body()}
    </Dialog>
  );
};
