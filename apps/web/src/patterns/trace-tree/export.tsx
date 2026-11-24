import { AlertBanner, Button, Dialog, Icon } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useId, useState } from 'react';

import { useApiClient } from '../api-context';
import { describeLoadError } from '../load-error-banner';
import { ApiRequestError, runRequestWithResponse, toApiError } from '../request';
import type { ListEntry } from './lot-list-state';
import type { TraceDirection } from './types';

/**
 * [엑셀 내보내기](피처 015 US4, R-8) — 지금 목록에 보이는 LOT 전체(최근 목록, 불러온 조건 결과, 스캔 목록)를 서버에
 * 보내고, 서버가 만든 .xlsx(시트 「최종 LOT」·「LOT 계보」)를 받아 저장한다.
 * - 200개를 넘으면 단추를 막고 사유를 잇는다(서버도 400).
 * - 조건 결과를 다 불러오지 않았으면 「지금 목록에 보이는 n개」를 확인받는다.
 * - 계보 줄이 100,000줄을 넘으면 서버가 422 `TRACE_EXPORT_TOO_LARGE` 로 거절한다 — 「조건을 좁히세요」.
 */
const t = messages.traceTree;

export const EXPORT_CAP = 200;
const TOO_LARGE_CODE = 'TRACE_EXPORT_TOO_LARGE';

export interface ExportPlan {
  lotIds: number[];
  /** 역방향만 — 시리얼로 들어온 줄의 { lotId: serialNo }. */
  serialNos: Record<string, string>;
}

/** 내보낼 LOT — 목록 순서, 같은 LOT 은 한 번. 시리얼은 역방향에서만 보낸다. */
export const exportPlan = (
  direction: TraceDirection,
  entries: readonly ListEntry[],
): ExportPlan => {
  const lotIds: number[] = [];
  const serialNos: Record<string, string> = {};
  const seen = new Set<number>();
  for (const entry of entries) {
    const id = entry.row.lot.lotId;
    if (seen.has(id)) continue;
    seen.add(id);
    lotIds.push(id);
    if (direction === 'BACKWARD' && entry.serialNo !== null) serialNos[String(id)] = entry.serialNo;
  }
  return { lotIds, serialNos };
};

/** 응답 머리의 파일 이름. 없으면 방향 이름. */
export const exportFileName = (disposition: string | null, direction: TraceDirection): string => {
  const encoded = /filename\*=UTF-8''([^;]+)/i.exec(disposition ?? '')?.[1];
  if (encoded !== undefined) return decodeURIComponent(encoded);
  const plain = /filename="?([^";]+)"?/i.exec(disposition ?? '')?.[1];
  return plain ?? `${direction === 'FORWARD' ? 'material' : 'product'}-trace.xlsx`;
};

/** 서버가 「계보 줄이 너무 많다」고 거절했는가(422). */
export const isExportTooLarge = (error: unknown): boolean => {
  if (!(error instanceof ApiRequestError)) return false;
  if (error.httpStatus === 422) return true;
  const api = error.apiError;
  return api.kind === 'validation' && api.errors.some((item) => item.code === TOO_LARGE_CODE);
};

const saveBlob = (fileName: string, blob: Blob): void => {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  URL.revokeObjectURL(url);
};

/** 서버에서 파일을 받아 저장한다. */
export const useTraceExportRun = (
  direction: TraceDirection,
  plantId: number | null,
): ((plan: ExportPlan) => Promise<void>) => {
  const { client } = useApiClient();
  return async (plan) => {
    if (plantId === null) return;
    const body = {
      plantId,
      lotIds: plan.lotIds,
      ...(Object.keys(plan.serialNos).length === 0 ? {} : { serialNos: plan.serialNos }),
    };
    const { data, response } = await runRequestWithResponse(() =>
      direction === 'FORWARD'
        ? client.POST('/trace/forward-exports', { body, parseAs: 'blob' })
        : client.POST('/trace/backward-exports', { body, parseAs: 'blob' }),
    );
    saveBlob(
      exportFileName(response.headers.get('Content-Disposition'), direction),
      data as unknown as Blob,
    );
  };
};

export interface TraceExportButtonProps {
  direction: TraceDirection;
  entries: readonly ListEntry[];
  /** 조건 결과의 전체 수 — 다 불러오지 않았으면 확인받는다. 최근·스캔 목록은 `null`. */
  total: number | null;
  run: (plan: ExportPlan) => Promise<void>;
  isTooLarge?: (error: unknown) => boolean;
}

type Failure = { kind: 'tooLarge' } | { kind: 'other'; message: string };

export const TraceExportButton = ({
  direction,
  entries,
  total,
  run,
  isTooLarge = isExportTooLarge,
}: TraceExportButtonProps) => {
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<Failure | null>(null);
  const reasonId = useId();
  const plan = exportPlan(direction, entries);
  const count = plan.lotIds.length;
  const tooMany = count > EXPORT_CAP;
  const partial = total !== null && total > count;

  const start = async (): Promise<void> => {
    setConfirming(false);
    setBusy(true);
    try {
      await run(plan);
    } catch (error) {
      setFailure(
        isTooLarge(error)
          ? { kind: 'tooLarge' }
          : { kind: 'other', message: describeLoadError(toApiError(error)) },
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Button
        variant="outlined"
        leadingIcon={<Icon name="download" size={18} />}
        disabled={busy || count === 0 || tooMany}
        loading={busy}
        aria-describedby={tooMany ? reasonId : undefined}
        title={count === 0 ? t.exporting.empty : busy ? t.exporting.busy : undefined}
        onClick={() => {
          if (partial) setConfirming(true);
          else void start();
        }}
      >
        {t.export}
      </Button>
      {tooMany && (
        <span id={reasonId} className="visually-hidden">
          {t.exporting.tooMany(EXPORT_CAP)}
        </span>
      )}
      {confirming && (
        <Dialog
          open
          size="sm"
          title={t.exporting.title}
          onClose={() => setConfirming(false)}
          footer={
            <>
              <Button variant="outlined" onClick={() => setConfirming(false)}>
                {t.exporting.cancel}
              </Button>
              <Button onClick={() => void start()}>{t.exporting.confirm}</Button>
            </>
          }
        >
          <p>{t.exporting.body(count)}</p>
          {total !== null && <p>{t.exporting.partial(count, total)}</p>}
        </Dialog>
      )}
      {failure !== null && (
        <Dialog
          open
          size="sm"
          title={t.exporting.title}
          onClose={() => setFailure(null)}
          footer={
            <Button variant="outlined" onClick={() => setFailure(null)}>
              {messages.common.close}
            </Button>
          }
        >
          {failure.kind === 'tooLarge' ? (
            <AlertBanner variant="warning" title={t.exporting.tooLargeTitle}>
              {t.exporting.tooLarge}
            </AlertBanner>
          ) : (
            <AlertBanner variant="error" title={t.exporting.failedTitle}>
              {failure.message}
            </AlertBanner>
          )}
        </Dialog>
      )}
    </>
  );
};
