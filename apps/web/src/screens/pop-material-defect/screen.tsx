import { AlertBanner, Button, Checkbox, Chip, TextField } from '@crefle/web-ui';
import { createIdempotencyKey } from '@omf-mes/api-client';
import { messages } from '@omf-mes/i18n';
import { NumericKeypad } from '@omf-mes/ui';
import { useQuery } from '@tanstack/react-query';
import { useId, useState, type FormEvent } from 'react';

import { useApiClient } from '../../patterns/api-context';
import { SaveErrorBanner } from '../../patterns/master';
import { usePopIdentity } from '../../patterns/pop-identity';
import { PopSelect as Select } from '../../patterns/pop-select';
import { PopWorkerMissingBanner } from '../../patterns/pop-worker-missing-banner';
import { runRequest } from '../../patterns/request';
import { useWorkerSession } from '../../patterns/worker-session';
import {
  EMPTY_DEFECT_CODE,
  majorsOf,
  minorsOf,
  optionOf,
  resolveDefectCodeId,
  type DefectCodeDraft,
} from '../material-defect/defect-code';
import { useDefectCodes, useRecordMaterialDefect } from '../material-defect/queries';

const t = messages.materialDefect;

/** 자재 불량으로 보류하면 LOT 은 검사 대기로 묶인다 — 의심자재 등록(W-03-03)과 같은 도착 상태다. */
const HOLD_TARGET_LOT_STATUS = 'INSPECTION_PENDING';
const HOLD_REASON_GROUP = 'LOT_HOLD_REASON';
const QTY_MAX_LENGTH = 12;

interface FoundLot {
  lotId: number;
  lotNo: string;
  itemId: number;
  uomId: number;
  statusCode: string;
  /** 보류가 싣는 낙관적 잠금 값 — LOT 상세의 ETag 에서 읽는다. 못 읽었으면 `null`(보류를 막는다). */
  versionNo: number | null;
}

/** `"7"` · `W/"7"` → 7. */
const versionOf = (etag: string | undefined): number | null => {
  const digits = etag?.match(/\d+/u)?.[0];
  return digits === undefined ? null : Number(digits);
};

/**
 * P-02-14 자재 불량 등록(POP · omf-all-around#108 · 설계보다 앞선 화면, 서버 장부 P-52).
 *
 * 생산·검사 중 투입된 자재에서 불량을 찾으면 LOT 을 스캔하고 불량 코드·수량을 남긴다. 고르면 그 LOT 을
 * 바로 보류한다(검사 대기). 작업지시·공정은 서버가 그 LOT 의 투입 기록에서 채운다.
 *
 * ⛔ 생산 화면(P-02-03 자재 투입)을 건드리지 않는 별도 품질 화면이다(사용자 결정 2026-10-16). 메뉴에는 검사
 *    입력 공정 단말에만 뜬다(서버 `can_input_inspection`).
 * ⚠ 기록과 보류는 두 요청이다 — 불량 기록 API 에 보류를 넣지 않기로 했다. 기록이 되고 보류가 실패하면 그
 *   사실을 따로 알린다(기록을 되돌리지 않는다).
 */
export const PopMaterialDefectScreen = () => {
  const titleId = useId();
  const majorFieldId = useId();
  const minorFieldId = useId();
  const reasonFieldId = useId();
  const { client, etags } = useApiClient();
  const identity = usePopIdentity();
  const workerSession = useWorkerSession();
  const workerNo = identity.workerNo?.trim() || workerSession?.worker.workerNo?.trim() || null;

  const [lotNoDraft, setLotNoDraft] = useState('');
  const [lotNo, setLotNo] = useState<string | null>(null);
  const [code, setCode] = useState<DefectCodeDraft>(EMPTY_DEFECT_CODE);
  const [qty, setQty] = useState('');
  const [description, setDescription] = useState('');
  const [hold, setHold] = useState(false);
  const [holdReason, setHoldReason] = useState('');
  /* 검사 대기 보류는 해제 조건이 필수다(서버 규칙 · 의심자재 보류와 같다) — 흔한 값을 채워 두고 고칠 수 있게 한다. */
  const [releaseCondition, setReleaseCondition] = useState<string>(t.hold.releaseConditionDefault);
  const [outcome, setOutcome] = useState<'recorded' | 'held' | 'holdFailed' | null>(null);

  const found = useQuery({
    queryKey: ['material-defect', 'pop-lot', lotNo],
    enabled: lotNo !== null,
    queryFn: async (): Promise<FoundLot | null> => {
      const list = await runRequest(() =>
        client.GET('/trace/lots', { params: { query: { lotNo: lotNo ?? '', size: 5 } } }),
      );
      const hit = list.items.find((item) => item.lotNo === lotNo);
      if (hit === undefined) return null;
      /* 상세를 한 번 더 부른다 — 보류가 싣는 잠금 값은 상세의 ETag 로만 온다. */
      await runRequest(() =>
        client.GET('/trace/lots/{lotId}', { params: { path: { lotId: hit.lotId } } }),
      );
      return {
        lotId: hit.lotId,
        lotNo: hit.lotNo,
        itemId: hit.itemId,
        uomId: hit.uomId,
        statusCode: hit.statusCode,
        versionNo: versionOf(etags.ifMatch(`/trace/lots/${String(hit.lotId)}`)),
      };
    },
  });
  const lot = found.data ?? null;

  const codes = useDefectCodes();
  const reasons = useQuery({
    queryKey: ['material-defect', 'hold-reasons'],
    queryFn: () =>
      runRequest(() =>
        client.GET('/mdm/code-values', {
          params: { query: { codeGroupCode: HOLD_REASON_GROUP, page: 1, size: 100 } },
        }),
      ).then((response) => response.items),
  });

  const holdLot = async (target: FoundLot, worker: string): Promise<void> => {
    try {
      await runRequest(() =>
        client.POST('/quality/lot-holds', {
          params: { header: { 'Idempotency-Key': createIdempotencyKey() } },
          headers: { 'X-Worker-No': worker },
          body: {
            lots: [{ lotId: target.lotId, versionNo: target.versionNo ?? 0 }],
            reasonCode: holdReason,
            targetLotStatusCode: HOLD_TARGET_LOT_STATUS,
            releaseCondition: releaseCondition.trim(),
            ...(description.trim() === '' ? {} : { remarks: description.trim() }),
          },
        }),
      );
      setOutcome('held');
    } catch {
      setOutcome('holdFailed');
    }
  };

  const record = useRecordMaterialDefect(() => {
    if (lot === null || workerNo === null) return;
    if (hold) void holdLot(lot, workerNo);
    else setOutcome('recorded');
  }, workerNo ?? undefined);

  const all = codes.data ?? [];
  const majors = majorsOf(all);
  const minors = minorsOf(all, code.majorId);
  const defectCodeId = resolveDefectCodeId(all, code);
  const quantity = Number(qty.trim());
  const blocked =
    lot === null
      ? t.blocked.lot
      : defectCodeId === null
        ? t.blocked.code
        : !(qty.trim() !== '' && quantity > 0)
          ? t.blocked.qty
          : hold && holdReason === ''
            ? t.blocked.holdReason
            : hold && releaseCondition.trim() === ''
              ? t.blocked.releaseCondition
              : null;
  const disabled = workerNo === null || record.isSaving;

  const find = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    const next = lotNoDraft.trim();
    setOutcome(null);
    setCode(EMPTY_DEFECT_CODE);
    setQty('');
    setDescription('');
    setHold(false);
    setHoldReason('');
    setReleaseCondition(t.hold.releaseConditionDefault);
    setLotNo(next === '' ? null : next);
  };

  const submit = (): void => {
    if (blocked !== null || lot === null || defectCodeId === null || workerNo === null) return;
    setOutcome(null);
    record.write({
      lotId: lot.lotId,
      defectCodeId,
      defectQty: quantity,
      uomId: lot.uomId,
      detectedAt: new Date().toISOString(),
      ...(description.trim() === '' ? {} : { defectDescription: description.trim() }),
    });
  };

  return (
    <main className="pop-shell pop-ui" aria-labelledby={titleId}>
      <header className="pop-header">
        <h1 id={titleId} className="pop-title">
          {t.title}
        </h1>
        <div className="pop-context-right">
          {workerNo !== null && (
            <Chip variant="status" size="md" status="success">
              {workerNo}
            </Chip>
          )}
        </div>
      </header>

      <PopWorkerMissingBanner workerNo={workerNo} />

      <div className="pop-panes">
        <section className="pane" aria-label={t.lot.label}>
          <form onSubmit={find} className="form-actions">
            <TextField
              label={t.lot.label}
              placeholder={t.lot.placeholder}
              value={lotNoDraft}
              onChange={(event) => setLotNoDraft(event.target.value)}
            />
            <Button type="submit" variant="outlined">
              {t.lot.find}
            </Button>
          </form>

          {found.isError && <AlertBanner variant="error">{t.lot.loadFailed}</AlertBanner>}
          {found.data === null && <AlertBanner variant="warning">{t.lot.notFound}</AlertBanner>}
          {lot !== null && (
            <dl className="pop-figures">
              <div>
                <dt>{t.lot.label}</dt>
                <dd>{lot.lotNo}</dd>
              </div>
              <div>
                <dt>{t.lot.item(lot.itemId)}</dt>
                <dd>{t.lot.status(lot.statusCode)}</dd>
              </div>
            </dl>
          )}

          {codes.isError && <p className="field-note">{t.code.loadFailed}</p>}
          {codes.data !== undefined && majors.length === 0 && (
            <p className="field-note">{t.code.none}</p>
          )}
          <div className="field-cell">
            <label className="field-label" htmlFor={majorFieldId}>
              {t.code.major}
            </label>
            <Select
              id={majorFieldId}
              aria-label={t.code.major}
              options={majors.map(optionOf)}
              value={code.majorId === '' ? null : code.majorId}
              disabled={disabled || lot === null || majors.length === 0}
              onChange={(value) => setCode({ majorId: value, minorId: '' })}
            />
          </div>
          {minors.length > 0 && (
            <div className="field-cell">
              <label className="field-label" htmlFor={minorFieldId}>
                {t.code.minor}
              </label>
              <Select
                id={minorFieldId}
                aria-label={t.code.minor}
                options={minors.map(optionOf)}
                value={code.minorId === '' ? null : code.minorId}
                disabled={disabled}
                onChange={(value) => setCode({ ...code, minorId: value })}
              />
            </div>
          )}
          <TextField
            label={t.description}
            value={description}
            disabled={disabled || lot === null}
            onChange={(event) => setDescription(event.target.value)}
          />
        </section>

        <section className="pane" aria-label={t.qty.label}>
          <TextField
            label={t.qty.label}
            inputMode="decimal"
            value={qty}
            disabled={disabled || lot === null}
            error={record.fieldErrors.defectQty}
            onChange={(event) => setQty(event.target.value)}
          />
          {/* ⭐ 키오스크에는 운영체제 키보드가 없다 — 수량은 화면 키패드로 넣는다. */}
          <NumericKeypad
            value={qty}
            onChange={setQty}
            dropLeadingZero
            allowDecimal
            disabled={disabled || lot === null}
            label={t.qty.keypad}
            backspaceLabel={t.qty.backspace}
            clearLabel={t.qty.clear}
            decimalLabel={t.qty.decimal}
            maxLength={QTY_MAX_LENGTH}
          />

          <Checkbox
            checked={hold}
            disabled={disabled || lot === null || lot.versionNo === null}
            onChange={(event) => setHold(event.target.checked)}
          >
            {t.hold.label}
          </Checkbox>
          {hold && (
            <div className="field-cell">
              <label className="field-label" htmlFor={reasonFieldId}>
                {t.hold.reason}
              </label>
              <Select
                id={reasonFieldId}
                aria-label={t.hold.reason}
                placeholder={t.hold.reasonPlaceholder}
                options={(reasons.data ?? []).map((reason) => ({
                  value: reason.code,
                  label: reason.codeName,
                }))}
                value={holdReason === '' ? null : holdReason}
                disabled={disabled}
                onChange={setHoldReason}
              />
            </div>
          )}
          {hold && (
            <TextField
              label={t.hold.releaseCondition}
              value={releaseCondition}
              disabled={disabled}
              onChange={(event) => setReleaseCondition(event.target.value)}
            />
          )}

          <SaveErrorBanner error={record.error} />
          {outcome === 'recorded' && <AlertBanner variant="success">{t.recorded}</AlertBanner>}
          {outcome === 'held' && (
            <AlertBanner variant="success">{`${t.recorded} ${t.held}`}</AlertBanner>
          )}
          {outcome === 'holdFailed' && <AlertBanner variant="warning">{t.holdFailed}</AlertBanner>}

          <div className="pop-action-bar">
            <div className="pop-action-note">
              {blocked !== null && <p className="field-note">{blocked}</p>}
            </div>
            <Button
              variant="filled"
              size="xl"
              disabled={blocked !== null || disabled}
              onClick={submit}
            >
              {record.isSaving ? t.saving : t.submit}
            </Button>
          </div>
        </section>
      </div>
    </main>
  );
};
