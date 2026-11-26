import { AlertBanner, Button, Chip, Dialog, Icon, TextField } from '@crefle/web-ui';
import type { MaterialLotBatchCreated } from '@omf-mes/api-client';
import { messages } from '@omf-mes/i18n';
import { useId, useState } from 'react';

import { InfoLabel, InfoTip } from '../../patterns/info-tip';
import { SaveErrorBanner } from '../../patterns/master';
import {
  checkBatch,
  isIntegerUom,
  lotNoPattern,
  prefillBatch,
  toBatchBody,
  useItemLotDefault,
  useItemStorageUnit,
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
  item: 'success',
  itemStorage: 'info',
  none: 'idle',
};

/**
 * W-01-14 발행 창 — POP 「자재 관리 LOT 만들기」와 **같은 칸 · 같은 규칙**(screens/W-01-14.md 「발행 창」 · US1-8).
 * 채우기 · 검사 · 본문은 `patterns/material-lot-batch` 하나가 정한다. 라벨은 여기서 찍지 않는다(POP).
 */
export const IssueDialog = ({ plantId, groups, fixed, onClose, onIssued }: IssueDialogProps) => {
  const reasonId = useId();
  const lotCountId = useId();
  const packageUomId = useId();
  const [pickedKey, setPickedKey] = useState<string | null>(
    fixed !== null ? groupKey(fixed) : null,
  );
  const group = fixed ?? groups.find((candidate) => groupKey(candidate) === pickedKey) ?? null;
  const target =
    group === null ? null : { plantId, supplierId: group.supplierId, itemId: group.itemId };

  const storage = useItemStorageUnit(group?.itemId ?? null);
  const itemDefault = useItemLotDefault(group?.itemId ?? null);
  const uoms = useUomOptions();

  /* 고른 조합의 기본값을 다 읽으면 그 조합으로 한 번 채운다 — 사람이 쓰는 중인 값을 다시 덮지 않는다. */
  const [filled, setFilled] = useState<{
    key: string;
    source: BatchSource;
    noPackage: boolean;
  } | null>(null);
  const [draft, setDraft] = useState<BatchDraft | null>(null);
  const key = group === null ? null : groupKey(group);
  const ready = group !== null && !storage.isPending;
  if (ready && key !== null && filled?.key !== key) {
    const prefill = prefillBatch(itemDefault.data ?? null, storage.data ?? null);
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
      size="lg"
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
            <dt>{td.supplier}</dt>
            <dd>{fixed.supplierName}</dd>
            <dt>{td.item}</dt>
            <dd>{td.itemWithUnit(fixed.itemCode, fixed.itemName, fixed.uomCode)}</dd>
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

        {storage.isError && <AlertBanner variant="warning">{td.defaultsFailed}</AlertBanner>}

        {showDraft && draft !== null && filled !== null && (
          <>
            {/* 기본값이 없을 때의 안내는 아래 「패키징 (선택)」 옆 ⓘ 로(사용자 지시 2026-11-26). */}
            {filled.source !== 'none' && (
              <div>
                <Chip size="sm" status={SOURCE_STATUS[filled.source]}>
                  {td.source[filled.source]}
                </Chip>
              </div>
            )}

            <section className="mlot-issue-package" aria-label={td.package}>
              <div className="mlot-issue-package-head">
                {/* 「패키징 (선택)」 ⓘ 한 줄 — ⓘ 에 마우스를 올리면 기본값 없음 안내(사용자 지시 2026-11-26). */}
                <span className="mlot-issue-package-title">
                  <strong>
                    {td.package} <span className="field-note">{td.packageOptional}</span>
                  </strong>
                  {filled.source === 'none' && <InfoTip text={td.source.none} />}
                </span>
                {/*
                 * 선택 항목이라 빨간 강조 없이 단추 하나(사용자 지시 2026-11-26) — 없으면 [+ 패키징 추가], 넣었으면
                 * [패키징 빼기]. 값(`packageOn`)과 검사 · 발행 규칙은 그대로.
                 */}
                {draft.packageOn ? (
                  <Button size="sm" variant="outlined" onClick={() => edit({ packageOn: false })}>
                    {td.packageOff}
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    variant="outlined"
                    leadingIcon={<Icon name="add" size={18} />}
                    onClick={() => edit({ packageOn: true })}
                  >
                    {td.packageOn}
                  </Button>
                )}
              </div>
              {draft.packageOn ? (
                <>
                  {/* 세 칸 한 줄 · 패키징 단위도 이름표를 단다(사용자 지시 2026-11-26). */}
                  <div className="mlot-issue-package-fields mlot-issue-package-row">
                    <div className="field-cell">
                      <span className="field-label">
                        <label htmlFor={packageUomId}>{td.packageUom}</label>
                        <span className="required-mark" aria-hidden="true">
                          {' '}
                          *
                        </span>
                      </span>
                      <Select
                        id={packageUomId}
                        aria-required="true"
                        placeholder={td.placeholders.packageUom}
                        value={draft.packageUomId === null ? null : String(draft.packageUomId)}
                        options={packageUoms.map((row) => ({
                          value: String(row.uomId),
                          /* 패키징 단위는 이름(「봉지」)으로 — 이름이 비면 코드(G2 L17). */
                          label: row.uomName.trim() === '' ? row.uomCode : row.uomName,
                        }))}
                        onChange={(value) => edit({ packageUomId: Number(value) })}
                      />
                    </div>
                    <TextField
                      label={td.packageCount}
                      required
                      placeholder={td.placeholders.packageCount}
                      inputMode="numeric"
                      value={draft.packageCount}
                      onChange={(event) => edit({ packageCount: event.target.value })}
                    />
                    <TextField
                      label={td.qtyPerPackage(uomCode)}
                      required
                      placeholder={td.placeholders.qtyPerPackage}
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
              ) : null}
            </section>

            <TextField
              label={td.lotQty}
              required
              placeholder={td.placeholders.lotQty}
              inputMode="decimal"
              value={lotQtyValue}
              trailingIcon={<span title={td.unitLocked}>{uomCode}</span>}
              error={lotQtyError ?? undefined}
              onChange={(event) =>
                edit({ lotQty: event.target.value, lotQtyEdited: event.target.value !== '' })
              }
            />
            <TextField
              label={td.supplierLotNo}
              placeholder={td.placeholders.supplierLotNo}
              value={draft.supplierLotNo}
              onChange={(event) => edit({ supplierLotNo: event.target.value })}
            />
            {/* 개수 범위는 라벨 옆 ⓘ 로 — 칸 아래 설명문을 두지 않는다(관리웹 정리 시안 A). 넘으면 오류 문구가 범위를 말한다. */}
            <div className="field-cell">
              <InfoLabel htmlFor={lotCountId} label={td.lotCount} info={td.lotCountHelp} required />
              <TextField
                id={lotCountId}
                aria-required="true"
                fullWidth
                placeholder={td.placeholders.lotCount}
                inputMode="numeric"
                value={draft.lotCount}
                error={lotCountError ?? undefined}
                onChange={(event) => edit({ lotCount: event.target.value })}
              />
            </div>
          </>
        )}

        <p id={reasonId} className="mlot-issue-summary" aria-live="polite">
          {summary}
        </p>
      </div>
    </Dialog>
  );
};
