import {
  AlertBanner,
  Button,
  Chip,
  DatePicker,
  Dialog,
  Skeleton,
  TextField,
  useToast,
} from '@crefle/web-ui';
import type {
  MaterialIssueRequestDetailForward,
  MaterialIssueRequestLineForward,
  MaterialIssueRequestUpdateForward,
} from '@omf-mes/api-client';
import { messages } from '@omf-mes/i18n';
import { useId, useRef, useState } from 'react';

import { SaveErrorBanner } from '../../patterns/master';
import { plantToday } from '../../patterns/plant-time';
import { Select } from '../../patterns/select';
import {
  hasErrorCode,
  useCancelRequest,
  useDestinationOptions,
  useRequestDetail,
  useRequestHistory,
  useUpdateRequest,
  useWarehouseOptions,
} from './queries';
import {
  dateEffect,
  editScope,
  formatDay,
  formatQty,
  isReleaseFailed,
  quantityError,
  STATUS_TONE,
  statusLabel,
} from './status';

const t = messages.materialIssueStatus;

const HOLIDAY_ACK_REQUIRED = 'HOLIDAY_ACK_REQUIRED';

const itemText = (line: MaterialIssueRequestLineForward): string =>
  line.itemCode ?? String(line.itemId);

type DialogState = 'date' | 'holiday' | 'cancel' | null;

export interface DetailPanelProps {
  requestId: number;
  /** 출발 생산 창고 후보를 고를 공장(목록 조건의 공장). */
  plantId: number | null;
  onClose: () => void;
}

/**
 * W-02-11 상세 — 오른쪽 덮개(screens/W-02-11.md 레이아웃). 대기 · 배포는 출고 작업일 · 출발 생산 창고 ·
 * 입고지 · 수량 · 취소, 진행 중은 수량만(기출고 이상), 완료 · 취소 · 지금 방식 요청은 보기만.
 */
export const DetailPanel = ({ requestId, plantId, onClose }: DetailPanelProps) => {
  const toast = useToast();
  const titleId = useId();
  const detail = useRequestDetail(requestId);
  const history = useRequestHistory(requestId);
  const today = plantToday();

  const [seeded, setSeeded] = useState<MaterialIssueRequestDetailForward | null>(null);
  const [qty, setQty] = useState<ReadonlyMap<number, string>>(new Map());
  const [source, setSource] = useState('');
  const [destination, setDestination] = useState('');
  const [dialog, setDialog] = useState<DialogState>(null);
  const [dateDraft, setDateDraft] = useState('');
  const [cancelReason, setCancelReason] = useState('');
  /**
   * 날짜만 바꾸는 저장인가 — 성공 토스트 문구가 갈린다. 쓰기 훅은 낸 때의 성공 처리를 부르므로 상태가
   * 아니라 참조에 둔다(같은 처리기에서 고친 상태는 그 처리에 보이지 않는다).
   */
  const pendingDateRef = useRef<string | null>(null);

  /* 응답이 바뀌면(저장 · 다시 불러오기) 입력을 다시 시드한다 — 렌더 중 갱신. */
  if (detail.data !== undefined && detail.data !== seeded) {
    setSeeded(detail.data);
    setQty(
      new Map(
        detail.data.lines.map((line) => [
          line.materialIssueRequestLineId,
          String(line.requestedQty),
        ]),
      ),
    );
    setSource(String(detail.data.materialIssueRequest.sourceWarehouseId ?? ''));
    setDestination(String(detail.data.materialIssueRequest.destinationLocationId));
  }

  const request = detail.data?.materialIssueRequest;
  const scope = request === undefined ? 'none' : editScope(request);
  const warehouses = useWarehouseOptions(scope === 'all' ? plantId : null);
  const destinations = useDestinationOptions(
    scope === 'all' ? (request?.destinationLocationId ?? null) : null,
  );

  const update = useUpdateRequest(requestId, (saved) => {
    setDialog(null);
    const date = pendingDateRef.current;
    pendingDateRef.current = null;
    if (date === null) toast.show({ variant: 'success', description: t.toast.saved });
    else
      toast.show({
        variant: 'success',
        description:
          date <= today
            ? t.toast.releasedNow(formatDay(date))
            : t.toast.dateChanged(formatDay(date)),
      });
    setSeeded(null);
    void saved;
  });
  const cancel = useCancelRequest(requestId, () => {
    setDialog(null);
    if (request !== undefined) {
      toast.show({ variant: 'success', description: t.toast.cancelled(request.issueRequestNo) });
    }
  });

  const reload = (): void => {
    update.reset();
    cancel.reset();
    setSeeded(null);
    void detail.refetch();
    void history.refetch();
  };

  /* 422 휴일 — 경고 창을 띄우고, 확인하면 `acknowledgeHoliday` 를 실어 다시 보낸다. */
  if (dialog === 'date' && hasErrorCode(update.error, HOLIDAY_ACK_REQUIRED)) {
    setDialog('holiday');
  }

  const body = () => {
    if (detail.isError) {
      return (
        <AlertBanner
          variant="error"
          title={messages.httpError.loadTitle}
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
    const qtyError = scope === 'none' ? null : quantityError(lines, qty, itemText);
    const lineChanges = lines
      .filter(
        (line) =>
          qty.get(line.materialIssueRequestLineId) !== undefined &&
          Number(qty.get(line.materialIssueRequestLineId)) !== line.requestedQty,
      )
      .map((line) => ({
        materialIssueRequestLineId: line.materialIssueRequestLineId,
        requestedQty: Number(qty.get(line.materialIssueRequestLineId)),
      }));
    const sourceChanged =
      scope === 'all' && source !== String(request.sourceWarehouseId ?? '') && source !== '';
    const destinationChanged =
      scope === 'all' &&
      destination !== String(request.destinationLocationId) &&
      destination !== '';
    const dirty = lineChanges.length > 0 || sourceChanged || destinationChanged;

    const save = (): void => {
      const patch: MaterialIssueRequestUpdateForward = {
        versionNo: request.versionNo ?? 0,
        ...(lineChanges.length > 0 ? { lines: lineChanges } : {}),
        ...(sourceChanged ? { sourceWarehouseId: Number(source) } : {}),
        ...(destinationChanged ? { destinationLocationId: Number(destination) } : {}),
      };
      pendingDateRef.current = null;
      update.write(patch);
    };

    const sendDate = (acknowledgeHoliday: boolean): void => {
      pendingDateRef.current = dateDraft;
      update.write({
        versionNo: request.versionNo ?? 0,
        issueWorkDate: dateDraft,
        ...(acknowledgeHoliday ? { acknowledgeHoliday: true } : {}),
      });
    };

    const notice = (() => {
      if (isReleaseFailed(request)) {
        return (
          <AlertBanner variant="error">
            {t.detail.releaseFailed(request.releaseErrorText ?? '')}
          </AlertBanner>
        );
      }
      if (request.displayStatus === 'IN_PROGRESS' && scope === 'quantity') {
        return <AlertBanner variant="warning">{t.detail.locked}</AlertBanner>;
      }
      if (request.displayStatus === 'CANCELLED') {
        return <AlertBanner variant="info">{t.detail.cancelled}</AlertBanner>;
      }
      if (request.displayStatus === 'DONE') {
        const reason =
          request.closeReasonCode === null || request.closeReasonCode === undefined
            ? undefined
            : t.closeReasons[request.closeReasonCode];
        const picked = lines.reduce(
          (sum, line) => sum + Math.max(0, (line.pickedQty ?? 0) - line.issuedQty),
          0,
        );
        return (
          <AlertBanner variant="info">
            {reason === undefined
              ? t.detail.done
              : t.detail.closed(reason, picked > 0 ? formatQty(picked) : '')}
          </AlertBanner>
        );
      }
      if (scope === 'none') return <AlertBanner variant="info">{t.detail.legacy}</AlertBanner>;
      return null;
    })();

    const errorBanner = (() => {
      const error = update.error ?? cancel.error;
      if (error === null || hasErrorCode(error, HOLIDAY_ACK_REQUIRED)) return null;
      if (error.kind === 'conflict' || error.kind === 'stateLocked') {
        return (
          <AlertBanner
            variant="error"
            action={
              <Button variant="outlined" size="sm" onClick={reload}>
                {t.errors.reload}
              </Button>
            }
          >
            {error.kind === 'conflict' ? t.errors.versionConflict : t.errors.stateLocked}
          </AlertBanner>
        );
      }
      return <SaveErrorBanner error={error} />;
    })();

    return (
      <div className="material-issue-status-detail">
        <p className="field-note">
          {[
            request.workOrderNo ?? String(request.workOrderId),
            t.detail.productionDate(formatDay(request.productionDate)),
            ...(request.productionPlanNo ? [t.detail.plan(request.productionPlanNo)] : []),
          ].join(', ')}
        </p>
        {notice}
        {errorBanner}

        <dl className="material-issue-status-head">
          <dt>{t.detail.issueWorkDate}</dt>
          <dd>
            <span>{formatDay(request.issueWorkDate)}</span>
            {scope === 'all' && (
              <Button
                variant="outlined"
                size="sm"
                onClick={() => {
                  update.reset();
                  setDateDraft(request.issueWorkDate ?? today);
                  setDialog('date');
                }}
              >
                {t.detail.changeDate}
              </Button>
            )}
            {scope === 'all' && t.detail.hints[request.displayStatus] !== undefined && (
              <span className="field-note">{t.detail.hints[request.displayStatus]}</span>
            )}
          </dd>
          <dt>{t.detail.sourceWarehouse}</dt>
          <dd>
            {scope === 'all' ? (
              <Select
                aria-label={t.detail.sourceWarehouse}
                value={source}
                options={withCurrent(warehouses.data ?? [], source, request.sourceWarehouseName)}
                onChange={setSource}
              />
            ) : (
              (request.sourceWarehouseName ?? '—')
            )}
          </dd>
          <dt>{t.detail.destination}</dt>
          <dd>
            {scope === 'all' ? (
              <Select
                aria-label={t.detail.destination}
                value={destination}
                options={withCurrent(
                  destinations.data ?? [],
                  destination,
                  request.destinationLocationName,
                )}
                onChange={setDestination}
              />
            ) : (
              (request.destinationLocationName ?? String(request.destinationLocationId))
            )}
          </dd>
        </dl>

        <table className="material-issue-status-lines" aria-label={t.detail.lines.label}>
          <thead>
            <tr>
              <th scope="col">{t.detail.lines.item}</th>
              <th scope="col">{t.detail.lines.requested}</th>
              <th scope="col">{t.detail.lines.picked}</th>
              <th scope="col">{t.detail.lines.issued}</th>
              <th scope="col">{t.detail.lines.outstanding}</th>
              <th scope="col">{t.detail.lines.shortage}</th>
            </tr>
          </thead>
          <tbody>
            {lines.map((line) => (
              <tr key={line.materialIssueRequestLineId}>
                <td>
                  <span className="material-issue-status-code">{itemText(line)}</span>
                  {line.itemName !== undefined && <span>{line.itemName}</span>}
                </td>
                <td>
                  {scope === 'none' ? (
                    formatQty(line.requestedQty)
                  ) : (
                    <TextField
                      size="sm"
                      inputMode="decimal"
                      aria-label={t.detail.lines.qtyLabel(itemText(line))}
                      value={qty.get(line.materialIssueRequestLineId) ?? ''}
                      onChange={(event) => {
                        update.reset();
                        setQty((prev) =>
                          new Map(prev).set(line.materialIssueRequestLineId, event.target.value),
                        );
                      }}
                    />
                  )}
                </td>
                <td>{formatQty(line.pickedQty ?? 0)}</td>
                <td>{formatQty(line.issuedQty)}</td>
                <td>
                  {formatQty(
                    line.outstandingQty ?? Math.max(0, line.requestedQty - line.issuedQty),
                  )}
                </td>
                <td>
                  {(line.shortageQty ?? 0) > 0 && (
                    <Chip size="sm" status="warning">
                      {formatQty(line.shortageQty ?? 0)}
                    </Chip>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {qtyError !== null && (
          <p className="field-error" role="alert">
            {qtyError}
          </p>
        )}

        <section aria-labelledby={`${titleId}-history`}>
          <h3 id={`${titleId}-history`} className="subsection-title">
            {t.detail.history}
          </h3>
          {(history.data?.length ?? 0) === 0 ? (
            <p className="field-note">{t.detail.noHistory}</p>
          ) : (
            <ul className="material-issue-status-history">
              {history.data?.map((entry, index) => (
                <li key={`${entry.occurredAt}-${String(index)}`}>
                  <span className="field-note">
                    {[entry.occurredAt.slice(5, 16).replace('T', ' '), entry.actorName ?? '']
                      .filter((part) => part !== '')
                      .join(' ')}
                  </span>
                  <span>{entry.text ?? entry.eventCode}</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <div className="form-actions">
          {scope === 'all' && (
            <Button
              variant="outlined"
              className="form-actions-secondary"
              onClick={() => {
                cancel.reset();
                setCancelReason('');
                setDialog('cancel');
              }}
            >
              {t.detail.cancel}
            </Button>
          )}
          {scope === 'quantity' && (
            <span className="field-note form-actions-secondary">{t.detail.cancelLocked}</span>
          )}
          {scope !== 'none' && (
            <>
              <Button
                variant="outlined"
                disabled={!dirty || update.isSaving}
                onClick={() => {
                  update.reset();
                  setSeeded(null);
                }}
              >
                {t.detail.revert}
              </Button>
              <Button
                disabled={!dirty || qtyError !== null || update.isSaving}
                loading={update.isSaving && pendingDateRef.current === null}
                onClick={save}
              >
                {t.detail.save}
              </Button>
            </>
          )}
        </div>

        <Dialog
          open={dialog === 'date'}
          onClose={() => setDialog(null)}
          title={t.dateDialog.title}
          size="sm"
          footer={
            <>
              <Button variant="outlined" onClick={() => setDialog(null)}>
                {t.dateDialog.cancel}
              </Button>
              <Button
                disabled={dateDraft === '' || update.isSaving}
                loading={update.isSaving}
                onClick={() => sendDate(false)}
              >
                {t.dateDialog.submit}
              </Button>
            </>
          }
        >
          <p className="dialog-text">
            {t.dateDialog.current(request.issueRequestNo, formatDay(request.issueWorkDate))}
          </p>
          <DatePicker
            aria-label={t.dateDialog.field}
            value={dateDraft}
            onChange={(value) => {
              update.reset();
              setDateDraft(value);
            }}
          />
          <AlertBanner variant="info">
            {dateEffect(dateDraft, today, request.displayStatus)}
          </AlertBanner>
        </Dialog>

        <Dialog
          open={dialog === 'holiday'}
          onClose={() => setDialog('date')}
          title={t.holidayDialog.title}
          size="sm"
          footer={
            <>
              <Button
                variant="outlined"
                onClick={() => {
                  update.reset();
                  setDialog('date');
                }}
              >
                {t.holidayDialog.back}
              </Button>
              <Button loading={update.isSaving} onClick={() => sendDate(true)}>
                {t.holidayDialog.submit}
              </Button>
            </>
          }
        >
          <p className="dialog-text">{t.holidayDialog.body(formatDay(dateDraft))}</p>
          <p className="dialog-text">{t.holidayDialog.note}</p>
        </Dialog>

        <Dialog
          open={dialog === 'cancel'}
          onClose={() => setDialog(null)}
          title={t.cancelDialog.title(request.issueRequestNo)}
          size="sm"
          footer={
            <>
              <Button variant="outlined" onClick={() => setDialog(null)}>
                {t.cancelDialog.close}
              </Button>
              <Button
                loading={cancel.isSaving}
                onClick={() =>
                  cancel.write({
                    versionNo: request.versionNo ?? 0,
                    ...(cancelReason.trim() === '' ? {} : { reason: cancelReason.trim() }),
                  })
                }
              >
                {t.cancelDialog.submit}
              </Button>
            </>
          }
        >
          <p className="dialog-text">
            {request.displayStatus === 'RELEASED'
              ? t.cancelDialog.released
              : t.cancelDialog.waiting}
          </p>
          {cancel.error !== null && <SaveErrorBanner error={cancel.error} />}
          <TextField
            label={t.cancelDialog.reason}
            placeholder={t.cancelDialog.reasonPlaceholder}
            value={cancelReason}
            onChange={(event) => setCancelReason(event.target.value)}
          />
        </Dialog>
      </div>
    );
  };

  return (
    <Dialog
      open
      onClose={onClose}
      placement="right"
      size="lg"
      className="material-issue-status-panel"
      aria-label={t.detail.label}
      title={
        request === undefined ? (
          t.detail.label
        ) : (
          <span className="material-issue-status-title">
            <span>{request.issueRequestNo}</span>
            <Chip size="sm" status={STATUS_TONE[request.displayStatus]}>
              {statusLabel(request)}
            </Chip>
          </span>
        )
      }
    >
      {body()}
    </Dialog>
  );
};

/** 고른 값이 후보 목록에 없으면(다른 공장 · 끈 창고) 그 이름을 맨 앞에 둔다 — 빈 칸으로 보이지 않게. */
const withCurrent = (
  options: { value: string; label: string }[],
  value: string,
  name: string | null | undefined,
): { value: string; label: string }[] =>
  value === '' || options.some((option) => option.value === value)
    ? options
    : [{ value, label: name ?? value }, ...options];
