import {
  AlertBanner,
  Breadcrumb,
  Button,
  Chip,
  Dialog,
  EmptyState,
  IconButton,
  PageHeader,
  Skeleton,
  Table,
  TextField,
  useToast,
  type Column,
} from '@crefle/web-ui';
import type { components } from '@omf-mes/api-client';
import { messages } from '@omf-mes/i18n';
import { useEffect, useState, type ReactNode } from 'react';

import { LoadErrorAlert } from '../../patterns/load-error-banner';
import { SaveErrorBanner } from '../../patterns/master';
import { formatPackageQty, formatQty } from '../../patterns/package-qty';
import { useSession } from '../../patterns/session';
import { Select } from '../../patterns/select';
import { EditDialog } from './edit-dialog';
import { useDeleteDefault } from './mutations';
import { useDefaults, usePlants } from './queries';
import { formatUpdatedAt, matchesFilter, type SupplierItemDefault } from './types';

type SessionScope = components['schemas']['SessionScope'];

const t = messages.supplierItemDefault;
const NO_SCOPES: readonly SessionScope[] = [];
/** 저장한 행을 잠깐 표시하는 시간(screens/W-06-25.md 「그 행을 잠깐 강조」). */
const JUST_SAVED_MS = 3000;

/**
 * W-06-25 공급사·품목 기본 정보(005 · omf-all-around#254 · US1-9 · FR-047).
 *
 * 공장 · 공급사 · 품목마다 자재 관리 LOT당 재고 수량(품목 기본 단위)과 패키징을 등록 · 수정 · 삭제한다.
 * 자재 관리 LOT 발행(POP P-01-01 · 관리웹 W-01-14)이 이 값을 미리 채운다. 고쳐도 이미 만든 LOT 는 그대로다.
 *
 * ⚠ 시안은 「공장 공통」이라 적었지만 명세 · 계약은 공장 단위다(screens/W-06-25.md 「시안과 다른 점」) — 데이터
 *   범위의 공장으로 조회 · 저장하고 공장 이름을 보인다. 범위에 공장이 여럿이면 공장을 고른다.
 */
export const SupplierItemDefaultScreen = () => {
  const toast = useToast();
  const { session } = useSession();
  const plants = usePlants(session?.scopes ?? NO_SCOPES);
  const [pickedPlant, setPickedPlant] = useState<number | null>(null);
  const plant =
    plants.data?.find((each) => each.plantId === pickedPlant) ?? plants.data?.[0] ?? null;
  const plantId = plant?.plantId ?? null;
  const list = useDefaults(plantId);

  const [supplierQuery, setSupplierQuery] = useState('');
  const [itemQuery, setItemQuery] = useState('');
  /** 열린 창 — `null` 닫힘, `'new'` 추가. */
  const [editing, setEditing] = useState<SupplierItemDefault | 'new' | null>(null);
  const [deleting, setDeleting] = useState<SupplierItemDefault | null>(null);
  const [justSaved, setJustSaved] = useState<number | null>(null);

  useEffect(() => {
    if (justSaved === null) return undefined;
    const timer = setTimeout(() => setJustSaved(null), JUST_SAVED_MS);
    return () => clearTimeout(timer);
  }, [justSaved]);

  const remove = useDeleteDefault(() => {
    toast.show({ variant: 'success', description: t.toast.deleted });
    setDeleting(null);
  });

  const rows = (list.data ?? []).filter((row) => matchesFilter(row, supplierQuery, itemQuery));

  const columns: Column<SupplierItemDefault>[] = [
    {
      key: 'supplier',
      header: t.columns.supplier,
      render: (row) => (
        <span className="supplier-item-default-cell">
          {row.supplierName} <span className="supplier-item-default-code">{row.supplierCode}</span>
          {justSaved === row.supplierItemDefaultId && (
            <Chip size="sm" status="success">
              {t.dialog.save}
            </Chip>
          )}
        </span>
      ),
    },
    {
      key: 'item',
      header: t.columns.item,
      render: (row) => (
        <span className="supplier-item-default-cell">
          <span className="supplier-item-default-code">{row.itemCode}</span> {row.itemName}
        </span>
      ),
    },
    { key: 'uom', header: t.columns.baseUom, render: (row) => row.uomCode },
    {
      key: 'package',
      header: t.columns.packageUom,
      render: (row) => row.package?.uomCode ?? t.values.noPackage,
    },
    {
      key: 'perPackage',
      header: t.columns.qtyPerPackage,
      align: 'end',
      render: (row) =>
        row.package === null
          ? t.values.none
          : `${formatQty(row.package.qtyPerPackage)} ${row.uomCode}`,
    },
    {
      key: 'lotQty',
      header: t.columns.lotQty,
      align: 'end',
      render: (row) => `${formatQty(row.lotQty)} ${row.uomCode}`,
    },
    {
      key: 'preview',
      header: t.columns.preview,
      render: (row) =>
        formatPackageQty(
          row.lotQty,
          row.uomCode,
          row.package === null
            ? null
            : {
                uomCode: row.package.uomCode,
                count: row.package.count,
                qtyPerPackage: row.package.qtyPerPackage,
              },
        ),
    },
    {
      key: 'updated',
      header: t.columns.updated,
      render: (row) => t.values.updated(formatUpdatedAt(row.updatedAt), row.updatedByName),
    },
    {
      key: 'actions',
      header: t.columns.actions,
      render: (row) => (
        <span className="supplier-item-default-actions">
          <Button
            variant="outlined"
            size="sm"
            aria-label={t.editRow(row.supplierName, row.itemCode)}
            onClick={() => setEditing(row)}
          >
            {t.edit}
          </Button>
          <IconButton
            icon="delete"
            size="sm"
            aria-label={t.deleteRow(row.supplierName, row.itemCode)}
            onClick={() => {
              remove.reset();
              setDeleting(row);
            }}
          />
        </span>
      ),
    },
  ];

  const body = (): ReactNode => {
    if (plants.isError)
      return <LoadErrorAlert error={plants.error} onRetry={() => void plants.refetch()} />;
    if (plants.isPending) return <Skeleton variant="rect" height="16rem" />;
    if (plant === null) return <EmptyState size="sm" title={t.noPlant} />;
    if (list.isError)
      return <LoadErrorAlert error={list.error} onRetry={() => void list.refetch()} />;
    if (list.isPending) return <Skeleton variant="rect" height="16rem" />;
    return (
      <>
        <div className="supplier-item-default-list-head">
          <span className="subsection-title">{t.count(rows.length)}</span>
          <span className="field-note">{t.plantNote(plant.plantName)}</span>
          <span className="supplier-item-default-actions-end">
            <Button onClick={() => setEditing('new')}>{t.add}</Button>
          </span>
        </div>
        {/* 좁은 폭에서 표는 짓누르지 않고 표 상자 안에서 가로로 민다(screens/W-06-25.md 좁은 폭). */}
        <div className="wide-table supplier-item-default-table">
          <Table
            density="compact"
            columns={columns}
            rows={rows}
            getRowId={(row) => String(row.supplierItemDefaultId)}
            aria-label={t.tableLabel}
            empty={<EmptyState size="sm" title={t.empty} />}
          />
        </div>
        <p className="field-note supplier-item-default-help">{t.help}</p>
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
      <div className="banner-slot">
        <AlertBanner variant="info">{t.intro}</AlertBanner>
      </div>
      <section className="pane" aria-label={t.filters.label}>
        <div className="filter-bar supplier-item-default-filter">
          {(plants.data?.length ?? 0) > 1 && (
            <Select
              aria-label={t.filters.plant}
              value={plantId === null ? null : String(plantId)}
              options={(plants.data ?? []).map((each) => ({
                value: String(each.plantId),
                label: each.plantName,
              }))}
              onChange={(value) => setPickedPlant(Number(value))}
            />
          )}
          <TextField
            label={t.filters.supplier}
            placeholder={t.filters.supplierPlaceholder}
            value={supplierQuery}
            onChange={(event) => setSupplierQuery(event.target.value)}
          />
          <TextField
            label={t.filters.item}
            placeholder={t.filters.itemPlaceholder}
            value={itemQuery}
            onChange={(event) => setItemQuery(event.target.value)}
          />
          <Button
            variant="outlined"
            onClick={() => {
              setSupplierQuery('');
              setItemQuery('');
            }}
          >
            {t.filters.reset}
          </Button>
        </div>
      </section>
      <section className="pane" aria-label={t.tableLabel}>
        {body()}
      </section>
      {editing !== null && plantId !== null && (
        <EditDialog
          plantId={plantId}
          row={editing === 'new' ? null : editing}
          existing={list.data ?? []}
          onClose={() => setEditing(null)}
          onSaved={(saved) => setJustSaved(saved.supplierItemDefaultId)}
          onReload={() => {
            setEditing(null);
            void list.refetch();
          }}
        />
      )}
      <Dialog
        open={deleting !== null}
        onClose={() => setDeleting(null)}
        title={t.deleteDialog.title}
        size="sm"
        footer={
          <>
            <Button variant="outlined" onClick={() => setDeleting(null)}>
              {t.deleteDialog.cancel}
            </Button>
            <Button
              loading={remove.isSaving}
              onClick={() => deleting !== null && remove.write(deleting.supplierItemDefaultId)}
            >
              {t.deleteDialog.confirm}
            </Button>
          </>
        }
      >
        {deleting !== null && (
          <p className="dialog-text">
            {t.dialog.deleteTarget(deleting.supplierName, deleting.itemCode, deleting.itemName)}
          </p>
        )}
        <p className="dialog-text">{t.deleteDialog.body}</p>
        {remove.error !== null && <SaveErrorBanner error={remove.error} />}
      </Dialog>
    </>
  );
};
