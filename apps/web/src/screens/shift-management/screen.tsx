import {
  Breadcrumb,
  Button,
  Dialog,
  EmptyState,
  Icon,
  PageHeader,
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
import { useDeactivateShift, usePlants, useShifts, type Shift } from './queries';

type SessionScope = components['schemas']['SessionScope'];

const t = messages.shiftManagement;
const NO_SCOPES: readonly SessionScope[] = [];

/** `HH:MM:SS` → `HH:MM`. 교대 시각은 분 단위로 정한다. */
const hhmm = (time: string): string => time.slice(0, 5);

/**
 * W-06-26 교대 관리(omf-all-around#318).
 *
 * 공장마다 주간·야간 교대를 등록 · 수정 · 사용 중지한다. 시간 값은 고객이 정하므로 화면에서 넣는다(시드 없음).
 * 목록은 기존 조회 API(`GET /mdm/shifts`)라 4M 자원배정의 교대 선택과 같은 행을 본다.
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

  const deactivate = useDeactivateShift(retiring?.shiftId ?? null, () => {
    /* 중지한 교대는 목록에서 빠진다 — 열린 수정 창도 함께 닫는다. */
    setRetiring(null);
    setEditing(null);
    toast.show({ variant: 'success', description: t.toast.deactivated });
  });

  const baseColumns: Column<Shift>[] = [
    { key: 'code', header: t.columns.code, render: (row) => row.shiftCode },
    { key: 'name', header: t.columns.name, render: (row) => row.shiftName },
    { key: 'start', header: t.columns.start, render: (row) => hhmm(row.startTime) },
    { key: 'end', header: t.columns.end, render: (row) => hhmm(row.endTime) },
    {
      key: 'crossesMidnight',
      header: t.columns.crossesMidnight,
      render: (row) => (row.crossesMidnight ? t.values.nextDay : t.values.sameDay),
    },
    {
      key: 'actions',
      header: t.columns.actions,
      render: (row) => (
        <Button
          variant="outlined"
          size="sm"
          aria-label={t.editRow(row.shiftName)}
          onClick={() => setEditing(row)}
        >
          {t.edit}
        </Button>
      ),
    },
  ];
  const ordered = useColumnOrder('omf-mes:shift-management:columns:order', baseColumns);
  const resizable = useColumnWidths('omf-mes:shift-management:columns:v1', ordered);
  const fit = useFitColumns(resizable.columns);

  const rows = list.data ?? [];

  const body = (): ReactNode => {
    if (plants.isError)
      return <LoadErrorAlert error={plants.error} onRetry={() => void plants.refetch()} />;
    if (plants.isPending) return <Skeleton variant="rect" height="12rem" />;
    if (plant === null) return <EmptyState size="sm" title={t.noPlant} />;
    if (list.isError)
      return <LoadErrorAlert error={list.error} onRetry={() => void list.refetch()} />;
    if (list.isPending) return <Skeleton variant="rect" height="12rem" />;
    return (
      <>
        <div className="shift-management-list-head">
          <span className="subsection-title">{t.count(rows.length)}</span>
          <span className="field-note">{t.plantNote(plant.plantName)}</span>
          <span className="shift-management-actions-end">
            <Button onClick={() => setEditing('new')}>{t.add}</Button>
          </span>
        </div>
        <div ref={fit.ref} className="shift-management-table" style={resizable.style}>
          <Table
            density="compact"
            columns={fit.columns}
            rows={rows}
            getRowId={(row) => String(row.shiftId)}
            aria-label={t.tableLabel}
            empty={<EmptyState size="sm" title={t.empty} />}
          />
        </div>
      </>
    );
  };

  return (
    <>
      <PageHeader
        title={t.title}
        breadcrumb={
          <Breadcrumb
            items={[{ label: t.breadcrumbRoot }, { label: t.title }]}
            aria-label={messages.common.shell.breadcrumb}
          />
        }
      />
      <p className="iqc-inspection-action-note" data-tone="info" role="status">
        <Icon name="info" size={14} aria-hidden />
        {t.intro}
      </p>
      {(plants.data?.length ?? 0) > 1 && (
        <section className="pane" aria-label={t.filters.label}>
          <div className="filter-bar">
            <Select
              aria-label={t.filters.plant}
              value={plantId === null ? null : String(plantId)}
              options={(plants.data ?? []).map((each) => ({
                value: String(each.plantId),
                label: each.plantName,
              }))}
              onChange={(value) => setPickedPlant(Number(value))}
            />
          </div>
        </section>
      )}
      <section className="pane" aria-label={t.tableLabel}>
        {body()}
      </section>
      {editing !== null && plant !== null && (
        <EditDialog
          plantId={plant.plantId}
          plantName={plant.plantName}
          shift={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            toast.show({ variant: 'success', description: t.toast.saved });
          }}
          onDeactivate={(shift) => {
            deactivate.reset();
            setRetiring(shift);
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
            <Button loading={deactivate.isSaving} onClick={() => deactivate.write()}>
              {t.deactivateDialog.confirm}
            </Button>
          </>
        }
      >
        {retiring !== null && (
          <p className="dialog-text">{t.deactivateDialog.body(retiring.shiftName)}</p>
        )}
        {deactivate.error !== null && <SaveErrorBanner error={deactivate.error} />}
      </Dialog>
    </>
  );
};
