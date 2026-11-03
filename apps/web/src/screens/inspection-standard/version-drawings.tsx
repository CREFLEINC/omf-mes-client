import {
  AlertBanner,
  Button,
  Dialog,
  EmptyState,
  Icon,
  SkeletonText,
  useToast,
} from '@crefle/web-ui';
import { createIdempotencyKey, type ApiError } from '@omf-mes/api-client';
import { messages } from '@omf-mes/i18n';
import { useQueryClient, type UseQueryResult } from '@tanstack/react-query';
import { useRef, useState, type ChangeEvent } from 'react';

import { useApiClient } from '../../patterns/api-context';
import {
  InspectionDrawingImages,
  type InspectionDrawing,
} from '../../patterns/inspection-drawings';
import { runRequest, toApiError, type ApiCallResult } from '../../patterns/request';
import { LoadErrorBanner } from './load-error-banner';
import { PlanActionBanner } from './plan-action-banner';

const t = messages.inspectionStandard.versionSection;

/** 서버 첨부 상한과 같다(`MAX_ATTACHMENT_BYTES`). 넘으면 보내기 전에 막는다. */
const MAX_DRAWING_BYTES = 10 * 1024 * 1024;
const DRAWING_TYPES = ['image/png', 'image/jpeg'];

type Pick = { kind: 'add' } | { kind: 'replace'; attachmentId: number };

/** 그림 파일 사전 검사 — 서버도 앞 바이트로 다시 본다. 통과하면 null. */
export const drawingFileProblem = (file: File): string | null => {
  if (!DRAWING_TYPES.includes(file.type)) return t.drawingFileInvalid;
  if (file.size > MAX_DRAWING_BYTES) return t.drawingFileTooLarge;
  return null;
};

/**
 * 버전 상세 「도면」 탭(omf-all-around#208) — 고른 버전의 기준서 도면. 조회는 화면이 쥔다(탭 이름의 건수와 같은 조회).
 * 작성 중 버전이면 도면을 추가하고, 보고 있는 도면을 바꾸거나 뺀다(#227). 확정 버전은 보기만 한다 — 검사 항목 탭과 같다.
 */
export const VersionDrawings = ({
  versionId,
  drawings,
  isEditable,
}: {
  versionId: number;
  drawings: UseQueryResult<InspectionDrawing[]>;
  isEditable: boolean;
}) => {
  const { client } = useApiClient();
  const queryClient = useQueryClient();
  const toast = useToast();
  const fileInput = useRef<HTMLInputElement>(null);
  const [pick, setPick] = useState<Pick>({ kind: 'add' });
  const [current, setCurrent] = useState(0);
  const [removing, setRemoving] = useState<number | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [error, setError] = useState<ApiError | null>(null);

  const list = drawings.data ?? [];
  const shown = Math.min(current, Math.max(list.length - 1, 0));
  const shownDrawing = list[shown];

  /** 바뀐 목록을 다시 받은 뒤 그 자리로 옮긴다 — 추가는 맨 끝, 빼기는 앞 자리. */
  const write = async (
    send: () => Promise<ApiCallResult<unknown>>,
    done: string,
    nextIndex: (count: number) => number,
  ): Promise<void> => {
    setIsSaving(true);
    setError(null);
    try {
      await runRequest(send);
      await queryClient.invalidateQueries({ queryKey: ['inspection-drawings', versionId] });
      const count =
        queryClient.getQueryData<InspectionDrawing[]>(['inspection-drawings', versionId])?.length ??
        0;
      setCurrent(Math.max(nextIndex(count), 0));
      setRemoving(null);
      toast.show({ variant: 'success', description: done });
    } catch (cause) {
      setError(toApiError(cause));
    } finally {
      setIsSaving(false);
    }
  };

  const openPicker = (next: Pick): void => {
    setPick(next);
    setProblem(null);
    fileInput.current?.click();
  };

  const onFile = (event: ChangeEvent<HTMLInputElement>): void => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (file === undefined) return;
    const found = drawingFileProblem(file);
    setProblem(found);
    if (found !== null) return;
    const form = new FormData();
    form.append('file', file);
    const header = { 'Idempotency-Key': createIdempotencyKey() };
    if (pick.kind === 'add') {
      void write(
        () =>
          client.POST('/quality/inspection-plan-versions/{inspectionPlanVersionId}/drawings', {
            params: { header, path: { inspectionPlanVersionId: versionId } },
            body: form,
          }),
        t.drawingAdded,
        (count) => count - 1,
      );
      return;
    }
    const { attachmentId } = pick;
    void write(
      () =>
        client.PUT(
          '/quality/inspection-plan-versions/{inspectionPlanVersionId}/drawings/{attachmentId}',
          {
            params: { header, path: { inspectionPlanVersionId: versionId, attachmentId } },
            body: form,
          },
        ),
      t.drawingReplaced,
      () => shown,
    );
  };

  const remove = (attachmentId: number): void => {
    void write(
      () =>
        client.DELETE(
          '/quality/inspection-plan-versions/{inspectionPlanVersionId}/drawings/{attachmentId}',
          {
            params: {
              header: { 'Idempotency-Key': createIdempotencyKey() },
              path: { inspectionPlanVersionId: versionId, attachmentId },
            },
          },
        ),
      t.drawingRemoved,
      (count) => Math.min(shown, count - 1),
    );
  };

  if (drawings.isError) {
    return <LoadErrorBanner error={drawings.error} onRetry={() => void drawings.refetch()} />;
  }
  if (drawings.data === undefined) {
    return (
      <div role="status" aria-label={t.drawingsLoading}>
        <SkeletonText lines={3} />
      </div>
    );
  }

  return (
    <>
      {isEditable && (
        <div className="inspection-standard-section-head inspection-standard-tab-toolbar">
          <input
            ref={fileInput}
            type="file"
            accept={DRAWING_TYPES.join(',')}
            hidden
            data-testid="drawing-file-input"
            onChange={onFile}
          />
          <Button
            variant="outlined"
            leadingIcon={<Icon name="add" size={18} />}
            disabled={isSaving}
            onClick={() => openPicker({ kind: 'add' })}
          >
            {t.drawingAdd}
          </Button>
          {shownDrawing !== undefined && (
            <>
              <Button
                variant="outlined"
                leadingIcon={<Icon name="swap_horiz" size={18} />}
                disabled={isSaving}
                onClick={() =>
                  openPicker({ kind: 'replace', attachmentId: shownDrawing.attachmentId })
                }
              >
                {t.drawingReplace}
              </Button>
              <Button
                variant="outlined"
                leadingIcon={<Icon name="delete" size={18} />}
                disabled={isSaving}
                onClick={() => {
                  setError(null);
                  setRemoving(shownDrawing.attachmentId);
                }}
              >
                {t.drawingRemove}
              </Button>
            </>
          )}
        </div>
      )}
      {problem !== null && (
        <div className="banner-slot">
          <AlertBanner variant="error" title={messages.httpError.title}>
            {problem}
          </AlertBanner>
        </div>
      )}
      {removing === null && <PlanActionBanner error={error} />}

      {drawings.data.length === 0 ? (
        <EmptyState
          size="sm"
          icon={<Icon name="image" size={32} />}
          title={t.drawingsNone}
          description={isEditable ? t.drawingsNoneHintEditable : t.drawingsNoneHint}
        />
      ) : (
        <InspectionDrawingImages
          drawings={drawings.data}
          altOf={t.drawingAlt}
          labels={{ prev: t.drawingPrev, next: t.drawingNext }}
          current={shown}
          onCurrentChange={setCurrent}
        />
      )}

      {removing !== null && (
        <Dialog
          open
          size="sm"
          title={t.drawingRemoveTitle(shown + 1)}
          closeOnBackdropClick={false}
          showCloseButton={false}
          onClose={() => setRemoving(null)}
          footer={
            <>
              <Button variant="outlined" disabled={isSaving} onClick={() => setRemoving(null)}>
                {messages.common.cancel}
              </Button>
              <Button loading={isSaving} disabled={isSaving} onClick={() => remove(removing)}>
                {t.drawingRemoveConfirm}
              </Button>
            </>
          }
        >
          <PlanActionBanner error={error} />
          <p>{t.drawingRemoveBody}</p>
        </Dialog>
      )}
    </>
  );
};
