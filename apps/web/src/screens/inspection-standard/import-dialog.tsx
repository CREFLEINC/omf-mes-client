import { AlertBanner, Button, Chip, Dialog, Icon, IconButton } from '@crefle/web-ui';
import type { ApiError, components } from '@omf-mes/api-client';
import { messages } from '@omf-mes/i18n';
import { useEffect, useId, useRef } from 'react';

import { serverReasonOf } from '../../patterns/server-reason';
import { FieldLabel } from './field-label';

const t = messages.inspectionStandard.import;

export type BatchResult = components['schemas']['BatchResult'];
type BatchFailure = components['schemas']['BatchFailure'];

/**
 * 올리기 결과 — `BatchResult` 에 반영된 기준마다 만든 작성중 버전을 더한다(계약 `InspectionPlanImportResult` · #208).
 * forward-contract: 서버 계약이 들어오면 생성 타입으로 바꾼다. 옛 서버는 `created` 를 주지 않는다.
 */
export type InspectionPlanImportResult = BatchResult & {
  created?: { index: number; key: string; inspectionPlanVersionId: number }[];
};

/** 올린 뒤 확정하지 못한 기준 하나 — 버전은 작성중으로 남는다. */
export interface ConfirmFailure {
  key: string;
  reason: string;
}

/** 파일 하나를 올린 결과. 서버가 받았으면 `result`, 파일째 거절됐으면(읽을 수 없다·권한 없음) `error` */
export interface ImportOutcome {
  /** 고른 파일 그 자체 — 같은 이름으로 다시 고른 파일과 결과를 섞지 않는다 */
  file: File;
  result: BatchResult | null;
  error: ApiError | null;
  /** 올린 뒤 바로 확정하다 실패한 기준(#208) — 그 파일 줄에 사유를 남긴다 */
  confirmFailures: ConfirmFailure[];
}

export type ImportStatus = 'pending' | 'running' | 'success' | 'failed' | 'partial';

/**
 * 파일 하나의 상태(#208).
 * - 실패: 파일째 거절됐거나 반영된 기준이 하나도 없다 — 서버에 남은 것이 없어 **다시 올려도 안전하다**.
 * - 일부 실패: 반영된 기준이 있는데 실패 · 확정 실패가 섞였다 — 다시 올리면 성공한 기준이 한 번 더 만들어진다.
 */
export const importStatusOf = (
  outcome: ImportOutcome,
): Exclude<ImportStatus, 'pending' | 'running'> => {
  if (outcome.result === null || outcome.result.succeeded === 0) return 'failed';
  if (outcome.result.failed.length > 0 || outcome.confirmFailures.length > 0) return 'partial';
  return 'success';
};

const STATUS_CHIP: Record<ImportStatus, 'idle' | 'success' | 'error' | 'warning'> = {
  pending: 'idle',
  running: 'warning',
  success: 'success',
  failed: 'error',
  partial: 'error',
};

/** 결과가 난 파일을 위로 — 실패 · 일부 실패, 그다음 대기 · 처리 중, 성공은 아래(사용자 지시 · #208). */
const STATUS_ORDER: Record<ImportStatus, number> = {
  failed: 0,
  partial: 0,
  running: 1,
  pending: 1,
  success: 2,
};

/** 서버 문구가 「엑셀 N행: …」으로 행을 이미 말한다 — 기준코드를 앞에 붙인다. */
const failureLine = (failure: BatchFailure): string =>
  t.failureLine(
    failure.key === undefined || failure.key.trim() === '' ? t.keyUnknown : failure.key,
    failure.errors
      .map((item) => item.message)
      .filter((message) => message.trim() !== '')
      .join(' '),
  );

/** 파일 줄 아래에 붙일 사유들. */
const reasonLinesOf = (outcome: ImportOutcome): string[] => {
  if (outcome.error !== null) {
    return [serverReasonOf(outcome.error) ?? messages.httpError.description];
  }
  return [
    ...(outcome.result?.failed ?? []).map(failureLine),
    ...outcome.confirmFailures.map((failure) => t.confirmFailed(failure.key, failure.reason)),
  ];
};

export interface ImportDialogProps {
  /** 고른 파일들. 아직 안 골랐으면 빈 배열 */
  files: File[];
  onSelectFiles: (files: File[]) => void;
  /** 파일별 결과. 결과가 없는 파일은 아직 올리지 않은 것이다 */
  outcomes: ImportOutcome[];
  /** 지금 올리는 파일과 이번 올리기의 진행(처리한 수 / 대상 수). 올리는 중이 아니면 null */
  progress: { running: File; done: number; total: number } | null;
  onClose: () => void;
  /** 대기 · 실패 파일을 올린다 */
  onSubmit: () => void;
}

/**
 * 검사기준 엑셀 올리기 창(#199 · #208). 고른 파일 목록 한 곳에 파일별 상태와 사유를 함께 낸다 —
 * 파일 목록과 결과 목록을 따로 두면 파일이 많을 때 창이 지나치게 길어진다(사용자 지시 · #208).
 *
 * ⭐ **이미 반영된 파일은 다시 보내지 않는다.** 성공 · 일부 실패 파일은 빼기 · 재시도 대상이 아니다 —
 * 서버는 기준 단위로 되돌리지 않으므로 다시 올리면 성공한 기준의 버전이 한 번 더 생긴다.
 *
 * ⭐ **스크림 클릭으로 닫히지 않게 한다** — 올리는 중에 창이 사라지면 결과를 볼 곳이 없다.
 */
export const ImportDialog = ({
  files,
  onSelectFiles,
  outcomes,
  progress,
  onClose,
  onSubmit,
}: ImportDialogProps) => {
  const inputId = useId();
  const fileRequiredId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const isSaving = progress !== null;

  /*
   * 파일 고르기 창의 「취소」는 입력칸에서 `cancel` 사건을 올리고, 그 사건이 위로 번져
   * 바깥 창(<dialog>)의 닫기로 읽힌다 — 입력칸에서 멈춘다(#208). React 타입에 입력칸 onCancel 이 없어 직접 단다.
   */
  useEffect(() => {
    const input = inputRef.current;
    if (input === null) return;

    const stop = (event: Event) => event.stopPropagation();
    input.addEventListener('cancel', stop);

    return () => input.removeEventListener('cancel', stop);
  }, []);

  const outcomeOf = (file: File): ImportOutcome | undefined =>
    outcomes.find((outcome) => outcome.file === file);
  const statusOf = (file: File): ImportStatus => {
    if (file === progress?.running) return 'running';
    const outcome = outcomeOf(file);
    return outcome === undefined ? 'pending' : importStatusOf(outcome);
  };
  /* 다시 보내도 되는 파일 — 아직 안 올린 것과 서버에 남은 것이 없는 실패 */
  const isOpen = (file: File): boolean => {
    const status = statusOf(file);
    return status === 'pending' || status === 'failed';
  };

  const rows = files
    .map((file, at) => ({ file, at, status: statusOf(file) }))
    .sort((a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status] || a.at - b.at);
  const targets = files.filter(isOpen);
  const hasResults = outcomes.length > 0;
  const succeededCount = rows.filter((row) => row.status === 'success').length;
  const failedCount = rows.filter(
    (row) => row.status === 'failed' || row.status === 'partial',
  ).length;
  /* 결과가 난 뒤 남은 대상이 모두 실패 파일이면 「실패 파일 재시도」, 새로 고른 파일이 있으면 「올리기」 */
  const submitLabel =
    hasResults && targets.every((file) => outcomeOf(file) !== undefined) ? t.retry : t.submit;

  return (
    <Dialog
      open
      onClose={onClose}
      closeOnBackdropClick={false}
      /* 닫기는 바닥 줄의 「닫기」 하나로 둔다(사용자 지시 · #208). */
      showCloseButton={false}
      title={t.title}
      footer={
        <>
          <Button variant="outlined" disabled={isSaving} onClick={onClose}>
            {messages.common.close}
          </Button>
          {/* 다시 보낼 파일이 없으면 단추를 두지 않는다 — 반영된 파일을 한 번 더 올리지 않게(사용자 지시 · #208). */}
          {(!hasResults || targets.length > 0 || isSaving) && (
            <Button
              loading={isSaving}
              disabled={isSaving || targets.length === 0}
              aria-describedby={files.length === 0 ? fileRequiredId : undefined}
              onClick={onSubmit}
            >
              {submitLabel}
            </Button>
          )}
        </>
      }
    >
      <div className="form-grid dialog-scroll">
        <div className="form-grid-full">
          {/* 되돌릴 수 없다는 경고 한 줄 — 높이를 줄였다(사용자 지시 · #208). */}
          <AlertBanner variant="warning">
            <span className="inspection-standard-import-text">{t.partialWarning}</span>
          </AlertBanner>
        </div>

        {/*
         * 파일 상자 — 머리 줄(건수 또는 결과 요약 · 「파일 추가」), 구분선, 파일 목록(사용자 시안 · #208).
         * 디자인 시스템에 파일 입력이 없다 — 툴 화면의 `FileField` 와 같이 숨긴 입력을 버튼이 부른다.
         */}
        <div className="form-grid-full inspection-standard-import-files">
          <div className="inspection-standard-import-files-label">
            <FieldLabel htmlFor={inputId} label={t.fileLabel} />
            <span className="field-note">{t.fileHint}</span>
          </div>
          <input
            ref={inputRef}
            id={inputId}
            type="file"
            accept=".xlsx"
            multiple
            disabled={isSaving}
            className="file-input"
            onChange={(event) => {
              /*
               * 「파일 추가」 — 고른 목록에 더한다. 같은 이름의 대기 · 실패 파일은 새로 고른 것으로 바꾼다.
               * 이미 반영된 파일과 같은 이름은 받지 않는다 — 같은 내용을 한 번 더 올리게 된다.
               */
              const done = new Set(files.filter((file) => !isOpen(file)).map((file) => file.name));
              const picked = [...(event.target.files ?? [])].filter((file) => !done.has(file.name));
              const names = new Set(picked.map((file) => file.name));
              onSelectFiles([...files.filter((file) => !names.has(file.name)), ...picked]);
              // 같은 파일을 다시 골라도 onChange 가 오게 비운다.
              event.target.value = '';
            }}
          />
          <div className="inspection-standard-import-box">
            <div className="inspection-standard-import-box-head">
              <Icon name="file_copy" size={20} aria-hidden />
              {files.length === 0 ? (
                <span id={fileRequiredId}>{t.fileRequired}</span>
              ) : (
                <strong>
                  {hasResults
                    ? t.summary(files.length, succeededCount, failedCount)
                    : t.fileCount(files.length)}
                </strong>
              )}
              <Button
                type="button"
                variant="outlined"
                size="sm"
                disabled={isSaving}
                onClick={() => inputRef.current?.click()}
              >
                {t.filePlaceholder}
              </Button>
            </div>
            {progress !== null && (
              <p className="field-note inspection-standard-import-progress" role="status">
                {t.progress(progress.done, progress.total)}
              </p>
            )}
            {files.length > 0 && (
              /* 파일이 많으면 목록 안에서만 스크롤한다(사용자 지시 · #208). */
              <ul className="inspection-standard-import-file-list">
                {rows.map(({ file, at, status }) => {
                  const outcome = outcomeOf(file);
                  const reasons =
                    outcome === undefined || status === 'success' ? [] : reasonLinesOf(outcome);
                  const result = outcome?.result ?? null;
                  return (
                    <li key={`${String(at)}-${file.name}`} aria-label={file.name}>
                      <div className="inspection-standard-import-file-row">
                        <Icon name="table_chart" size={18} aria-hidden />
                        <span>{file.name}</span>
                        <Chip variant="status" status={STATUS_CHIP[status]}>
                          {t.status[status]}
                        </Chip>
                        {/* 대기 · 실패 파일만 뺄 수 있다 — 반영된 파일의 결과는 남긴다. */}
                        {isOpen(file) && (
                          <IconButton
                            icon="close"
                            size="sm"
                            aria-label={t.removeFile(file.name)}
                            disabled={isSaving}
                            onClick={() => onSelectFiles(files.filter((_, index) => index !== at))}
                          />
                        )}
                      </div>
                      {reasons.length > 0 && (
                        <div className="inspection-standard-import-reasons">
                          {/* 한 파일에 기준이 여럿이면 기준 단위 건수도 낸다 — 파일 성공 · 실패와 다르다. */}
                          {result !== null && result.succeeded + result.failed.length > 1 && (
                            <p>{t.criteriaCounts(result.succeeded, result.failed.length)}</p>
                          )}
                          {reasons.map((line, index) => (
                            <p key={`${String(index)}-${line}`} className="field-error">
                              {line}
                            </p>
                          ))}
                          {status === 'partial' && (
                            <p>
                              {outcome !== undefined && outcome.confirmFailures.length > 0
                                ? t.confirmNote
                                : t.partialNote}
                            </p>
                          )}
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>

        {/* 형식 안내는 접어 둔다 — 처음 쓰는 사람만 펼쳐 본다(사용자 시안 · #208). */}
        <details className="form-grid-full inspection-standard-import-guide">
          <summary>
            <Icon name="info" size={18} aria-hidden />
            {t.formatGuide}
            <Icon name="expand_more" size={20} aria-hidden />
          </summary>
          <div className="inspection-standard-import-guide-body">
            <p>{t.guideHeaderRow}</p>
            <p>{t.guideRequiredColumns}</p>
            <p>{t.guideTckt}</p>
          </div>
        </details>
      </div>
    </Dialog>
  );
};
