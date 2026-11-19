import type { MaterialLotSummary, WaitingMaterialLotGroup } from '@omf-mes/api-client';
import { createIdempotencyKey } from '@omf-mes/api-client';
import { messages } from '@omf-mes/i18n';
import { useId, useState } from 'react';

import { useApiClient } from '../../patterns/api-context';
import {
  checkBatch,
  isIntegerUom,
  lotNoPattern,
  prefillBatch,
  toBatchBody,
  useItemStorageUnit,
  useSupplierItemDefault,
  useUomOptions,
  type BatchDraft,
  type BatchPrefill,
} from '../../patterns/material-lot-batch';
import { formatBaseQty, formatPackage } from '../../patterns/package-qty';
import { plantToday } from '../../patterns/plant-time';
import { PuButton, PuDialog, PuField, PuInput, PuNote, PuUnit } from '../../patterns/pop-uniform';
import { toApiError } from '../../patterns/request';
import { serverReasonOf } from '../../patterns/server-reason';
import { Select } from '../../patterns/select';
import { createMaterialLotBatch } from './mutations';

const t = messages.popMaterialLotLabel.batch;

export interface BatchDialogProps {
  plantId: number;
  workerNo: string;
  group: WaitingMaterialLotGroup;
  onClose: () => void;
  /** 만든 LOT — 화면이 고른 채로 둔다. */
  onCreated: (lots: MaterialLotSummary[]) => void;
}

/**
 * **자재 관리 LOT 만들기**(screens/P-01-01.md 「창」 · FR-002·003 · US1-1·US1-3·US1-5).
 *
 * ⭐ 칸 · 규칙 · 채우기 · 본문은 관리웹 W-01-14 발행 창과 같다(`patterns/material-lot-batch`). 이 창은 POP 손 크기로
 *    그릴 뿐이다.
 * ⭐ 기본값을 다 읽은 뒤에 칸을 채운다 — 읽는 중에 사람이 넣은 값을 기본값이 덮지 않게, 채우기는 한 번뿐이다.
 */
export const BatchDialog = (props: BatchDialogProps) => {
  const { plantId, group } = props;
  const target = { plantId, supplierId: group.supplierId, itemId: group.itemId };
  const defaults = useSupplierItemDefault(target);
  const storage = useItemStorageUnit(group.itemId);
  const uoms = useUomOptions();
  /* 기본값을 못 읽었으면 직접 입력으로 연다 — 막지 않는다. */
  const isLoading = defaults.isPending || (storage.isPending && !storage.isError);

  /* POP 팝업은 바깥을 눌러 닫히지 않는다(#1005) — 공통 창(`PuDialog`)도 바깥 누름으로 닫지 않는다. */
  if (isLoading) {
    return (
      <PuDialog
        title={t.title}
        wide
        onClose={props.onClose}
        footer={
          <>
            <PuButton onClick={props.onClose}>{t.cancel}</PuButton>
            <PuButton variant="primary" disabled>
              {t.submitIdle}
            </PuButton>
          </>
        }
      >
        <p className="pu-help">{t.loading}</p>
      </PuDialog>
    );
  }

  return (
    <BatchForm
      {...props}
      prefill={prefillBatch(defaults.data ?? null, storage.data ?? null)}
      defaultsFailed={defaults.isError}
      uoms={uoms.data ?? []}
    />
  );
};

interface BatchFormProps extends BatchDialogProps {
  prefill: BatchPrefill;
  defaultsFailed: boolean;
  uoms: NonNullable<ReturnType<typeof useUomOptions>['data']>;
}

const BatchForm = ({
  plantId,
  workerNo,
  group,
  onClose,
  onCreated,
  prefill,
  defaultsFailed,
  uoms,
}: BatchFormProps) => {
  const { client } = useApiClient();
  const idBase = useId();
  const fieldId = (name: string): string => `${idBase}-${name}`;
  const [draft, setDraft] = useState<BatchDraft>(prefill.draft);
  /* 창 하나에 키 하나 — 통신이 끊긴 뒤 다시 눌러도 묶음이 둘 생기지 않는다. */
  const [idempotencyKey] = useState(createIdempotencyKey);
  const [isSaving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const uomCode = group.uomCode;
  const check = checkBatch(draft, isIntegerUom(uoms, uomCode));
  const shownLotQty =
    draft.packageOn && !draft.lotQtyEdited && check.product !== null
      ? String(check.product)
      : draft.lotQty;
  const packageUom = uoms.find((row) => row.uomId === draft.packageUomId);
  const packageUomCode = packageUom?.uomCode ?? '';
  const update = (patch: Partial<BatchDraft>): void => {
    setDraft((previous) => ({ ...previous, ...patch }));
    setError(null);
  };

  const submit = async (): Promise<void> => {
    const body = toBatchBody(check, {
      plantId,
      supplierId: group.supplierId,
      itemId: group.itemId,
    });

    if (body === null || isSaving) return;

    setSaving(true);
    try {
      const created = await createMaterialLotBatch(client, body, workerNo, idempotencyKey);

      onCreated(created.lots);
    } catch (cause) {
      setError(serverReasonOf(toApiError(cause)) ?? t.failed);
    } finally {
      setSaving(false);
    }
  };

  const errors = check.errors;
  const lotQtyTouched = shownLotQty.trim() !== '';
  const lotQtyError =
    lotQtyTouched && errors.lotQty !== undefined
      ? errors.lotQty === 'integer'
        ? t.errors.integer(uomCode)
        : t.errors.lotQty
      : null;
  const packageError = draft.packageOn
    ? draft.packageCount !== '' && errors.packageCount !== undefined
      ? t.errors.packageCount
      : draft.qtyPerPackage !== '' && errors.qtyPerPackage !== undefined
        ? t.errors.qtyPerPackage
        : null
    : null;
  const pkgText =
    check.package === null
      ? null
      : formatPackage({
          uomCode: packageUomCode,
          uomName: packageUom?.uomName ?? null,
          count: check.package.count,
          qtyPerPackage: check.package.qtyPerPackage,
        });
  const calcLine =
    pkgText === null || check.product === null
      ? null
      : errors.mismatch === true && check.lotQty !== null
        ? {
            ok: false,
            text: t.errors.mismatch(
              formatBaseQty(check.lotQty, uomCode),
              `${pkgText} = ${formatBaseQty(check.product, uomCode)}`,
            ),
          }
        : { ok: true, text: `${pkgText} = ${formatBaseQty(check.product, uomCode)}` };
  const sourceNote =
    prefill.source === 'default'
      ? prefill.defaultWithoutPackage && !draft.packageOn
        ? t.sourceNote.defaultWithoutPackage
        : null
      : prefill.source === 'itemStorage'
        ? draft.packageOn
          ? null
          : t.sourceNote.itemStorage
        : draft.packageOn
          ? null
          : t.sourceNote.none;

  return (
    <PuDialog
      title={t.title}
      wide
      onClose={onClose}
      footer={
        <>
          <PuButton onClick={onClose}>{t.cancel}</PuButton>
          <PuButton
            variant="primary"
            icon="plus"
            disabled={!check.ok || isSaving}
            onClick={() => {
              void submit();
            }}
          >
            {check.ok && check.lotCount !== null ? t.submit(check.lotCount) : t.submitIdle}
          </PuButton>
        </>
      }
    >
      <div className="mll-batch">
        {defaultsFailed ? <PuNote tone="warn">{t.defaultsFailed}</PuNote> : null}
        {error === null ? null : <PuNote tone="bad">{error}</PuNote>}

        <div className="mll-batch-pair">
          <span className="pu-label">{t.pair}</span>
          <span>
            {group.supplierName} <span className="mll-dim">{group.supplierCode}</span>
            {' · '}
            <b>{group.itemCode}</b> {group.itemName}
          </span>
          <span className="pu-chip mll-batch-source" data-source={prefill.source}>
            {t.source[prefill.source]}
          </span>
        </div>

        <section className="mll-batch-package" aria-label={t.package}>
          <div className="mll-batch-package-top">
            <span className="pu-label">
              {t.package} <span className="opt">{t.optional}</span>
            </span>
            <div className="mll-switch" role="group" aria-label={t.package}>
              <button
                type="button"
                aria-pressed={draft.packageOn}
                onClick={() => {
                  update({ packageOn: true });
                }}
              >
                {t.packageOn}
              </button>
              <button
                type="button"
                aria-pressed={!draft.packageOn}
                onClick={() => {
                  update({ packageOn: false, lotQtyEdited: true, lotQty: shownLotQty });
                }}
              >
                {t.packageOff}
              </button>
            </div>
          </div>
          {draft.packageOn ? (
            <div className="mll-batch-grid">
              <PuField label={t.packageUom} required>
                <Select
                  aria-label={t.packageUom}
                  placeholder={t.packageUomPlaceholder}
                  value={draft.packageUomId === null ? null : String(draft.packageUomId)}
                  options={uoms
                    .filter((row) => row.uomCode !== uomCode)
                    /* 패키징 단위는 이름(「봉지」)으로 — 이름이 비면 코드(G2 L17). */
                    .map((row) => ({
                      value: String(row.uomId),
                      label: row.uomName.trim() === '' ? row.uomCode : row.uomName,
                    }))}
                  onChange={(value) => {
                    update({ packageUomId: Number(value) });
                  }}
                />
              </PuField>
              <PuField label={t.packageCount} required htmlFor={fieldId('count')}>
                <PuInput
                  id={fieldId('count')}
                  inputMode="numeric"
                  numeric
                  need={draft.packageCount === ''}
                  value={draft.packageCount}
                  onChange={(event) => {
                    update({ packageCount: event.target.value });
                  }}
                />
              </PuField>
              <PuField label={t.qtyPerPackage(uomCode)} required htmlFor={fieldId('per')}>
                <PuInput
                  id={fieldId('per')}
                  inputMode="decimal"
                  numeric
                  need={draft.qtyPerPackage === ''}
                  value={draft.qtyPerPackage}
                  onChange={(event) => {
                    update({ qtyPerPackage: event.target.value });
                  }}
                />
              </PuField>
            </div>
          ) : null}
          {sourceNote === null ? null : <p className="pu-help">{sourceNote}</p>}
          {packageError === null ? null : (
            <p className="mll-batch-calc" data-ok="false" role="alert">
              {packageError}
            </p>
          )}
        </section>

        <div className="mll-batch-grid">
          <PuField label={t.lotQty} required htmlFor={fieldId('lotQty')}>
            <div className="pu-row">
              <PuInput
                id={fieldId('lotQty')}
                placeholder={t.lotQtyPlaceholder}
                inputMode="decimal"
                numeric
                need={shownLotQty.trim() === ''}
                aria-invalid={lotQtyError === null ? undefined : true}
                value={shownLotQty}
                onChange={(event) => {
                  update({ lotQty: event.target.value, lotQtyEdited: event.target.value !== '' });
                }}
              />
              <span title={t.unitLocked}>
                <PuUnit>{uomCode}</PuUnit>
              </span>
            </div>
            {lotQtyError === null ? null : (
              <p className="mll-batch-calc" data-ok="false" role="alert">
                {lotQtyError}
              </p>
            )}
            <p className="pu-help">
              {draft.packageOn ? t.lotQtyHelpPackaged(uomCode) : t.lotQtyHelp(uomCode)}
            </p>
            {calcLine === null ? null : (
              <p
                className="mll-batch-calc"
                data-ok={calcLine.ok}
                role={calcLine.ok ? undefined : 'alert'}
              >
                {calcLine.text}
              </p>
            )}
          </PuField>
          <PuField label={t.supplierLot} optional={t.optional} htmlFor={fieldId('supplierLot')}>
            <PuInput
              id={fieldId('supplierLot')}
              placeholder={t.supplierLotPlaceholder}
              value={draft.supplierLotNo}
              onChange={(event) => {
                update({ supplierLotNo: event.target.value });
              }}
            />
            <p className="pu-help">{t.supplierLotHelp}</p>
          </PuField>
          <PuField label={t.lotCount} required htmlFor={fieldId('lotCount')}>
            <div className="pu-row">
              <PuInput
                id={fieldId('lotCount')}
                placeholder="1~200"
                inputMode="numeric"
                numeric
                need={draft.lotCount === ''}
                value={draft.lotCount}
                onChange={(event) => {
                  update({ lotCount: event.target.value });
                }}
              />
              <PuUnit>{t.lotCountUnit}</PuUnit>
            </div>
            {draft.lotCount !== '' && errors.lotCount !== undefined ? (
              <p className="mll-batch-calc" data-ok="false" role="alert">
                {t.errors.lotCount}
              </p>
            ) : null}
            <p className="pu-help">{t.lotCountHelp}</p>
          </PuField>
        </div>

        <p className="mll-batch-summary" aria-live="polite">
          {check.ok && check.lotQty !== null && check.lotCount !== null ? (
            <>
              <b>
                {t.summary(
                  check.lotCount,
                  pkgText === null
                    ? formatBaseQty(check.lotQty, uomCode)
                    : `${formatBaseQty(check.lotQty, uomCode)} (${pkgText})`,
                  formatBaseQty(check.lotQty * check.lotCount, uomCode),
                )}
                {check.supplierLotNo === null ? '' : t.summarySupplierLot(check.supplierLotNo)}
              </b>
              <br />
              {t.summaryNote(
                lotNoPattern(group.itemCode, check.lotQty, group.supplierCode, plantToday()),
              )}
            </>
          ) : (
            t.summaryEmpty
          )}
        </p>
      </div>
    </PuDialog>
  );
};
