import { AlertBanner, Button, Dialog, EmptyState, Icon, SkeletonText } from '@crefle/web-ui';
import { createIdempotencyKey, type ApiError } from '@omf-mes/api-client';
import { messages } from '@omf-mes/i18n';
import { useQueryClient, type UseQueryResult } from '@tanstack/react-query';
import { useMemo, useRef, useState, type ChangeEvent } from 'react';

import { useApiClient } from '../../patterns/api-context';
import {
  InspectionDrawingImages,
  type InspectionDrawing,
} from '../../patterns/inspection-drawings';
import { runRequest, toApiError } from '../../patterns/request';
import { LoadErrorBanner } from './load-error-banner';
import { PlanActionBanner } from './plan-action-banner';

const t = messages.inspectionStandard.versionSection;

/** 서버 첨부 상한과 같다(`MAX_ATTACHMENT_BYTES`). 넘으면 보내기 전에 막는다. */
const MAX_DRAWING_BYTES = 10 * 1024 * 1024;
const DRAWING_TYPES = ['image/png', 'image/jpeg'];

/** 그림 파일 사전 검사 — 서버도 앞 바이트로 다시 본다. 통과하면 null. */
export const drawingFileProblem = (file: File): string | null => {
  if (!DRAWING_TYPES.includes(file.type)) return t.drawingFileInvalid;
  if (file.size > MAX_DRAWING_BYTES) return t.drawingFileTooLarge;
  return null;
};

/** 초안 도면 한 장 — `attachmentId` 가 없으면 새로 붙일 그림, `file` 이 있으면 저장할 때 보낼 그림이다. */
interface DraftDrawing {
  key: number;
  attachmentId: number | null;
  blob: Blob;
  file: File | null;
}

interface DraftState {
  versionId: number | null;
  list: DraftDrawing[];
  /** 저장할 때 지울 서버 도면. */
  removed: number[];
}

const fromServer = (
  versionId: number | null,
  drawings: readonly InspectionDrawing[],
): DraftState => ({
  versionId,
  list: drawings.map((drawing) => ({ ...drawing, key: drawing.attachmentId, file: null })),
  removed: [],
});

/**
 * 도면 탭의 초안(#227) — 검사 항목 탭처럼 추가 · 수정 · 제거는 화면에만 담고 [저장]을 눌러야 작성 중 버전에 보낸다(사용자 지시).
 * 확정 · 신규 버전 발행을 막으려면 화면이 「저장하지 않은 변경」을 알아야 해 초안을 화면이 쥔다.
 * 다른 버전으로 옮기면 초안을 버린다. 서버 목록이 새로 오면 저장하지 않은 변경이 없을 때만 다시 세운다.
 */
export const useVersionDrawingDraft = (
  versionId: number | null,
  drawings: UseQueryResult<InspectionDrawing[]>,
) => {
  const { client } = useApiClient();
  const queryClient = useQueryClient();
  const [state, setState] = useState<DraftState>(() => fromServer(null, []));
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  /* 새 그림의 자리 표시 — 서버 첨부 번호(양수)와 겹치지 않게 음수로 센다. */
  const nextKey = useRef(-1);
  const takeKey = (): number => {
    const key = nextKey.current;
    nextKey.current -= 1;
    return key;
  };

  const isCurrent = state.versionId === versionId;
  const isDirty =
    isCurrent && (state.removed.length > 0 || state.list.some((drawing) => drawing.file !== null));

  const [seededFrom, setSeededFrom] = useState<{
    versionId: number | null;
    data: InspectionDrawing[] | undefined;
  }>({ versionId: null, data: undefined });
  if (seededFrom.versionId !== versionId || seededFrom.data !== drawings.data) {
    setSeededFrom({ versionId, data: drawings.data });
    if (seededFrom.versionId !== versionId) setError(null);
    if (drawings.data !== undefined && !isDirty) setState(fromServer(versionId, drawings.data));
  }

  const list = isCurrent ? state.list : fromServer(versionId, drawings.data ?? []).list;

  const add = (file: File): void => {
    const key = takeKey();
    setState((prev) => ({
      ...prev,
      list: [...prev.list, { key, attachmentId: null, blob: file, file }],
    }));
  };

  const replace = (index: number, file: File): void => {
    const key = takeKey();
    setState((prev) => ({
      ...prev,
      list: prev.list.map((drawing, at) =>
        at === index ? { ...drawing, key, blob: file, file } : drawing,
      ),
    }));
  };

  const remove = (index: number): void => {
    setState((prev) => {
      const target = prev.list[index];
      if (target === undefined) return prev;
      return {
        ...prev,
        list: prev.list.filter((_, at) => at !== index),
        removed:
          target.attachmentId === null ? prev.removed : [...prev.removed, target.attachmentId],
      };
    });
  };

  const cancel = (): void => {
    setError(null);
    setState(fromServer(versionId, drawings.data ?? []));
  };

  /**
   * 제거 → 수정 · 추가(놓인 순서) 로 한 장씩 보낸다. 성공한 것은 그때마다 초안에서 「보낸 것」으로 돌린다 —
   * 중간에 실패하면 남은 변경만 그대로 남아 다시 [저장]하면 이어서 보낸다. 다 보내면 서버 목록을 다시 받아 세운다.
   */
  const save = async (): Promise<void> => {
    if (versionId === null) return;
    const path = { inspectionPlanVersionId: versionId };
    setIsSaving(true);
    setError(null);
    try {
      for (const attachmentId of state.removed) {
        await runRequest(() =>
          client.DELETE(
            '/quality/inspection-plan-versions/{inspectionPlanVersionId}/drawings/{attachmentId}',
            {
              params: {
                header: { 'Idempotency-Key': createIdempotencyKey() },
                path: { ...path, attachmentId },
              },
            },
          ),
        );
        setState((prev) => ({
          ...prev,
          removed: prev.removed.filter((id) => id !== attachmentId),
        }));
      }
      for (const drawing of state.list) {
        const { file, attachmentId } = drawing;
        if (file === null) continue;
        const form = new FormData();
        form.append('file', file);
        const header = { 'Idempotency-Key': createIdempotencyKey() };
        const saved = await runRequest(() =>
          attachmentId === null
            ? client.POST('/quality/inspection-plan-versions/{inspectionPlanVersionId}/drawings', {
                params: { header, path },
                body: form,
              })
            : client.PUT(
                '/quality/inspection-plan-versions/{inspectionPlanVersionId}/drawings/{attachmentId}',
                { params: { header, path: { ...path, attachmentId } }, body: form },
              ),
        );
        setState((prev) => ({
          ...prev,
          list: prev.list.map((each) =>
            each.key === drawing.key
              ? { ...each, attachmentId: saved.attachmentId, file: null }
              : each,
          ),
        }));
      }
      await queryClient.invalidateQueries({ queryKey: ['inspection-drawings', versionId] });
    } catch (cause) {
      setError(toApiError(cause));
    } finally {
      setIsSaving(false);
    }
  };

  return { list, isDirty, isSaving, error, add, replace, remove, cancel, save };
};

export type VersionDrawingDraft = ReturnType<typeof useVersionDrawingDraft>;

type Pick = { kind: 'add' } | { kind: 'replace'; index: number };

/**
 * 버전 상세 「도면」 탭(omf-all-around#208) — 고른 버전의 기준서 도면. 조회 · 초안은 화면이 쥔다(탭 이름의 건수 · 확정 막기).
 * 작성 중 버전이면 도면을 추가하고, 보고 있는 도면을 수정하거나 제거한 뒤 [저장]한다(#227). 확정 버전은 보기만 한다 — 검사 항목 탭과 같다.
 */
export const VersionDrawings = ({
  drawings,
  draft,
  isEditable,
}: {
  drawings: UseQueryResult<InspectionDrawing[]>;
  draft: VersionDrawingDraft;
  isEditable: boolean;
}) => {
  const fileInput = useRef<HTMLInputElement>(null);
  const [pick, setPick] = useState<Pick>({ kind: 'add' });
  const [current, setCurrent] = useState(0);
  const [isRemoving, setIsRemoving] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  const { list } = draft;
  const shown = Math.min(current, Math.max(list.length - 1, 0));
  /* 그림 주소는 목록이 바뀔 때만 다시 만든다 — 렌더마다 새 배열이면 보기가 주소를 계속 다시 만든다. */
  const images = useMemo<InspectionDrawing[]>(
    () => list.map((drawing) => ({ attachmentId: drawing.key, blob: drawing.blob })),
    [list],
  );

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
    if (pick.kind === 'add') {
      draft.add(file);
      setCurrent(list.length);
      return;
    }
    draft.replace(pick.index, file);
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
            disabled={draft.isSaving}
            onClick={() => openPicker({ kind: 'add' })}
          >
            {t.drawingAdd}
          </Button>
          {list.length > 0 && (
            <>
              <Button
                variant="outlined"
                leadingIcon={<Icon name="swap_horiz" size={18} />}
                disabled={draft.isSaving}
                onClick={() => openPicker({ kind: 'replace', index: shown })}
              >
                {t.drawingReplace}
              </Button>
              <Button
                variant="outlined"
                leadingIcon={<Icon name="delete" size={18} />}
                disabled={draft.isSaving}
                onClick={() => setIsRemoving(true)}
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
      <PlanActionBanner error={draft.error} />

      {list.length === 0 ? (
        <EmptyState size="sm" icon={<Icon name="image" size={32} />} title={t.drawingsNone} />
      ) : (
        <InspectionDrawingImages
          drawings={images}
          altOf={t.drawingAlt}
          labels={{ prev: t.drawingPrev, next: t.drawingNext }}
          current={shown}
          onCurrentChange={setCurrent}
        />
      )}

      {/* 검사 항목 탭과 같은 바닥 단추 — 저장해야 작성 중 버전에 담긴다(사용자 지시 · #227). */}
      {isEditable && (
        <div className="form-actions">
          <Button
            variant="outlined"
            disabled={!draft.isDirty || draft.isSaving}
            onClick={draft.cancel}
          >
            {messages.common.cancel}
          </Button>
          <Button
            disabled={!draft.isDirty || draft.isSaving}
            loading={draft.isSaving}
            onClick={() => void draft.save()}
          >
            {messages.common.save}
          </Button>
        </div>
      )}

      {isRemoving && (
        <Dialog
          open
          size="md"
          title={t.drawingRemoveTitle}
          closeOnBackdropClick={false}
          showCloseButton={false}
          onClose={() => setIsRemoving(false)}
          footer={
            <>
              <Button variant="outlined" onClick={() => setIsRemoving(false)}>
                {messages.common.cancel}
              </Button>
              <Button
                onClick={() => {
                  draft.remove(shown);
                  setCurrent(Math.max(shown - 1, 0));
                  setIsRemoving(false);
                }}
              >
                {t.drawingRemoveConfirm}
              </Button>
            </>
          }
        >
          <p>{t.drawingRemoveBody}</p>
          <p className="field-note">{t.drawingRemoveNote}</p>
        </Dialog>
      )}
    </>
  );
};
