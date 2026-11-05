import {
  AlertBanner,
  Button,
  type Column,
  Dialog,
  Icon,
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
import { routingKeys, useDependencyTypeOptions, useOperationDependencies } from './queries';
import type { SelectOption } from './types';
import { centerColumns } from './table-align';

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
  /** 제목에 붙일 개정(「Rev N」) · 그 아래 품목코드 — 어느 Rev 의 연결인지 창만 보고 알 수 있어야 한다 */
  revisionLabel: string;
  itemCode: string;
  operations: DependencyOperation[];
  isEditable: boolean;
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
 * 닫기 하나만 둔다(조회 전용 · #231).
 */
export const DependencyDialog = ({
  routingId,
  revisionLabel,
  itemCode,
  operations,
  isEditable,
  renderLoadError,
  onClose,
}: DependencyDialogProps) => {
  const { client } = useApiClient();
  const queryClient = useQueryClient();
  const toast = useToast();

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

  /*
   * 오류는 빠진 칸에만 — 한쪽만 비었으면 그 칸만 붉게 하고 문구도 그 칸 아래에, 둘 다 비었거나 다른 규칙(같은 공정 ·
   * 중복 · 순환 · 서버)에 걸리면 두 칸을 붉게 하고 문구는 선행 칸 아래 한 번만(사용자 지시 · #231).
   */
  const fieldError = (
    row: DependencyDraft,
    field: 'predecessor' | 'successor',
  ): string | undefined => {
    const error = errors[row.draftId];
    if (error === undefined) return undefined;
    const missing = { predecessor: row.predecessorId === '', successor: row.successorId === '' };
    if (missing.predecessor || missing.successor) return missing[field] ? error : undefined;
    return error;
  };
  const noteField = (row: DependencyDraft): 'predecessor' | 'successor' =>
    row.predecessorId !== '' && row.successorId === '' ? 'successor' : 'predecessor';
  const errorIdOf = (row: DependencyDraft, field: 'predecessor' | 'successor') =>
    fieldError(row, field) === undefined ? undefined : `${row.draftId}-error`;
  const errorNote = (row: DependencyDraft, field: 'predecessor' | 'successor'): ReactNode =>
    errors[row.draftId] === undefined || noteField(row) !== field ? null : (
      <span id={`${row.draftId}-error`} className="field-error">
        {errors[row.draftId]}
      </span>
    );

  const editColumns: Column<DependencyDraft>[] = [
    {
      key: 'predecessor',
      header: td.predecessor,
      render: (row, rowIndex) => (
        <div className="routing-dependency-cell">
          <Select
            aria-label={td.rowField(rowIndex + 1, td.predecessor)}
            options={operationOptions}
            value={row.predecessorId === '' ? null : row.predecessorId}
            onChange={(predecessorId) => changeRow(row.draftId, { predecessorId })}
            invalid={fieldError(row, 'predecessor') !== undefined}
            aria-describedby={errorIdOf(row, 'predecessor')}
          />
          {errorNote(row, 'predecessor')}
        </div>
      ),
    },
    {
      key: 'successor',
      header: td.successor,
      render: (row, rowIndex) => (
        <div className="routing-dependency-cell">
          <Select
            aria-label={td.rowField(rowIndex + 1, td.successor)}
            options={operationOptions}
            value={row.successorId === '' ? null : row.successorId}
            onChange={(successorId) => changeRow(row.draftId, { successorId })}
            invalid={fieldError(row, 'successor') !== undefined}
            aria-describedby={errorIdOf(row, 'successor')}
          />
          {errorNote(row, 'successor')}
        </div>
      ),
    },
    {
      key: 'type',
      header: td.type,
      /* 관계 값(「선행 완료 후 착수」)이 잘리지 않는 폭 — 선행 · 후행 칸이 남는 폭을 나눠 갖는다(#231). */
      width: '13rem',
      render: (row, rowIndex) => (
        <div className="routing-dependency-cell">
          <Select
            aria-label={td.rowField(rowIndex + 1, td.type)}
            options={typeOptions}
            value={row.typeCode}
            onChange={(typeCode) => changeRow(row.draftId, { typeCode })}
          />
        </div>
      ),
    },
    {
      key: 'remove',
      /* 삭제 단추 하나뿐인 칸 — 최소 폭(사용자 지시 · #231). */
      header: td.removeColumn,
      width: '56px',
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

  const addButton = (
    <Button
      variant="outlined"
      leadingIcon={<Icon name="add" size={18} aria-hidden="true" />}
      onClick={() => changeDrafts((rows) => [...rows, createDependencyDraft()])}
    >
      {td.add}
    </Button>
  );

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

    const rows = isEditable ? drafts : state.baseline;
    /*
     * 연결이 없으면 빈 표 머리 대신 안내 상자 하나 — 편집할 수 있으면 그 안에 「연결 추가」(사용자 시안 · #231).
     */
    if (rows.length === 0) {
      return (
        <div className="routing-dependency-empty">
          <p>{td.noneTitle}</p>
          {isEditable && addButton}
        </div>
      );
    }

    return (
      <div className="routing-dependency-rows">
        <Table
          density="compact"
          columns={centerColumns(isEditable ? editColumns : readOnlyColumns)}
          /* 잠긴 Rev 는 서버 값만 보인다 — 저장되지 못한 편집이 남아 있어도 그것은 이 Rev 의 관계가 아니다. */
          rows={rows}
          getRowId={(row) => row.draftId}
        />
      </div>
    );
  };

  const canSave = isDirty && !hasErrors && types.data !== undefined && !write.isSaving;

  return (
    <>
      <Dialog
        open
        /* 읽기 전용은 세 칸뿐이라 좁게, 편집은 고르기 칸이 들어가 넓게. */
        size={isEditable ? 'lg' : 'md'}
        onClose={requestClose}
        title={td.title(revisionLabel)}
        /* 취소 · 닫기 단추가 이미 있어 우상단 X 는 두지 않는다(사용자 지시 · #231). */
        showCloseButton={false}
        footer={
          isEditable ? (
            <>
              <Button variant="outlined" onClick={requestClose}>
                {messages.common.cancel}
              </Button>
              {/* 막힌 사유는 단추 아래 문장 대신 그 입력칸에 보인다(사용자 지시 · #231) — 활성 조건은 그대로다. */}
              <Button
                disabled={!canSave}
                loading={write.isSaving}
                onClick={() => write.write(drafts)}
              >
                {messages.common.save}
              </Button>
            </>
          ) : (
            /* 조회 전용 — 저장할 것이 없어 닫기 하나만(사용자 시안 · #231). */
            <Button variant="outlined" onClick={onClose}>
              {messages.common.close}
            </Button>
          )
        }
      >
        <p className="routing-dependency-subtitle">{td.itemCode(itemCode)}</p>

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

        {/* 연결 추가는 표 위 오른쪽(사용자 지시 · #231). 연결이 없으면 빈 안내 상자 안에 있다. */}
        {isEditable && state !== null && drafts.length > 0 && (
          <div className="routing-dependency-tools">{addButton}</div>
        )}

        {body()}
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
