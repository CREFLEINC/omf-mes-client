import { AlertBanner, Button, Dialog, TextField, useToast } from '@crefle/web-ui';
import type { ApiError, ReplenishmentItem, ReplenishmentSettings } from '@omf-mes/api-client';
import { messages } from '@omf-mes/i18n';
import { useId, useState } from 'react';

import { ItemSelect } from '../../patterns/item-select';
import { SaveErrorBanner } from '../../patterns/master';
import { Select } from '../../patterns/select';
import { useDeleteItem, useSaveItem } from './mutations';
import { sourceOptions, type WarehouseOption } from './queries';
import { hasErrorCode, parseQty } from './types';

const t = messages.productionWarehouseReplenishment;
const ti = t.itemDialog;

/** 관리 품목은 자재 유형만(원자재 · 부자재, plan 확인할 것 3). */
export const MATERIAL_ITEM_TYPES = ['RAW_MATERIAL', 'SUBSIDIARY_MATERIAL'] as const;

/** 보충 시점 · 유지량 검사 — 0 < 보충 시점 < 유지량(US4-2). 빈 칸은 「빈 칸을 채우세요」로 따로 막는다. */
export const pointRangeOk = (point: string, target: string): boolean => {
  const p = parseQty(point);
  const q = parseQty(target);
  if (p === null || q === null) return true;
  return p > 0 && p < q;
};

const saveErrorText = (error: ApiError): string | null => {
  if (hasErrorCode(error, 'DUPLICATE')) return t.errors.duplicateItem;
  if (hasErrorCode(error, 'RANGE')) return t.errors.range;
  if (hasErrorCode(error, 'VERSION_CONFLICT') || error.kind === 'conflict') {
    return t.errors.versionConflict;
  }
  if (hasErrorCode(error, 'INVALID')) return t.errors.invalid;
  return null;
};

export interface ItemDialogProps {
  /** 고칠 행. 없으면 추가 창. */
  item: ReplenishmentItem | null;
  settings: ReplenishmentSettings;
  warehouses: readonly WarehouseOption[];
  onClose: () => void;
}

/** 관리 품목 추가 · 고치기 창(screens/W-02-12.md 보기 4). 고치기는 생산 창고 · 품목을 바꾸지 않는다. */
export const ItemDialog = ({ item, settings, warehouses, onClose }: ItemDialogProps) => {
  const toast = useToast();
  const rangeId = useId();
  const [warehouse, setWarehouse] = useState(
    String(item?.productionWarehouseId ?? settings.warehouses[0]?.warehouseId ?? ''),
  );
  const [itemId, setItemId] = useState(item === null ? '' : String(item.itemId));
  const [point, setPoint] = useState(item === null ? '' : String(item.reorderPointQty));
  const [target, setTarget] = useState(item === null ? '' : String(item.targetQty));
  const [source, setSource] = useState(item === null ? '' : String(item.sourceWarehouseId));
  const [confirmDelete, setConfirmDelete] = useState(false);

  const save = useSaveItem(() => {
    toast.show({ variant: 'success', description: t.toast.itemSaved });
    onClose();
  });
  const remove = useDeleteItem((deleted) => {
    toast.show({
      variant: 'success',
      description:
        deleted.inProgressRequestCount > 0
          ? t.toast.itemDeletedInProgress(deleted.inProgressRequestCount)
          : t.toast.itemDeleted,
    });
    onClose();
  });

  const rangeOk = pointRangeOk(point, target);
  const complete =
    warehouse !== '' &&
    itemId !== '' &&
    source !== '' &&
    point.trim() !== '' &&
    target.trim() !== '';
  const blocked = !rangeOk || !complete;
  const touch = (): void => save.reset();

  const submit = (): void => {
    const reorderPointQty = parseQty(point) ?? 0;
    const targetQty = parseQty(target) ?? 0;
    if (item === null) {
      save.write({
        mode: 'create',
        body: {
          productionWarehouseId: Number(warehouse),
          itemId: Number(itemId),
          reorderPointQty,
          targetQty,
          sourceWarehouseId: Number(source),
        },
      });
    } else {
      save.write({
        mode: 'update',
        id: item.replenishmentItemId,
        body: {
          reorderPointQty,
          targetQty,
          sourceWarehouseId: Number(source),
          versionNo: item.versionNo,
        },
      });
    }
  };

  const errorBanner = (() => {
    const error = save.error ?? remove.error;
    if (error === null) return null;
    const text = saveErrorText(error);
    return text === null ? (
      <SaveErrorBanner error={error} />
    ) : (
      <AlertBanner variant="error">{text}</AlertBanner>
    );
  })();

  const itemText = item === null ? '' : `${item.itemCode} ${item.itemName}`;

  return (
    <>
      <Dialog
        open={!confirmDelete}
        onClose={onClose}
        title={item === null ? ti.addTitle : ti.editTitle}
        size="sm"
        footer={
          <>
            {item !== null && (
              <Button
                variant="outlined"
                className="form-actions-secondary"
                onClick={() => {
                  remove.reset();
                  setConfirmDelete(true);
                }}
              >
                {ti.delete}
              </Button>
            )}
            <Button variant="outlined" onClick={onClose}>
              {ti.cancel}
            </Button>
            <Button
              disabled={blocked}
              aria-describedby={blocked ? rangeId : undefined}
              loading={save.isSaving}
              onClick={submit}
            >
              {ti.save}
            </Button>
          </>
        }
      >
        <div className="replenishment-form">
          {errorBanner}
          {item === null ? (
            <>
              <Select
                aria-label={ti.productionWarehouse}
                value={warehouse}
                options={settings.warehouses.map((row) => ({
                  value: String(row.warehouseId),
                  label: row.warehouseName,
                }))}
                onChange={(value) => {
                  touch();
                  setWarehouse(value);
                  if (value === source) setSource('');
                }}
              />
              <ItemSelect
                aria-label={ti.item}
                placeholder={ti.item}
                itemTypeCodes={MATERIAL_ITEM_TYPES}
                value={itemId === '' ? null : itemId}
                onChange={(value) => {
                  touch();
                  setItemId(value);
                }}
              />
            </>
          ) : (
            <dl className="replenishment-head">
              <dt>{ti.productionWarehouse}</dt>
              <dd>{item.productionWarehouseName}</dd>
              <dt>{ti.item}</dt>
              <dd>{`${itemText} (${item.uomCode})`}</dd>
            </dl>
          )}
          <TextField
            label={ti.point}
            inputMode="decimal"
            value={point}
            error={rangeOk ? undefined : t.errors.range}
            onChange={(event) => {
              touch();
              setPoint(event.target.value);
            }}
          />
          <TextField
            label={ti.target}
            inputMode="decimal"
            value={target}
            onChange={(event) => {
              touch();
              setTarget(event.target.value);
            }}
          />
          <Select
            aria-label={ti.source}
            placeholder={ti.source}
            value={source === '' ? null : source}
            options={sourceOptions(warehouses, warehouse)}
            onChange={(value) => {
              touch();
              setSource(value);
            }}
          />
          <p className="field-note">{ti.help}</p>
          {blocked && (
            <p id={rangeId} className="field-note">
              {rangeOk ? ti.required : t.errors.range}
            </p>
          )}
        </div>
      </Dialog>
      <Dialog
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        title={ti.deleteTitle}
        size="sm"
        footer={
          <>
            <Button variant="outlined" onClick={() => setConfirmDelete(false)}>
              {ti.cancel}
            </Button>
            <Button
              loading={remove.isSaving}
              onClick={() => item !== null && remove.write(item.replenishmentItemId)}
            >
              {ti.deleteConfirm}
            </Button>
          </>
        }
      >
        <p className="dialog-text">{ti.deleteBody(itemText, (item?.inProgressQty ?? 0) > 0)}</p>
        {remove.error !== null && <SaveErrorBanner error={remove.error} />}
      </Dialog>
    </>
  );
};
