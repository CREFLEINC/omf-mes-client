import { AlertBanner, Button, type Column, Dialog, IconButton, Table } from '@crefle/web-ui';
import type { ApiError, components } from '@omf-mes/api-client';
import { messages } from '@omf-mes/i18n';
import { useId, useRef } from 'react';

import { FieldLabel } from './field-label';
import { PlanActionBanner } from './plan-action-banner';

const t = messages.inspectionStandard.import;

export type BatchResult = components['schemas']['BatchResult'];
type BatchFailure = components['schemas']['BatchFailure'];

/** 파일 하나를 올린 결과. 서버가 받았으면 `result`, 파일째 거절됐으면(읽을 수 없다·권한 없음) `error` */
export interface ImportOutcome {
  fileName: string;
  result: BatchResult | null;
  error: ApiError | null;
}

/** 서버가 .xlsx 만 연다 — .xls 를 고르게 두면 「파일을 열 수 없습니다」로만 돌아온다. */
const ACCEPT = '.xlsx';

export interface ImportDialogProps {
  /** 고른 파일들. 아직 안 골랐으면 빈 배열 */
  files: File[];
  onSelectFiles: (files: File[]) => void;
  /** 파일별 결과. 올린 순서대로 쌓인다 — 올리는 중에도 끝난 파일부터 보인다 */
  outcomes: ImportOutcome[];
  isSaving: boolean;
  onClose: () => void;
  onSubmit: () => void;
}

/** 사유 여럿을 한 줄로 — 서버 문구가 「엑셀 N행: …」으로 행을 이미 말한다. */
const failureReason = (failure: BatchFailure): string =>
  failure.errors
    .map((item) => item.message)
    .filter((message) => message.trim() !== '')
    .join(' ');

const failureKey = (failure: BatchFailure): string =>
  failure.key === undefined || failure.key.trim() === '' ? t.keyUnknown : failure.key;

const COLUMNS: Column<BatchFailure>[] = [
  { key: 'key', header: t.fields.key, width: '180px', render: failureKey },
  { key: 'reason', header: t.fields.reason, render: failureReason },
];

/**
 * 검사기준 엑셀 올리기 창(#199). 툴 엑셀 올리기 창과 같은 짜임에 **여러 파일**을 받는다 —
 * 현장 기준서가 제품별 파일이라 한 번에 여러 개를 옮긴다.
 *
 * ⭐ **「통째로 되돌리지 않는다」와 「작성중 버전이 생긴다」를 올리기 «전에» 말한다.**
 * 올린 뒤에 알려 주면, 확정까지 된 줄 알고 현장에 내보내거나 같은 파일을 다시 올려 버전이 쌓인다.
 *
 * ⭐ **결과를 파일별로 남긴다.** 한 파일이 거절돼도 나머지는 반영된다 — 어느 파일이 됐는지
 * 보이지 않으면 전부 다시 올려 중복 버전이 생긴다.
 *
 * ⭐ **스크림 클릭으로 닫히지 않게 한다** — 올리는 중에 창이 사라지면 결과를 볼 곳이 없다.
 */
export const ImportDialog = ({
  files,
  onSelectFiles,
  outcomes,
  isSaving,
  onClose,
  onSubmit,
}: ImportDialogProps) => {
  const inputId = useId();
  const fileRequiredId = useId();
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <Dialog
      open
      onClose={onClose}
      closeOnBackdropClick={false}
      title={t.title}
      footer={
        <>
          <Button variant="outlined" disabled={isSaving} onClick={onClose}>
            {messages.common.close}
          </Button>
          <Button
            loading={isSaving}
            disabled={isSaving || files.length === 0}
            aria-describedby={files.length === 0 ? fileRequiredId : undefined}
            onClick={onSubmit}
          >
            {t.submit}
          </Button>
        </>
      }
    >
      <div className="form-grid dialog-scroll">
        <div className="form-grid-full">
          <AlertBanner variant="warning" title={t.partialWarningTitle}>
            {t.partialWarning}
          </AlertBanner>
        </div>

        <div className="form-grid-full">
          <AlertBanner variant="info">{t.draftNote}</AlertBanner>
        </div>

        <p className="form-grid-full dialog-lead">{t.columnsNote}</p>

        {/* 디자인 시스템에 파일 입력이 없다 — 툴 화면의 `FileField` 와 같이 숨긴 입력을 버튼이 부른다. */}
        <div className="field-cell">
          <FieldLabel htmlFor={inputId} label={t.fileLabel} />
          <input
            ref={inputRef}
            id={inputId}
            type="file"
            accept={ACCEPT}
            multiple
            disabled={isSaving}
            className="file-input"
            onChange={(event) => {
              onSelectFiles([...(event.target.files ?? [])]);
              // 같은 파일을 다시 골라도 onChange 가 오게 비운다.
              event.target.value = '';
            }}
          />
          <Button
            type="button"
            variant="outlined"
            disabled={isSaving}
            onClick={() => inputRef.current?.click()}
          >
            {t.filePlaceholder}
          </Button>
          <span className="field-note">
            {files.length === 0 ? t.fileNone : t.fileCount(files.length)}
          </span>
        </div>

        {files.length === 0 ? (
          <span id={fileRequiredId} className="field-note">
            {t.fileRequired}
          </span>
        ) : (
          <ul className="form-grid-full dialog-lead import-file-list">
            {files.map((file, index) => (
              <li key={`${String(index)}-${file.name}`}>
                <span>{file.name}</span>
                {/* 잘못 고른 파일 하나만 뺀다 — 다시 고르게 하면 나머지를 또 찾아야 한다. */}
                <IconButton
                  icon="close"
                  size="sm"
                  aria-label={t.removeFile(file.name)}
                  disabled={isSaving}
                  onClick={() => onSelectFiles(files.filter((_, at) => at !== index))}
                />
              </li>
            ))}
          </ul>
        )}

        {(outcomes.length > 0 || isSaving) && (
          <div className="form-grid-full">
            <h3 className="field-label">{t.resultTitle}</h3>
            {isSaving && <p>{t.progress(outcomes.length, files.length)}</p>}

            {outcomes.map((outcome, index) => (
              <section key={`${String(index)}-${outcome.fileName}`} aria-label={outcome.fileName}>
                <h4 className="field-label">{outcome.fileName}</h4>
                <PlanActionBanner error={outcome.error} />
                {outcome.result !== null && (
                  <>
                    {/* 성공과 실패를 둘 다 말한다 — 되돌리지 않는 경로라 한쪽만 말하면 중복 등록으로 이어진다. */}
                    <p>
                      {outcome.result.succeeded === 0
                        ? t.noneSucceeded
                        : t.succeeded(outcome.result.succeeded)}
                    </p>
                    <p>
                      {outcome.result.failed.length === 0
                        ? t.allSucceeded
                        : t.failed(outcome.result.failed.length)}
                    </p>
                    {outcome.result.failed.length > 0 && (
                      <div className="wide-table">
                        <Table
                          density="compact"
                          columns={COLUMNS}
                          rows={outcome.result.failed}
                          getRowId={(row) => String(row.index)}
                        />
                      </div>
                    )}
                  </>
                )}
              </section>
            ))}
          </div>
        )}
      </div>
    </Dialog>
  );
};
