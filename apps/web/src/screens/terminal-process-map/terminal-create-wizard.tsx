import { Button, Dialog, EmptyState, Icon } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useEffect, useRef, useState } from 'react';

import { SaveErrorBanner } from '../../patterns/master';
import type { FlagKey } from './flags';
import {
  addProcess,
  hasNoFlag,
  hasProcess,
  removeProcess,
  setRow,
  splitRowErrors,
  toggleFlag,
  toReplaceBody,
  type GridDraft,
} from './grid-draft';
import { LoadErrorBanner } from './load-error-banner';
import { lookupNote, type LookupResult, type TerminalCodeNames } from './lookups';
import { ProcessGrid } from './process-grid';
import {
  useProcessesReplace,
  useTerminalCreate,
  useTerminalProcesses,
  useTokenIssue,
} from './queries';
import { SelectField } from './select-field';
import { toCreateBody, type TerminalDraft, type TerminalErrors } from './terminal-draft';
import { TerminalForm } from './terminal-form';
import { TokenPanel } from './token-dialog';
import type { TokenView } from './types';

const t = messages.terminalProcessMap;

/** 공정 기능을 고르는 단말 유형 — 창고에서 쓰는 단말(PDA 등)은 공정이 뜻이 없어 그 단계를 건너뛴다. */
const POP_TYPE = 'POP';

type Step = 'info' | 'processes' | 'connect';

/** 단말 정보 칸 — 서버가 이 칸들을 짚으면 첫 단계로 돌아가 칸 옆에 보인다. */
const INFO_FIELDS = ['terminalCode', 'plantId', 'terminalTypeCode', 'equipmentId', 'warehouseId'];

export interface TerminalCreateWizardProps {
  open: boolean;
  draft: TerminalDraft;
  errors: TerminalErrors;
  codeIsAuto: boolean;
  plants: LookupResult;
  processes: LookupResult;
  codeNames: TerminalCodeNames;
  onChange: (patch: Partial<TerminalDraft>) => void;
  /** 첫 단계 칸을 검사한다 — 오류를 칸에 걸고, 넘어가도 되면 `true`. */
  validate: () => boolean;
  /**
   * 닫혔다. 이 창에서 만든 단말이 있으면 그 번호 — 화면이 그 단말을 고른다.
   * `finished` 는 기기 연결까지 마쳤는가 — 마쳤으면 창이 이미 「등록했습니다」를 말했다.
   */
  onClose: (createdId: number | null, finished: boolean) => void;
}

/**
 * 단말 추가 — 단말 정보 → 공정 기능(POP만) → 기기 연결.
 *
 * ⭐ **[등록] 한 번이 세 쓰기를 잇는다** — 단말 만들기 → (공정이 있으면) 기능 구성 저장 → 등록 토큰 발급.
 * 기능 구성 저장은 구성 조회가 준 잠금 토큰을 요구하므로, 단말을 만든 뒤 그 단말의 구성을 한 번 읽고 보낸다.
 *
 * ⭐ **단말을 만든 뒤 멈추면 단말은 남는다.** [다시 시도]는 남은 쓰기만 한다 — 같은 단말을 두 번 만들지 않는다.
 * 이때 [이전]은 잠근다(단말 정보는 이미 저장됐다). 닫으면 화면이 그 단말을 골라 오른쪽에서 이어 할 수 있다.
 */
export const TerminalCreateWizard = ({
  open,
  draft,
  errors,
  codeIsAuto,
  plants,
  processes,
  codeNames,
  onChange,
  validate,
  onClose,
}: TerminalCreateWizardProps) => {
  const isPop = draft.terminalTypeCode === POP_TYPE;
  /** 유형을 고른 뒤에야 공정 단계를 건너뛸지 안다 — 고르기 전에는 [다음]. */
  const skipsProcesses = draft.terminalTypeCode !== '' && !isPop;
  /* 단계는 늘 셋 — 창고에서 쓰는 단말은 공정 기능 단계를 흐리게 두고 건너뛴다(자리가 바뀌지 않게). */
  const steps: Step[] = ['info', 'processes', 'connect'];

  const [step, setStep] = useState<Step>('info');
  const [grid, setGrid] = useState<GridDraft>([]);
  const [addTarget, setAddTarget] = useState('');
  const [gridNotice, setGridNotice] = useState<string | null>(null);
  const [created, setCreated] = useState<{ id: number; code: string } | null>(null);
  const [issued, setIssued] = useState<TokenView | null>(null);
  /** 단말을 만든 뒤 구성 조회를 기다려 기능 구성을 보낼 차례인가. */
  const [awaitingLock, setAwaitingLock] = useState(false);
  /** [등록]을 누른 때의 공정 줄 — 그 뒤 표를 고쳐도 보낸 것과 섞이지 않는다. */
  const rowsToSave = useRef<GridDraft>([]);
  const processesSaved = useRef(false);
  const sentProcessIds = useRef<number[]>([]);

  const createdId = created?.id ?? null;

  const token = useTokenIssue(createdId, (view) => {
    setIssued(view);
    setStep('connect');
  });

  const replace = useProcessesReplace(createdId, () => {
    processesSaved.current = true;
    token.write({});
  });

  const create = useTerminalCreate((view) => {
    setCreated({ id: view.terminalId, code: view.terminalCode });
    setAwaitingLock(true);
  });

  /* 새 단말의 구성 조회 — 기능 구성 저장의 잠금 토큰이 여기서 온다. 보낼 공정이 없으면 읽지 않는다. */
  const lockRows = useTerminalProcesses(rowsToSave.current.length > 0 ? createdId : null);

  useEffect(() => {
    if (!awaitingLock || createdId === null) return;

    if (rowsToSave.current.length === 0) {
      setAwaitingLock(false);
      token.write({});
      return;
    }

    if (!lockRows.isSuccess) return;

    setAwaitingLock(false);
    sentProcessIds.current = rowsToSave.current.map((row) => row.processId);
    replace.write(toReplaceBody(rowsToSave.current));
  }, [awaitingLock, createdId, lockRows.isSuccess, replace, token]);

  /* 서버가 단말 정보 칸을 짚으면 첫 단계로 돌아가 칸 옆에 보인다(코드 중복 등). */
  const infoFieldError = INFO_FIELDS.some((field) => create.fieldErrors[field] !== undefined);
  useEffect(() => {
    if (infoFieldError) setStep('info');
  }, [infoFieldError]);

  const isBusy =
    create.isSaving || replace.isSaving || token.isSaving || (awaitingLock && !lockRows.isError);

  const register = (rows: GridDraft): void => {
    if (createdId === null) {
      rowsToSave.current = rows;
      processesSaved.current = false;
      create.write(toCreateBody(draft));
      return;
    }

    /* 단말은 이미 있다 — 남은 쓰기만 다시 한다. */
    if (rowsToSave.current.length > 0 && !processesSaved.current) {
      if (lockRows.isError) void lockRows.refetch();
      setAwaitingLock(true);
      return;
    }

    token.write({});
  };

  const goNext = (): void => {
    if (!validate()) return;
    if (skipsProcesses) register([]);
    else setStep('processes');
  };

  const close = (): void => {
    if (isBusy) return;
    onClose(createdId, step === 'connect');
  };

  const serverRowErrors = splitRowErrors(replace.error, sentProcessIds.current);
  const noFlagIds = grid.filter(hasNoFlag).map((row) => row.processId);
  const rowErrors = new Map(serverRowErrors.rows);
  for (const processId of noFlagIds) rowErrors.set(processId, t.grid.noFlag);

  const addableProcesses = processes.entries.filter(
    (entry) => !grid.some((row) => String(row.processId) === entry.value),
  );

  const addRow = (value: string): void => {
    setAddTarget('');
    if (value === '') return;

    const processId = Number(value);
    const entry = processes.entries.find((item) => item.value === value);

    if (hasProcess(grid, processId)) {
      setGridNotice(t.grid.duplicate);
      return;
    }

    setGridNotice(null);
    setGrid(addProcess(grid, processId, entry?.label ?? value));
  };

  /* 단말은 만들었는데 이어지는 쓰기가 멈췄다 — 띠는 하나만(무엇이 멈췄는지는 아래 띠가 말한다). */
  const unfinished =
    createdId !== null &&
    !isBusy &&
    (replace.error !== null || token.error !== null || lockRows.isError);

  const banners = (
    <>
      {unfinished && (
        <p className="iqc-inspection-action-note terminal-map-wizard-note" data-tone="warning">
          <Icon name="warning" size={16} aria-hidden />
          {t.wizard.unfinished}
        </p>
      )}
      <SaveErrorBanner error={create.error} />
      <SaveErrorBanner error={serverRowErrors.rest} />
      <SaveErrorBanner error={token.error} />
      {lockRows.isError ? (
        <LoadErrorBanner
          error={lockRows.error}
          onRetry={() => {
            void lockRows.refetch();
          }}
        />
      ) : null}
    </>
  );

  const stepTitle: Record<Step, string> = {
    info: t.wizard.stepInfo,
    processes: t.wizard.stepProcesses,
    connect: t.wizard.stepConnect,
  };
  const currentIndex = steps.indexOf(step);

  const registerLabel = createdId === null ? t.wizard.register : t.wizard.retry;

  const footer =
    step === 'info' ? (
      <>
        <Button variant="outlined" disabled={isBusy} onClick={close}>
          {t.terminal.cancel}
        </Button>
        {skipsProcesses ? (
          <Button loading={isBusy} disabled={isBusy} onClick={goNext}>
            {registerLabel}
          </Button>
        ) : (
          <Button
            trailingIcon={<Icon name="arrow_forward" size={18} aria-hidden />}
            onClick={goNext}
          >
            {t.wizard.next}
          </Button>
        )}
      </>
    ) : step === 'processes' ? (
      <>
        <Button
          variant="outlined"
          className="terminal-map-wizard-back"
          leadingIcon={<Icon name="arrow_back" size={18} aria-hidden />}
          /* 단말을 만든 뒤에는 정보를 되돌려 고칠 수 없다 — 오른쪽 [단말 수정]으로 고친다. */
          disabled={isBusy || createdId !== null}
          onClick={() => {
            setStep('info');
          }}
        >
          {t.wizard.back}
        </Button>
        {isBusy && <p className="field-note form-actions-secondary">{t.wizard.saving}</p>}
        {createdId === null && (
          <Button
            variant="text"
            disabled={isBusy}
            onClick={() => {
              setGrid([]);
              register([]);
            }}
          >
            {t.wizard.skip}
          </Button>
        )}
        <Button
          loading={isBusy}
          disabled={isBusy || noFlagIds.length > 0}
          onClick={() => {
            register(grid);
          }}
        >
          {registerLabel}
        </Button>
      </>
    ) : (
      <Button onClick={close}>{t.wizard.done}</Button>
    );

  return (
    <Dialog
      open={open}
      size="lg"
      title={t.terminal.create}
      className="terminal-map-form-dialog terminal-map-wizard"
      closeOnBackdropClick={false}
      /* 닫기는 [취소] · [완료](사용자 지시 2026-11-20 · #333). */
      showCloseButton={false}
      onClose={close}
      footer={footer}
    >
      <ol className="terminal-map-steps" aria-label={t.wizard.stepsLabel}>
        {steps.map((item, index) => {
          const skipped = item === 'processes' && skipsProcesses;
          return (
            <li
              key={item}
              data-state={
                skipped
                  ? 'skip'
                  : index < currentIndex
                    ? 'done'
                    : index === currentIndex
                      ? 'current'
                      : 'todo'
              }
              aria-current={index === currentIndex ? 'step' : undefined}
            >
              <span className="terminal-map-step-number" aria-hidden="true">
                {index < currentIndex && !skipped ? <Icon name="check" size={14} /> : index + 1}
              </span>
              {stepTitle[item]}
              {skipped && <span className="terminal-map-step-skip">{t.wizard.popOnly}</span>}
            </li>
          );
        })}
      </ol>

      {step === 'info' && (
        <>
          {banners}
          <TerminalForm
            draft={draft}
            errors={errors}
            isNew
            codeIsAuto={codeIsAuto}
            saveError={null}
            fieldErrors={create.fieldErrors}
            plants={plants}
            codeNames={codeNames}
            onChange={onChange}
          />
        </>
      )}

      {step === 'processes' && (
        <>
          {banners}
          <div className="terminal-map-settings-head terminal-map-grid-head">
            <h3 className="terminal-map-settings-title">
              {t.wizard.summary(draft.terminalCode, grid.length)}
            </h3>
            <SelectField
              label={t.grid.add}
              options={addableProcesses.map((entry) => ({
                value: entry.value,
                label: entry.label,
              }))}
              value={addTarget}
              note={lookupNote(processes, t.grid.processLookupFailed)}
              error={gridNotice ?? undefined}
              placeholder={t.grid.addPlaceholder}
              className="terminal-map-add-field"
              disabled={isBusy || createdId !== null}
              onChange={addRow}
            />
          </div>
          <div className="terminal-map-grid-table">
            <ProcessGrid
              rows={grid}
              rowErrors={rowErrors}
              processWidth="200px"
              disabled={isBusy || createdId !== null}
              onToggle={(processId, key: FlagKey) => {
                setGrid(toggleFlag(grid, processId, key));
              }}
              onToggleRow={(processId, rowOpen) => {
                setGrid(setRow(grid, processId, rowOpen));
              }}
              onRemove={(processId) => {
                setGrid(removeProcess(grid, processId));
              }}
              empty={
                <EmptyState
                  size="sm"
                  className="terminal-map-grid-empty"
                  icon={
                    <span className="inspection-standard-empty-icon">
                      <Icon name="checklist" size={20} />
                    </span>
                  }
                  title={t.grid.emptyTitle}
                />
              }
            />
          </div>
        </>
      )}

      {step === 'connect' && issued !== null && created !== null && (
        <>
          <p className="terminal-map-wizard-done" role="status">
            <Icon name="check_circle" size={20} aria-hidden />
            {t.wizard.registered(created.code)}
          </p>
          <TokenPanel token={issued} terminalCode={created.code} />
        </>
      )}
    </Dialog>
  );
};
