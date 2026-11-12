import { AlertBanner, Button, Chip, Dialog, TextField } from '@crefle/web-ui';
import type { MaterialLotBatchCreated } from '@omf-mes/api-client';
import { messages } from '@omf-mes/i18n';
import { useId, useState } from 'react';

import { SaveErrorBanner } from '../../patterns/master';
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
  type BatchSource,
} from '../../patterns/material-lot-batch';
import { formatBaseQty, formatPackage } from '../../patterns/package-qty';
import { plantToday } from '../../patterns/plant-time';
import { Select } from '../../patterns/select';
import { useIssueBatch } from './mutations';
import { groupKey, type Group } from './types';

const t = messages.materialLotIssue;
const td = t.dialog;

export interface IssueDialogProps {
  plantId: number;
  /** 고를 수 있는 공급사·품목(목록 위 단추로 열 때). */
  groups: readonly Group[];
  /** 상세 창에서 열면 그 조합으로 고정. */
  fixed: Group | null;
  onClose: () => void;
  onIssued: (created: MaterialLotBatchCreated, group: Group) => void;
}

const SOURCE_STATUS: Record<BatchSource, 'success' | 'info' | 'idle'> = {
  default: 'success',
  itemStorage: 'info',
  none: 'idle',
};

/**
 * W-01-14 발행 창 — POP 「자재 관리 LOT 만들기」와 **같은 칸 · 같은 규칙**(screens/W-01-14.md 「발행 창」 · US1-8).
 * 채우기 · 검사 · 본문은 `patterns/material-lot-batch` 하나가 정한다. 라벨은 여기서 찍지 않는다(POP).
 */
export const IssueDialog = ({ plantId, groups, fixed, onClose, onIssued }: IssueDialogProps) => {
  const reasonId = useId();
  const [pickedKey, setPickedKey] = useState<string | null>(
    fixed !== null ? groupKey(fixed) : null,
  );
  const group = fixed ?? groups.find((candidate) => groupKey(candidate) === pickedKey) ?? null;
  const target =
    group === null ? null : { plantId, supplierId: group.supplierId, itemId: group.itemId };

  const defaults = useSupplierItemDefault(target);
  const storage = useItemStorageUnit(group?.itemId ?? null);
  const uoms = useUomOptions();

  /* 고른 조합의 기본값을 다 읽으면 그 조합으로 한 번 채운다 — 사람이 쓰는 중인 값을 다시 덮지 않는다. */
  const [filled, setFilled] = useState<{
    key: string;
    source: BatchSource;
    noPackage: boolean;
  } | null>(null);
  const [draft, setDraft] = useState<BatchDraft | null>(null);
  const key = group === null ? null : groupKey(group);
  const ready = group !== null && !defaults.isPending && !storage.isPending;
  if (ready && key !== null && filled?.key !== key) {
    const prefill = prefillBatch(defaults.data ?? null, storage.data ?? null);
    setFilled({ key, source: prefill.source, noPackage: prefill.defaultWithoutPackage });
    setDraft(prefill.draft);
  }

  const issue = useIssueBatch((created) => {
    if (group !== null) onIssued(created, group);
  });

  const uomCode = group?.uomCode ?? '';
  const integerOnly = isIntegerUom(uoms.data, uomCode);
  const check = draft === null ? null : checkBatch(draft, integerOnly);
  const showDraft = draft !== null && filled?.key === key;

  const edit = (patch: Partial<BatchDraft>): void => {
    issue.reset();
    setDraft((previous) => (previous === null ? previous : { ...previous, ...patch }));
  };

  const packageUoms = (uoms.data ?? []).filter((row) => row.uomCode !== uomCode);
  const packageUomCode = (uomId: number | null): string =>
    uoms.data?.find((row) => row.uomId === uomId)?.uomCode ?? '';
  const packageUomName = (uomId: number | null): string | null =>
    uoms.data?.find((row) => row.uomId === uomId)?.uomName ?? null;

  const pkgText =
    check?.package === null || check?.package === undefined
      ? null
      : formatPackage({
          uomCode: packageUomCode(check.package.uomId),
          uomName: packageUomName(check.package.uomId),
          count: check.package.count,
          qtyPerPackage: check.package.qtyPerPackage,
        });

  const lotQtyValue =
    draft === null
      ? ''
      : draft.packageOn &&
          !draft.lotQtyEdited &&
          check?.product !== null &&
          check?.product !== undefined
        ? String(check.product)
        : draft.lotQty;

  const touched = (value: string): boolean => value.trim() !== '';
  const errors = check?.errors ?? {};
  const packageError =
    draft === null
      ? null
      : errors.packageCount !== undefined && touched(draft.packageCount)
        ? td.errors.packageCount
        : errors.qtyPerPackage !== undefined && touched(draft.qtyPerPackage)
          ? td.errors.qtyPerPackage
          : null;
  const lotQtyError =
    draft === null || !touched(lotQtyValue)
      ? null
      : errors.lotQty === 'integer'
        ? td.errors.integer(uomCode)
        : errors.lotQty === 'required'
          ? td.errors.lotQty
          : null;
  const lotCountError =
    draft !== null && touched(draft.lotCount) && errors.lotCount !== undefined
      ? td.errors.lotCount
      : null;
  const mismatchText =
    errors.mismatch === true &&
    check?.lotQty !== null &&
    check?.lotQty !== undefined &&
    pkgText !== null
      ? td.errors.mismatch(
          formatBaseQty(check.lotQty, uomCode),
          pkgText,
          formatBaseQty(check.product ?? 0, uomCode),
        )
      : null;

  const summary =
    check?.ok === true && check.lotQty !== null && check.lotCount !== null && group !== null ? (
      <>
        <strong>
          {td.summary(
            check.lotCount,
            formatBaseQty(check.lotQty, uomCode),
            pkgText,
            formatBaseQty(check.lotQty * check.lotCount, uomCode),
            check.supplierLotNo,
          )}
        </strong>
        <br />
        {td.summaryTail(
          lotNoPattern(group.itemCode, check.lotQty, group.supplierCode, plantToday()),
        )}
      </>
    ) : (
      td.summaryEmpty
    );

  const submit = (): void => {
    if (check === null || target === null) return;
    const body = toBatchBody(check, target);
    if (body !== null) issue.write(body);
  };

  const blocked = check?.ok !== true;

  return (
    <Dialog
      open
      onClose={onClose}
      title={td.title}
      size="md"
      footer={
        <>
          <Button variant="outlined" onClick={onClose}>
            {td.cancel}
          </Button>
          <Button
            disabled={blocked}
            aria-describedby={blocked ? reasonId : undefined}
            loading={issue.isSaving}
            onClick={submit}
          >
            {td.submit(check?.ok === true ? check.lotCount : null)}
          </Button>
        </>
      }
    >
      <div className="mlot-issue-form">
        {issue.error !== null && <SaveErrorBanner error={issue.error} />}
        {fixed !== null ? (
          <dl className="mlot-issue-facts">
            <dt>{td.target}</dt>
            <dd>
              {td.targetOption(fixed.supplierName, fixed.itemCode, fixed.itemName, fixed.uomCode)}
            </dd>
          </dl>
        ) : (
          <Select
            aria-label={td.target}
            placeholder={td.targetPlaceholder}
            value={pickedKey}
            options={groups.map((row) => ({
              value: groupKey(row),
              label: td.targetOption(row.supplierName, row.itemCode, row.itemName, row.uomCode),
            }))}
            onChange={(value) => {
              issue.reset();
              setPickedKey(value);
            }}
          />
        )}

        {defaults.isError && <AlertBanner variant="warning">{td.defaultsFailed}</AlertBanner>}

        {showDraft && draft !== null && filled !== null && (
          <>
            <div>
              <Chip size="sm" status={SOURCE_STATUS[filled.source]}>
                {td.source[filled.source]}
              </Chip>
            </div>

            <section className="mlot-issue-package" aria-label={td.package}>
              <div className="mlot-issue-package-head">
                <strong>
                  {td.package} <span className="field-note">{td.packageOptional}</span>
                </strong>
                <div role="group" aria-label={td.package} className="mlot-issue-switch">
                  <Button
                    size="sm"
                    variant={draft.packageOn ? 'filled' : 'outlined'}
                    aria-pressed={draft.packageOn}
                    onClick={() => edit({ packageOn: true })}
                  >
                    {td.packageOn}
                  </Button>
                  <Button
                    size="sm"
                    variant={draft.packageOn ? 'outlined' : 'filled'}
                    aria-pressed={!draft.packageOn}
                    onClick={() => edit({ packageOn: false })}
                  >
                    {td.packageOff}
                  </Button>
                </div>
              </div>
              {draft.packageOn ? (
                <>
                  <div className="mlot-issue-package-fields">
                    <Select
                      aria-label={td.packageUom}
                      placeholder={td.packageUom}
                      value={draft.packageUomId === null ? null : String(draft.packageUomId)}
                      options={packageUoms.map((row) => ({
                        value: String(row.uomId),
                        label: row.uomCode,
                      }))}
                      onChange={(value) => edit({ packageUomId: Number(value) })}
                    />
                    <TextField
                      label={td.packageCount}
                      inputMode="numeric"
                      value={draft.packageCount}
                      onChange={(event) => edit({ packageCount: event.target.value })}
                    />
                    <TextField
                      label={td.qtyPerPackage(uomCode)}
                      inputMode="decimal"
                      value={draft.qtyPerPackage}
                      onChange={(event) => edit({ qtyPerPackage: event.target.value })}
                    />
                  </div>
                  {packageError !== null ? (
                    <p className="field-note mlot-issue-bad" role="alert">
                      {packageError}
                    </p>
                  ) : mismatchText !== null ? (
                    <p className="field-note mlot-issue-bad" role="alert">
                      {mismatchText}
                    </p>
                  ) : pkgText !== null &&
                    check?.product !== null &&
                    check?.product !== undefined ? (
                    <p className="field-note mlot-issue-ok">
                      {td.product(pkgText, formatBaseQty(check.product, uomCode))}
                    </p>
                  ) : null}
                </>
              ) : (
                <p className="field-note">
                  {td.packageNone[filled.noPackage ? 'default' : filled.source]}
                </p>
              )}
            </section>

            <TextField
              label={td.lotQty}
              inputMode="decimal"
              value={lotQtyValue}
              trailingIcon={<span title={td.unitLocked}>{uomCode}</span>}
              error={lotQtyError ?? undefined}
              helperText={draft.packageOn ? td.lotQtyHelpPackage(uomCode) : td.lotQtyHelp(uomCode)}
              onChange={(event) =>
                edit({ lotQty: event.target.value, lotQtyEdited: event.target.value !== '' })
              }
            />
            <TextField
              label={td.supplierLotNo}
              value={draft.supplierLotNo}
              helperText={td.supplierLotHelp}
              onChange={(event) => edit({ supplierLotNo: event.target.value })}
            />
            <TextField
              label={td.lotCount}
              inputMode="numeric"
              value={draft.lotCount}
              error={lotCountError ?? undefined}
              helperText={td.lotCountHelp}
              onChange={(event) => edit({ lotCount: event.target.value })}
            />
          </>
        )}

        <p id={reasonId} className="mlot-issue-summary" aria-live="polite">
          {summary}
        </p>
      </div>
    </Dialog>
  );
};
