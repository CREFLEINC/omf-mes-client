import { AlertBanner, Button, Dialog, Field, TextField, useToast } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useEffect, useId, useState } from 'react';

import { ItemSelect } from '../../patterns/item-select';
import { SaveErrorBanner } from '../../patterns/master';
import { josa } from '../../patterns/josa';
import { isIntegerUom, useItemStorageUnit, useUomOptions } from '../../patterns/material-lot-batch';
import { formatQty, packageCountOf, parseQtyInput } from '../../patterns/package-qty';
import { PartnerSelect } from '../../patterns/partner-select';
import { Select } from '../../patterns/select';
import { useSaveDefault } from './mutations';
import {
  checkDraft,
  draftOf,
  EMPTY_DRAFT,
  hasErrorCode,
  toCreateBody,
  toUpdateBody,
  type DefaultDraft,
  type DraftError,
  type SupplierItemDefault,
} from './types';

const t = messages.supplierItemDefault;
const td = t.dialog;

/** 공급사 · 품목을 고르는 칸의 대상 — 거래처 중 공급사, 품목은 자재 유형만이 아니라 전부(공급사가 주는 것). */
const SUPPLIER_ROLE = 'SUPPLIER';

export interface EditDialogProps {
  plantId: number;
  /** 고칠 행. 없으면 추가 창. */
  row: SupplierItemDefault | null;
  /** 이 공장에 이미 있는 행 — 추가 창의 중복 검사(서버도 409 `DUPLICATE` 로 막는다). */
  existing: readonly SupplierItemDefault[];
  onClose: () => void;
  /** 저장 뒤 — 목록이 그 행을 잠깐 표시한다. */
  onSaved: (saved: SupplierItemDefault) => void;
  /** 409 VERSION_CONFLICT 뒤 「다시 불러오기」. */
  onReload: () => void;
}

/**
 * 추가 · 수정 창(screens/W-06-25.md 「추가·수정 창」). 수정은 공급사 · 품목을 바꾸지 않는다.
 * ⭐ 추가에서 품목을 고르면 품목 기본 보관 단위로 패키징 단위 · 패키징 수량을 다시 채운다(없으면 비움).
 */
export const EditDialog = ({
  plantId,
  row,
  existing,
  onClose,
  onSaved,
  onReload,
}: EditDialogProps) => {
  const toast = useToast();
  const errorId = useId();
  const [draft, setDraft] = useState<DefaultDraft>(row === null ? EMPTY_DRAFT : draftOf(row));
  /** 추가 창에서 고른 품목의 기본 단위(품목 마스터). 수정 창은 행의 값. */
  const [baseUomId, setBaseUomId] = useState<number | null>(row?.uomId ?? null);
  /** 품목을 바꾼 뒤 보관 단위로 다시 채울 품목(받으면 비운다). */
  const [refillFor, setRefillFor] = useState<string | null>(null);

  const uoms = useUomOptions();
  const itemId = draft.itemId === '' ? null : Number(draft.itemId);
  const storage = useItemStorageUnit(itemId);

  useEffect(() => {
    if (refillFor === null || refillFor !== draft.itemId || storage.isPending) return;
    const unit = storage.data ?? null;
    setDraft((prev) => ({
      ...prev,
      packageUomId: unit === null ? '' : String(unit.uomId),
      qtyPerPackage: unit?.qtyPerPackage == null ? '' : String(unit.qtyPerPackage),
    }));
    setRefillFor(null);
  }, [refillFor, draft.itemId, storage.isPending, storage.data]);

  const save = useSaveDefault((saved) => {
    toast.show({
      variant: 'success',
      description: t.toast.saved(saved.supplierName, saved.itemCode),
    });
    onSaved(saved);
    onClose();
  });

  const uomCodeOf = (id: number | null): string =>
    id === null ? '' : (uoms.data?.find((uom) => uom.uomId === id)?.uomCode ?? '');
  /** 패키징 단위는 이름(「봉지」)으로 보인다 — 이름이 비면 코드(G2 L17). */
  const uomNameOf = (id: number | null): string => {
    if (id === null) return '';
    const found = uoms.data?.find((uom) => uom.uomId === id);
    return found === undefined ? '' : found.uomName.trim() === '' ? found.uomCode : found.uomName;
  };
  const baseUomCode = row?.uomCode ?? uomCodeOf(baseUomId);

  /* 같은 공장 · 공급사 · 품목이 이미 있으면 그 행 — 안내에 그 행의 이름을 쓴다. */
  const duplicate =
    row === null
      ? existing.find(
          (each) =>
            String(each.supplierId) === draft.supplierId && String(each.itemId) === draft.itemId,
        )
      : undefined;
  const isDuplicate = duplicate !== undefined;
  const problem = checkDraft(draft, {
    integerOnly: isIntegerUom(uoms.data, baseUomCode),
    isDuplicate,
  });

  const errorText = (error: DraftError): string => {
    switch (error.kind) {
      case 'pick':
        return t.errors.pick;
      case 'duplicate':
        return t.errors.duplicate(
          duplicate?.supplierName ?? '',
          duplicate?.itemCode ?? '',
          josa(duplicate?.itemCode ?? '', '은/는'),
        );
      case 'qtyPerPackage':
        return t.errors.qtyPerPackage;
      case 'lotQty':
        return t.errors.lotQty;
      case 'integer':
        return t.errors.integer(baseUomCode, josa(baseUomCode, '은/는'));
      case 'multiple':
        return t.errors.multiple(
          formatQty(error.lotQty),
          josa(formatQty(error.lotQty), '은/는'),
          formatQty(error.qtyPerPackage),
        );
    }
  };

  /* 시안처럼 칸을 하나도 건드리지 않은 빈 추가 창에는 오류 줄을 세우지 않는다(잠금은 한다). */
  const touched = row !== null || draft.supplierId !== '' || draft.lotQty !== '';
  const problemText = problem === null || !touched ? null : errorText(problem);

  const update = (patch: Partial<DefaultDraft>): void => {
    save.reset();
    setDraft((prev) => ({ ...prev, ...patch }));
  };

  const submit = (): void => {
    if (problem !== null) return;
    if (row === null) save.write({ mode: 'create', body: toCreateBody(draft, plantId) });
    else
      save.write({
        mode: 'update',
        id: row.supplierItemDefaultId,
        body: toUpdateBody(draft, row.versionNo),
      });
  };

  const serverBanner = (() => {
    const error = save.error;
    if (error === null) return null;
    if (hasErrorCode(error, 'DUPLICATE')) {
      return <AlertBanner variant="error">{t.errors.duplicateServer}</AlertBanner>;
    }
    if (hasErrorCode(error, 'VERSION_CONFLICT') || error.kind === 'conflict') {
      return (
        <AlertBanner
          variant="error"
          action={
            <Button variant="outlined" size="sm" onClick={onReload}>
              {t.errors.reload}
            </Button>
          }
        >
          {t.errors.conflict}
        </AlertBanner>
      );
    }
    if (hasErrorCode(error, 'INVALID')) {
      return <AlertBanner variant="error">{t.errors.invalid}</AlertBanner>;
    }
    return <SaveErrorBanner error={error} />;
  })();

  const storageNote = (() => {
    if (itemId === null || storage.isPending) return null;
    const unit = storage.data ?? null;
    if (unit === null) return td.storageNone;
    const name = uomNameOf(unit.uomId);
    return unit.qtyPerPackage === null
      ? td.storageUnitOnly(name)
      : td.storage(name, formatQty(unit.qtyPerPackage), baseUomCode);
  })();

  const hasPackage = draft.packageUomId !== '';
  const packageOptions = [
    { value: '', label: td.noPackage },
    ...(uoms.data ?? [])
      .filter((uom) => uom.uomCode !== baseUomCode)
      .map((uom) => ({ value: String(uom.uomId), label: uomNameOf(uom.uomId) })),
  ];

  const lot = parseQtyInput(draft.lotQty);
  const per = parseQtyInput(draft.qtyPerPackage);
  const count = hasPackage && lot !== null && per !== null ? packageCountOf(lot, per) : null;
  const countNote =
    problem === null && count !== null
      ? td.countOf(uomNameOf(Number(draft.packageUomId)), formatQty(count))
      : undefined;

  return (
    <Dialog
      open
      onClose={onClose}
      title={row === null ? td.addTitle : td.editTitle}
      size="md"
      footer={
        <>
          <span className="field-note supplier-item-default-foot-hint">{td.footHint}</span>
          <Button variant="outlined" onClick={onClose}>
            {td.cancel}
          </Button>
          <Button
            disabled={problem !== null}
            aria-describedby={problemText === null ? undefined : errorId}
            loading={save.isSaving}
            onClick={submit}
          >
            {td.save}
          </Button>
        </>
      }
    >
      <div className="supplier-item-default-form">
        {serverBanner}
        {row === null ? (
          <>
            <Field label={td.supplier} required>
              {(ids) => (
                <PartnerSelect
                  id={ids.controlId}
                  roleTypeCode={SUPPLIER_ROLE}
                  placeholder={td.pick}
                  value={draft.supplierId === '' ? null : draft.supplierId}
                  onChange={(value) => update({ supplierId: value })}
                />
              )}
            </Field>
            <Field label={td.item} required>
              {(ids) => (
                <ItemSelect
                  id={ids.controlId}
                  placeholder={td.pick}
                  value={itemId === null ? null : draft.itemId}
                  onChange={(value) => {
                    update({ itemId: value });
                    setRefillFor(value);
                  }}
                  onItemChange={(item) => setBaseUomId(item.baseUomId)}
                />
              )}
            </Field>
          </>
        ) : (
          <dl className="supplier-item-default-head">
            <dt>{td.supplier}</dt>
            <dd>
              {row.supplierName}{' '}
              <span className="supplier-item-default-code">{row.supplierCode}</span>
            </dd>
            <dt>{td.item}</dt>
            <dd>
              <span className="supplier-item-default-code">{row.itemCode}</span> {row.itemName}
            </dd>
          </dl>
        )}
        <dl className="supplier-item-default-head">
          <dt>{td.baseUom}</dt>
          <dd>
            {baseUomCode === '' ? t.values.none : baseUomCode}
            {storageNote === null ? null : (
              <span className="field-note supplier-item-default-storage">{storageNote}</span>
            )}
          </dd>
        </dl>
        <Field label={td.packageUom}>
          {(ids) => (
            <Select
              id={ids.controlId}
              options={packageOptions}
              value={draft.packageUomId}
              onChange={(value) =>
                update(
                  value === '' ? { packageUomId: '', qtyPerPackage: '' } : { packageUomId: value },
                )
              }
            />
          )}
        </Field>
        <TextField
          label={td.qtyPerPackage}
          inputMode="decimal"
          value={draft.qtyPerPackage}
          disabled={!hasPackage}
          helperText={td.qtyPerPackageHelp(baseUomCode)}
          aria-invalid={problem?.kind === 'qtyPerPackage' && touched}
          onChange={(event) => update({ qtyPerPackage: event.target.value })}
        />
        {/* 시안처럼 「[1,000] EA = 봉지 10개」를 한 줄에 — 도움말 자리에 두면 칸 아래로 내려간다(G2 L18). */}
        <div className="supplier-item-default-qty-row">
          <TextField
            label={td.lotQty}
            required
            inputMode="decimal"
            value={draft.lotQty}
            containerClassName="supplier-item-default-qty-field"
            aria-invalid={
              problem?.kind === 'multiple' || (problem?.kind === 'lotQty' && draft.lotQty !== '')
            }
            onChange={(event) => update({ lotQty: event.target.value })}
          />
          <span className="supplier-item-default-qty-after">
            {baseUomCode}
            {countNote === undefined ? null : (
              <span className="supplier-item-default-qty-count">{countNote}</span>
            )}
          </span>
        </div>
        <TextField
          label={td.remarks}
          value={draft.remarks}
          onChange={(event) => update({ remarks: event.target.value })}
        />
        {/* 오류 줄 자리는 늘 둔다 — 나타나고 사라질 때 창 높이가 흔들리지 않게(G2 L18). */}
        <p id={errorId} className="field-error supplier-item-default-error" role="alert">
          {problemText ?? ''}
        </p>
        {row === null ? null : <p className="field-note">{td.unchanged}</p>}
      </div>
    </Dialog>
  );
};
