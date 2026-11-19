import type { MaterialLotSummary, WaitingMaterialLotGroup } from '@omf-mes/api-client';
import { createIdempotencyKey } from '@omf-mes/api-client';
import { messages } from '@omf-mes/i18n';
import { useId, useState } from 'react';

import { useApiClient } from '../../patterns/api-context';
import {
  checkBatch,
  isIntegerUom,
  prefillBatch,
  toBatchBody,
  useItemStorageUnit,
  useSupplierItemDefault,
  useUomOptions,
  type BatchDraft,
  type BatchPrefill,
} from '../../patterns/material-lot-batch';
import { formatBaseQty, formatPackage } from '../../patterns/package-qty';
import {
  PuButton,
  PuDialog,
  PuField,
  PuInput,
  PuKeypad,
  PuNote,
  PuUnit,
  applyKeypadKey,
  type PuKey,
} from '../../patterns/pop-uniform';
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
type KeypadTarget = 'count' | 'per' | 'lotQty' | 'lotCount';

/** 처음 키패드가 잡을 칸 — 비어 있는 첫 숫자 칸(포장이 꺼져 있으면 포장 칸은 건너뛴다). */
const firstEmptyTarget = (draft: BatchDraft): KeypadTarget => {
  if (draft.packageOn && draft.packageCount === '') return 'count';
  if (draft.packageOn && draft.qtyPerPackage === '') return 'per';
  if (!draft.packageOn && draft.lotQty === '') return 'lotQty';
  return 'lotCount';
};

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
  const isCountUom = isIntegerUom(uoms, uomCode);
  const check = checkBatch(draft, isCountUom);
  /* kg 같은 개수 아닌 단위는 「수량」 대신 「양」(사용자 지시 2026-11-19). */
  const lotQtyLabel = isCountUom ? t.lotQty : t.lotQtyAmount;
  const perLabel = isCountUom ? t.qtyPerPackage(uomCode) : t.qtyPerPackageAmount(uomCode);
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

  /*
   * 오른쪽 키패드(POP 통일 규칙 8) — 누른 숫자 칸에 들어간다. 손가락으로 칸에 직접 쳐도 같은 값이 된다.
   * 처음에는 비어 있는 첫 숫자 칸을 잡는다. 공급사 LOT 번호는 글자 칸이라 키패드 대상이 아니다.
   */
  const [target, setTarget] = useState<KeypadTarget>(() => firstEmptyTarget(prefill.draft));
  const activeTarget: KeypadTarget =
    !draft.packageOn && (target === 'count' || target === 'per') ? 'lotQty' : target;
  const targetValue: Record<KeypadTarget, string> = {
    count: draft.packageCount,
    per: draft.qtyPerPackage,
    lotQty: shownLotQty,
    lotCount: draft.lotCount,
  };
  const setTargetValue = (next: string): void => {
    if (activeTarget === 'count') update({ packageCount: next });
    else if (activeTarget === 'per') update({ qtyPerPackage: next });
    else if (activeTarget === 'lotQty') update({ lotQty: next, lotQtyEdited: next !== '' });
    else update({ lotCount: next });
  };
  const targetLabel: Record<KeypadTarget, string> = {
    count: t.packageCount,
    per: perLabel,
    lotQty: lotQtyLabel,
    lotCount: t.lotCount,
  };
  /* 정수 칸(포장 수 · 개수)은 「.」을 끈다 — 손으로 칠 때의 `inputMode` 와 같다. */
  const decimalTarget = activeTarget === 'per' || activeTarget === 'lotQty';
  const onKey = (key: PuKey): void => {
    setTargetValue(applyKeypadKey(targetValue[activeTarget], key, { decimal: decimalTarget }));
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
        : isCountUom
          ? t.errors.lotQty
          : t.errors.lotQtyAmount
      : null;
  const packageError = draft.packageOn
    ? draft.packageCount !== '' && errors.packageCount !== undefined
      ? t.errors.packageCount
      : draft.qtyPerPackage !== '' && errors.qtyPerPackage !== undefined
        ? isCountUom
          ? t.errors.qtyPerPackage
          : t.errors.qtyPerPackageAmount
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
            text: (isCountUom ? t.errors.mismatch : t.errors.mismatchAmount)(
              formatBaseQty(check.lotQty, uomCode),
              `${pkgText} = ${formatBaseQty(check.product, uomCode)}`,
            ),
          }
        : { ok: true, text: `${pkgText} = ${formatBaseQty(check.product, uomCode)}` };
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
      <div className="mll-batch-wrap">
        <div className="mll-batch">
          {defaultsFailed ? <PuNote tone="warn">{t.defaultsFailed}</PuNote> : null}
          {error === null ? null : <PuNote tone="bad">{error}</PuNote>}

          <div className="mll-batch-pair">
            <div>
              <span className="pu-label">{t.supplier}</span>
              <span className="mll-batch-pair-value">
                {group.supplierName} <span className="mll-dim">{group.supplierCode}</span>
              </span>
            </div>
            <div>
              <span className="pu-label">{t.item}</span>
              <span className="mll-batch-pair-value">
                <b>{group.itemCode}</b> {group.itemName}
              </span>
            </div>
          </div>
          <div>
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
            <div className="mll-batch-grid">
              {/* 「포장 없음」이면 칸은 보이되 흐리게·입력 불가(사용자 지시 2026-11-19) — 보내는 값은 그대로 포장 없음. */}
              <PuField label={t.packageUom} required>
                <Select
                  disabled={!draft.packageOn}
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
                  disabled={!draft.packageOn}
                  id={fieldId('count')}
                  target={activeTarget === 'count'}
                  onFocus={() => {
                    setTarget('count');
                  }}
                  inputMode="numeric"
                  numeric
                  need={draft.packageOn && draft.packageCount === ''}
                  value={draft.packageCount}
                  onChange={(event) => {
                    update({ packageCount: event.target.value });
                  }}
                />
              </PuField>
              <PuField label={perLabel} required htmlFor={fieldId('per')}>
                <PuInput
                  disabled={!draft.packageOn}
                  id={fieldId('per')}
                  target={activeTarget === 'per'}
                  onFocus={() => {
                    setTarget('per');
                  }}
                  inputMode="decimal"
                  numeric
                  need={draft.packageOn && draft.qtyPerPackage === ''}
                  value={draft.qtyPerPackage}
                  onChange={(event) => {
                    update({ qtyPerPackage: event.target.value });
                  }}
                />
              </PuField>
            </div>
            {packageError === null ? null : (
              <p className="mll-batch-calc" data-ok="false" role="alert">
                {packageError}
              </p>
            )}
          </section>

          <div className="mll-batch-grid">
            <PuField label={lotQtyLabel} required htmlFor={fieldId('lotQty')}>
              <div className="pu-row">
                <PuInput
                  id={fieldId('lotQty')}
                  target={activeTarget === 'lotQty'}
                  onFocus={() => {
                    setTarget('lotQty');
                  }}
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
                value={draft.supplierLotNo}
                onChange={(event) => {
                  update({ supplierLotNo: event.target.value });
                }}
              />
            </PuField>
            <PuField label={t.lotCount} required htmlFor={fieldId('lotCount')}>
              <div className="pu-row">
                <PuInput
                  id={fieldId('lotCount')}
                  target={activeTarget === 'lotCount'}
                  onFocus={() => {
                    setTarget('lotCount');
                  }}
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
            </PuField>
          </div>

          {check.ok && check.lotQty !== null && check.lotCount !== null ? (
            <p className="mll-batch-summary" aria-live="polite">
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
            </p>
          ) : null}
        </div>
        <div className="mll-batch-keypad">
          <PuKeypad
            targetLabel={targetLabel[activeTarget]}
            decimal={decimalTarget}
            disabled={isSaving}
            onKey={onKey}
            onClearAll={() => {
              setTargetValue('');
            }}
          />
        </div>
      </div>
    </PuDialog>
  );
};
