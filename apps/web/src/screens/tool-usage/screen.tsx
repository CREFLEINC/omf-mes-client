import { messages } from '@omf-mes/i18n';
import { useEffect, useId, useRef, useState } from 'react';

import {
  PuActionBar,
  PuButton,
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
import { toApiError } from '../../patterns/request';
import { conversionState } from './conversion';
import { ErrorBanner } from './error-banner';
import { hasEntry, usePopEntry } from './entry-context';
import { useOperationPolicy, useToolByCode } from './queries';
import {
  availableShots,
  formatShots,
  isOverGuaranteed,
  projectedTotal,
  usagePercent,
  type FigureInput,
  type ShotFigure,
} from './shot-figures';
import { useToolUsageWrite } from './mutations';
import { useOnline } from './use-online';
import { WorkOrderBand, useWorkOrderUom } from './wo-band';
import {
  canSave,
  decimalOnly,
  digitsOnly,
  hasInput,
  incrementOf,
  saveDisabledReason,
  type SaveGuard,
} from './usage-draft';
import {
  COLLECTION_METHOD,
  DISPOSED_STATUS_CODE,
  emptyUsageDraft,
  type Mold,
  type ToolUsage,
  type UsageDraft,
} from './types';

import './uniform.css';

const t = messages.toolUsage;

/** 타발수 상한 — 계약이 정수로 받고, 자릿수를 넘겨 치는 것은 오타다. 키패드가 그 위를 무시한다. */
const SHOT_MAX_LENGTH = 9;

/**
 * 저장 응답이 준 것. **서버가 더한 누계와 그 누계가 어느 시각 것인지다**(계약 `ToolUsage`).
 *
 * ⭐ **이 값이 ③ 구획을 곧바로 갱신한다.** 배너만 새 누계를 말하고 아래 표가 옛 값을 그대로
 * 두면 한 화면이 두 말을 한다 — 사용자는 어느 쪽이 참인지 알 수 없다. 다시 조회해 올 때까지
 * 기다리지 않고, 서버가 방금 알려 준 값을 그대로 세운다.
 */
interface SaveResult {
  cumulativeShotCount: number | undefined;
  cumulativeAsOf: string | undefined;
}

/**
 * 값 하나를 사람이 읽는 글자로.
 *
 * ⭐ **초과는 수치 옆에 붙는다** — 「−1,200 회(초과)」(스펙 §6-1). 따로 떨어진 문장으로 두면
 * 어느 숫자가 넘긴 것인지 눈이 다시 찾아야 한다.
 */
const figureText = (figure: ShotFigure, offlineText: string): string => {
  switch (figure.kind) {
    case 'value':
      return figure.value < 0
        ? `${formatShots(figure.value)} ${t.shot.unit}${t.cumulative.overSuffix}`
        : `${formatShots(figure.value)} ${t.shot.unit}`;
    case 'offline':
      return offlineText;
    /* 칸에는 「—」만 — 왜 비었는지는 누계 아래 한 줄이 말한다(칸이 좁아 긴 문장이 넘친다). */
    case 'guaranteedMissing':
      return '—';
  }
};

/**
 * P-05-01 — POP(1024×768 터치)에서 금형 QR 을 찍고 타발수를 기입해 툴 사용실적을 남긴다.
 *
 * **이 화면의 본론은 「누가 무엇을 정하는가」다**(스펙 §5-2 · 공유계약 B-13).
 *
 * - 화면이 정하는 것: **이번에 더할 타발수**(증분)
 * - 서버가 정하는 것: **누계**. 화면은 저장 전에 예상치를 보일 뿐이고 ④ 안내가 그 사실을 말한다
 *
 * 본문은 POP 통일 시안(#295) — 작업지시 띠 아래 「툴 스캔 | 타발수 입력 | 수량」 세 구획, 아래 작업 줄.
 *
 * ⚠ **연결이 끊기면 저장을 막는다.** 스펙 §6-2 는 오프라인 버퍼링을 확정했지만 이 저장소에
 * 보낼 것 보관함(outbox)이 아직 없다 — 감추지 않고 사유를 말한다(`use-online.ts`).
 */
export const ToolUsageScreen = () => {
  const titleId = useId();
  const shotInputId = useId();
  const baseQtyId = useId();

  const entry = usePopEntry();
  /* ⭐ 작업지시가 없으면 입력란·키패드를 잠근다(사용자 지시 2026-09-17) — 넣어도 저장할 곳이 없다. */
  const inputLocked = entry.workOrderId === null;
  const isOnline = useOnline();

  /** 스캔칸에 치는 중인 값과, 조회를 건 값은 다르다 — 한 글자마다 서버를 부르지 않는다. */
  const [codeInput, setCodeInput] = useState('');
  const [submittedCode, setSubmittedCode] = useState('');
  const [draft, setDraft] = useState<UsageDraft>(emptyUsageDraft);
  const [saved, setSaved] = useState<SaveResult | null>(null);

  /**
   * 이 입력이 언제 일어났는가. **한 번 정하면 성공할 때까지 붙든다.**
   *
   * ⛔ **누를 때마다 새로 만들면 안 된다.** 발생 시각이 본문에 실리므로 재시도마다 값이 달라지고,
   * 그러면 멱등 키의 지문도 매번 달라져 **같은 입력이 새 쓰기로 나간다** — 통신이 끊긴 뒤
   * 다시 누르면 타발수가 두 번 더해진다. 값이 실제로 바뀌었을 때만(초안 변경·성공) 버린다.
   */
  const occurredAtRef = useRef<string | null>(null);

  const lookup = useToolByCode(submittedCode);
  const tool: Mold | null = lookup.data?.tool ?? null;
  const isDisposed = tool !== null && tool.statusCode === DISPOSED_STATUS_CODE;
  /** 폐기된 툴은 고른 것으로 치지 않는다 — 스캔 자체를 거부한다(스펙 §6-1). */
  const usableTool = isDisposed ? null : tool;
  /* ⭐ 순서는 금형 QR → 수량이다(사용자 지시 2026-09-17). 금형을 못 읽었으면 수량 칸·키패드·환산을 잠근다. */
  const shotLocked = inputLocked || usableTool === null;

  const enabledPolicy = useOperationPolicy('SHOT_CONVERSION_ENABLED');
  const ratioPolicy = useOperationPolicy('SHOT_CONVERSION_RATIO');
  const conversion = conversionState({
    enabled: enabledPolicy.data,
    ratio: ratioPolicy.data,
    isLoading: enabledPolicy.isPending || ratioPolicy.isPending,
  });

  const increment = incrementOf(draft, conversion);

  const write = useToolUsageWrite({
    workerNo: entry.workerNo ?? '',
    onSuccess: (usage: ToolUsage) => {
      occurredAtRef.current = null;
      setDraft(emptyUsageDraft);
      setShotConfirmed(false);
      /* ⭐ 저장되면 금형 QR 칸과 고른 금형 안내도 비운다(사용자 지시 2026-09-17) — 다음 실적은 QR 부터다. */
      setCodeInput('');
      setSubmittedCode('');
      setSaved({
        cumulativeShotCount: usage.cumulativeShotCount,
        cumulativeAsOf: usage.cumulativeAsOf,
      });
      /* 결과는 아래 가운데 알림 한 줄(POP 통일 시안). */
      puToast(t.save.successTitle);
    },
  });

  /**
   * ⭐ **[확인]은 숫자만 확정한다**(사용자 지시 2026-09-17) — 저장하지 않는다. 확정한 뒤에야
   *    [실적 저장]이 열리고, 값을 다시 바꾸면 확정이 풀린다.
   */
  const [shotConfirmed, setShotConfirmed] = useState(false);

  const changeDraft = (patch: Partial<UsageDraft>): void => {
    setDraft((prev) => ({ ...prev, ...patch }));
    setShotConfirmed(false);
    /* 값이 바뀌면 다른 쓰기다 — 붙들고 있던 발생 시각과 앞 시도의 진술을 함께 버린다. */
    occurredAtRef.current = null;
    setSaved(null);
    write.reset();
  };

  const guard: SaveGuard = {
    hasTool: usableTool !== null,
    hasEntry: hasEntry(entry),
    isOnline,
    isSaving: write.isSaving,
    increment,
  };

  const blockReason = saveDisabledReason(guard);
  const isSaveOpen = canSave(guard) && shotConfirmed;
  const canConfirmShot = !shotLocked && increment !== null && !shotConfirmed;

  /**
   * 지금 화면이 아는 서버 누계. **저장 응답이 조회 응답보다 새롭다.**
   *
   * 저장이 끝나면 서버가 더한 값을 곧바로 알려 주므로 그것을 쓴다. 다시 조회해 온 값이
   * 도착하면(초안이 바뀌거나 툴을 다시 고를 때 `saved` 를 버린다) 그쪽으로 돌아간다.
   */
  const serverShotCount = saved?.cumulativeShotCount ?? usableTool?.currentShotCount ?? 0;

  const figures: FigureInput = {
    currentShotCount: serverShotCount,
    guaranteedShotCount: usableTool?.guaranteedShotCount,
    increment,
    isOnline,
  };

  /**
   * 툴을 새로 찍는다 — **앞 시도의 흔적을 함께 버린다.**
   *
   * ⛔ 앞 시도의 실패 배너를 남기면 방금 찍은 툴이 거부된 것처럼 읽힌다.
   * ⛔ 발생 시각도 버린다 — 붙들고 있으면 **툴 B 의 실적에 툴 A 를 찍던 시각**이 박힌다.
   * 친 타발수는 남긴다. 값을 먼저 치고 툴을 찍는 순서도 정상이다.
   */
  const isConverted = draft.method === COLLECTION_METHOD.converted;
  const usagePercentFigure = usagePercent(figures);
  const isOver = isOverGuaranteed(figures);

  const guaranteedText =
    usableTool === null ||
    usableTool.guaranteedShotCount === null ||
    usableTool.guaranteedShotCount === undefined
      ? '—'
      : `${formatShots(usableTool.guaranteedShotCount)} ${t.shot.unit}`;

  /**
   * 누계가 «언제 것인가».
   *
   * ⭐ **저장 응답의 `cumulativeAsOf` 가 정본이다** — 서버가 더한 시점을 그 값이 말한다.
   * ⚠ 아직 저장하지 않았으면 그 값이 없다. 툴 마스터에는 시각 칸이 없으므로 그때는 **화면이
   * 그 값을 받은 시각**을 적는다 — 없는 값을 지어내지 않되 「이 숫자가 언제 것인가」는 답한다.
   */
  const asOfSource = saved?.cumulativeAsOf ?? null;
  const asOfMillis = asOfSource === null ? lookup.dataUpdatedAt : new Date(asOfSource).getTime();

  const asOfText =
    asOfMillis === 0 || Number.isNaN(asOfMillis)
      ? null
      : t.cumulative.asOf(
          new Date(asOfMillis).toLocaleTimeString('ko-KR', {
            hour: '2-digit',
            minute: '2-digit',
          }),
        );

  const applyCode = (raw: string): void => {
    /* 다른 툴을 읽으면 앞 툴에 확정한 숫자를 풀어 둔다(리뷰) — 새 툴 실적으로 저장되지 않게. */
    setShotConfirmed(false);
    setSubmittedCode(raw.trim());
    setSaved(null);
    occurredAtRef.current = null;
    write.reset();
  };

  /*
   * ⭐ 못 찾았거나 폐기된 툴이면 칸을 비운다 — 칸 바로 아래 빨간 한 줄이 이유를 말한다(시안 규칙 6).
   *    바코드를 읽으면 Enter 없이 바로 조회하는 것은 공통 스캔 칸(`PuScanField`)이 맡는다.
   */
  const scanFailed = submittedCode !== '' && !lookup.isPending && (tool === null || isDisposed);
  useEffect(() => {
    if (scanFailed) setCodeInput('');
  }, [scanFailed]);

  /**
   * [입력 초기화] — **친 값만 지우고 고른 툴은 남긴다.**
   *
   * ⛔ 툴까지 지우면 타발수 오타 하나에 QR 을 다시 찍게 된다. 툴을 바꾸려면 다른 QR 을 읽으면 된다.
   */
  const resetDraft = (): void => {
    setDraft(emptyUsageDraft);
    setShotConfirmed(false);
    occurredAtRef.current = null;
    setSaved(null);
    write.reset();
  };

  const save = (): void => {
    if (!canSave(guard) || usableTool === null || increment === null) return;
    if (entry.workOrderId === null || entry.workerNo === null) return;

    occurredAtRef.current ??= new Date().toISOString();

    const isConverted = draft.method === COLLECTION_METHOD.converted;

    write.write({
      moldId: usableTool.moldId,
      workOrderId: entry.workOrderId,
      shotCount: increment,
      collectionMethodCode: draft.method,
      occurredAt: occurredAtRef.current,
      /* 환산에 쓴 기준 수량과 비율을 함께 저장한다 — 정책이 바뀌어도 과거 실적이 흔들리지 않게. */
      ...(isConverted && conversion.kind === 'ready'
        ? { conversionBaseQty: Number(draft.baseQty), conversionRatio: conversion.ratio }
        : {}),
    });
  };

  const uomCode = useWorkOrderUom(entry.workOrderId);
  /* 키패드가 넣는 칸 — 직접 입력이면 타발수, 생산 수량으로 계산하면 수량이다. */
  const padValue = isConverted ? draft.baseQty : draft.shotCount;
  const padUnit = isConverted ? uomCode : t.shot.unit;
  const usageWidth =
    usagePercentFigure.kind === 'value' ? Math.min(Math.max(usagePercentFigure.value, 0), 100) : 0;

  return (
    <PuScreen
      className="tu-screen"
      labelledBy={titleId}
      band={entry.workOrderId !== null}
      actionBar={
        <PuActionBar label={t.title}>
          <PuButton icon="reset" disabled={!hasInput(draft)} onClick={resetDraft}>
            {t.actions.reset}
          </PuButton>
          <PuButton variant="primary" disabled={!isSaveOpen} onClick={save}>
            {t.actions.save}
          </PuButton>
        </PuActionBar>
      }
    >
      {/* 표제는 셸 탭이 보인다 — 본문 이름으로만 남긴다. */}
      <h1 id={titleId} className="visually-hidden">
        {t.title}
      </h1>
      {entry.workOrderId !== null && <WorkOrderBand workOrderId={entry.workOrderId} />}

      <PuCols variant="lk">
        {/* 툴 스캔 — QR 이 실패해도 코드를 손으로 칠 수 있어야 한다(스펙 §6-1 · D-3). */}
        <PuSection title={t.scan.sectionLabel}>
          {/* ⭐ 사번 미확인은 모든 POP 화면이 같은 말로 알린다(사용자 지시 2026-09-17). */}
          {entry.workerNo === null && (
            <PuNote tone="warn">{messages.popChrome.workerMissing}</PuNote>
          )}
          {/* ⛔ 「타발수를 1 이상 기입하세요」는 세우지 않는다(사용자 지시 2026-09-17). 칸이 바로 보인다. */}
          {blockReason !== undefined && blockReason !== t.actionReasons.noShot && (
            <PuNote tone="warn">{blockReason}</PuNote>
          )}
          {lookup.isError && (
            <ErrorBanner
              error={toApiError(lookup.error)}
              title={messages.httpError.loadTitle}
              onRetry={() => void lookup.refetch()}
            />
          )}
          <PuScanField
            label={t.scan.inputLabel}
            ariaLabel={t.scan.inputLabel}
            required
            value={codeInput}
            onChange={setCodeInput}
            onSubmit={applyCode}
            done={usableTool !== null}
            autoFocus
            disabled={inputLocked}
            error={!scanFailed ? undefined : isDisposed ? t.scan.disposed : t.scan.notFound}
            manual={{ label: t.scan.inputLabel }}
          />
          {usableTool === null ? (
            <PuEmpty
              icon="scan"
              title={t.scan.empty}
              hint={saved !== null ? t.scan.nextHint : undefined}
            />
          ) : (
            <PuKv
              items={[
                {
                  label: t.scan.mold,
                  value: <span className="pu-mono">{usableTool.moldCode}</span>,
                },
                { label: t.scan.moldName, value: usableTool.moldName },
                { label: t.scan.cavity, value: String(usableTool.cavityCount) },
                { label: t.cumulative.guaranteed, value: guaranteedText },
                {
                  label: t.cumulative.current,
                  value: `${formatShots(serverShotCount)} ${t.shot.unit}`,
                },
              ]}
            />
          )}
        </PuSection>

        {/* 타발수 입력 — 타발수 칸은 늘 서고, 환산은 그 아래에서 값을 만든다(스펙 §3). */}
        <PuSection title={t.shot.sectionLabel} bodyClassName="tu-mid">
          <PuField label={t.shot.inputLabel} required htmlFor={shotInputId}>
            <div className="pu-row">
              {/*
               * ⭐ **환산을 켜면 이 칸은 «결과»를 보인다.** 사람이 고칠 수 있는 자리가 둘이면
               * 어느 값이 나가는지 알 수 없다 — 환산 중에는 읽기 전용이다.
               */}
              <PuInput
                id={shotInputId}
                aria-label={t.shot.inputLabel}
                numeric
                target={!shotLocked && !isConverted}
                need={write.fieldErrors.shotCount !== undefined}
                inputMode="numeric"
                placeholder="0"
                autoComplete="off"
                disabled={shotLocked}
                readOnly={isConverted}
                value={
                  isConverted ? (increment === null ? '' : formatShots(increment)) : draft.shotCount
                }
                onChange={(event) => {
                  changeDraft({ shotCount: digitsOnly(event.target.value) });
                }}
              />
              <PuUnit>{t.shot.unit}</PuUnit>
              {/*
               * ⭐ **타발수 칸 오른쪽에 [확인]이 선다**(사용자 지시 2026-09-17).
               *    ⛔ 저장하지 않는다 — 친 숫자를 확정만 하고, 저장은 [실적 저장]이다.
               */}
              <PuButton
                disabled={!canConfirmShot}
                onClick={() => {
                  setShotConfirmed(true);
                }}
              >
                {t.actions.confirm}
              </PuButton>
            </div>
          </PuField>
          {write.fieldErrors.shotCount !== undefined && (
            <PuNote tone="bad">{write.fieldErrors.shotCount}</PuNote>
          )}

          <div className="tu-switch">
            <span className="pu-help">
              {conversion.kind === 'loading' && t.shot.conversionLoading}
              {conversion.kind === 'off' && t.shot.conversionOff}
              {conversion.kind === 'unset' && t.shot.conversionUnavailable}
            </span>
            <label className="pu-check">
              <input
                type="checkbox"
                role="switch"
                checked={isConverted}
                disabled={shotLocked || conversion.kind !== 'ready'}
                onChange={(event) => {
                  changeDraft({
                    method: event.target.checked
                      ? COLLECTION_METHOD.converted
                      : COLLECTION_METHOD.direct,
                    shotCount: '',
                    baseQty: '',
                  });
                }}
              />
              {t.shot.convertedLabel}
            </label>
          </div>

          {isConverted && conversion.kind === 'ready' && (
            <>
              <PuField label={t.shot.baseQtyLabel} required htmlFor={baseQtyId}>
                <div className="pu-row">
                  <PuInput
                    id={baseQtyId}
                    aria-label={t.shot.baseQtyLabel}
                    numeric
                    target={!shotLocked}
                    need={write.fieldErrors.conversionBaseQty !== undefined}
                    inputMode="decimal"
                    placeholder="0"
                    autoComplete="off"
                    disabled={shotLocked}
                    value={draft.baseQty}
                    onChange={(event) => {
                      changeDraft({ baseQty: decimalOnly(event.target.value) });
                    }}
                  />
                  {uomCode !== '' && <PuUnit>{uomCode}</PuUnit>}
                </div>
              </PuField>
              {write.fieldErrors.conversionBaseQty !== undefined && (
                <PuNote tone="bad">{write.fieldErrors.conversionBaseQty}</PuNote>
              )}
              <p className="pu-help">
                {t.shot.convertedExpression(
                  draft.baseQty === '' ? '—' : draft.baseQty,
                  String(conversion.ratio),
                  increment === null ? '—' : formatShots(increment),
                )}
              </p>
            </>
          )}

          {/* 누계 — 넣는 값에 따라 바뀌는 것만(이번 입력 · 저장 후 예상 누계 · 사용 가능 · 사용률). */}
          {usableTool !== null && (
            <>
              <hr className="pu-sep" />
              <h3 className="tu-sub">
                {t.cumulative.sectionLabel}
                {asOfText !== null && <span className="asof">{asOfText}</span>}
              </h3>
              <dl className="tu-fig">
                <div>
                  <dt>{t.cumulative.increment}</dt>
                  <dd>{increment === null ? '—' : `+${formatShots(increment)} ${t.shot.unit}`}</dd>
                </div>
                <div className="is-after">
                  <dt>{t.cumulative.projected}</dt>
                  <dd>{figureText(projectedTotal(figures), t.cumulative.offlineProjection)}</dd>
                </div>
                <div className={isOver ? 'is-after is-over' : 'is-after'}>
                  <dt>{t.cumulative.available}</dt>
                  <dd>{figureText(availableShots(figures), t.cumulative.offlineProjection)}</dd>
                </div>
              </dl>
              {/*
               * ⛔ **적정타수가 없거나 연결이 끊기면 막대를 그리지 않는다**(스펙 §5-3 · §6-2).
               * 0% 로 그리면 「다 썼다」로, 캐시 값으로 그리면 실제보다 여유 있게 읽힌다.
               */}
              {usagePercentFigure.kind === 'value' && (
                <div className="tu-usage">
                  {t.cumulative.usageBarLabel}
                  <div
                    className={isOver ? 'pu-progress is-over' : 'pu-progress'}
                    role="progressbar"
                    aria-label={t.cumulative.usageLabel}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={Math.round(usagePercentFigure.value)}
                  >
                    <i style={{ width: `${String(usageWidth)}%` }} />
                  </div>
                  <b>{`${String(Math.round(usagePercentFigure.value))}%`}</b>
                </div>
              )}
              {availableShots(figures).kind === 'guaranteedMissing' && (
                <p className="pu-help">{t.cumulative.guaranteedMissing}</p>
              )}
              {!isOnline && <p className="pu-help">{t.cumulative.offlineBase}</p>}
            </>
          )}

          <ErrorBannerSlot error={write.error} onRetry={save} />
        </PuSection>

        {/* 「수량」 키패드 구획 — 생산 작업 화면과 같은 모양(단위 · 입력 칸 · [전체 삭제]). */}
        <PuSection title={t.pad.title} meta={t.pad.unit(padUnit === '' ? '—' : padUnit)}>
          <PuKeypad
            targetLabel={isConverted ? t.shot.baseQtyLabel : t.shot.inputLabel}
            /* 환산 기준 수량만 소수를 받는다 — 타발수는 정수다(스펙 §4-A `bigint`). */
            decimal={isConverted}
            disabled={shotLocked}
            onKey={(key) => {
              const next = applyKeypadKey(padValue, key, { decimal: isConverted });
              const cleaned = isConverted ? decimalOnly(next) : digitsOnly(next);
              /* 타발수 상한 — 계약이 정수로 받고, 자릿수를 넘겨 치는 것은 오타다. 그 위를 무시한다. */
              if (cleaned.length > SHOT_MAX_LENGTH) return;
              changeDraft(isConverted ? { baseQty: cleaned } : { shotCount: cleaned });
            }}
            onClearAll={() => {
              changeDraft(isConverted ? { baseQty: '' } : { shotCount: '' });
            }}
          />
        </PuSection>
      </PuCols>
    </PuScreen>
  );
};

/** 저장 실패 배너 — `null` 이면 아무것도 그리지 않는다. */
const ErrorBannerSlot = ({
  error,
  onRetry,
}: {
  error: ReturnType<typeof useToolUsageWrite>['error'];
  onRetry: () => void;
}) => {
  if (error === null) return null;

  return <ErrorBanner error={error} title={t.save.failTitle} onRetry={onRetry} />;
};
