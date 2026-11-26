import { Button, Chip, Dialog, IconButton, Table, useToast, type Column } from '@crefle/web-ui';
import type { ApiError, components } from '@omf-mes/api-client';
import { messages } from '@omf-mes/i18n';
import { useRef, useState } from 'react';
import { useNavigate } from 'react-router';

import { InfoTip } from '../../patterns/info-tip';
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
import { LoadErrorBanner } from '../../patterns/load-error-banner';
import { Select } from '../../patterns/select';
import { ListEmpty } from '../../patterns/list-empty';

type DepartmentProductionWarehouse = components['schemas']['DepartmentProductionWarehouse'];
const t = messages.commonCode.department.productionWarehouses;

/** W-01-07 재고 현황 — `wh` 가 그 화면의 창고 조건이다. */
export const STOCK_STATUS_PATH = '/logistics/stock-status';

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

/** 표 안 추가 줄 자리 — 실제 창고 id 와 겹치지 않는 값. */
const ADD_ROW_ID = -1;
const ADD_ROW: LinkedWarehouseRow = {
  warehouseId: ADD_ROW_ID,
  warehouseCode: '',
  warehouseName: '',
  plantId: ADD_ROW_ID,
  isNew: false,
};
const isAddRow = (row: LinkedWarehouseRow): boolean => row.warehouseId === ADD_ROW_ID;

export interface ProductionWarehouseSectionProps {
  editor: ProductionWarehouseEditor;
}

/**
 * 부서 정보 칸 안의 「생산 창고」 구획 — 연결 목록 · 창고 추가 · 해제.
 * 「재고 조회」는 같은 창에서 W-01-07 로 옮긴다(사용자 지시 2026-11-26). 권한은 그 화면이 막는다.
 */
export const ProductionWarehouseSection = ({ editor }: ProductionWarehouseSectionProps) => {
  /* 표 안 맨 아래 추가 줄 — 「창고 추가」를 눌렀을 때만 선다(사용자 지시 2026-11-25 · 표 안으로 2026-11-26). */
  const [isAdding, setIsAdding] = useState(false);
  const [addValue, setAddValue] = useState('');
  const navigate = useNavigate();

  const columns: Column<LinkedWarehouseRow>[] = [
    {
      key: 'plant',
      header: t.columns.plant,
      /* 열 폭을 고정한다 — 창고를 넣거나 추가 줄이 서도 표 모양이 바뀌지 않게(사용자 지시 2026-11-26). */
      width: '20%',
      align: 'center',
      render: (row) => {
        if (!isAddRow(row)) return editor.plantName(row.plantId);
        /* 고른 창고의 공장 — 고르기 전에는 빈 칸 표기. */
        const picked = editor.candidates.find(
          (warehouse) => String(warehouse.warehouseId) === addValue,
        );
        return picked === undefined ? '—' : editor.plantName(picked.plantId);
      },
    },
    {
      key: 'warehouse',
      header: t.columns.warehouse,
      align: 'center',
      render: (row) =>
        isAddRow(row) ? (
          <span className="production-warehouse-add-cell">
            <Select
              aria-label={t.addRow.label}
              options={addOptions}
              value={addValue === '' ? null : addValue}
              onChange={setAddValue}
              placeholder={t.addRow.placeholder}
              disabled={addOptions.length === 0}
            />
            {addOptions.length === 0 && <span className="field-note">{t.addRow.empty}</span>}
          </span>
        ) : (
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
      width: '20%',
      align: 'center',
      render: (row) =>
        isAddRow(row) ? null : (
          /*
           * 일반 단추 모양(사용자 지시 2026-11-25). 새 탭 대신 같은 창에서 재고 조회 화면으로 옮긴다(사용자 지시 2026-11-26) —
           * 고친 채 떠나면 화면의 이탈 확인이 먼저 묻는다.
           */
          <Button
            variant="outlined"
            size="sm"
            aria-label={t.viewStockLabel(`${row.warehouseCode} ${row.warehouseName}`)}
            onClick={() => navigate(`${STOCK_STATUS_PATH}?wh=${String(row.warehouseId)}`)}
          >
            {t.viewStock}
          </Button>
        ),
    },
    {
      key: 'remove',
      /* 다른 화면 표처럼 「관리」 열 · 휴지통(사용자 지시 2026-11-25). */
      header: t.columns.manage,
      align: 'center',
      /* 추가 줄의 [추가] · [취소] 가 들어갈 폭으로 늘 고정한다 — 추가 줄이 서도 열 폭이 바뀌지 않게(사용자 지시 2026-11-26). */
      width: '144px',
      render: (row) =>
        isAddRow(row) ? (
          <span className="production-warehouse-add-actions">
            {/* 창고를 고르기 전에는 꺼진 단추로만 — 칸의 「창고를 선택하세요」가 이미 말한다. */}
            <Button variant="outlined" size="sm" disabled={addValue === ''} onClick={handleAdd}>
              {t.addRow.confirm}
            </Button>
            <Button variant="outlined" size="sm" onClick={closeAddRow}>
              {messages.common.cancel}
            </Button>
          </span>
        ) : (
          <IconButton
            icon="delete"
            size="sm"
            aria-label={t.removeLabel(`${row.warehouseCode} ${row.warehouseName}`)}
            onClick={() => editor.toggle(row.warehouseId)}
          />
        ),
    },
  ];

  /* 고를 수 있는 창고 — 종전 추가 창이 늘어놓던 후보 중 아직 연결하지 않은 것. */
  const addOptions = editor.candidates
    .filter((warehouse) => !editor.isLinked(warehouse.warehouseId))
    .map((warehouse) => ({
      value: String(warehouse.warehouseId),
      label: `${editor.plantName(warehouse.plantId)} ${warehouse.warehouseCode} ${warehouse.warehouseName}`,
    }));

  const closeAddRow = (): void => {
    setAddValue('');
    setIsAdding(false);
  };

  /* 종전 창에서 그 창고를 체크한 것과 같다 — 초안에만 넣고 저장은 부서 「저장」이 한다. */
  const handleAdd = (): void => {
    /* 넣기만 한다 — `toggle` 은 이미 연결된 창고면 빼므로, 연결된 창고는 넘기지 않는다. */
    if (addValue === '' || editor.isLinked(Number(addValue))) return;
    editor.toggle(Number(addValue));
    closeAddRow();
  };

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
    /* 창고가 없어도 머리줄은 그리고 빈 안내는 표 안에 둔다 — 앱의 빈 목록 통일 모양(사용자 지시 2026-11-26). */
    return (
      <Table
        columns={columns}
        rows={isAdding ? [...editor.rows, ADD_ROW] : editor.rows}
        empty={<ListEmpty icon="warehouse" title={t.none} />}
        getRowId={(row) => String(row.warehouseId)}
        density="compact"
        aria-label={t.tableLabel}
      />
    );
  };

  return (
    <section className="production-warehouse-section" aria-labelledby="production-warehouse-title">
      <div className="section-heading-row">
        {/*
         * 출고 창고를 고르는 규칙은 제목 옆 ⓘ 로 — 늘 펼쳐 둘 문장은 아니다(관리웹 정리 시안 A).
         * 제목 안에 두지 않는다 — 구획 이름(`aria-labelledby`)에 문장이 섞인다.
         */}
        <div className="info-label">
          <h3 id="production-warehouse-title" className="subsection-title">
            {t.title}
          </h3>
          <InfoTip text={t.help} />
        </div>
        {/* 상세 상자 안 보조 단추는 작은 크기 — 취소 · 저장만 기본 크기(사용자 지시 2026-11-25). */}
        <Button
          variant="outlined"
          size="sm"
          disabled={editor.isLoading || editor.loadError !== null}
          aria-expanded={isAdding}
          onClick={() => setIsAdding(true)}
        >
          {`+ ${t.add}`}
        </Button>
      </div>
      <SaveErrorBanner error={editor.error} />
      {body()}

      <Dialog
        open={editor.pendingConfirm !== null}
        onClose={editor.cancelConfirm}
        title={t.confirm.title}
        size="sm"
        /* 닫기(X) 없이 바닥 단추로만 — Esc 는 종전대로 닫는다(사용자 지시 2026-11-25). */
        showCloseButton={false}
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
