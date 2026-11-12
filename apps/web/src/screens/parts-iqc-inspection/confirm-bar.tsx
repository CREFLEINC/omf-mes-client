import { AlertBanner, Button, Chip, Dialog, Icon, useToast } from '@crefle/web-ui';
import type { InspectionConfirmBlockerCode } from '@omf-mes/api-client';
import { messages } from '@omf-mes/i18n';
import { useId, useState } from 'react';

import { useApiClient } from '../../patterns/api-context';
import { useSession } from '../../patterns/session';
import { toApiError } from '../../patterns/request';
import {
  CancelBlockedDialog,
  CancelConfirmDialog,
  type ConfirmBlocker,
} from './cancel-confirm-dialog';
import {
  cancelConfirmInspection,
  confirmInspection,
  useInboundRefresh,
  type InboundInspection,
} from './inbound-queries';
import { judgmentStatus, judgmentText } from './result-list';

const t = messages.iqcInboundLot.confirm;
const tc = messages.iqcInboundLot.cancel;

/** 확정 · 확정 취소 권한 — 화면이 아닌 동작 권한(D-11 · D-20, W-03-14 선례). */
export const CONFIRM_PERMISSION = 'W-01-15';

const BLOCKER_CODES: readonly InspectionConfirmBlockerCode[] = [
  'INBOUND_LOT_FINALIZED',
  'GOODS_RECEIVED',
  'DISPOSITION_STARTED',
  'CONCESSION_EXISTS',
  'LOT_STATUS_CHANGED',
];

/** 오류 줄의 LOT 번호 — `lotNos` 또는 `details.lotNos`(G2 L12 — 서버가 실는다). */
const lotNosOf = (item: unknown): string[] | undefined => {
  if (typeof item !== 'object' || item === null) return undefined;
  const record = item as { lotNos?: unknown; details?: { lotNos?: unknown } | null };
  const raw = Array.isArray(record.lotNos) ? record.lotNos : record.details?.lotNos;
  return Array.isArray(raw) ? raw.filter((no): no is string => typeof no === 'string') : undefined;
};

/** 판정 확정이 잠기는 까닭(US4-6) — 결과 0건, 판정이 빈 결과. 없으면 null. */
export const confirmLockOf = (inspection: InboundInspection): string | null => {
  const results = inspection.results ?? [];

  if (results.length === 0) return t.lockedNoResults;
  /* 재작업으로 다시 연 뒤 앞 확정 결과(CONFIRMED)만 남았으면 새 결과가 없다 — 서버도 400(G2 L2). */
  if (!results.some((result) => result.statusCode === 'DRAFT')) return t.lockedNoNewResult;
  if (results.some((result) => result.overallJudgmentCode == null)) return t.lockedNoJudgment;

  return null;
};

export const useCanConfirm = (): boolean => {
  const { session } = useSession();

  return session?.permissions?.includes(CONFIRM_PERMISSION) ?? false;
};

/** 권한이 없으면 머리 아래 한 줄(US4-7) — 단추는 그리지 않는다. */
export const ConfirmPermissionNote = () =>
  useCanConfirm() ? null : (
    <p className="iqc-inspection-action-note" data-tone="info">
      <Icon name="lock" size={14} aria-hidden />
      {t.noPermission}
    </p>
  );

/**
 * 판정 확정 · 확정 취소 단추와 창(screens/W-01-01.md · US4 · US5, C4). `session.permissions` 에 W-01-15 가 있을 때만 단추를 그린다.
 * 확정 전이면 [판정 확정](잠김 까닭은 단추 설명), 확정 뒤면 [확정 취소].
 */
export const ConfirmActions = ({
  inspection,
  confirmed,
}: {
  inspection: InboundInspection;
  confirmed: boolean;
}) => {
  const canConfirm = useCanConfirm();
  const { client } = useApiClient();
  const toast = useToast();
  const refresh = useInboundRefresh();
  const lockId = useId();
  const [asking, setAsking] = useState<'confirm' | 'cancel' | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<{ text: string; reload: boolean } | null>(null);
  const [blockers, setBlockers] = useState<ConfirmBlocker[] | null>(null);

  if (!canConfirm) return null;

  const inboundLotNo = inspection.inboundLotNo ?? inspection.inspectionRequestNo;
  const versionNo = inspection.versionNo ?? 0;
  const results = inspection.results ?? [];
  const lotCount = (inspection.lots ?? []).length;
  const preview = inspection.previewJudgmentCode ?? null;
  const lock = confirmLockOf(inspection);
  const count = (code: string) =>
    results.filter((result) => result.overallJudgmentCode === code).length;

  const failure = (cause: unknown, fallback: string): { text: string; reload: boolean } => {
    const apiError = toApiError(cause);
    const conflict =
      apiError.kind === 'conflict' ||
      ((apiError.kind === 'validation' || apiError.kind === 'stateLocked') &&
        apiError.errors.some((item) => item.code === 'VERSION_CONFLICT'));

    if (conflict) return { text: t.conflict, reload: true };
    /* 400 등은 서버 문구를 덧붙인다 — 일반 실패 문구만으로는 다음에 할 일을 모른다(G2 L2). */
    const serverLines =
      apiError.kind === 'validation' || apiError.kind === 'stateLocked'
        ? apiError.errors.map((item) => item.message)
        : apiError.kind === 'http' && apiError.message !== undefined
          ? [apiError.message]
          : [];
    const text = [fallback, ...serverLines.filter((line) => line !== '')].join(' ');

    return { text, reload: false };
  };

  const confirm = async (): Promise<void> => {
    setBusy(true);
    setError(null);
    try {
      const done = await confirmInspection(client, inspection.inspectionRequestId, versionNo);

      setAsking(null);
      toast.show({
        variant: 'success',
        description:
          done.overallJudgmentCode === 'REJECTED'
            ? t.doneRejected(done.nonconformanceNo ?? null)
            : t.done(judgmentText(done.overallJudgmentCode ?? preview)),
      });
    } catch (cause) {
      setAsking(null);
      setError(failure(cause, t.failed));
    } finally {
      setBusy(false);
      await refresh();
    }
  };

  const cancel = async (reason: string): Promise<void> => {
    setBusy(true);
    setError(null);
    try {
      await cancelConfirmInspection(client, inspection.inspectionRequestId, versionNo, reason);
      setAsking(null);
      toast.show({ variant: 'success', description: tc.done });
    } catch (cause) {
      const apiError = toApiError(cause);
      const found =
        apiError.kind === 'validation' || apiError.kind === 'stateLocked'
          ? apiError.errors
              .filter((item) => (BLOCKER_CODES as readonly string[]).includes(item.code))
              .map((item) => ({
                code: item.code,
                message: item.message,
                lotNos: lotNosOf(item),
              }))
          : [];

      setAsking(null);
      if (found.length > 0) setBlockers(found);
      else setError(failure(cause, tc.failed));
    } finally {
      setBusy(false);
      await refresh();
    }
  };

  return (
    <>
      {confirmed ? (
        <Button variant="outlined" size="sm" onClick={() => setAsking('cancel')}>
          {tc.open}
        </Button>
      ) : (
        <>
          <Button
            size="sm"
            disabled={lock !== null}
            aria-describedby={lock === null ? undefined : lockId}
            title={lock ?? undefined}
            onClick={() => setAsking('confirm')}
          >
            {t.open}
          </Button>
          {lock === null ? null : (
            <span id={lockId} className="visually-hidden">
              {lock}
            </span>
          )}
        </>
      )}

      {error === null ? null : (
        <Dialog
          open
          size="sm"
          title={error.text}
          onClose={() => setError(null)}
          footer={
            <Button
              onClick={() => {
                setError(null);
                void refresh();
              }}
            >
              {error.reload ? t.reload : tc.blockedOk}
            </Button>
          }
        >
          <AlertBanner variant="error">{error.text}</AlertBanner>
        </Dialog>
      )}

      {asking === 'confirm' && (
        <Dialog
          open
          size="md"
          showCloseButton={false}
          closeOnBackdropClick={false}
          title={t.title(inboundLotNo)}
          onClose={() => setAsking(null)}
          footer={
            <>
              <Button variant="outlined" disabled={busy} onClick={() => setAsking(null)}>
                {t.back}
              </Button>
              <Button loading={busy} onClick={() => void confirm()}>
                {t.proceed(judgmentText(preview))}
              </Button>
            </>
          }
        >
          <div className="iqc-inbound-confirm">
            <Chip size="sm" status={judgmentStatus(preview)}>
              {judgmentText(preview)}
            </Chip>
            <p className="dialog-text">
              {t.counts(results.length, count('ACCEPTED'), count('REJECTED'), count('HELD'))}
            </p>
            <p className="dialog-text">
              <strong>{t.applyHeading}</strong>{' '}
              {preview === 'REJECTED'
                ? t.apply.REJECTED(lotCount)
                : preview === 'HELD'
                  ? t.apply.HELD(lotCount)
                  : t.apply.ACCEPTED(lotCount)}
            </p>
            <p className="field-note">{t.note}</p>
          </div>
        </Dialog>
      )}

      {asking === 'cancel' && (
        <CancelConfirmDialog
          inspection={inspection}
          busy={busy}
          error={null}
          onBack={() => setAsking(null)}
          onProceed={(reason) => void cancel(reason)}
        />
      )}

      {blockers === null ? null : (
        <CancelBlockedDialog blockers={blockers} onClose={() => setBlockers(null)} />
      )}
    </>
  );
};
