import {
  Button,
  Chip,
  Dialog,
  EmptyState,
  Icon,
  Skeleton,
  Table,
  useToast,
  type Column,
} from '@crefle/web-ui';
import type { components } from '@omf-mes/api-client';
import { messages } from '@omf-mes/i18n';
import { useId, useState, type ReactNode } from 'react';

import { useFitColumns } from '../../patterns/column-fit';
import { useColumnOrder } from '../../patterns/column-grip-order';
import { useColumnWidths } from '../../patterns/column-resize';
import { InfoTip } from '../../patterns/info-tip';
import { LoadErrorAlert } from '../../patterns/load-error-banner';
import { useOaAccess, useScopedPlants } from '../../patterns/oa-access';
import { SaveErrorBanner } from '../../patterns/master';
import { useSession } from '../../patterns/session';
import { Select } from '../../patterns/select';
import { EditDialog } from './edit-dialog';
import { useDeactivateShift, usePlants, useShiftDetail, useShifts, type Shift } from './queries';

type SessionScope = components['schemas']['SessionScope'];

const t = messages.shiftManagement;
const NO_SCOPES: readonly SessionScope[] = [];

/** `HH:MM:SS` → `HH:MM`. 교대 시간은 분 단위로 정한다. */
const hhmm = (time: string): string => time.slice(0, 5);

/**
 * W-06-26 교대 관리(omf-all-around#318).
 *
 * 공장마다 주간·야간 교대를 등록 · 수정 · 사용 중지한다. 시간 값은 고객이 정하므로 화면에서 넣는다(시드 없음).
 * 목록은 기존 조회 API(`GET /mdm/shifts`)라 4M 자원배정의 교대 선택과 같은 행을 본다.
 * 틀은 검사 조회·판정 · 단말 관리와 같다 — 머리글 없이 위 조회 상자, 아래 「교대 목록 N건」 상자.
 */
export const ShiftManagementScreen = () => {
  const toast = useToast();
  const plantFieldId = useId();
  const { session } = useSession();
  const plants = usePlants(session?.scopes ?? NO_SCOPES);
  /*
   * 공장은 사용자 설정을 따라 자동으로 고른다 — 계정 범위 공장 중 위 줄에서 고른 동작(OA · 부품)의 공장.
   * 그 공장이 여럿이면 고를 수 있다. 판단 근거를 못 받으면 범위 공장 전체를 후보로 둔다.
   */
  const access = useOaAccess();
  const scoped = useScopedPlants();
  const kindIds =
    scoped.status === 'ready' && (access === 'oa' || access === 'not-oa')
      ? new Set((access === 'oa' ? scoped.oa : scoped.parts).map((each) => each.plantId))
      : null;
  const candidates = (plants.data ?? []).filter(
    (each) => kindIds === null || kindIds.has(each.plantId),
  );
  const [pickedPlant, setPickedPlant] = useState<number | null>(null);
  const plant = candidates.find((each) => each.plantId === pickedPlant) ?? candidates[0] ?? null;
  const plantId = plant?.plantId ?? null;
  const list = useShifts(plantId);
  /** 사용 유무 라벨 — `null` 이면 둘 다 보인다. 공장을 바꾸면 풀린다. */
  const [statusFilter, setStatusFilter] = useState<'active' | 'inactive' | null>(null);

  /** 열린 창 — `null` 닫힘, `'new'` 추가. */
  const [editing, setEditing] = useState<Shift | 'new' | null>(null);
  const [retiring, setRetiring] = useState<Shift | null>(null);
  /* 사용 중지는 상세의 잠금 토큰(ETag)으로 보낸다 — 확인 창이 열리면 상세를 받는다. */
  const retiringDetail = useShiftDetail(retiring?.shiftId ?? null);

  const deactivate = useDeactivateShift(retiring?.shiftId ?? null, () => {
    setRetiring(null);
    toast.show({ variant: 'success', description: t.toast.deactivated });
  });

  const baseColumns: Column<Shift>[] = [
    { key: 'code', header: t.columns.code, align: 'center', render: (row) => row.shiftCode },
    { key: 'name', header: t.columns.name, render: (row) => row.shiftName },
    {
      key: 'start',
      header: t.columns.start,
      align: 'center',
      render: (row) => hhmm(row.startTime),
    },
    {
      key: 'end',
      header: t.columns.end,
      align: 'center',
      render: (row) =>
        row.crossesMidnight ? t.values.nextDayEnd(hhmm(row.endTime)) : hhmm(row.endTime),
    },
    {
      key: 'status',
      header: t.columns.status,
      align: 'center',
      render: (row) => (
        <Chip variant="status" size="sm" status={row.isActive ? 'success' : 'idle'}>
          {row.isActive ? t.chips.active : t.chips.inactive}
        </Chip>
      ),
    },
    {
      key: 'actions',
      header: t.columns.actions,
      align: 'center',
      /* 사용 중지한 교대는 다시 쓰게 하는 기능이 없어 관리 단추를 두지 않는다(#318 범위). */
      render: (row) =>
        !row.isActive ? null : (
          <span className="shift-management-row-actions">
            <Button
              variant="outlined"
              size="sm"
              aria-label={t.editRow(row.shiftName)}
              onClick={() => setEditing(row)}
            >
              {t.edit}
            </Button>
            <Button
              variant="outlined"
              size="sm"
              aria-label={t.deactivateRow(row.shiftName)}
              onClick={() => {
                deactivate.reset();
                setRetiring(row);
              }}
            >
              {t.deactivate}
            </Button>
          </span>
        ),
    },
  ];
  const ordered = useColumnOrder('omf-mes:shift-management:columns:order', baseColumns);
  const resizable = useColumnWidths('omf-mes:shift-management:columns:v2', ordered);
  const fit = useFitColumns(resizable.columns);

  const allRows = list.data ?? [];
  const activeCount = allRows.filter((row) => row.isActive).length;
  const counts = { active: activeCount, inactive: allRows.length - activeCount };
  const rows =
    statusFilter === null
      ? allRows
      : allRows.filter((row) => row.isActive === (statusFilter === 'active'));
  /* 0건 라벨은 숨긴다 — 걸려 있는 라벨은 0건이어도 남겨 풀 수 있게 한다. */
  const chips = (['active', 'inactive'] as const).filter(
    (status) => list.data !== undefined && (statusFilter === status || counts[status] > 0),
  );

  const listBody = (): ReactNode => {
    if (plants.isError)
      return <LoadErrorAlert error={plants.error} onRetry={() => void plants.refetch()} />;
    if (plants.isPending) return <Skeleton variant="rect" height="12rem" />;
    if (plant === null) return <EmptyState size="sm" title={t.noPlant} />;
    if (list.isError)
      return <LoadErrorAlert error={list.error} onRetry={() => void list.refetch()} />;
    if (list.isPending) return <Skeleton variant="rect" height="12rem" />;
    return (
      <div
        ref={fit.ref}
        className="inspection-queue-table shift-management-table"
        style={resizable.style}
      >
        <Table
          density="compact"
          columns={fit.columns}
          rows={rows}
          getRowId={(row) => String(row.shiftId)}
          aria-label={t.tableLabel}
          empty={<EmptyState size="sm" title={t.empty} />}
        />
      </div>
    );
  };

  return (
    <>
      {chips.length > 0 && (
        <div className="shift-management-top-actions">
          <div className="inspection-hub-counts" role="group" aria-label={t.chips.label}>
            {chips.map((status) => {
              const label = t.chips[status];
              const isOn = statusFilter === status;
              return (
                <Chip
                  key={status}
                  variant="filter"
                  size="sm"
                  selected={isOn}
                  aria-pressed={isOn}
                  aria-label={isOn ? t.chips.filterOff(label) : t.chips.filterOn(label)}
                  onSelectedChange={(selected) => setStatusFilter(selected ? status : null)}
                >
                  {messages.common.inspectionHub.count(label, counts[status])}
                </Chip>
              );
            })}
          </div>
        </div>
      )}
      {/* 조회 상자는 단말 관리 · 사용자 역할 권한 관리와 같은 틀 — 칸 바닥 맞춤, 추가 단추는 줄 오른쪽 끝. */}
      <section
        className="pane users-roles-search filter-field-surface"
        aria-label={t.filters.label}
      >
        <div className="filter-bar users-roles-filter-row shift-management-filter">
          <div className="field-cell shift-management-plant">
            <span className="field-label">
              <label htmlFor={plantFieldId}>{t.filters.plant}</label>
            </span>
            <Select
              id={plantFieldId}
              value={plantId === null ? null : String(plantId)}
              options={candidates.map((each) => ({
                value: String(each.plantId),
                label: each.plantName,
              }))}
              onChange={(value) => {
                setPickedPlant(Number(value));
                setStatusFilter(null);
              }}
            />
          </div>
          {/* 볼 수 있는 공장이 없으면 목록이 그 사유를 말한다 — 추가 단추는 두지 않는다. */}
          {plant !== null && (
            <Button
              className="shift-management-add"
              leadingIcon={<Icon name="add" size={18} />}
              onClick={() => setEditing('new')}
            >
              {t.add}
            </Button>
          )}
        </div>
      </section>
      <section className="pane shift-management-list-pane" aria-label={t.tableLabel}>
        <div className="po-board-list-head">
          <h2 className="pane-title">{t.tableLabel}</h2>
          {list.data !== undefined && (
            <span className="po-board-list-count">
              {messages.common.paneList.count(rows.length)}
            </span>
          )}
          {/* 안내는 아이콘만 — 마우스를 올리면 문장이 뜬다(사용자 지시 2026-11-25). */}
          <InfoTip text={t.intro} />
        </div>
        {listBody()}
      </section>
      {editing !== null && plant !== null && (
        <EditDialog
          plantId={plant.plantId}
          plantName={plant.plantName}
          shift={editing === 'new' ? null : editing}
          existingCodes={allRows.map((row) => row.shiftCode)}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            toast.show({ variant: 'success', description: t.toast.saved });
          }}
        />
      )}
      <Dialog
        open={retiring !== null}
        onClose={() => setRetiring(null)}
        title={t.deactivateDialog.title(retiring?.shiftName ?? '')}
        size="sm"
        showCloseButton={false}
        footer={
          <>
            <Button variant="outlined" onClick={() => setRetiring(null)}>
              {t.deactivateDialog.cancel}
            </Button>
            <Button
              loading={deactivate.isSaving}
              disabled={retiringDetail.data === undefined}
              onClick={() => deactivate.write()}
            >
              {t.deactivateDialog.confirm}
            </Button>
          </>
        }
      >
        {retiring !== null && (
          <p className="dialog-text">{t.deactivateDialog.body(retiring.shiftName)}</p>
        )}
        {retiringDetail.isError && (
          <LoadErrorAlert
            error={retiringDetail.error}
            onRetry={() => void retiringDetail.refetch()}
          />
        )}
        {deactivate.error !== null && <SaveErrorBanner error={deactivate.error} />}
      </Dialog>
    </>
  );
};
