import { createIdempotencyKey } from '@omf-mes/api-client';
import { messages } from '@omf-mes/i18n';
import { useId, useState } from 'react';

import { useApiClient } from '../../patterns/api-context';
import { isIntegerUom, useUomOptions, type BatchDraft } from '../../patterns/material-lot-batch';
import {
  checkRevise,
  lotNoAfterRevise,
  reviseDraftOf,
  reviseMaterialLot,
  reviseRejectionOf,
  toReviseBody,
  type ReviseRejection,
} from '../../patterns/material-lot-revise';
import { formatBaseQty, formatPackage } from '../../patterns/package-qty';
import { PopSelect } from '../../patterns/pop-select';
import {
  PuButton,
  PuChip,
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
import type { LabelLot } from './types';

const t = messages.popMaterialLotLabel.precreate.revise;
const tp = messages.popMaterialLotLabel.precreate;

type Target = 'qty' | 'count' | 'per';

export interface ReviseDialogProps {
  lot: LabelLot;
  workerNo: string;
  onClose: () => void;
  /** 저장됨 — 새 번호를 알린다. */
  onSaved: (lotNo: string) => void;
  /** 409 로 거절됨(이미 출력 · 상태 잠김) — 화면이 알리고 목록을 다시 받는다. */
  onRejected: (reason: Exclude<ReviseRejection, 'conflict' | 'other'>) => void;
}

/**
 * POP [수정] 창(피처 014 FR-016 · FR-017 · 시안 P0101 ⑤) — 미출력 LOT 의 재고량 · 포장을 찍기 전에 고친다.
 * 칸 · 곱 검사는 [자재 관리 LOT 생성] 창과 같은 규칙(`patterns/material-lot-revise`). 오른쪽 키패드는 누른 숫자 칸에 들어간다.
 * ⭐ 수량이 바뀌면 번호를 새로 받는다 — 「지금 / 저장 뒤」 번호를 함께 보인다(일련은 서버가 매겨 `NNNN`).
 * ⭐ 멱등 키는 창 하나에 하나 — 끊긴 뒤 다시 눌러도 같은 쓰기다. POP 은 사번(`X-Worker-No`)을 싣는다.
 */
export const ReviseDialog = ({
  lot,
  workerNo,
  onClose,
  onSaved,
  onRejected,
}: ReviseDialogProps) => {
  const { client } = useApiClient();
  const idBase = useId();
  const uoms = useUomOptions();
  const [draft, setDraft] = useState<BatchDraft>(() => reviseDraftOf(lot, null));
  const [idempotencyKey] = useState(createIdempotencyKey);
  const [target, setTarget] = useState<Target>(lot.package === null ? 'qty' : 'count');
  const [isSaving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const uomCode = lot.uomCode;
  const integerOnly = isIntegerUom(uoms.data, uomCode);
  const check = checkRevise(draft, integerOnly);
  const shownQty =
    draft.packageOn && !draft.lotQtyEdited && check.product !== null
      ? String(check.product)
      : draft.lotQty;
  const packageUom = uoms.data?.find((row) => row.uomId === draft.packageUomId);
  const pkgText =
    check.package === null
      ? null
      : formatPackage({
          uomCode: packageUom?.uomCode ?? lot.package?.uomCode ?? '',
          uomName: packageUom?.uomName ?? lot.package?.uomName ?? null,
          count: check.package.count,
          qtyPerPackage: check.package.qtyPerPackage,
        });
  const calcText =
    pkgText === null || check.product === null
      ? null
      : `${pkgText} = ${formatBaseQty(check.product, uomCode)}`;
  const isMismatch = check.errors.mismatch === true;
  const otherError =
    !check.ok && !isMismatch && (shownQty.trim() !== '' || draft.packageCount !== '');
  const nextLotNo = lotNoAfterRevise(lot.lotNo, check.lotQty);
  const renumbers = nextLotNo !== null && nextLotNo !== lot.lotNo;

  const update = (patch: Partial<BatchDraft>): void => {
    setDraft((previous) => ({ ...previous, ...patch }));
    setError(null);
  };
  const activeTarget: Target = !draft.packageOn && target !== 'qty' ? 'qty' : target;
  const values: Record<Target, string> = {
    qty: shownQty,
    count: draft.packageCount,
    per: draft.qtyPerPackage,
  };
  const setValue = (next: string): void => {
    if (activeTarget === 'count') update({ packageCount: next, lotQtyEdited: false });
    else if (activeTarget === 'per') update({ qtyPerPackage: next, lotQtyEdited: false });
    else update({ lotQty: next, lotQtyEdited: next !== '' });
  };
  const labels: Record<Target, string> = {
    qty: t.qty,
    count: t.packageCount,
    per: t.qtyPerPackage,
  };

  const save = async (): Promise<void> => {
    const body = toReviseBody(check);

    if (body === null || isSaving) return;

    setSaving(true);
    try {
      const saved = await reviseMaterialLot(client, lot.lotId, body, { idempotencyKey, workerNo });

      onSaved(saved.lotNo);
    } catch (cause) {
      const apiError = toApiError(cause);
      const rejection = reviseRejectionOf(apiError);

      if (rejection === 'alreadyPrinted' || rejection === 'stateLocked') {
        onRejected(rejection);
      } else {
        setError(rejection === 'conflict' ? t.conflict : (serverReasonOf(apiError) ?? t.failed));
      }
    } finally {
      setSaving(false);
    }
  };

  const fieldId = (name: string): string => `${idBase}-${name}`;

  return (
    <PuDialog
      title={t.title}
      wide
      onClose={onClose}
      footer={
        <>
          <span className="mll-dim mll-revise-foot">{t.printedNote}</span>
          <PuButton onClick={onClose}>{t.cancel}</PuButton>
          <PuButton
            variant="primary"
            disabled={!check.ok || isSaving}
            onClick={() => {
              void save();
            }}
          >
            {t.save}
          </PuButton>
        </>
      }
    >
      <div className="mll-batch-wrap">
        <div className="mll-batch">
          {error === null ? null : <PuNote tone="bad">{error}</PuNote>}
          <dl className="pu-kv mll-revise-kv">
            <dt>{t.lotNo}</dt>
            <dd className="pu-mono">{lot.lotNo}</dd>
            <dt>{t.pair}</dt>
            <dd>
              {lot.supplierName} {lot.supplierCode} / {lot.itemCode} {lot.itemName}{' '}
              {/* P/O 라인은 POP 에 보이지 않는다(T058 · 사용자 2026-11-24) — 만든 방식 칩만. */}
              {lot.creationModeCode === undefined ? null : (
                <PuChip tone={lot.creationModeCode === 'AUTO' ? 'info' : 'idle'}>
                  {tp.mode[lot.creationModeCode]}
                </PuChip>
              )}
            </dd>
          </dl>

          <PuField label={t.qty} required htmlFor={fieldId('qty')}>
            <div className="pu-row">
              <PuInput
                id={fieldId('qty')}
                target={activeTarget === 'qty'}
                onFocus={() => {
                  setTarget('qty');
                }}
                inputMode="decimal"
                numeric
                value={shownQty}
                onChange={(event) => {
                  update({ lotQty: event.target.value, lotQtyEdited: event.target.value !== '' });
                }}
              />
              <PuUnit>{uomCode}</PuUnit>
            </div>
          </PuField>

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
                    update({ packageOn: true, lotQtyEdited: false });
                  }}
                >
                  {t.packageOn}
                </button>
                <button
                  type="button"
                  aria-pressed={!draft.packageOn}
                  onClick={() => {
                    update({ packageOn: false, lotQtyEdited: true, lotQty: shownQty });
                  }}
                >
                  {t.packageOff}
                </button>
              </div>
            </div>
            {draft.packageOn ? (
              <div className="mll-batch-grid">
                <PuField label={t.packageUom} required>
                  <PopSelect
                    aria-label={t.packageUom}
                    value={draft.packageUomId === null ? null : String(draft.packageUomId)}
                    options={(uoms.data ?? [])
                      .filter((row) => row.uomCode !== uomCode)
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
                    target={activeTarget === 'count'}
                    onFocus={() => {
                      setTarget('count');
                    }}
                    inputMode="numeric"
                    numeric
                    value={draft.packageCount}
                    onChange={(event) => {
                      update({ packageCount: event.target.value, lotQtyEdited: false });
                    }}
                  />
                </PuField>
                <PuField label={t.qtyPerPackage} required htmlFor={fieldId('per')}>
                  <div className="pu-row">
                    <PuInput
                      id={fieldId('per')}
                      target={activeTarget === 'per'}
                      onFocus={() => {
                        setTarget('per');
                      }}
                      inputMode="decimal"
                      numeric
                      value={draft.qtyPerPackage}
                      onChange={(event) => {
                        update({ qtyPerPackage: event.target.value, lotQtyEdited: false });
                      }}
                    />
                    <PuUnit>{uomCode}</PuUnit>
                  </div>
                </PuField>
              </div>
            ) : null}
          </section>

          {isMismatch && calcText !== null && check.lotQty !== null ? (
            <p className="mll-batch-calc" data-ok="false" role="alert">
              {t.mismatch(formatBaseQty(check.lotQty, uomCode), calcText)}
            </p>
          ) : calcText !== null && check.ok ? (
            <p className="mll-batch-calc" data-ok="true">
              {t.calcOk(calcText)}
            </p>
          ) : otherError ? (
            <p className="mll-batch-calc" data-ok="false" role="alert">
              {t.invalid}
            </p>
          ) : null}

          {renumbers ? (
            <PuNote>
              <b>{t.renumber}</b>
              <span className="mll-revise-numbers">
                <span>{t.now}</span>
                <span className="pu-mono">{lot.lotNo}</span>
                <span>{t.after}</span>
                <span className="pu-mono">{nextLotNo}</span>
              </span>
            </PuNote>
          ) : null}
        </div>
        <div className="mll-batch-keypad">
          <PuKeypad
            targetLabel={labels[activeTarget]}
            decimal={activeTarget !== 'count'}
            disabled={isSaving}
            onKey={(key: PuKey) => {
              setValue(
                applyKeypadKey(values[activeTarget], key, { decimal: activeTarget !== 'count' }),
              );
            }}
            onClearAll={() => {
              setValue('');
            }}
          />
        </div>
      </div>
    </PuDialog>
  );
};
