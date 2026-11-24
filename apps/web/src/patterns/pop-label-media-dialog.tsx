import { messages } from '@omf-mes/i18n';
import { useEffect, useState } from 'react';

import {
  LABEL_MEDIA_LIMITS,
  LABEL_SIZE_PRESETS,
  isInLabelMediaRange,
  labelMediaShell,
  type LabelMediaField,
  type LabelMediaKind,
  type LabelMediaState,
  type LabelSettings,
} from './pop-label-media';
import { terminalPrinterName } from './pop-printer-choice';
import { printSampleLotLabel } from './pop-sample-label';
import {
  PuButton,
  PuDialog,
  PuField,
  PuInput,
  PuKeypad,
  PuKv,
  PuNote,
  PuTiles,
  PuUnit,
  applyKeypadKey,
  puToast,
  type PuKey,
} from './pop-uniform';

const t = messages.popChrome.labelMedia;

/** 칸 차례 — 키패드가 이 차례로 이름을 말한다. */
const FIELDS: readonly LabelMediaField[] = [
  'widthMm',
  'heightMm',
  'linerWidthMm',
  'gapMm',
  'offsetMm',
  'speed',
  'density',
];

/** 속도 · 농도는 정수만. 나머지는 mm 소수 한 자리. */
const isWhole = (field: LabelMediaField): boolean => field === 'speed' || field === 'density';

const fieldLabel = (field: LabelMediaField): string =>
  ({
    widthMm: t.width,
    heightMm: t.height,
    linerWidthMm: t.linerWidth,
    gapMm: t.gap,
    offsetMm: t.offset,
    speed: t.speed,
    density: t.density,
  })[field];

interface Draft {
  /** 크기를 직접 정하는가(아니면 프린터 설정을 따른다). */
  manual: boolean;
  kind: LabelMediaKind;
  values: Record<LabelMediaField, string>;
}

/** 크기 칸 — 직접 정할 때만 쓴다. */
const SIZE_FIELDS: readonly LabelMediaField[] = ['widthMm', 'heightMm', 'linerWidthMm'];

/**
 * 창을 열 때의 값 — 저장한 값이 있으면 그것, 없으면 지금 쓰는 값으로 칸을 채운다.
 *
 * ⭐ 이형지 폭은 처음 직접 정할 때 **프린터 설정의 가로**로 채운다 — 드라이버 크기가 이형지 폭이었다
 *    (82.6 × 39.9 · 라벨 80 × 40, 2026-11-24). 라벨 크기만 고쳐 넣어도 찍히는 자리가 그대로다.
 */
const draftOf = (state: LabelMediaState): Draft => {
  const source = state.saved ?? null;
  const size = source?.size ?? { widthMm: state.media.widthMm, heightMm: state.media.heightMm };
  const rest = source ?? state.media;
  const liner =
    source !== null && source.size !== null ? source.linerWidthMm : (state.driver?.widthMm ?? null);

  return {
    manual: source !== null && source.size !== null,
    kind: rest.kind,
    values: {
      widthMm: String(size.widthMm),
      heightMm: String(size.heightMm),
      linerWidthMm: liner === null ? '' : String(liner),
      gapMm: String(rest.gapMm),
      offsetMm: String(rest.offsetMm),
      speed: String(rest.speed),
      density: String(rest.density),
    },
  };
};

/** 칸 값을 설정으로. 범위를 벗어난 칸이 있으면 그 칸을 돌려준다 — 저장하지 않는다. */
const settingsOf = (
  draft: Draft,
): { settings: LabelSettings; invalid: null } | { settings: null; invalid: LabelMediaField } => {
  const used = FIELDS.filter((field) => draft.manual || !SIZE_FIELDS.includes(field));
  const numbers = {} as Record<LabelMediaField, number>;
  let liner: number | null = null;

  for (const field of used) {
    const raw = draft.values[field].trim();
    /* 이형지 폭은 비워도 된다 — 라벨 가로와 같다. */
    if (field === 'linerWidthMm' && raw === '') continue;
    const value = raw === '' ? Number.NaN : Number(raw);

    if (!isInLabelMediaRange(field, value) || (isWhole(field) && !Number.isInteger(value))) {
      return { settings: null, invalid: field };
    }

    numbers[field] = value;
    if (field === 'linerWidthMm') liner = value;
  }

  if (liner !== null && liner < numbers.widthMm) return { settings: null, invalid: 'linerWidthMm' };

  return {
    settings: {
      size: draft.manual ? { widthMm: numbers.widthMm, heightMm: numbers.heightMm } : null,
      kind: draft.kind,
      gapMm: numbers.gapMm,
      offsetMm: numbers.offsetMm,
      speed: numbers.speed,
      density: numbers.density,
      linerWidthMm: draft.manual ? liner : null,
    },
    invalid: null,
  };
};

const sameSettings = (left: LabelSettings | null, right: LabelSettings | null): boolean =>
  JSON.stringify(left) === JSON.stringify(right);

const reasonOf = (cause: unknown): string =>
  cause instanceof Error ? cause.message : String(cause);

/**
 * **라벨지 설정 창**(톱니 설정 → 라벨지 설정 · 사용자 지시 2026-11-24).
 *
 * ⭐ 크기가 다른 라벨지로 갈아 끼웠을 때 앱을 끄지 않고 맞춘다 — [저장]하면 셸이 단말에 남기고 다음 인쇄부터
 *    바로 따른다. 숨은 단축키(Ctrl+Alt+G 보정 · Ctrl+Alt+P 견본)를 이 창의 단추로 옮겼다.
 * ⛔ **서버를 부르지 않는다** — 셸 통로(`labelMedia`)와 셸 인쇄 통로만 쓴다. 서버가 죽어 있어도 맞출 수 있다.
 * ⚠ [보정] · [견본 인쇄]는 **저장한 값**으로 찍는다 — 바꾼 채 저장하지 않았으면 꺼 두고 「저장한 뒤」를 알린다.
 *   찍어 본 값과 실제 발행 값이 갈리지 않게 하려는 것이다.
 */
export const PopLabelMediaDialog = ({ onClose }: { onClose: () => void }) => {
  const [shell] = useState(labelMediaShell);
  /* 발행 화면과 같은 프린터로 읽고 · 보정하고 · 찍는다(머리줄 프린터 칩이 고른 것). */
  const [printerName] = useState(() => terminalPrinterName() ?? undefined);
  const [state, setState] = useState<LabelMediaState | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [target, setTarget] = useState<LabelMediaField | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let alive = true;

    if (shell === null) {
      setLoadError(t.loadFailed);
      return undefined;
    }

    shell
      .read(printerName)
      .then((read) => {
        if (!alive) return;
        setState(read);
        setDraft(draftOf(read));
      })
      .catch(() => {
        if (alive) setLoadError(t.loadFailed);
      });

    return () => {
      alive = false;
    };
  }, [shell, printerName]);

  const parsed = draft === null ? null : settingsOf(draft);
  const invalidField = parsed === null ? null : parsed.invalid;
  const draftSettings = parsed === null ? null : parsed.settings;
  /* 저장한 값이 없으면 「지금 쓰는 값으로 채운 칸」과 견준다 — 칸을 그대로 두었으면 바꾼 것이 없다. */
  const isDirty =
    state !== null &&
    draft !== null &&
    (invalidField !== null ||
      !sameSettings(draftSettings, state.saved ?? settingsOf(draftOf(state)).settings));
  const canSave = isDirty && draftSettings !== null && !busy;
  const canTest = state !== null && state.hasPrinter && !isDirty && !busy;

  const setValue = (field: LabelMediaField, value: string): void => {
    setDraft((current) =>
      current === null ? current : { ...current, values: { ...current.values, [field]: value } },
    );
  };

  const pressKey = (key: PuKey): void => {
    if (target === null || draft === null) return;
    setValue(
      target,
      applyKeypadKey(draft.values[target], key, { decimal: !isWhole(target), maxDecimals: 1 }),
    );
  };

  const save = async (settings: LabelSettings | null, done: string): Promise<void> => {
    if (shell === null) return;
    setBusy(true);
    try {
      const next = await shell.save(settings, printerName);
      setState(next);
      setDraft(draftOf(next));
      setTarget(null);
      puToast(done);
    } catch {
      puToast(t.saveFailed, 'bad');
    } finally {
      setBusy(false);
    }
  };

  const runTest = async (kind: 'calibrate' | 'sample'): Promise<void> => {
    if (shell === null) return;
    setBusy(true);
    try {
      if (kind === 'calibrate') await shell.calibrate(printerName);
      else await printSampleLotLabel(printerName);
      puToast(kind === 'calibrate' ? t.calibrated : t.sampled);
    } catch (cause) {
      puToast(`${t.printFailed} ${reasonOf(cause)}`, 'bad');
    } finally {
      setBusy(false);
    }
  };

  const input = (field: LabelMediaField) => {
    const limits = LABEL_MEDIA_LIMITS[field];
    const invalid = invalidField === field;

    return (
      <PuField
        label={fieldLabel(field)}
        optional={field === 'linerWidthMm' ? t.linerEmpty : t.range(limits.min, limits.max)}
        htmlFor={`pop-label-media-${field}`}
      >
        <span className="pop-label-media__input">
          <PuInput
            id={`pop-label-media-${field}`}
            numeric
            inputMode={isWhole(field) ? 'numeric' : 'decimal'}
            value={draft?.values[field] ?? ''}
            need={invalid}
            target={target === field}
            disabled={busy || draft === null || (field === 'gapMm' && draft.kind === 'continuous')}
            onFocus={() => {
              setTarget(field);
            }}
            onChange={(event) => {
              setValue(field, event.target.value.replace(/[^0-9.]/gu, ''));
            }}
          />
          {isWhole(field) ? null : <PuUnit>mm</PuUnit>}
        </span>
      </PuField>
    );
  };

  const sizeText = (width: number, height: number): string => t.sizeValue(width, height);

  return (
    <PuDialog
      wide
      title={t.title}
      onClose={onClose}
      footer={
        <>
          <PuButton disabled={busy} onClick={onClose}>
            {isDirty ? t.cancel : t.close}
          </PuButton>
          <PuButton
            variant="primary"
            disabled={!canSave}
            onClick={() => {
              if (draftSettings !== null) void save(draftSettings, t.saved);
            }}
          >
            {t.save}
          </PuButton>
        </>
      }
    >
      {loadError !== null ? (
        <PuNote tone="bad">{loadError}</PuNote>
      ) : state === null || draft === null ? (
        <PuNote live>{t.loading}</PuNote>
      ) : (
        <div className="pop-label-media">
          <div className="pop-label-media__form">
            <div className="pop-label-media__current">
              <PuKv
                cols2
                items={[
                  {
                    label: t.printer,
                    value:
                      state.printer === null
                        ? t.noPrinter
                        : state.printer === '(OS 기본)'
                          ? t.printerDefault
                          : state.printer,
                  },
                  {
                    label: t.size,
                    value: (
                      <>
                        {sizeText(state.media.widthMm, state.media.heightMm)}{' '}
                        <span className="pop-label-media__source">
                          {t.source[state.sizeSource]}
                        </span>
                        {state.media.linerWidthMm !== null && (
                          <span className="pop-label-media__source">
                            {t.linerValue(state.media.linerWidthMm)}
                          </span>
                        )}
                      </>
                    ),
                  },
                  {
                    label: t.kind,
                    value: t.separatorValue(
                      t.kinds[state.media.kind],
                      t.mm(state.media.gapMm),
                      t.mm(state.media.offsetMm),
                    ),
                  },
                  {
                    label: t.printSettings,
                    value: t.printValue(state.media.speed, state.media.density),
                  },
                ]}
              />
              {state.saved !== null && (
                <PuButton
                  size="sm"
                  disabled={busy}
                  onClick={() => {
                    void save(null, t.cleared);
                  }}
                >
                  {t.clear}
                </PuButton>
              )}
            </div>

            <PuField label={t.size}>
              <PuTiles
                label={t.sizeMode}
                cols={2}
                disabled={busy}
                value={draft.manual ? 'manual' : 'driver'}
                options={[
                  {
                    value: 'driver',
                    label:
                      state.driver === null
                        ? t.followDriver
                        : `${t.followDriver} (${sizeText(state.driver.widthMm, state.driver.heightMm)})`,
                  },
                  { value: 'manual', label: t.manual },
                ]}
                onChange={(mode) => {
                  setDraft({ ...draft, manual: mode === 'manual' });
                  if (mode === 'driver' && (target === 'widthMm' || target === 'heightMm')) {
                    setTarget(null);
                  }
                }}
              />
            </PuField>
            {!draft.manual && state.driver === null && (
              <PuNote tone="warn">{t.driverUnknown}</PuNote>
            )}
            {!draft.manual && state.envPinned && <PuNote>{t.envPinned}</PuNote>}
            {draft.manual && (
              <>
                <div className="pop-label-media__row">
                  {input('widthMm')}
                  {input('heightMm')}
                  {input('linerWidthMm')}
                </div>
                <PuNote>{t.linerHint}</PuNote>
                <PuTiles
                  label={t.presets}
                  cols={LABEL_SIZE_PRESETS.length}
                  disabled={busy}
                  value={
                    LABEL_SIZE_PRESETS.find(
                      (preset) =>
                        String(preset.widthMm) === draft.values.widthMm &&
                        String(preset.heightMm) === draft.values.heightMm,
                    ) === undefined
                      ? null
                      : `${draft.values.widthMm}x${draft.values.heightMm}`
                  }
                  options={LABEL_SIZE_PRESETS.map((preset) => ({
                    value: `${String(preset.widthMm)}x${String(preset.heightMm)}`,
                    label: sizeText(preset.widthMm, preset.heightMm),
                  }))}
                  onChange={(value) => {
                    const [width = '', height = ''] = value.split('x');
                    /* 이형지가 새 라벨보다 좁으면 비운다 — 라벨 가로와 같게 본다. */
                    const liner = draft.values.linerWidthMm;
                    setDraft({
                      ...draft,
                      values: {
                        ...draft.values,
                        widthMm: width,
                        heightMm: height,
                        linerWidthMm: liner !== '' && Number(liner) < Number(width) ? '' : liner,
                      },
                    });
                  }}
                />
              </>
            )}

            <PuField label={t.kind}>
              <PuTiles
                label={t.kind}
                cols={3}
                disabled={busy}
                value={draft.kind}
                options={(['gap', 'bline', 'continuous'] as const).map((kind) => ({
                  value: kind,
                  label: t.kinds[kind],
                }))}
                onChange={(kind) => {
                  setDraft({ ...draft, kind });
                }}
              />
            </PuField>
            <div className="pop-label-media__row">
              {input('gapMm')}
              {input('offsetMm')}
              {input('speed')}
              {input('density')}
            </div>
            {invalidField !== null && (
              <PuNote tone="bad">
                {invalidField === 'linerWidthMm' &&
                isInLabelMediaRange('linerWidthMm', Number(draft.values.linerWidthMm))
                  ? t.linerNarrow
                  : t.outOfRange(
                      fieldLabel(invalidField),
                      LABEL_MEDIA_LIMITS[invalidField].min,
                      LABEL_MEDIA_LIMITS[invalidField].max,
                    )}
              </PuNote>
            )}

            <PuField label={t.test}>
              <div className="pop-label-media__test">
                <PuButton
                  icon="reset"
                  disabled={!canTest}
                  onClick={() => {
                    void runTest('calibrate');
                  }}
                >
                  {t.calibrate}
                </PuButton>
                <span>{t.calibrateHint}</span>
                <PuButton
                  icon="print"
                  disabled={!canTest}
                  onClick={() => {
                    void runTest('sample');
                  }}
                >
                  {t.sample}
                </PuButton>
                <span>{t.sampleHint}</span>
              </div>
            </PuField>
            {isDirty && <PuNote tone="warn">{t.saveFirst}</PuNote>}
            {!state.hasPrinter && <PuNote tone="warn">{t.noPrinter}</PuNote>}
          </div>
          <PuKeypad
            targetLabel={target === null ? null : fieldLabel(target)}
            decimal={target === null || !isWhole(target)}
            disabled={busy}
            onKey={pressKey}
            onClearAll={() => {
              if (target !== null) setValue(target, '');
            }}
          />
        </div>
      )}
    </PuDialog>
  );
};
