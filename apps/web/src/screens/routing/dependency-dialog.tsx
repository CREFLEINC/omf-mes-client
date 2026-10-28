import {
  AlertBanner,
  Button,
  type Column,
  Dialog,
  EmptyState,
  IconButton,
  SkeletonText,
  Table,
  useToast,
} from '@crefle/web-ui';
import type { components } from '@omf-mes/api-client';
import { messages } from '@omf-mes/i18n';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useId, useState, type ReactNode } from 'react';

import { useApiClient } from '../../patterns/api-context';
import { SaveErrorBanner, useMasterWrite } from '../../patterns/master';
import { Select } from '../../patterns/select';
import {
  createDependencyDraft,
  type DependencyDraft,
  isSameDependencies,
  validateDependencies,
} from './dependency-validation';
import { DisabledAction } from './disabled-action';
import { routingKeys, useDependencyTypeOptions, useOperationDependencies } from './queries';
import type { SelectOption } from './types';

const t = messages.routing;
const ROW_FIELDS = ['.predecessorOperationId', '.successorOperationId', '.dependencyTypeCode'];
const td = messages.routing.dependencies;

type DependencyList = components['schemas']['RoutingOperationDependencyListResponse'];

/** 선후행이 가리킬 수 있는 공정 — 저장된 라인만, 표와 같은 표시 번호로 온다. */
export interface DependencyOperation {
  routingOperationId: number;
  label: string;
}

export interface DependencyDialogProps {
  routingId: number;
  /** 제목에 붙일 대상(품목·Rev). 어느 Rev 의 선후행인지 창만 보고 알 수 있어야 한다 */
  subject: string;
  operations: DependencyOperation[];
  isEditable: boolean;
  /** 잠긴 Rev 에서 저장 자리에 붙일 사유 */
  lockReason: string;
  renderLoadError: (error: unknown, onRetry: () => void) => ReactNode;
  onClose: () => void;
}

interface DraftState {
  source: DependencyList;
  baseline: DependencyDraft[];
  drafts: DependencyDraft[];
}

const toDrafts = (list: DependencyList): DependencyDraft[] =>
  list.items.map((item) =>
    createDependencyDraft({
      predecessorId: String(item.predecessorOperationId),
      successorId: String(item.successorOperationId),
      typeCode: item.dependencyTypeCode,
    }),
  );

/**
 * W-06-01 공정 선후행 설정. 서버가 목록 전체를 치환하므로 창 안에서 고친 것을 「저장」 한 번에 보낸다.
 *
 * 잠긴 Rev 에서도 연다 — 어떤 관계가 걸려 있는지는 확정 뒤에도 봐야 한다. 그때는 값만 보이고
 * 저장 자리에 잠금 사유를 붙인다.
 */
export const DependencyDialog = ({
  routingId,
  subject,
  operations,
  isEditable,
  lockReason,
  renderLoadError,
  onClose,
}: DependencyDialogProps) => {
  const { client } = useApiClient();
  const queryClient = useQueryClient();
  const toast = useToast();
  const saveNoteId = useId();

  const dependencies = useOperationDependencies(routingId);
  const types = useDependencyTypeOptions();

  const [state, setState] = useState<DraftState | null>(null);
  const [isDiscardOpen, setIsDiscardOpen] = useState(false);

  /* 응답 객체가 바뀔 때만 다시 세운다 — 매 렌더 파생값으로 두면 편집 중 재조회가 입력을 지운다. */
  const source = dependencies.data ?? null;
  if (source !== null && state?.source !== source) {
    const seeded = toDrafts(source);
    setState({ source, baseline: seeded, drafts: seeded });
  }

  const drafts = state?.drafts ?? [];
  const isDirty = state !== null && !isSameDependencies(state.drafts, state.baseline);

  const labelById = new Map(
    operations.map((operation) => [String(operation.routingOperationId), operation.label]),
  );
  const operationLabel = (operationId: string): string =>
    labelById.get(operationId) ?? td.unknownOperation;
  const operationOptions: SelectOption[] = operations.map((operation) => ({
    value: String(operation.routingOperationId),
    label: operation.label,
  }));

  const typeLabel = (code: string): string =>
    types.data?.find((option) => option.code === code)?.codeName ?? code;
  const typeOptions: SelectOption[] = (types.data ?? []).map((option) => ({
    value: option.code,
    label: typeLabel(option.code),
  }));

  const localErrors = isEditable ? validateDependencies(drafts, operationLabel) : {};
  const hasErrors = Object.keys(localErrors).length > 0;

  const write = useMasterWrite<DependencyDraft[], DependencyList>({
    request: (rows, headers) =>
      client.PUT('/planning/routings/{routingId}/operation-dependencies', {
        params: {
          path: { routingId },
          header: { 'Idempotency-Key': headers['Idempotency-Key'] },
        },
        body: {
          dependencies: rows.map((row) => ({
            predecessorOperationId: Number(row.predecessorId),
            successorOperationId: Number(row.successorId),
            dependencyTypeCode: row.typeCode,
          })),
        },
      }),
    /* 선후행에는 판 번호가 없다(부여·회수형) — 잠글 토큰이 없어 If-Match 를 싣지 않는다. */
    etagPath: null,
    invalidateKeys: [routingKeys.dependencies(routingId)],
    /* 줄 오류는 `dependencies[i]`·`dependencies[i].<칸>` 으로 온다 — 그 줄에 붙이고, 순환처럼 화면 전체 오류는 띠로 올린다. */
    knownFields: drafts.flatMap((_row, index) =>
      ['', ...ROW_FIELDS].map((field) => `dependencies[${String(index)}]${field}`),
    ),
    onSuccess: () => {
      toast.show({ variant: 'success', description: messages.common.saved });
      onClose();
    },
  });

  /*
   * 다른 사람이 그사이 확정했으면 이 창이 들고 있는 «작성중»이 낡았다. Rev 를 다시 읽어
   * 창을 읽기 전용으로 돌리고, 무엇이 일어났는지는 화면의 말로 알린다.
   */
  const isStateLocked = write.error?.kind === 'stateLocked';
  useEffect(() => {
    if (isStateLocked) void queryClient.invalidateQueries({ queryKey: routingKeys.all });
  }, [isStateLocked, queryClient]);

  /* 서버가 짚은 줄은 보낼 때의 위치로 온다 — 표가 바뀌면 그 위치가 다른 줄을 가리키므로 함께 지운다. */
  const errors: Record<string, string> = { ...localErrors };
  drafts.forEach((row, index) => {
    if (row.draftId in errors) return;
    const serverError = ['', ...ROW_FIELDS]
      .map((field) => write.fieldErrors[`dependencies[${String(index)}]${field}`])
      .find((message) => message !== undefined);
    if (serverError !== undefined) errors[row.draftId] = serverError;
  });

  const changeDrafts = (next: (rows: DependencyDraft[]) => DependencyDraft[]) => {
    write.reset();
    setState((prev) => (prev === null ? prev : { ...prev, drafts: next(prev.drafts) }));
  };

  const changeRow = (draftId: string, patch: Partial<DependencyDraft>) => {
    changeDrafts((rows) =>
      rows.map((row) => (row.draftId === draftId ? { ...row, ...patch } : row)),
    );
  };

  const requestClose = () => {
    if (isEditable && isDirty) {
      setIsDiscardOpen(true);
      return;
    }

    onClose();
  };

  const readOnlyColumns: Column<DependencyDraft>[] = [
    {
      key: 'predecessor',
      header: td.predecessor,
      render: (row) => operationLabel(row.predecessorId),
    },
    { key: 'successor', header: td.successor, render: (row) => operationLabel(row.successorId) },
    { key: 'type', header: td.type, render: (row) => typeLabel(row.typeCode) },
  ];

  const editColumns: Column<DependencyDraft>[] = [
    {
      key: 'predecessor',
      header: td.predecessor,
      render: (row, rowIndex) => {
        const error = errors[row.draftId];
        const errorId = `${row.draftId}-error`;

        return (
          <>
            <Select
              aria-label={td.rowField(rowIndex + 1, td.predecessor)}
              options={operationOptions}
              value={row.predecessorId === '' ? null : row.predecessorId}
              onChange={(predecessorId) => changeRow(row.draftId, { predecessorId })}
              invalid={error !== undefined}
              aria-describedby={error === undefined ? undefined : errorId}
            />
            {error !== undefined && (
              <span id={errorId} className="field-error">
                {error}
              </span>
            )}
          </>
        );
      },
    },
    {
      key: 'successor',
      header: td.successor,
      render: (row, rowIndex) => {
        const error = errors[row.draftId];

        return (
          <Select
            aria-label={td.rowField(rowIndex + 1, td.successor)}
            options={operationOptions}
            value={row.successorId === '' ? null : row.successorId}
            onChange={(successorId) => changeRow(row.draftId, { successorId })}
            invalid={error !== undefined}
            aria-describedby={error === undefined ? undefined : `${row.draftId}-error`}
          />
        );
      },
    },
    {
      key: 'type',
      header: td.type,
      render: (row, rowIndex) => (
        <Select
          aria-label={td.rowField(rowIndex + 1, td.type)}
          options={typeOptions}
          value={row.typeCode}
          onChange={(typeCode) => changeRow(row.draftId, { typeCode })}
        />
      ),
    },
    {
      key: 'remove',
      header: t.fields.rowActions,
      width: '64px',
      render: (row, rowIndex) => (
        <IconButton
          icon="delete"
          size="sm"
          aria-label={td.remove(rowIndex + 1)}
          onClick={() =>
            changeDrafts((rows) => rows.filter((item) => item.draftId !== row.draftId))
          }
        />
      ),
    },
  ];

  const body = (): ReactNode => {
    if (dependencies.isError) {
      return renderLoadError(dependencies.error, () => void dependencies.refetch());
    }

    if (state === null) {
      return (
        <div role="status" aria-label={td.loading}>
          <SkeletonText lines={3} />
        </div>
      );
    }

    return (
      <Table
        density="compact"
        columns={isEditable ? editColumns : readOnlyColumns}
        /* 잠긴 Rev 는 서버 값만 보인다 — 저장되지 못한 편집이 남아 있어도 그것은 이 Rev 의 관계가 아니다. */
        rows={isEditable ? drafts : state.baseline}
        getRowId={(row) => row.draftId}
        empty={
          <EmptyState
            size="sm"
            title={td.noneTitle}
            description={isEditable ? td.noneDescription : undefined}
          />
        }
      />
    );
  };

  const saveBlockedReason = ((): string | null => {
    if (hasErrors) return td.saveBlockedByInvalid;
    if (types.isPending) return td.saveBlockedWhileLoadingTypes;

    return null;
  })();
  const canSave = isDirty && !hasErrors && types.data !== undefined && !write.isSaving;

  return (
    <>
      <Dialog
        open
        size="lg"
        onClose={requestClose}
        title={td.title(subject)}
        footer={
          isEditable ? (
            <>
              <Button variant="outlined" onClick={requestClose}>
                {messages.common.cancel}
              </Button>
              <div className="field-cell">
                <Button
                  disabled={!canSave}
                  loading={write.isSaving}
                  aria-describedby={saveBlockedReason === null ? undefined : saveNoteId}
                  onClick={() => write.write(drafts)}
                >
                  {messages.common.save}
                </Button>
                {saveBlockedReason !== null && (
                  <span id={saveNoteId} className="field-note">
                    {saveBlockedReason}
                  </span>
                )}
              </div>
            </>
          ) : (
            <>
              <Button variant="outlined" onClick={onClose}>
                {messages.common.close}
              </Button>
              <DisabledAction label={messages.common.save} reason={lockReason} />
            </>
          )
        }
      >
        {isStateLocked ? (
          <div className="banner-slot">
            <AlertBanner variant="warning">{td.stateLocked}</AlertBanner>
          </div>
        ) : (
          <SaveErrorBanner error={write.error} />
        )}

        {types.isError && (
          <div className="banner-slot">
            <AlertBanner
              variant="error"
              action={
                <Button variant="outlined" size="sm" onClick={() => void types.refetch()}>
                  {messages.common.retry}
                </Button>
              }
            >
              {td.typesLoadFailed}
            </AlertBanner>
          </div>
        )}

        {body()}

        {isEditable && state !== null && (
          <div className="filter-bar">
            <Button
              variant="outlined"
              onClick={() => changeDrafts((rows) => [...rows, createDependencyDraft()])}
            >
              {td.add}
            </Button>
          </div>
        )}
      </Dialog>

      {isDiscardOpen && (
        <Dialog
          open
          size="sm"
          closeOnBackdropClick={false}
          onClose={() => setIsDiscardOpen(false)}
          title={td.discard.title}
          footer={
            <>
              <Button variant="outlined" onClick={() => setIsDiscardOpen(false)}>
                {td.discard.stay}
              </Button>
              <Button onClick={onClose}>{td.discard.confirm}</Button>
            </>
          }
        >
          <p>{td.discard.body}</p>
        </Dialog>
      )}
    </>
  );
};
