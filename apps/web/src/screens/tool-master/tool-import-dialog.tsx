import { AlertBanner, Button, type Column, Dialog, Table } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useId, type ReactNode } from 'react';

import { FileField } from './file-field';
import {
  dataRowNumber,
  failureKey,
  failureReason,
  resultSummary,
  type BatchFailure,
  type BatchResult,
} from './import-result';

const t = messages.toolMaster.import;

/** 엑셀 대장이라 받아들일 확장자를 좁혀 준다. **막지는 못한다** — 판정은 서버가 한다. */
const ACCEPT = '.xlsx,.xls';

export interface ToolImportDialogProps {
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

/**
 * 현행 엑셀 대장을 옮기는 창.
 *
 * ⭐ **「통째로 되돌리지 않는다」를 올리기 «전에» 말한다.** 성공한 행은 들어가고 실패한 행만
 * 돌아온다 — 잘못 올린 뒤에는 되돌릴 수단이 없다. 결과를 본 뒤에 알려 주면 늦다.
 *
 * ⭐ **「라벨을 발행하지 않는다」도 함께 말한다**(스펙 §6). 마스터 행이 생겼다고 현장에 라벨이
 * 나가는 것이 아니다 — 올린 뒤 라벨이 있을 것이라 믿고 현장에 내보내면 그때 어긋난다.
 *
 * ⭐ **스크림 클릭으로 닫히지 않게 한다** — 올리는 중에 창이 사라지면 결과를 볼 곳이 없다.
 */
export const ToolImportDialog = ({
  file,
  onSelectFile,
  result,
  banner,
  isSaving,
  onClose,
  onSubmit,
}: ToolImportDialogProps) => {
  const fileRequiredId = useId();
  const columns: Column<BatchFailure>[] = [
    {
      key: 'index',
      header: t.fields.row,
      width: '140px',
      render: (row) => t.rowLabel(dataRowNumber(row.index)),
    },
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
            /* 잠긴 버튼은 포커스를 못 받아 툴팁이 닿지 않는다 — 사유를 보이는 글자로 잇는다. */
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

        {/*
         * ⚠ 되돌릴 수 없다는 사실을 **가장 먼저** 세운다. 아래 파일 고르기보다 위에 있어야
         * 파일을 고르기 전에 읽는다.
         */}
        <div className="form-grid-full">
          <AlertBanner variant="warning" title={t.partialWarningTitle}>
            {t.partialWarning}
          </AlertBanner>
        </div>

        <div className="form-grid-full">
          <AlertBanner variant="info">{t.noLabelNote}</AlertBanner>
        </div>

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
            {/*
             * ⭐ **성공과 실패를 둘 다 말한다.** 성공만 말하면 실패한 행이 없는 것처럼 읽히고,
             * 실패만 말하면 이미 들어간 행을 모르고 파일을 통째로 다시 올린다 —
             * 되돌리지 않는 경로라 그 오해가 곧 중복 등록이다.
             */}
            {resultSummary(result).map((line) => (
              <p key={line}>{line}</p>
            ))}

            {result.failed.length > 0 && (
              <>
                <span className="field-note">{t.rowNote}</span>
                <div className="wide-table">
                  <Table
                    density="compact"
                    columns={columns}
                    rows={result.failed}
                    getRowId={(row) => String(row.index)}
                  />
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </Dialog>
  );
};
