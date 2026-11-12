import { AlertBanner, Button, Dialog, TextField } from '@crefle/web-ui';
import type { MaterialLotSummary, WaitingMaterialLotGroup } from '@omf-mes/api-client';
import { createIdempotencyKey } from '@omf-mes/api-client';
import { messages } from '@omf-mes/i18n';
import { useState } from 'react';

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
import { popTouchClass } from '../../patterns/pop-touch';
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

  return (
    <Dialog
      open
      /* POP 팝업은 바깥을 눌러 닫히지 않는다(#1005) — 장갑 낀 손이 창 밖을 스치면 사라졌다. */
      closeOnBackdropClick={false}
      onClose={props.onClose}
      title={t.title}
      size="lg"
      className="pop-mlot-batch-dialog"
    >
      {isLoading ? (
        <p className="pop-mlot-empty">{t.loading}</p>
      ) : (
        <BatchForm
          {...props}
          prefill={prefillBatch(defaults.data ?? null, storage.data ?? null)}
          defaultsFailed={defaults.isError}
          uoms={uoms.data ?? []}
        />
      )}
    </Dialog>
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
  const packageUomCode = uoms.find((row) => row.uomId === draft.packageUomId)?.uomCode ?? '';
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
    <div className="pop-mlot-batch">
      {defaultsFailed ? <AlertBanner variant="warning">{t.defaultsFailed}</AlertBanner> : null}
      {error === null ? null : <AlertBanner variant="error">{error}</AlertBanner>}

      <dl className="pop-mlot-batch-pair">
        <dt>{t.pair}</dt>
        <dd>
          {group.supplierName} <span className="pop-mlot-dim">{group.supplierCode}</span>
          <br />
          <strong>{group.itemCode}</strong> {group.itemName}
        </dd>
      </dl>
      <span className="pop-mlot-source" data-source={prefill.source}>
        {t.source[prefill.source]}
      </span>

      <section className="pop-mlot-package" aria-label={t.package}>
        <div className="pop-mlot-package-top">
          <strong>
            {t.package} <span className="pop-mlot-dim">{t.optional}</span>
          </strong>
          <div className="pop-mlot-switch" role="group" aria-label={t.package}>
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
          <div className="pop-mlot-package-fields">
            <Select
              aria-label={t.packageUom}
              placeholder={t.packageUomPlaceholder}
              value={draft.packageUomId === null ? null : String(draft.packageUomId)}
              options={uoms
                .filter((row) => row.uomCode !== uomCode)
                .map((row) => ({ value: String(row.uomId), label: row.uomCode }))}
              onChange={(value) => {
                update({ packageUomId: Number(value) });
              }}
            />
            <TextField
              label={t.packageCount}
              inputMode="numeric"
              value={draft.packageCount}
              onChange={(event) => {
                update({ packageCount: event.target.value });
              }}
            />
            <TextField
              label={t.qtyPerPackage(uomCode)}
              inputMode="decimal"
              value={draft.qtyPerPackage}
              onChange={(event) => {
                update({ qtyPerPackage: event.target.value });
              }}
            />
          </div>
        ) : null}
        {sourceNote === null ? null : <p className="pop-mlot-hint">{sourceNote}</p>}
        {packageError === null ? null : (
          <p className="pop-mlot-calc" data-ok="false" role="alert">
            {packageError}
          </p>
        )}
      </section>

      <div className="pop-mlot-batch-grid">
        <div className="pop-mlot-batch-field">
          <div className="pop-mlot-inrow">
            <TextField
              label={t.lotQty}
              placeholder={t.lotQtyPlaceholder}
              inputMode="decimal"
              value={shownLotQty}
              error={lotQtyError ?? undefined}
              onChange={(event) => {
                update({ lotQty: event.target.value, lotQtyEdited: event.target.value !== '' });
              }}
            />
            <span className="pop-mlot-unitfix" title={t.unitLocked}>
              {uomCode}
            </span>
          </div>
          <p className="pop-mlot-hint">
            {draft.packageOn ? t.lotQtyHelpPackaged(uomCode) : t.lotQtyHelp(uomCode)}
          </p>
          {calcLine === null ? null : (
            <p
              className="pop-mlot-calc"
              data-ok={calcLine.ok}
              role={calcLine.ok ? undefined : 'alert'}
            >
              {calcLine.text}
            </p>
          )}
        </div>
        <div className="pop-mlot-batch-field">
          <TextField
            label={`${t.supplierLot} ${t.optional}`}
            placeholder={t.supplierLotPlaceholder}
            value={draft.supplierLotNo}
            onChange={(event) => {
              update({ supplierLotNo: event.target.value });
            }}
          />
          <p className="pop-mlot-hint">{t.supplierLotHelp}</p>
        </div>
        <div className="pop-mlot-batch-field">
          <div className="pop-mlot-inrow">
            <TextField
              label={t.lotCount}
              placeholder="1~200"
              inputMode="numeric"
              value={draft.lotCount}
              error={
                draft.lotCount !== '' && errors.lotCount !== undefined
                  ? t.errors.lotCount
                  : undefined
              }
              onChange={(event) => {
                update({ lotCount: event.target.value });
              }}
            />
            <span className="pop-mlot-unitfix">{t.lotCountUnit}</span>
          </div>
          <p className="pop-mlot-hint">{t.lotCountHelp}</p>
        </div>
      </div>

      <p className="pop-mlot-summary" aria-live="polite">
        {check.ok && check.lotQty !== null && check.lotCount !== null ? (
          <>
            <strong>
              {t.summary(
                check.lotCount,
                pkgText === null
                  ? formatBaseQty(check.lotQty, uomCode)
                  : `${formatBaseQty(check.lotQty, uomCode)} (${pkgText})`,
                formatBaseQty(check.lotQty * check.lotCount, uomCode),
              )}
              {check.supplierLotNo === null ? '' : t.summarySupplierLot(check.supplierLotNo)}
            </strong>
            <br />
            {t.summaryNote(
              lotNoPattern(group.itemCode, check.lotQty, group.supplierCode, plantToday()),
            )}
          </>
        ) : (
          t.summaryEmpty
        )}
      </p>

      <div className="pop-mlot-batch-foot">
        <Button className={popTouchClass('normal')} variant="outlined" size="xl" onClick={onClose}>
          {t.cancel}
        </Button>
        <Button
          className={popTouchClass('primary')}
          size="xl"
          disabled={!check.ok}
          loading={isSaving}
          onClick={() => {
            void submit();
          }}
        >
          {check.ok && check.lotCount !== null ? t.submit(check.lotCount) : t.submitIdle}
        </Button>
      </div>
    </div>
  );
};
