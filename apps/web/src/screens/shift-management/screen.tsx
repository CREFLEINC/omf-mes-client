import {
  Button,
  Dialog,
  EmptyState,
  Field,
  Icon,
  Skeleton,
  Table,
  useToast,
  type Column,
} from '@crefle/web-ui';
import type { components } from '@omf-mes/api-client';
import { messages } from '@omf-mes/i18n';
import { useState, type ReactNode } from 'react';

import { useFitColumns } from '../../patterns/column-fit';
import { useColumnOrder } from '../../patterns/column-grip-order';
import { useColumnWidths } from '../../patterns/column-resize';
import { LoadErrorAlert } from '../../patterns/load-error-banner';
import { SaveErrorBanner } from '../../patterns/master';
import { useSession } from '../../patterns/session';
import { Select } from '../../patterns/select';
import { EditDialog } from './edit-dialog';
import {
  useDeactivateShift,
  usePlants,
  useShiftDetail,
  useShifts,
  type Shift,
} from './queries';

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
  const { session } = useSession();
  const plants = usePlants(session?.scopes ?? NO_SCOPES);
  const [pickedPlant, setPickedPlant] = useState<number | null>(null);
  const plant =
    plants.data?.find((each) => each.plantId === pickedPlant) ?? plants.data?.[0] ?? null;
  const plantId = plant?.plantId ?? null;
  const list = useShifts(plantId);

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
    { key: 'start', header: t.columns.start, align: 'center', render: (row) => hhmm(row.startTime) },
    {
      key: 'end',
      header: t.columns.end,
      align: 'center',
      render: (row) =>
        row.crossesMidnight ? t.values.nextDayEnd(hhmm(row.endTime)) : hhmm(row.endTime),
    },
    {
      key: 'actions',
      header: t.columns.actions,
      align: 'center',
      render: (row) => (
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

  const rows = list.data ?? [];

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
      <section className="pane filter-field-surface" aria-label={t.filters.label}>
        <div className="filter-bar shift-management-filter">
          <Field label={t.filters.plant} labelAs="span">
            {(ids) => (
              <Select
                id={ids.controlId}
                aria-label={t.filters.plant}
                value={plantId === null ? null : String(plantId)}
                options={(plants.data ?? []).map((each) => ({
                  value: String(each.plantId),
                  label: each.plantName,
                }))}
                onChange={(value) => setPickedPlant(Number(value))}
              />
            )}
          </Field>
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
        </div>
        <p className="iqc-inspection-action-note" data-tone="info" role="status">
          <Icon name="info" size={14} aria-hidden />
          {t.intro}
        </p>
        {listBody()}
      </section>
      {editing !== null && plant !== null && (
        <EditDialog
          plantId={plant.plantId}
          plantName={plant.plantName}
          shift={editing === 'new' ? null : editing}
          existingCodes={rows.map((row) => row.shiftCode)}
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
        title={t.deactivateDialog.title}
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
