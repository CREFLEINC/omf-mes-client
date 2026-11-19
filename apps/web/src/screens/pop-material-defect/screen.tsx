import { createIdempotencyKey, type ApiError } from '@omf-mes/api-client';
import { messages } from '@omf-mes/i18n';
import { useQuery } from '@tanstack/react-query';
import { useEffect, useId, useRef, useState } from 'react';

import { useApiClient } from '../../patterns/api-context';
import { SaveErrorBanner } from '../../patterns/master';
import { masterName } from '../../patterns/master-name';
import { usePopIdentity } from '../../patterns/pop-identity';
import { useUomOptions } from '../../patterns/material-lot-batch';
import { PopSelect as Select } from '../../patterns/pop-select';
import {
  PuActionBar,
  PuButton,
  PuChip,
  PuCols,
  PuEmpty,
  PuField,
  PuInput,
  PuKeypad,
  PuKv,
  PuNote,
  PuScanField,
  PuScreen,
  PuSection,
  PuUnit,
  applyKeypadKey,
  puToast,
} from '../../patterns/pop-uniform';
import { runRequest, toApiError } from '../../patterns/request';
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
import { useLotStatusLabels } from '../material-input-scan/lot-status-labels';

import './uniform.css';

const t = messages.materialDefect;

/** 자재 불량으로 보류하면 LOT 은 검사 대기로 묶인다 — 의심자재 등록(W-03-03)과 같은 도착 상태다. */
const HOLD_TARGET_LOT_STATUS = 'INSPECTION_PENDING';
const HOLD_REASON_GROUP = 'LOT_HOLD_REASON';
const QTY_MAX_LENGTH = 12;

interface FoundLot {
  lotId: number;
  lotNo: string;
  /** `품목코드 · 품목명`. 품목을 못 불러왔으면 `null`. */
  itemLabel: string | null;
  uomId: number;
  statusCode: string;
  /** 보류가 싣는 낙관적 잠금 값 — LOT 상세의 ETag 에서 읽는다. 못 읽었으면 `null`(보류를 막는다). */
  versionNo: number | null;
}

/** 보류 실패의 이유와 할 일. 기록은 이미 끝났다 — 기록을 다시 내라고 안내하지 않는다. */
const holdFailureOf = (error: ApiError): string => {
  if (error.kind === 'conflict' && error.code === 'VERSION_CONFLICT')
    return t.holdFailure.versionConflict;
  if (error.kind === 'conflict' && error.code === 'DUPLICATE_HOLD')
    return t.holdFailure.alreadyHeld;
  if (error.kind === 'stateLocked') return t.holdFailure.stateLocked;
  if (error.kind === 'network') return t.holdFailure.network;
  return t.holdFailure.other;
};

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
  const qtyFieldId = useId();
  const descFieldId = useId();
  const releaseFieldId = useId();
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
  const [holdFailure, setHoldFailure] = useState<string | null>(null);
  const [isRetryingHold, setIsRetryingHold] = useState(false);
  const statuses = useLotStatusLabels();

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
      /* 품목은 코드·이름으로 보인다 — 품목을 못 불러와도 LOT 조회는 실패로 접지 않는다. */
      const item = await runRequest(() =>
        client.GET('/mdm/items/{itemId}', { params: { path: { itemId: hit.itemId } } }),
      )
        .then((response) => response.item)
        .catch(() => null);
      return {
        lotId: hit.lotId,
        lotNo: hit.lotNo,
        itemLabel: item === null ? null : `${item.itemCode} · ${masterName(item, item.itemName)}`,
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
    /* 잠금 값을 못 읽었으면 보내지 않는다 — 0 을 실으면 서버가 버전 충돌로 거절하고 이유가 흐려진다(#108 리뷰 m5). */
    if (target.versionNo === null) {
      setHoldFailure(t.hold.noVersion);
      setOutcome('holdFailed');
      return;
    }
    const versionNo = target.versionNo;
    try {
      await runRequest(() =>
        client.POST('/quality/lot-holds', {
          params: { header: { 'Idempotency-Key': createIdempotencyKey() } },
          headers: { 'X-Worker-No': worker },
          body: {
            lots: [{ lotId: target.lotId, versionNo }],
            reasonCode: holdReason,
            targetLotStatusCode: HOLD_TARGET_LOT_STATUS,
            releaseCondition: releaseCondition.trim(),
            ...(holdRemarks.current === '' ? {} : { remarks: holdRemarks.current }),
          },
        }),
      );
      setHoldFailure(null);
      setOutcome('held');
      puToast(`${t.recorded} ${t.held}`);
    } catch (error) {
      setHoldFailure(holdFailureOf(toApiError(error)));
      setOutcome('holdFailed');
    }
  };

  /*
   * 기록은 됐고 보류만 실패한 뒤의 재시도 — ⛔ 기록을 다시 내지 않는다(같은 불량이 두 번 남는다). LOT 을 다시
   * 조회해 새 잠금 값으로 보류만 다시 한다(버전 충돌이 흔한 실패 이유다).
   */
  const retryHold = async (): Promise<void> => {
    if (workerNo === null) return;
    setIsRetryingHold(true);
    try {
      const fresh = (await found.refetch()).data ?? null;
      if (fresh === null) {
        setHoldFailure(t.holdFailure.other);
        return;
      }
      await holdLot(fresh, workerNo);
    } finally {
      setIsRetryingHold(false);
    }
  };

  /*
   * 보류 비고는 «기록할 때의» 불량 내용이다 — 기록이 성공하면 입력 칸을 비우므로(아래) 보류 재시도가 빈 칸을 읽지
   * 않게 따로 붙든다.
   */
  const holdRemarks = useRef('');

  const record = useRecordMaterialDefect(() => {
    /* 같은 불량이 거듭 기록되지 않게 성공하면 불량 입력을 비운다(담당자 결정 · #108). LOT·보류 입력은 그대로다. */
    setCode(EMPTY_DEFECT_CODE);
    setQty('');
    setDescription('');
    if (lot === null || workerNo === null) return;
    if (hold) void holdLot(lot, workerNo);
    else {
      setOutcome('recorded');
      puToast(t.recorded);
    }
  }, workerNo ?? undefined);

  const all = codes.data ?? [];
  const majors = majorsOf(all);
  const minors = minorsOf(all, code.majorId);
  const defectCodeId = resolveDefectCodeId(all, code);
  const quantity = Number(qty.trim());
  /* 기록을 막는 조건 — 막힌 사유는 칸의 빨간 테두리가 말한다(작업 줄에는 버튼만 · POP 통일 시안). */
  const blocked =
    lot === null ||
    defectCodeId === null ||
    !(qty.trim() !== '' && quantity > 0) ||
    (hold && holdReason === '') ||
    (hold && releaseCondition.trim() === '');
  const holdOnly = outcome === 'holdFailed';
  const holdBlocked = holdReason === '' || releaseCondition.trim() === '';
  const disabled = workerNo === null || record.isSaving || isRetryingHold;

  /** 스캔(또는 [직접 입력])한 번호로 LOT 을 찾는다 — 앞 LOT 의 입력과 결과를 함께 비운다. */
  const find = (raw: string): void => {
    const next = raw.trim();
    setLotNoDraft(next);
    setOutcome(null);
    setHoldFailure(null);
    setCode(EMPTY_DEFECT_CODE);
    setQty('');
    setDescription('');
    setHold(false);
    setHoldReason('');
    setReleaseCondition(t.hold.releaseConditionDefault);
    setLotNo(next === '' ? null : next);
  };

  /** [입력 초기화] — 스캔한 LOT 과 모든 입력을 처음으로 돌린다(시안). 서버에는 아무것도 보내지 않는다. */
  const resetAll = (): void => {
    find('');
  };

  const submit = (): void => {
    if (blocked || lot === null || defectCodeId === null || workerNo === null) return;
    setOutcome(null);
    holdRemarks.current = description.trim();
    record.write({
      lotId: lot.lotId,
      defectCodeId,
      defectQty: quantity,
      uomId: lot.uomId,
      detectedAt: new Date().toISOString(),
      ...(description.trim() === '' ? {} : { defectDescription: description.trim() }),
    });
  };

  const uoms = useUomOptions().data;
  const uomCode = lot === null ? '' : (uoms?.find((uom) => uom.uomId === lot.uomId)?.uomCode ?? '');
  const lotMissing = lotNo !== null && found.data === null;
  const off = disabled || lot === null;
  /* 없는 LOT 이면 칸을 비운다 — 이유는 칸 바로 아래 빨간 한 줄이 말한다(시안 규칙 6). */
  useEffect(() => {
    if (lotMissing) setLotNoDraft('');
  }, [lotMissing]);
  const codesEmpty = codes.data !== undefined && majors.length === 0;
  const hasInput =
    lotNoDraft !== '' ||
    lotNo !== null ||
    code.majorId !== '' ||
    qty !== '' ||
    description !== '' ||
    hold;

  return (
    <PuScreen
      className="md-screen"
      labelledBy={titleId}
      actionBar={
        <PuActionBar label={t.title}>
          <PuButton icon="reset" disabled={!hasInput || record.isSaving} onClick={resetAll}>
            {t.reset}
          </PuButton>
          {/*
           * 기록은 됐고 보류만 실패했으면 주 버튼이 [보류 다시 시도]로 바뀐다 — ⛔ 기록을 다시 내지 않는다.
           */}
          {holdOnly ? (
            <PuButton
              variant="primary"
              disabled={holdBlocked || disabled}
              onClick={() => void retryHold()}
            >
              {t.retryHold}
            </PuButton>
          ) : (
            <PuButton variant="primary" disabled={blocked || disabled} onClick={submit}>
              {record.isSaving ? t.saving : t.submit}
            </PuButton>
          )}
        </PuActionBar>
      }
    >
      <h1 id={titleId} className="visually-hidden">
        {t.title}
      </h1>
      <div className="md-stack">
        {/* 맨 위 한 줄: 자재 LOT 스캔(화면 전체 너비). 없는 LOT 이면 칸을 비우고 칸 아래 빨간 한 줄. */}
        <PuSection className="md-top" grow={false}>
          {/* ⭐ 사번 미확인은 모든 POP 화면이 같은 말로 알린다(사용자 지시 2026-09-17). */}
          {workerNo === null && <PuNote tone="warn">{messages.popChrome.workerMissing}</PuNote>}
          <PuScanField
            label={t.lot.label}
            ariaLabel={t.lot.label}
            required
            value={lotNoDraft}
            onChange={setLotNoDraft}
            onSubmit={find}
            placeholder={t.lot.placeholder}
            done={lot !== null}
            autoFocus
            error={lotMissing ? t.lot.notFound : found.isError ? t.lot.loadFailed : undefined}
            manual={{ title: t.lot.manualEntry, label: t.lot.label }}
          />
        </PuSection>

        <PuCols variant="lk">
          {/* 자재 정보 — 스캔 전에는 빈 구획 모양. 상태는 제목 줄 오른쪽. */}
          <PuSection
            title={t.lot.section}
            meta={lot === null ? undefined : <PuChip>{statuses.describe(lot.statusCode)}</PuChip>}
          >
            {lot === null ? (
              <PuEmpty icon="box" title={t.lot.empty} />
            ) : (
              <PuKv
                items={[
                  { label: t.lot.label, value: lot.lotNo },
                  { label: t.lot.item, value: lot.itemLabel ?? '-' },
                ]}
              />
            )}
          </PuSection>

          {/* 불량 등록 — LOT 을 스캔하기 전까지 흐리게 꺼 둔다. */}
          <PuSection title={t.code.section} disabled={lot === null} bodyClassName="md-form">
            {codes.isError && <PuNote tone="bad">{t.code.loadFailed}</PuNote>}
            {codesEmpty && <PuNote tone="bad">{t.code.none}</PuNote>}
            <div className="md-pair">
              <PuField label={t.code.major} required htmlFor={majorFieldId}>
                <Select
                  id={majorFieldId}
                  aria-label={t.code.major}
                  placeholder={t.code.placeholder}
                  options={majors.map(optionOf)}
                  value={code.majorId === '' ? null : code.majorId}
                  disabled={off || majors.length === 0}
                  invalid={!off && majors.length > 0 && code.majorId === ''}
                  onChange={(value) => setCode({ majorId: value, minorId: '' })}
                />
              </PuField>
              <PuField label={t.code.minor} required htmlFor={minorFieldId}>
                <Select
                  id={minorFieldId}
                  aria-label={t.code.minor}
                  placeholder={t.code.placeholder}
                  options={minors.map(optionOf)}
                  value={code.minorId === '' ? null : code.minorId}
                  /* 상세가 없는 대분류는 대분류 자체가 코드다 — 그때는 칸을 꺼 둔다. */
                  disabled={off || minors.length === 0}
                  invalid={!off && minors.length > 0 && code.minorId === ''}
                  onChange={(value) => setCode({ ...code, minorId: value })}
                />
              </PuField>
            </div>
            <div className="md-pair md-qrow">
              <PuField label={t.qty.label} required htmlFor={qtyFieldId}>
                <div className="pu-row">
                  {/* ⭐ 키오스크에는 운영체제 키보드가 없다 — 수량은 오른쪽 「수량」 키패드로 넣는다. */}
                  <PuInput
                    id={qtyFieldId}
                    aria-label={t.qty.label}
                    numeric
                    target={!off}
                    need={!off && (qty === '' || record.fieldErrors.defectQty !== undefined)}
                    inputMode="decimal"
                    placeholder="0"
                    autoComplete="off"
                    value={qty}
                    disabled={off}
                    onChange={(event) => setQty(event.target.value)}
                  />
                  {uomCode !== '' && <PuUnit>{uomCode}</PuUnit>}
                </div>
              </PuField>
              <PuField label={t.description} optional={t.code.optional} htmlFor={descFieldId}>
                <div className="pu-row">
                  <PuInput
                    id={descFieldId}
                    aria-label={t.description}
                    autoComplete="off"
                    value={description}
                    disabled={off}
                    onChange={(event) => setDescription(event.target.value)}
                  />
                </div>
              </PuField>
            </div>
            {record.fieldErrors.defectQty !== undefined && (
              <PuNote tone="bad">{record.fieldErrors.defectQty}</PuNote>
            )}

            <label className="pu-check md-hold">
              <input
                type="checkbox"
                checked={hold}
                disabled={lot === null || off || lot.versionNo === null}
                onChange={(event) => setHold(event.target.checked)}
              />
              {t.hold.label}
            </label>
            {lot !== null && lot.versionNo === null && (
              <PuNote tone="warn">{t.hold.noVersion}</PuNote>
            )}
            {hold && (
              <div className="md-pair">
                <PuField label={t.hold.reason} required htmlFor={reasonFieldId}>
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
                    invalid={!disabled && holdReason === ''}
                    onChange={setHoldReason}
                  />
                </PuField>
                <PuField label={t.hold.releaseCondition} required htmlFor={releaseFieldId}>
                  <div className="pu-row">
                    <PuInput
                      id={releaseFieldId}
                      aria-label={t.hold.releaseCondition}
                      autoComplete="off"
                      value={releaseCondition}
                      disabled={disabled}
                      need={!disabled && releaseCondition.trim() === ''}
                      onChange={(event) => setReleaseCondition(event.target.value)}
                    />
                  </div>
                </PuField>
              </div>
            )}

            <SaveErrorBanner error={record.error} />
            {/* 기록은 됐고 보류만 실패한 것은 알림 한 줄로 지나가면 안 된다 — 구획 안에 남긴다. */}
            {outcome === 'holdFailed' && (
              <PuNote tone="warn">
                {holdFailure === null ? t.holdFailed : `${t.holdFailed} ${holdFailure}`}
              </PuNote>
            )}
          </PuSection>

          {/* 수량 — 생산 작업 화면과 같은 「수량」 키패드 구획. */}
          <PuSection
            title={t.qty.padTitle}
            meta={t.qty.padUnit(uomCode === '' ? '—' : uomCode)}
            disabled={lot === null}
          >
            <PuKeypad
              targetLabel={t.qty.label}
              decimal
              disabled={off}
              onKey={(key) => {
                setQty((prev) => {
                  const next = applyKeypadKey(prev, key, { decimal: true }).replace(
                    /^0+(?=\d)/u,
                    '',
                  );
                  return next.length > QTY_MAX_LENGTH ? prev : next;
                });
              }}
              onClearAll={() => {
                setQty('');
              }}
            />
          </PuSection>
        </PuCols>
      </div>
    </PuScreen>
  );
};
