import {
  AlertBanner,
  Button,
  Card,
  Chip,
  NumberPad,
  Progress,
  Switch,
  TextField,
} from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useId, useRef, useState, type FormEvent } from 'react';

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
import { canSave, hasInput, incrementOf, saveDisabledReason, type SaveGuard } from './usage-draft';
import {
  COLLECTION_METHOD,
  DISPOSED_STATUS_CODE,
  emptyUsageDraft,
  type Mold,
  type ToolUsage,
  type UsageDraft,
} from './types';

const t = messages.toolUsage;

/** 타발수 상한 — 계약이 정수로 받고, 자릿수를 넘겨 치는 것은 오타다. 키패드가 그 위를 무시한다. */
const SHOT_MAX_LENGTH = 9;

/** 저장 후 서버가 돌려준 누계를 그대로 보인다 — 화면의 예상치가 아니다. */
interface SaveResult {
  cumulativeShotCount: number | undefined;
}

const figureText = (figure: ShotFigure, offlineText: string, missingText: string): string => {
  switch (figure.kind) {
    case 'value':
      return `${formatShots(figure.value)} ${t.shot.unit}`;
    case 'offline':
      return offlineText;
    case 'guaranteedMissing':
      return missingText;
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
 * ⛔ **셸(`AppShell`)을 쓰지 않는다.** POP 은 사이드바로 옮겨 다니는 화면이 아니라 작업지시
 * 하나에 매인 태스크 화면이고, 세로 예산이 액션바까지 정해져 있다(스펙 §3). 그래서 배치 규범 8
 * 과 같은 사정으로 **자기 `<main>` 을 직접 렌더한다** — 관리웹에서 로그인 화면이 그렇게 선다.
 *
 * ⚠ **연결이 끊기면 저장을 막는다.** 스펙 §6-2 는 오프라인 버퍼링을 확정했지만 이 저장소에
 * 보낼 것 보관함(outbox)이 아직 없다 — 감추지 않고 사유를 말한다(`use-online.ts`).
 */
export const ToolUsageScreen = () => {
  const titleId = useId();
  const shotInputId = useId();

  const entry = usePopEntry();
  const isOnline = useOnline();

  /** 스캔칸에 치는 중인 값과, 조회를 건 값은 다르다 — 한 글자마다 서버를 부르지 않는다. */
  const [codeInput, setCodeInput] = useState('');
  /** 손으로 치는 중인가 — 안내 문구만 바뀐다. 스캐너와 입력 자리를 나누지 않는다. */
  const [isManualEntry, setIsManualEntry] = useState(false);
  const scanRef = useRef<HTMLInputElement>(null);
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
      setSaved({ cumulativeShotCount: usage.cumulativeShotCount });
    },
  });

  const changeDraft = (patch: Partial<UsageDraft>): void => {
    setDraft((prev) => ({ ...prev, ...patch }));
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

  const figures: FigureInput = {
    currentShotCount: usableTool?.currentShotCount ?? 0,
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
   * 누계를 «언제 받은 값»인가.
   *
   * ⚠ **서버가 시각을 주지 않는다** — 툴 마스터에 그 칸이 없다. 그래서 화면이 그 값을 받은
   * 시각을 적는다. 스펙 §3 이 요구하는 「○○ 기준」의 뜻(이 숫자가 언제 것인가)은 그대로 서고,
   * 없는 값을 지어내지도 않는다. 계약에 시각이 생기면 그 값으로 바꾼다.
   */
  const asOfText =
    lookup.dataUpdatedAt === 0
      ? null
      : t.cumulative.asOf(
          new Date(lookup.dataUpdatedAt).toLocaleTimeString('ko-KR', {
            hour: '2-digit',
            minute: '2-digit',
          }),
        );

  const submitCode = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    setSubmittedCode(codeInput.trim());
    setSaved(null);
    occurredAtRef.current = null;
    write.reset();
  };

  /**
   * 「다시 입력」 — **친 값만 지우고 고른 툴은 남긴다.**
   *
   * ⛔ 툴까지 지우면 타발수 오타 하나에 QR 을 다시 찍게 된다. 툴을 바꾸는 길은 스캔 구획의
   * 「툴 다시 고르기」로 따로 있다 — 두 액션은 지우는 대상이 다르다(스펙 §5-1).
   */
  const resetDraft = (): void => {
    setDraft(emptyUsageDraft);
    occurredAtRef.current = null;
    setSaved(null);
    write.reset();
  };

  const clearTool = (): void => {
    setCodeInput('');
    setSubmittedCode('');
    setIsManualEntry(false);
    resetDraft();
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

  return (
    <main className="pop-shell" aria-labelledby={titleId}>
      <header className="pop-header">
        <h1 id={titleId} className="pop-title">
          {t.title}
        </h1>
        <div className="pop-entry">
          {entry.workOrderId !== null && (
            <span>{`${t.entry.workOrderLabel} ${String(entry.workOrderId)}`}</span>
          )}
          {entry.workerNo !== null && <span>{`${t.entry.workerLabel} ${entry.workerNo}`}</span>}
          <Chip status={isOnline ? 'success' : 'warning'}>
            {isOnline ? t.entry.online : t.entry.offline}
          </Chip>
        </div>
      </header>

      <div className="pop-body">
        {lookup.isError && (
          <ErrorBanner
            error={toApiError(lookup.error)}
            title={messages.httpError.loadTitle}
            onRetry={() => void lookup.refetch()}
          />
        )}
        <ErrorBannerSlot error={write.error} onRetry={save} />

        {saved !== null && (
          <div className="banner-slot">
            <AlertBanner variant="success" title={t.save.successTitle}>
              {saved.cumulativeShotCount === undefined
                ? t.save.successBody
                : `${t.cumulative.current} ${formatShots(saved.cumulativeShotCount)} ${t.shot.unit}`}
            </AlertBanner>
          </div>
        )}

        {/* ① 툴 스캔 — QR 이 실패해도 코드를 손으로 칠 수 있어야 한다(스펙 §6-1 · D-3). */}
        <Card bordered className="pop-section" aria-label={t.scan.sectionLabel}>
          <Card.Body>
            <form className="pop-scan" onSubmit={submitCode}>
              <TextField
                ref={scanRef}
                label={t.scan.inputLabel}
                placeholder={isManualEntry ? t.scan.manualPlaceholder : t.scan.placeholder}
                size="xl"
                fullWidth
                autoFocus
                value={codeInput}
                onChange={(event) => {
                  setCodeInput(event.target.value);
                }}
              />
              {/*
               * ⭐ **조회 버튼을 두지 않는다.** 스캐너가 코드 끝에 Enter 를 붙여 보내므로 폼이
               * 그대로 제출된다 — 손으로 칠 때도 같은 길이다. 버튼을 두면 장갑 낀 손이 스캔
               * 뒤에 한 번 더 눌러야 한다.
               */}
              <Button
                type="button"
                size="2xl"
                variant="tonal"
                onClick={() => {
                  setIsManualEntry(true);
                  scanRef.current?.focus();
                }}
              >
                {t.scan.manualEntry}
              </Button>
            </form>

            {submittedCode !== '' && !lookup.isPending && tool === null && (
              <p className="field-note">{t.scan.notFound}</p>
            )}
            {isDisposed && <p className="field-error">{t.scan.disposed}</p>}

            {usableTool !== null && (
              <p className="pop-tool">
                <strong>{usableTool.moldCode}</strong>
                <span>{usableTool.moldName}</span>
                <span>{`${t.scan.cavity} ${String(usableTool.cavityCount)}`}</span>
                <Button variant="text" size="sm" onClick={clearTool}>
                  {t.scan.clear}
                </Button>
              </p>
            )}
          </Card.Body>
        </Card>

        {/* ② 타발수 입력 — 타발수 칸은 늘 서고, 환산은 그 아래에서 값을 만든다(스펙 §3). */}
        <Card bordered className="pop-section" aria-label={t.shot.sectionLabel}>
          <Card.Body>
            <div className="pop-shot">
              <div className="pop-shot-fields">
                {/*
                 * ⭐ **환산을 켜면 이 칸은 «결과»를 보인다.** 사람이 고칠 수 있는 자리가 둘이면
                 * 어느 값이 나가는지 알 수 없다 — 환산 중에는 읽기 전용이다.
                 */}
                <TextField
                  id={shotInputId}
                  label={t.shot.inputLabel}
                  size="xl"
                  fullWidth
                  inputMode="numeric"
                  readOnly={isConverted}
                  value={
                    isConverted
                      ? increment === null
                        ? ''
                        : formatShots(increment)
                      : draft.shotCount
                  }
                  error={write.fieldErrors.shotCount}
                  /* 단위는 칸 오른쪽 안에 붙인다 — 스펙 §3 의 「타발수 [1,250] 회」 */
                  trailingIcon={t.shot.unit}
                  onChange={(event) => {
                    changeDraft({ shotCount: event.target.value });
                  }}
                />

                <Switch
                  label={t.shot.convertedLabel}
                  checked={isConverted}
                  disabled={conversion.kind !== 'ready'}
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

                {conversion.kind === 'loading' && (
                  <p className="field-note">{t.shot.conversionLoading}</p>
                )}
                {conversion.kind === 'off' && <p className="field-note">{t.shot.conversionOff}</p>}
                {conversion.kind === 'unset' && (
                  <p className="field-note">{t.shot.conversionUnavailable}</p>
                )}

                {isConverted && conversion.kind === 'ready' && (
                  <div className="pop-conversion">
                    <TextField
                      label={t.shot.baseQtyLabel}
                      size="xl"
                      inputMode="decimal"
                      value={draft.baseQty}
                      error={write.fieldErrors.conversionBaseQty}
                      onChange={(event) => {
                        changeDraft({ baseQty: event.target.value });
                      }}
                    />
                    <p className="field-note">
                      {t.shot.convertedExpression(
                        draft.baseQty === '' ? '—' : draft.baseQty,
                        String(conversion.ratio),
                        increment === null ? '—' : formatShots(increment),
                      )}
                    </p>
                    <p className="field-note">{t.shot.roundedNote}</p>
                  </div>
                )}
              </div>

              <NumberPad
                aria-label={t.shot.keypadLabel}
                maxLength={SHOT_MAX_LENGTH}
                allowDecimal={isConverted}
                value={isConverted ? draft.baseQty : draft.shotCount}
                onChange={(value) => {
                  changeDraft(isConverted ? { baseQty: value } : { shotCount: value });
                }}
              />
            </div>
          </Card.Body>
        </Card>

        {/* ③ 누계 — 저장 전에 「저장하면 얼마가 남는가」를 보인다(스펙 §3 · §3-2). */}
        <Card bordered className="pop-section" aria-label={t.cumulative.sectionLabel}>
          <Card.Body>
            <dl className="pop-figures">
              <div>
                <dt>{t.cumulative.guaranteed}</dt>
                <dd>{guaranteedText}</dd>
              </div>
              <div>
                <dt>{t.cumulative.current}</dt>
                <dd>
                  {usableTool === null
                    ? '—'
                    : `${formatShots(usableTool.currentShotCount)} ${t.shot.unit}`}
                  {usableTool !== null && asOfText !== null && (
                    <span className="pop-figure-note">{asOfText}</span>
                  )}
                </dd>
              </div>
              <div>
                <dt>{t.cumulative.increment}</dt>
                <dd>{increment === null ? '—' : `+${formatShots(increment)} ${t.shot.unit}`}</dd>
              </div>

              {/* 구분선 — 위 셋은 「지금 사실」이고 아래 둘은 「저장하면 그렇게 된다」다. */}
              <div className="pop-figures-rule" />

              <div>
                <dt>{t.cumulative.projected}</dt>
                <dd>
                  {usableTool === null
                    ? '—'
                    : figureText(
                        projectedTotal(figures),
                        t.cumulative.offlineProjection,
                        t.cumulative.guaranteedMissing,
                      )}
                </dd>
              </div>
              <div>
                <dt>{t.cumulative.available}</dt>
                <dd className="pop-figure-usage">
                  <span>
                    {usableTool === null
                      ? '—'
                      : figureText(
                          availableShots(figures),
                          t.cumulative.offlineProjection,
                          t.cumulative.guaranteedMissing,
                        )}
                  </span>
                  {/*
                   * ⛔ **적정타수가 없거나 연결이 끊기면 막대를 그리지 않는다**(스펙 §5-3 · §6-2).
                   * 0% 로 그리면 「다 썼다」로, 캐시 값으로 그리면 실제보다 여유 있게 읽힌다.
                   */}
                  {usagePercentFigure.kind === 'value' && (
                    <Progress
                      label={t.cumulative.usageLabel}
                      value={usagePercentFigure.value}
                      showValue
                      tone={isOver ? 'error' : 'primary'}
                    />
                  )}
                </dd>
              </div>
            </dl>

            {!isOnline && usableTool !== null && (
              <p className="field-note">{t.cumulative.offlineBase}</p>
            )}
            {isOver && <p className="field-note">{t.cumulative.over}</p>}
          </Card.Body>
        </Card>

        {/* ④ 안내 — 누계를 서버가 더한다는 사실을 상시 밝힌다(스펙 §3-2). */}
        <Card bordered className="pop-section pop-notice" aria-label={t.notice.sectionLabel}>
          <Card.Body>{t.notice.serverAdds}</Card.Body>
        </Card>
      </div>

      <div className="pop-actions">
        <Button variant="outlined" size="2xl" disabled={!hasInput(draft)} onClick={resetDraft}>
          {t.actions.reset}
        </Button>
        <Button
          size="2xl"
          loading={write.isSaving}
          disabled={blockReason !== undefined}
          onClick={save}
        >
          {t.actions.save}
        </Button>
        {blockReason !== undefined && <p className="field-note">{blockReason}</p>}
      </div>
    </main>
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
