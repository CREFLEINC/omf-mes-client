import { Button, Table, type Column } from '@crefle/web-ui';
import type { AttachmentTargetType, components } from '@omf-mes/api-client';
import { messages } from '@omf-mes/i18n';
import { useQuery } from '@tanstack/react-query';
import { useRef, useState, type ChangeEvent } from 'react';

import { useApiClient } from '../../patterns/api-context';
import { SaveErrorBanner, useMasterWrite } from '../../patterns/master';
import { runRequest } from '../../patterns/request';

type Attachment = components['schemas']['Attachment'];
type AttachmentUpload = NonNullable<
  Parameters<ReturnType<typeof useApiClient>['client']['POST']>[1]
>['body'];

const t = messages.inspectionDocuments;
/** 서버와 같은 한도(`MAX_ATTACHMENT_BYTES`). 넘으면 보내기 전에 막아 10MB 를 올리고 나서야 거절받지 않게 한다. */
const MAX_BYTES = 10 * 1024 * 1024;
/** 고르는 창의 거름 — 정본 판정은 서버(파일 머리 바이트)다. */
const ACCEPT = '.pdf,.png,.jpg,.jpeg,.webp,.xlsx,.xls,.docx,.doc,.pptx,.ppt,.csv,.txt';
const ACCEPTED_EXTENSIONS = ACCEPT.split(',');

/** 고르는 시점의 사전 검사 — 통과하면 `null`. 서버가 머리 바이트로 다시 판정한다. */
const precheck = (file: File): string | null => {
  const dot = file.name.lastIndexOf('.');
  const extension = dot < 0 ? '' : file.name.slice(dot).toLowerCase();
  if (!ACCEPTED_EXTENSIONS.includes(extension)) return t.unsupported;
  if (file.size > MAX_BYTES) return t.tooLarge;
  return null;
};

const sizeText = (bytes: number): string =>
  bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.ceil(bytes / 1024)} KB`;

const formatAt = (iso: string): string => {
  const at = new Date(iso);
  const pad = (n: number): string => String(n).padStart(2, '0');
  return `${String(at.getFullYear())}-${pad(at.getMonth() + 1)}-${pad(at.getDate())} ${pad(at.getHours())}:${pad(at.getMinutes())}`;
};

export const attachmentKeys = {
  list: (targetTypeCode: AttachmentTargetType, targetId: number) =>
    ['inspection-documents', targetTypeCode, targetId] as const,
};

export interface AttachmentPanelProps {
  /** 붙일 대상 — 검사 문서는 LOT 또는 검사 결과(서버 선행 P-57). */
  targetTypeCode: 'LOT' | 'INSPECTION_RESULT';
  targetId: number;
}

/**
 * 검사 문서 첨부(omf-all-around#58) — 시험성적서·측정 엑셀 등을 LOT·검사 결과에 붙이고 연다.
 *
 * ⭐ 볼 수 있는 문서만 받는다 — 서버가 파일 머리 바이트로 판정하고 실행 파일은 거절한다. 화면의 고르는 창은
 *    편의일 뿐이다. 10MB 를 넘으면 보내기 전에 막는다.
 * ⛔ 지우기·이름 바꾸기는 없다 — 첨부는 기록이고 계약에 그 경로가 없다.
 *
 * 고르기와 올리기를 나눈다(3단계 검증 · 담당자 지시): [문서 올리기]로 고르면 이름·크기를 보이고(제거 가능),
 * [업로드]를 눌러야 보낸다. 사전 검사에 걸리면 [업로드]가 막힌다. 한 번에 한 파일이다.
 */
export const AttachmentPanel = ({ targetTypeCode, targetId }: AttachmentPanelProps) => {
  const { client } = useApiClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [selected, setSelected] = useState<File | null>(null);
  const [selectError, setSelectError] = useState<string | null>(null);

  const list = useQuery({
    queryKey: attachmentKeys.list(targetTypeCode, targetId),
    queryFn: () =>
      runRequest(() =>
        client.GET('/app/attachments', { params: { query: { targetTypeCode, targetId } } }),
      ).then((response) => response.items),
  });

  const upload = useMasterWrite<{ file: File }, Attachment>({
    request: ({ file }, headers) => {
      const form = new FormData();
      form.append('targetTypeCode', targetTypeCode);
      form.append('targetId', String(targetId));
      form.append('file', file);
      return client.POST('/app/attachments', {
        params: { header: { 'Idempotency-Key': headers['Idempotency-Key'] } },
        body: form as unknown as AttachmentUpload,
      });
    },
    etagPath: null,
    invalidateKeys: [attachmentKeys.list(targetTypeCode, targetId)],
    knownFields: ['file'],
    onSuccess: () => {
      setSelected(null);
      setNotice(t.uploaded);
    },
  });

  const pick = (event: ChangeEvent<HTMLInputElement>): void => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (file === undefined) return;
    upload.reset();
    setNotice(null);
    setSelected(file);
    setSelectError(precheck(file));
  };

  const clearSelection = (): void => {
    upload.reset();
    setSelected(null);
    setSelectError(null);
  };

  /** PDF 는 새 탭에서 바로 열고, 그 밖은 내려받는다. 받지 못하면 그 사실을 알린다. */
  const open = async (row: Attachment): Promise<void> => {
    setNotice(null);
    try {
      const blob = (await runRequest(() =>
        client.GET('/app/attachments/{attachmentId}/content', {
          params: { path: { attachmentId: row.attachmentId } },
          parseAs: 'blob',
        }),
      )) as Blob;
      const url = URL.createObjectURL(blob);
      if (blob.type === 'application/pdf' && window.open(url, '_blank') !== null) {
        // 새 탭이 다 읽기 전에 주소를 풀면 빈 화면이 된다 — 넉넉히 기다렸다 푼다.
        window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
        return;
      }
      const link = document.createElement('a');
      link.href = url;
      link.download = row.fileName;
      link.click();
      URL.revokeObjectURL(url);
    } catch {
      setNotice(t.openFailed);
    }
  };

  const columns: Column<Attachment>[] = [
    {
      key: 'fileName',
      header: t.columns.fileName,
      render: (row) => (
        <Button variant="text" size="sm" onClick={() => void open(row)}>
          {row.fileName}
        </Button>
      ),
    },
    { key: 'size', header: t.columns.size, align: 'end', render: (row) => sizeText(row.byteSize) },
    { key: 'uploadedAt', header: t.columns.uploadedAt, render: (row) => formatAt(row.uploadedAt) },
  ];

  return (
    <section aria-label={t.heading} className="inspection-documents">
      <h3>{t.heading}</h3>
      <p className="field-note">{t.help}</p>
      {list.isError ? (
        <p className="field-note">{t.loadFailed}</p>
      ) : (
        <Table
          caption={t.caption}
          density="compact"
          columns={columns}
          rows={list.data ?? []}
          getRowId={(row) => String(row.attachmentId)}
          empty={<p className="field-note">{list.isPending ? t.loading : t.none}</p>}
        />
      )}
      <SaveErrorBanner error={upload.error} />
      {upload.fieldErrors.file !== undefined && (
        <p className="field-note">{upload.fieldErrors.file}</p>
      )}
      {notice !== null && <p className="field-note">{notice}</p>}
      {selected !== null && (
        <div className="inspection-documents-selected" aria-label={t.selected} role="group">
          <span className="inspection-documents-selected-name">{selected.name}</span>
          <span className="field-note">{sizeText(selected.size)}</span>
          <Button
            variant="text"
            size="sm"
            className="app-button-neutral"
            disabled={upload.isSaving}
            onClick={clearSelection}
          >
            {t.remove}
          </Button>
          {selectError !== null && <span className="field-error">{selectError}</span>}
        </div>
      )}
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT}
        hidden
        aria-label={t.upload}
        onChange={pick}
      />
      <div className="form-actions">
        <Button
          variant="outlined"
          size="sm"
          disabled={upload.isSaving}
          onClick={() => inputRef.current?.click()}
        >
          {t.upload}
        </Button>
        <Button
          size="sm"
          loading={upload.isSaving}
          disabled={selected === null || selectError !== null || upload.isSaving}
          onClick={() => {
            if (selected !== null) upload.write({ file: selected });
          }}
        >
          {upload.isSaving ? t.uploading : t.submit}
        </Button>
      </div>
    </section>
  );
};
