import { Button, Checkbox, Chip, Dialog, TextField } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useId, useState } from 'react';

import { SaveErrorBanner } from '../../patterns/master';
import { isIntegerUom, type BatchDraft, type UomOption } from '../../patterns/material-lot-batch';
import { materialLotKeys } from '../../patterns/material-lot-precreate';
import {
  checkRevise,
  lotNoAfterRevise,
  reviseDraftOf,
  reviseRejectionOf,
  toReviseBody,
} from '../../patterns/material-lot-revise';
import { formatBaseQty, formatPackage } from '../../patterns/package-qty';
import { Select } from '../../patterns/select';
import { useReviseLot } from './mutations';
import type { Group, Lot } from './types';

const tp = messages.materialLotIssue.precreate;
const t = tp.revise;
/** 칸 안 흐린 안내는 발행 창과 같은 글(사용자 지시 2026-11-26). */
const ph = messages.materialLotIssue.dialog.placeholders;

export interface ReviseDialogProps {
  group: Group;
  lot: Lot;
  uoms: readonly UomOption[] | undefined;
  onClose: () => void;
  /** 저장됨 — 새 번호. */
  onSaved: (lotNo: string) => void;
  /** 409 로 거절(이미 출력 · 상태 잠김) — 화면이 알린다. 목록은 이 창이 다시 받게 한다. */
  onRejected: (message: string) => void;
}

/**
 * W-01-14 [수정] 창(피처 014 FR-016 · FR-017 · 시안 W0114 W5) — POP 수정 창과 같은 규칙, 관리웹 발행 창의 칸 이름
 * (패키징 단위 · 패키징 수 · 패키징당 수량). 저장은 `POST /logistics/material-lots/{lotId}:revise`(사번 없음).
 */
export const ReviseDialog = ({
  group,
  lot,
  uoms,
  onClose,
  onSaved,
  onRejected,
}: ReviseDialogProps) => {
  const packageUomId = useId();
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState<BatchDraft>(() => reviseDraftOf(lot, null));
  const uomCode = group.uomCode;
  const check = checkRevise(draft, isIntegerUom(uoms, uomCode));
  const revise = useReviseLot((saved) => {
    onSaved(saved.lotNo);
  });
  const shownQty =
    draft.packageOn && !draft.lotQtyEdited && check.product !== null
      ? String(check.product)
      : draft.lotQty;
  const packageUom = uoms?.find((row) => row.uomId === draft.packageUomId);
  const pkgText =
    check.package === null
      ? null
      : formatPackage({
          uomCode: packageUom?.uomCode ?? lot.package?.uomCode ?? '',
          uomName: packageUom?.uomName ?? lot.package?.uomName ?? null,
          count: check.package.count,
          qtyPerPackage: check.package.qtyPerPackage,
        });
  const isMismatch = check.errors.mismatch === true;
  const nextLotNo = lotNoAfterRevise(lot.lotNo, check.lotQty);
  const renumbers = nextLotNo !== null && nextLotNo !== lot.lotNo;
  const rejection = revise.error === null ? null : reviseRejectionOf(revise.error);

  /* 409 이미 출력 · 상태 잠김 — 창을 닫고 알린 뒤 목록을 다시 받는다. */
  const locked = rejection === 'alreadyPrinted' || rejection === 'stateLocked' ? rejection : null;
  useEffect(() => {
    if (locked === null) return;
    void queryClient.invalidateQueries({ queryKey: materialLotKeys.all });
    onRejected(locked === 'alreadyPrinted' ? t.alreadyPrinted : t.stateLocked);
  }, [locked, onRejected, queryClient]);

  const edit = (patch: Partial<BatchDraft>): void => {
    revise.reset();
    setDraft((previous) => ({ ...previous, ...patch }));
  };

  const save = (): void => {
    const body = toReviseBody(check);
    if (body !== null) revise.write({ lotId: lot.lotId, body });
  };

  const packageUoms = (uoms ?? []).filter((row) => row.uomCode !== uomCode);

  return (
    <Dialog
      open
      onClose={onClose}
      title={t.title}
      size="lg"
      footer={
        <>
          <Button variant="outlined" onClick={onClose}>
            {t.cancel}
          </Button>
          <Button disabled={!check.ok} loading={revise.isSaving} onClick={save}>
            {t.save}
          </Button>
        </>
      }
    >
      <div className="mlot-issue-form">
        {revise.error !== null && rejection !== 'alreadyPrinted' && rejection !== 'stateLocked' && (
          <SaveErrorBanner error={revise.error} />
        )}
        {rejection === 'conflict' && <p className="field-note mlot-issue-bad">{t.conflict}</p>}
        <dl className="mlot-issue-facts">
          <dt>{t.lotNo}</dt>
          <dd className="mlot-issue-lot-no">{lot.lotNo}</dd>
          <dt>{t.po}</dt>
          <dd>
            {lot.purchaseOrderLine === null
              ? '—'
              : tp.poLine(lot.purchaseOrderLine.purchaseOrderNo, lot.purchaseOrderLine.lineNo)}{' '}
            <Chip size="sm" status={lot.creationModeCode === 'AUTO' ? 'info' : 'idle'}>
              {tp.mode[lot.creationModeCode]}
            </Chip>
          </dd>
        </dl>

        {/* 필수 칸(checkBatch lotQty)인데 * 가 없다 — 「(선택)」이 붙지 않게(#360). */}
        <TextField
          containerClassName="no-optional-mark"
          label={t.qty}
          placeholder={ph.lotQty}
          inputMode="decimal"
          value={shownQty}
          trailingIcon={<span title={t.qtyFixed}>{uomCode}</span>}
          onChange={(event) =>
            edit({ lotQty: event.target.value, lotQtyEdited: event.target.value !== '' })
          }
        />

        <section className="mlot-issue-package" aria-label={t.package}>
          <div className="mlot-issue-package-head">
            {/* 발행 창과 같이 「패키징 유무」 체크칸(사용자 지시 2026-11-26) — 켜고 끌 때 값 처리는 종전 단추와 같다. */}
            <span className="mlot-issue-package-title">
              <Checkbox
                checked={draft.packageOn}
                onChange={(event) =>
                  edit(
                    event.target.checked
                      ? { packageOn: true, lotQtyEdited: false }
                      : { packageOn: false, lotQtyEdited: true, lotQty: shownQty },
                  )
                }
              >
                <strong>{t.package}</strong>
              </Checkbox>
            </span>
          </div>
          {draft.packageOn ? (
            <div className="mlot-issue-package-fields">
              {/* 패키징 세 칸은 켜면 필수(checkBatch) — 「(선택)」이 붙지 않게(#360). */}
              <div className="field-cell no-optional-mark">
                <span className="field-label">
                  <label htmlFor={packageUomId}>{t.packageUom}</label>
                </span>
                <Select
                  id={packageUomId}
                  placeholder={ph.packageUom}
                  value={draft.packageUomId === null ? null : String(draft.packageUomId)}
                  options={packageUoms.map((row) => ({
                    value: String(row.uomId),
                    label: row.uomName.trim() === '' ? row.uomCode : row.uomName,
                  }))}
                  onChange={(value) => edit({ packageUomId: Number(value) })}
                />
              </div>
              <TextField
                containerClassName="no-optional-mark"
                label={t.packageCount}
                placeholder={ph.packageCount}
                inputMode="numeric"
                value={draft.packageCount}
                onChange={(event) =>
                  edit({ packageCount: event.target.value, lotQtyEdited: false })
                }
              />
              <TextField
                containerClassName="no-optional-mark"
                label={t.qtyPerPackage(uomCode)}
                placeholder={ph.qtyPerPackage}
                inputMode="decimal"
                value={draft.qtyPerPackage}
                onChange={(event) =>
                  edit({ qtyPerPackage: event.target.value, lotQtyEdited: false })
                }
              />
            </div>
          ) : null}
        </section>

        {isMismatch && pkgText !== null && check.product !== null && check.lotQty !== null ? (
          <p className="field-note mlot-issue-bad" role="alert">
            {t.mismatch(
              formatBaseQty(check.lotQty, uomCode),
              `${pkgText} = ${formatBaseQty(check.product, uomCode)}`,
            )}
          </p>
        ) : !check.ok && shownQty.trim() !== '' ? (
          <p className="field-note mlot-issue-bad" role="alert">
            {t.invalid}
          </p>
        ) : pkgText !== null && check.product !== null ? (
          <p className="field-note mlot-issue-ok">
            {`${pkgText} = ${formatBaseQty(check.product, uomCode)}`}
          </p>
        ) : null}

        {renumbers ? (
          <p className="field-note">
            <strong>{t.renumber}</strong> <span className="mlot-issue-lot-no">→ {nextLotNo}</span>
          </p>
        ) : null}
      </div>
    </Dialog>
  );
};
