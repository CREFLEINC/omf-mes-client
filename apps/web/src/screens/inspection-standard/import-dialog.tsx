import { AlertBanner, Button, type Column, Dialog, Table } from '@crefle/web-ui';
import type { components } from '@omf-mes/api-client';
import { messages } from '@omf-mes/i18n';
import { useId, type ReactNode } from 'react';

import { FileField } from '../tool-master/file-field';

const t = messages.inspectionStandard.import;

export type BatchResult = components['schemas']['BatchResult'];
type BatchFailure = components['schemas']['BatchFailure'];

/** 서버가 .xlsx 만 연다 — .xls 를 고르게 두면 「파일을 열 수 없습니다」로만 돌아온다. */
const ACCEPT = '.xlsx';

export interface ImportDialogProps {
  /** 고른 파일. 아직 안 골랐으면 `null` */
  file: File | null;
  onSelectFile: (file: File | null) => void;
  /** 서버가 돌려준 결과. 아직 안 올렸으면 `null` */
  result: BatchResult | null;
  /** 올리기 실패 배너 슬롯(파일을 읽을 수 없다 · 권한 없음) */
  banner: ReactNode;
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

/**
 * 검사기준 엑셀 올리기 창(#199). 툴 엑셀 올리기 창과 같은 짜임이다.
 *
 * ⭐ **「통째로 되돌리지 않는다」와 「작성중 버전이 생긴다」를 올리기 «전에» 말한다.**
 * 올린 뒤에 알려 주면, 확정까지 된 줄 알고 현장에 내보내거나 같은 파일을 다시 올려 버전이 쌓인다.
 *
 * ⭐ **스크림 클릭으로 닫히지 않게 한다** — 올리는 중에 창이 사라지면 결과를 볼 곳이 없다.
 */
export const ImportDialog = ({
  file,
  onSelectFile,
  result,
  banner,
  isSaving,
  onClose,
  onSubmit,
}: ImportDialogProps) => {
  const fileRequiredId = useId();
  const columns: Column<BatchFailure>[] = [
    { key: 'key', header: t.fields.key, width: '180px', render: failureKey },
    { key: 'reason', header: t.fields.reason, render: failureReason },
  ];

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
            disabled={isSaving || file === null}
            aria-describedby={file === null ? fileRequiredId : undefined}
            onClick={onSubmit}
          >
            {t.submit}
          </Button>
        </>
      }
    >
      <div className="form-grid dialog-scroll">
        {banner}

        <div className="form-grid-full">
          <AlertBanner variant="warning" title={t.partialWarningTitle}>
            {t.partialWarning}
          </AlertBanner>
        </div>

        <div className="form-grid-full">
          <AlertBanner variant="info">{t.draftNote}</AlertBanner>
        </div>

        <p className="form-grid-full field-note">{t.columnsNote}</p>

        <FileField
          label={t.fileLabel}
          buttonLabel={t.filePlaceholder}
          fileName={file === null ? null : file.name}
          emptyText={t.fileNone}
          accept={ACCEPT}
          disabled={isSaving}
          onSelect={onSelectFile}
        />

        {file === null && (
          <span id={fileRequiredId} className="field-note">
            {t.fileRequired}
          </span>
        )}

        {result !== null && (
          <div className="form-grid-full">
            <h3 className="field-label">{t.resultTitle}</h3>
            {/* 성공과 실패를 둘 다 말한다 — 되돌리지 않는 경로라 한쪽만 말하면 중복 등록으로 이어진다. */}
            <p>{result.succeeded === 0 ? t.noneSucceeded : t.succeeded(result.succeeded)}</p>
            <p>{result.failed.length === 0 ? t.allSucceeded : t.failed(result.failed.length)}</p>

            {result.failed.length > 0 && (
              <div className="wide-table">
                <Table
                  density="compact"
                  columns={columns}
                  rows={result.failed}
                  getRowId={(row) => String(row.index)}
                />
              </div>
            )}
          </div>
        )}
      </div>
    </Dialog>
  );
};
