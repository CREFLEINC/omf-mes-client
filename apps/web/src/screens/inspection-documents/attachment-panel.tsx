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
 */
export const AttachmentPanel = ({ targetTypeCode, targetId }: AttachmentPanelProps) => {
  const { client } = useApiClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const [notice, setNotice] = useState<string | null>(null);

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
    onSuccess: () => setNotice(t.uploaded),
  });

  const pick = (event: ChangeEvent<HTMLInputElement>): void => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (file === undefined) return;
    if (file.size > MAX_BYTES) {
      setNotice(t.tooLarge);
      return;
    }
    setNotice(null);
    upload.write({ file });
  };

  const open = async (row: Attachment): Promise<void> => {
    const blob = await runRequest(() =>
      client.GET('/app/attachments/{attachmentId}/content', {
        params: { path: { attachmentId: row.attachmentId } },
        parseAs: 'blob',
      }),
    );
    const url = URL.createObjectURL(blob as Blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = row.fileName;
    link.click();
    URL.revokeObjectURL(url);
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
          {upload.isSaving ? t.uploading : t.upload}
        </Button>
      </div>
    </section>
  );
};
