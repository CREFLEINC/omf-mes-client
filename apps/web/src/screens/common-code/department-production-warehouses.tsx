import {
  Button,
  Checkbox,
  Chip,
  Dialog,
  EmptyState,
  IconButton,
  Table,
  useToast,
  type Column,
} from '@crefle/web-ui';
import type { ApiError, components } from '@omf-mes/api-client';
import { messages } from '@omf-mes/i18n';
import { useRef, useState } from 'react';
import { Link } from 'react-router';

import { SaveErrorBanner } from '../../patterns/master';
import { toApiError } from '../../patterns/request';
import {
  usePlantNames,
  usePreviewProductionWarehouseReplace,
  useProductionWarehouseCandidates,
  useLinkedProductionWarehouses,
  useReplaceProductionWarehouses,
  type WarehouseCandidate,
} from './department-production-warehouse-queries';
import { LoadErrorBanner } from './load-error-banner';

type DepartmentProductionWarehouse = components['schemas']['DepartmentProductionWarehouse'];
const t = messages.commonCode.department.productionWarehouses;

/** W-01-07 재고 현황 — `wh` 가 그 화면의 창고 조건이다. */
export const STOCK_STATUS_PATH = '/logistics/stock-status';
export const stockStatusLink = (warehouseId: number): string =>
  `${STOCK_STATUS_PATH}?wh=${String(warehouseId)}`;

interface DraftState {
  departmentId: number;
  /** 시드한 연결 목록 응답. 응답이 바뀌면(저장 뒤 재조회 · 다른 부서) 다시 시드한다. */
  source: DepartmentProductionWarehouse[];
  baseline: readonly number[];
  ids: readonly number[];
}

interface PendingConfirm {
  lines: { warehouseId: number; text: string }[];
  proceed: () => void;
}

const sameIds = (left: readonly number[], right: readonly number[]): boolean =>
  left.length === right.length && left.every((id) => right.includes(id));

export interface LinkedWarehouseRow extends WarehouseCandidate {
  isNew: boolean;
}

export interface ProductionWarehouseEditor {
  rows: LinkedWarehouseRow[];
  candidates: WarehouseCandidate[];
  plantName: (plantId: number) => string;
  isLoading: boolean;
  loadError: unknown;
  retryLoad: () => void;
  isDirty: boolean;
  /** 해제 확인을 묻는 중이거나 저장이 나가는 중이다. */
  isBusy: boolean;
  error: ApiError | null;
  pendingConfirm: PendingConfirm | null;
  isLinked: (warehouseId: number) => boolean;
  toggle: (warehouseId: number) => void;
  /**
   * 저장 전 확인. 연결을 뺀 창고에서 나갈 요청이 있으면 확인 창을 띄우고, 확인하면 `proceed` 를 부른다.
   * 뺀 창고가 없거나 요청이 0장이면 바로 부른다.
   */
  requestSave: (proceed: () => void) => void;
  confirm: () => void;
  cancelConfirm: () => void;
  /** 연결을 저장한다. `quiet` 이면 성공 토스트를 내지 않는다 — 부서 저장이 이미 알렸다. */
  commit: (options: { quiet: boolean }) => void;
  reset: () => void;
}

/**
 * W-06-06 부서 폼의 「생산 창고」 편집 상태(003 · US8). 저장 자리는 부서 폼의 「저장」 하나다 —
 * 순서는 부서 먼저, 연결은 그 뒤 `PUT …/production-warehouses` 전체 교체(screens/W-06-06.md).
 */
export const useProductionWarehouseEditor = (
  departmentId: number | null,
): ProductionWarehouseEditor => {
  const toast = useToast();
  const linked = useLinkedProductionWarehouses(departmentId);
  const candidates = useProductionWarehouseCandidates(departmentId !== null);
  const plants = usePlantNames(departmentId !== null);
  const preview = usePreviewProductionWarehouseReplace();

  const [draft, setDraft] = useState<DraftState | null>(null);
  const [checking, setChecking] = useState(false);
  const [previewError, setPreviewError] = useState<ApiError | null>(null);
  const [pendingConfirm, setPendingConfirm] = useState<PendingConfirm | null>(null);
  const quietRef = useRef(false);

  /* 응답이 바뀌면 다시 시드한다(부서 폼의 시드 방식과 같다 — 렌더 중 갱신). */
  if (departmentId === null || linked.data === undefined) {
    if (draft !== null && draft.departmentId !== departmentId) setDraft(null);
  } else if (draft?.source !== linked.data || draft.departmentId !== departmentId) {
    const ids = linked.data.map((warehouse) => warehouse.warehouseId);
    setDraft({ departmentId, source: linked.data, baseline: ids, ids });
  }

  const replace = useReplaceProductionWarehouses(departmentId, () => {
    setDraft((prev) => (prev === null ? prev : { ...prev, baseline: prev.ids }));
    if (!quietRef.current) toast.show({ variant: 'success', description: messages.common.saved });
  });

  const known = new Map<number, WarehouseCandidate>();
  for (const warehouse of linked.data ?? []) known.set(warehouse.warehouseId, warehouse);
  for (const warehouse of candidates.data ?? []) known.set(warehouse.warehouseId, warehouse);

  const plantName = (plantId: number): string => plants.data?.get(plantId) ?? t.unknownPlant;
  const labelOf = (warehouseId: number): string => {
    const warehouse = known.get(warehouseId);
    return warehouse === undefined
      ? String(warehouseId)
      : `${warehouse.warehouseCode} ${warehouse.warehouseName}`;
  };

  const byPlantThenCode = (left: WarehouseCandidate, right: WarehouseCandidate): number =>
    plantName(left.plantId).localeCompare(plantName(right.plantId)) ||
    left.warehouseCode.localeCompare(right.warehouseCode);

  const ids = draft?.ids ?? [];
  const baseline = draft?.baseline ?? [];
  const rows = ids
    .map((id) => known.get(id))
    .filter((warehouse): warehouse is WarehouseCandidate => warehouse !== undefined)
    .sort(byPlantThenCode)
    .map((warehouse) => ({ ...warehouse, isNew: !baseline.includes(warehouse.warehouseId) }));

  const isDirty = draft !== null && !sameIds(draft.ids, draft.baseline);

  const clearFeedback = (): void => {
    setPreviewError(null);
    replace.reset();
  };

  const toggle = (warehouseId: number): void => {
    clearFeedback();
    setDraft((prev) =>
      prev === null
        ? prev
        : {
            ...prev,
            ids: prev.ids.includes(warehouseId)
              ? prev.ids.filter((id) => id !== warehouseId)
              : [...prev.ids, warehouseId],
          },
    );
  };

  const requestSave = (proceed: () => void): void => {
    if (draft === null || departmentId === null || !isDirty) {
      proceed();
      return;
    }
    if (draft.baseline.every((id) => draft.ids.includes(id))) {
      proceed();
      return;
    }

    clearFeedback();
    setChecking(true);
    preview(departmentId, { warehouseIds: [...draft.ids] })
      .then((result) => {
        const lines = result.removed
          .filter((item) => item.activeRequestCount > 0)
          .map((item) => ({
            warehouseId: item.warehouseId,
            text: t.confirm.body(labelOf(item.warehouseId), item.activeRequestCount),
          }));
        if (lines.length === 0) proceed();
        else setPendingConfirm({ lines, proceed });
      })
      .catch((cause: unknown) => setPreviewError(toApiError(cause)))
      .finally(() => setChecking(false));
  };

  return {
    rows,
    candidates: [...(candidates.data ?? [])].sort(byPlantThenCode),
    plantName,
    isLoading: departmentId !== null && (linked.isPending || draft === null),
    loadError: linked.isError ? linked.error : null,
    retryLoad: () => void linked.refetch(),
    isDirty,
    isBusy: checking || replace.isSaving,
    error: previewError ?? replace.error,
    pendingConfirm,
    isLinked: (warehouseId) => ids.includes(warehouseId),
    toggle,
    requestSave,
    confirm: () => {
      const next = pendingConfirm;
      setPendingConfirm(null);
      next?.proceed();
    },
    cancelConfirm: () => setPendingConfirm(null),
    commit: ({ quiet }) => {
      if (draft === null || !isDirty) return;
      quietRef.current = quiet;
      replace.write({ warehouseIds: [...draft.ids] });
    },
    reset: () => {
      clearFeedback();
      setPendingConfirm(null);
      setDraft((prev) => (prev === null ? prev : { ...prev, ids: prev.baseline }));
    },
  };
};

export interface ProductionWarehouseSectionProps {
  editor: ProductionWarehouseEditor;
}

/**
 * 부서 정보 칸 안의 「생산 창고」 구획 — 연결 목록 · 창고 추가 · 해제.
 * 「재고 보기」는 W-01-07 을 새 탭으로 연다 — 편집 중인 폼을 잃지 않게. 권한은 그 화면이 막는다.
 */
export const ProductionWarehouseSection = ({ editor }: ProductionWarehouseSectionProps) => {
  const [pickerOpen, setPickerOpen] = useState(false);

  const columns: Column<LinkedWarehouseRow>[] = [
    {
      key: 'plant',
      header: t.columns.plant,
      render: (row) => editor.plantName(row.plantId),
    },
    {
      key: 'warehouse',
      header: t.columns.warehouse,
      render: (row) => (
        <span className="production-warehouse-name">
          {`${row.warehouseCode} ${row.warehouseName}`}
          {row.isNew && (
            <Chip size="sm" status="info">
              {t.newlyLinked}
            </Chip>
          )}
        </span>
      ),
    },
    {
      key: 'stock',
      header: t.columns.stock,
      render: (row) => (
        <Link
          to={stockStatusLink(row.warehouseId)}
          target="_blank"
          rel="noreferrer"
          aria-label={t.viewStockLabel(`${row.warehouseCode} ${row.warehouseName}`)}
        >
          {t.viewStock}
        </Link>
      ),
    },
    {
      key: 'remove',
      header: <span className="visually-hidden">{t.columns.remove}</span>,
      align: 'end',
      width: '56px',
      render: (row) => (
        <IconButton
          icon="close"
          size="sm"
          aria-label={t.removeLabel(`${row.warehouseCode} ${row.warehouseName}`)}
          onClick={() => editor.toggle(row.warehouseId)}
        />
      ),
    },
  ];

  const body = () => {
    if (editor.loadError !== null) {
      return <LoadErrorBanner error={editor.loadError} onRetry={editor.retryLoad} />;
    }
    if (editor.isLoading) {
      return (
        <p className="field-note" role="status">
          {t.loading}
        </p>
      );
    }
    if (editor.rows.length === 0) return <p className="field-note">{t.none}</p>;

    return (
      <Table
        columns={columns}
        rows={editor.rows}
        getRowId={(row) => String(row.warehouseId)}
        density="compact"
        aria-label={t.tableLabel}
      />
    );
  };

  return (
    <section className="production-warehouse-section" aria-labelledby="production-warehouse-title">
      <div className="section-heading-row">
        <h3 id="production-warehouse-title" className="subsection-title">
          {t.title}
        </h3>
        <Button
          variant="outlined"
          size="sm"
          disabled={editor.isLoading || editor.loadError !== null}
          onClick={() => setPickerOpen(true)}
        >
          {`+ ${t.add}`}
        </Button>
      </div>
      <p className="field-note">{t.help}</p>
      <SaveErrorBanner error={editor.error} />
      {body()}

      <Dialog
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        title={t.picker.title}
        size="sm"
        /* 아래 「닫기」와 같은 이름의 × 를 두지 않는다. */
        showCloseButton={false}
        footer={
          <Button variant="outlined" onClick={() => setPickerOpen(false)}>
            {t.picker.close}
          </Button>
        }
      >
        <p className="dialog-text">{t.picker.description}</p>
        {editor.candidates.length === 0 ? (
          <EmptyState size="sm" title={t.picker.empty} />
        ) : (
          <ul className="production-warehouse-candidates" aria-label={t.picker.title}>
            {editor.candidates.map((warehouse) => (
              <li key={warehouse.warehouseId}>
                <Checkbox
                  checked={editor.isLinked(warehouse.warehouseId)}
                  onChange={() => editor.toggle(warehouse.warehouseId)}
                >
                  {`${editor.plantName(warehouse.plantId)} ${warehouse.warehouseCode} ${warehouse.warehouseName}`}
                </Checkbox>
              </li>
            ))}
          </ul>
        )}
      </Dialog>

      <Dialog
        open={editor.pendingConfirm !== null}
        onClose={editor.cancelConfirm}
        title={t.confirm.title}
        size="sm"
        footer={
          <>
            <Button variant="outlined" onClick={editor.cancelConfirm}>
              {t.confirm.cancel}
            </Button>
            <Button onClick={editor.confirm}>{t.confirm.submit}</Button>
          </>
        }
      >
        {editor.pendingConfirm?.lines.map((line) => (
          <p key={line.warehouseId} className="dialog-text">
            {line.text}
          </p>
        ))}
      </Dialog>
    </section>
  );
};
