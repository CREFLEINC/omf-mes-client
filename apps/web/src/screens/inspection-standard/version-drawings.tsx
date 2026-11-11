import { AlertBanner, Button, Dialog, EmptyState, Icon, SkeletonText } from '@crefle/web-ui';
import { createIdempotencyKey, type ApiError } from '@omf-mes/api-client';
import { messages } from '@omf-mes/i18n';
import { useQueryClient, type UseQueryResult } from '@tanstack/react-query';
import { useMemo, useRef, useState, type ChangeEvent, type ReactNode } from 'react';

import { useApiClient } from '../../patterns/api-context';
import {
  InspectionDrawingImages,
  type InspectionDrawing,
} from '../../patterns/inspection-drawings';
import { runRequest, toApiError } from '../../patterns/request';
import { LoadErrorBanner } from '../../patterns/load-error-banner';
import { PlanActionBanner } from './plan-action-banner';
import { VersionSettingRow } from './version-setting-row';

const t = messages.inspectionStandard.versionSection;

/** 서버 첨부 상한과 같다(`MAX_ATTACHMENT_BYTES`). 넘으면 보내기 전에 막는다. */
const MAX_DRAWING_BYTES = 10 * 1024 * 1024;
const DRAWING_TYPES = ['image/png', 'image/jpeg'];

/** 받지 않는 까닭 — 까닭마다 알림 띠 하나로 묶는다(사용자 시안 · #227). */
export type DrawingProblem = 'invalid' | 'tooLarge' | 'duplicate';

/** 그림 파일 사전 검사 — 서버도 앞 바이트로 다시 본다. 통과하면 null. */
export const drawingFileProblem = (file: File): DrawingProblem | null => {
  if (!DRAWING_TYPES.includes(file.type)) return 'invalid';
  if (file.size > MAX_DRAWING_BYTES) return 'tooLarge';
  return null;
};

const PROBLEM_ORDER: readonly DrawingProblem[] = ['duplicate', 'invalid', 'tooLarge'];
const problemTitle: Record<DrawingProblem, string> = {
  duplicate: t.drawingDuplicate,
  invalid: t.drawingFileInvalid,
  tooLarge: t.drawingFileTooLarge,
};
const problemLine: Record<DrawingProblem, (name: string) => string> = {
  duplicate: t.drawingDuplicateFile,
  invalid: t.drawingRejectedFile,
  tooLarge: t.drawingRejectedFile,
};

/** 두 그림의 내용이 같은가 — 크기가 다르면 읽지 않는다. 상한이 10MB 라 통째로 견준다. */
const sameBytes = async (a: Blob, b: Blob): Promise<boolean> => {
  if (a.size !== b.size) return false;
  const [left, right] = await Promise.all([a.arrayBuffer(), b.arrayBuffer()]);
  const x = new Uint8Array(left);
  const y = new Uint8Array(right);
  return x.every((byte, at) => byte === y[at]);
};

/**
 * 이미 붙은 도면과 내용이 같은 그림인가(사용자 지시 · #227) — 서버를 고치지 않고 화면이 막는다.
 * 저장된 도면 · 저장 전 추가한 도면 모두와 견준다. 파일 이름이 달라도 내용이 같으면 같은 도면이다.
 */
export const isDuplicateDrawing = async (
  file: Blob,
  drawings: readonly { blob: Blob }[],
): Promise<boolean> => {
  for (const drawing of drawings) {
    if (await sameBytes(file, drawing.blob)) return true;
  }
  return false;
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

  /** 저장 전 변경을 버린다 — 화면이 편집을 비울 때(다른 기준 · 버전으로 옮김 확인 뒤) 부른다. */
  const reset = (): void => {
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

  return { list, isDirty, isSaving, error, add, replace, remove, reset, save };
};

export type VersionDrawingDraft = ReturnType<typeof useVersionDrawingDraft>;

type Pick = { kind: 'add' } | { kind: 'replace'; index: number };

/**
 * 버전 상세 「검사 도면」 줄(omf-all-around#208 · 줄 모양은 #258) — 고른 버전의 기준서 도면. 조회 · 초안은 화면이 쥔다(탭 이름의 건수 · 확정 막기).
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
  /* 받지 않은 파일과 까닭 — 여러 장을 한 번에 고르면 몇 장만 막힐 수 있어 파일마다 낸다. 닫기로 지운다. */
  const [problems, setProblems] = useState<{ name: string; problem: DrawingProblem }[]>([]);

  const { list } = draft;
  const shown = Math.min(current, Math.max(list.length - 1, 0));
  /* 그림 주소는 목록이 바뀔 때만 다시 만든다 — 렌더마다 새 배열이면 보기가 주소를 계속 다시 만든다. */
  const images = useMemo<InspectionDrawing[]>(
    () => list.map((drawing) => ({ attachmentId: drawing.key, blob: drawing.blob })),
    [list],
  );

  const openPicker = (next: Pick): void => {
    setPick(next);
    setProblems([]);
    const input = fileInput.current;
    if (input === null) return;
    /* 추가는 여러 장을 한 번에 고른다(사용자 지시 · #227). 수정은 보고 있는 한 장만 바꾼다. 단추를 누른 그 자리에서 정해야 해 상태를 기다리지 않는다. */
    input.multiple = next.kind === 'add';
    input.click();
  };

  /**
   * 고른 파일을 하나씩 검사한다 — 그림이 아니거나 크거나 이미 붙은 도면(이번에 함께 고른 것 포함)과 같으면 그 파일만 뺀다.
   * 여러 장 중 몇 장만 막혀도 나머지는 붙인다.
   */
  const onFile = async (event: ChangeEvent<HTMLInputElement>): Promise<void> => {
    const files = Array.from(event.target.files ?? []);
    event.target.value = '';
    if (files.length === 0) return;
    const accepted: File[] = [];
    const rejected: { name: string; problem: DrawingProblem }[] = [];
    for (const file of files) {
      const problem =
        drawingFileProblem(file) ??
        ((await isDuplicateDrawing(file, [...list, ...accepted.map((blob) => ({ blob }))]))
          ? 'duplicate'
          : null);
      if (problem === null) accepted.push(file);
      else rejected.push({ name: file.name, problem });
    }
    setProblems(rejected);
    if (pick.kind === 'replace') {
      if (accepted[0] !== undefined) draft.replace(pick.index, accepted[0]);
      return;
    }
    if (accepted.length === 0) return;
    accepted.forEach((file) => draft.add(file));
    setCurrent(list.length + accepted.length - 1);
  };

  const isLoaded = !drawings.isError && drawings.data !== undefined;

  /* 「+ 도면 추가」는 줄 오른쪽 끝(사용자 시안 · #258). */
  const addAction =
    isEditable && isLoaded ? (
      <>
        <input
          ref={fileInput}
          type="file"
          accept={DRAWING_TYPES.join(',')}
          hidden
          data-testid="drawing-file-input"
          onChange={(event) => void onFile(event)}
        />
        <Button
          variant="outlined"
          leadingIcon={<Icon name="add" size={18} />}
          disabled={draft.isSaving}
          onClick={() => openPicker({ kind: 'add' })}
        >
          {t.drawingAdd}
        </Button>
      </>
    ) : undefined;

  const body = (): ReactNode => {
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
    return renderLoaded();
  };

  const renderLoaded = (): ReactNode => (
    <>
      {isEditable && list.length > 0 && (
        <div className="inspection-standard-section-head inspection-standard-tab-toolbar">
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
        </div>
      )}
      {PROBLEM_ORDER.map((problem) => {
        const names = problems.filter((each) => each.problem === problem).map((each) => each.name);
        if (names.length === 0) return null;
        return (
          <div key={problem} className="banner-slot">
            <AlertBanner
              variant="error"
              title={problemTitle[problem]}
              dismissLabel={messages.common.close}
              onDismiss={() =>
                setProblems((prev) => prev.filter((each) => each.problem !== problem))
              }
            >
              {names.map((name) => (
                <div key={name}>{problemLine[problem](name)}</div>
              ))}
            </AlertBanner>
          </div>
        );
      })}
      <PlanActionBanner error={draft.error} />

      {list.length === 0 ? (
        /* 작성중 버전이면 흐린 안내 한 줄 — 검사 항목 빈 상태와 같다(사용자 지시 · #258). */
        <EmptyState
          size="sm"
          icon={<Icon name="image" size={32} />}
          title={t.drawingsNone}
          description={isEditable ? t.drawingsNoneDescription : undefined}
        />
      ) : (
        <InspectionDrawingImages
          drawings={images}
          altOf={t.drawingAlt}
          labels={{ prev: t.drawingPrev, next: t.drawingNext }}
          current={shown}
          onCurrentChange={setCurrent}
        />
      )}

      {/* 저장은 카드 바닥 줄 「임시 저장」 하나로 항목과 함께 한다(사용자 지시 · #258) — 저장해야 작성 중 버전에 담긴다(#227). */}

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

  return (
    <VersionSettingRow
      title={t.rowDrawings}
      summary={isLoaded ? t.rowDrawingsCount(list.length) : ''}
      action={addAction}
    >
      {body()}
    </VersionSettingRow>
  );
};
