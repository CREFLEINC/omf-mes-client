import {
  AlertBanner,
  Button,
  Dialog,
  EmptyState,
  Icon,
  IconButton,
  Table,
  useToast,
  type Column,
} from '@crefle/web-ui';
import {
  createIdempotencyKey,
  type components,
  type InspectionLotForward,
  type paths,
} from '@omf-mes/api-client';
import { messages } from '@omf-mes/i18n';
import { useQueries, useQueryClient } from '@tanstack/react-query';
import { useRef, useState, type ChangeEvent, type ReactNode } from 'react';

import { useApiClient } from '../../patterns/api-context';
import { useFitColumns } from '../../patterns/column-fit';
import { useColumnOrder } from '../../patterns/column-grip-order';
import { useColumnWidths } from '../../patterns/column-resize';
import { formatPlantDateTime } from '../../patterns/plant-time';
import { runRequest } from '../../patterns/request';
import {
  ACCEPT,
  attachmentKeys,
  formatAt,
  precheck,
  sizeText,
} from '../inspection-documents/attachment-panel';
import { LotMatchField, LotNo } from './lot-match-field';

type Attachment = components['schemas']['Attachment'];
type AttachmentUpload = NonNullable<
  Parameters<ReturnType<typeof useApiClient>['client']['POST']>[1]
>['body'];

const t = messages.iqcInboundLot.attachments;
const td = messages.inspectionDocuments;

/** 같은 파일을 여러 LOT 에 붙이면 LOT 마다 첨부가 하나씩 생긴다 — 표에서는 파일 하나를 한 줄로 모은다. */
interface FileRow {
  key: string;
  first: Attachment;
  lotNos: string[];
}

const fileKeyOf = (row: Attachment): string =>
  [
    row.fileName,
    String(row.byteSize),
    String(row.uploadedBy ?? ''),
    row.uploadedAt.slice(0, 16),
  ].join('|');

/**
 * 이 입하 LOT 의 첨부 전부 — 자재 관리 LOT 마다 붙은 것과, LOT 을 고르지 않아 검사 의뢰에 붙은 것(omf-all-around#296).
 * 대상마다 같은 캐시(`attachmentKeys`)를 쓴다.
 */
const useLotAttachments = (inspectionRequestId: number, lots: readonly InspectionLotForward[]) => {
  const { client } = useApiClient();
  const targets: { type: 'LOT' | 'INSPECTION_REQUEST'; id: number; lotNo: string | null }[] = [
    { type: 'INSPECTION_REQUEST', id: inspectionRequestId, lotNo: null },
    ...lots.map((lot) => ({ type: 'LOT' as const, id: lot.lotId, lotNo: lot.lotNo })),
  ];
  const queries = useQueries({
    queries: targets.map((target) => ({
      queryKey: attachmentKeys.list(target.type, target.id),
      queryFn: () =>
        runRequest(() =>
          client.GET('/app/attachments', {
            params: { query: { targetTypeCode: target.type, targetId: target.id } },
          }),
        ).then((response) => response.items),
    })),
  });
  const rows = new Map<string, FileRow>();
  queries.forEach((query, index) => {
    const target = targets[index];
    if (target === undefined) return;
    for (const item of query.data ?? []) {
      /* 검사 의뢰에 붙은 것은 LOT 연결이 없다 — 같은 파일이라도 따로 한 줄. */
      const key = target.lotNo === null ? `request|${String(item.attachmentId)}` : fileKeyOf(item);
      const row = rows.get(key);
      if (row === undefined)
        rows.set(key, { key, first: item, lotNos: target.lotNo === null ? [] : [target.lotNo] });
      else if (target.lotNo !== null && !row.lotNos.includes(target.lotNo))
        row.lotNos.push(target.lotNo);
    }
  });

  return {
    rows: [...rows.values()].sort((a, b) => b.first.uploadedAt.localeCompare(a.first.uploadedAt)),
    isPending: queries.some((query) => query.isPending),
    isError: queries.some((query) => query.isError),
  };
};

/**
 * 검사 결과 상자의 첨부 파일 표(사용자 지시 2026-11-18 · omf-all-around#296) — 파일명 · 연결 LOT · 크기 · 등록 일시,
 * 파일명 옆 단추로 내려받는다. 열 폭 끌기 · 순서 바꾸기는 다른 표와 같다.
 */
export const InboundAttachmentTable = ({
  inspectionRequestId,
  lots,
  confirmedAt,
  uomCode,
  canLink,
  action,
}: {
  inspectionRequestId: number;
  lots: readonly InspectionLotForward[];
  uomCode: string;
  /** LOT 없이 올린 파일에 [LOT 연결]을 보일지 — 확정 전(작성 중·대기)만(omf-all-around#296). */
  canLink: boolean;
  /** 이 의뢰의 판정 확정 일시 — 확정 전은 `null`(「-」 · omf-all-around#296). */
  confirmedAt: string | null;
  /** 제목 줄 오른쪽 단추([파일 첨부]). */
  action?: ReactNode;
}) => {
  const { client } = useApiClient();
  const list = useLotAttachments(inspectionRequestId, lots);
  const [notice, setNotice] = useState<string | null>(null);
  const [linking, setLinking] = useState<Attachment | null>(null);

  const download = async (row: Attachment): Promise<void> => {
    setNotice(null);
    try {
      const blob = (await runRequest(() =>
        client.GET('/app/attachments/{attachmentId}/content', {
          params: { path: { attachmentId: row.attachmentId } },
          parseAs: 'blob',
        }),
      )) as Blob;
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = row.fileName;
      link.click();
      URL.revokeObjectURL(url);
    } catch {
      setNotice(t.downloadFailed);
    }
  };

  const baseColumns: Column<FileRow>[] = [
    {
      key: 'fileName',
      align: 'center',
      header: t.columns.fileName,
      width: '280px',
      render: (row) => (
        <span className="inspection-documents-file-cell">
          <span className="iqc-inbound-attach-name" title={row.first.fileName}>
            {row.first.fileName}
          </span>
          <IconButton
            icon="download"
            size="sm"
            aria-label={t.download(row.first.fileName)}
            title={t.download(row.first.fileName)}
            onClick={() => void download(row.first)}
          />
        </span>
      ),
    },
    {
      key: 'lots',
      header: t.columns.lots,
      width: '220px',
      align: 'center',
      render: (row) =>
        /* LOT 을 고르지 않고 올린 파일 — 연결 LOT 없음. */
        row.lotNos.length === 0 ? (
          canLink ? (
            <Button
              variant="outlined"
              size="sm"
              aria-label={t.linkLabel(row.first.fileName)}
              onClick={() => setLinking(row.first)}
            >
              {t.link}
            </Button>
          ) : (
            '-'
          )
        ) : (
          <span className="iqc-inbound-attach-lots">
            {row.lotNos.map((lotNo) => (
              <LotNo key={lotNo} lotNo={lotNo} />
            ))}
          </span>
        ),
    },
    {
      key: 'size',
      header: t.columns.size,
      width: '96px',
      align: 'center',
      render: (row) => sizeText(row.first.byteSize),
    },
    {
      key: 'uploadedAt',
      header: t.columns.uploadedAt,
      width: '150px',
      align: 'center',
      render: (row) => formatAt(row.first.uploadedAt),
    },
    {
      key: 'confirmedAt',
      header: t.columns.confirmedAt,
      width: '150px',
      align: 'center',
      render: () => (confirmedAt === null ? '-' : (formatPlantDateTime(confirmedAt) ?? '-')),
    },
  ];
  const ordered = useColumnOrder('omf-mes:iqc-inbound-attachments:columns:order', baseColumns);
  const resizable = useColumnWidths('omf-mes:iqc-inbound-attachments:columns', ordered);
  const fit = useFitColumns(resizable.columns, {});

  return (
    <div className="iqc-inbound-attachments">
      <div className="parts-iqc-block-head">
        <h4 className="parts-iqc-sub-title">
          {t.tableTitle} <span className="parts-iqc-muted">{t.count(list.rows.length)}</span>
        </h4>
        <span className="parts-iqc-footer-gap" />
        {action}
      </div>
      {list.isError ? (
        <p className="field-note">{t.loadFailed}</p>
      ) : (
        <div ref={fit.ref} className="inspection-queue-table" style={resizable.style}>
          <Table
            caption={t.tableTitle}
            density="compact"
            columns={fit.columns}
            rows={list.rows}
            getRowId={(row) => row.key}
            empty={
              list.isPending ? (
                <p className="field-note">{td.loading}</p>
              ) : (
                /* 빈 표 안내는 목록과 같은 모양(아이콘 + 글)으로(사용자 지시 2026-11-19 · omf-all-around#296). */
                <EmptyState
                  size="sm"
                  icon={
                    <span className="inspection-standard-empty-icon">
                      <Icon name="attach_file" size={20} />
                    </span>
                  }
                  title={t.empty}
                />
              )
            }
          />
        </div>
      )}
      {notice === null ? null : <p className="field-note">{notice}</p>}
      {linking === null ? null : (
        <LinkLotsDialog
          attachment={linking}
          inspectionRequestId={inspectionRequestId}
          lots={lots}
          uomCode={uomCode}
          onClose={() => setLinking(null)}
        />
      )}
    </div>
  );
};

/**
 * [LOT 연결] 창(사용자 지시 2026-11-19 · omf-all-around#296) — LOT 없이 올린 파일을 고른 자재 관리 LOT 에 연결한다.
 * 서버가 LOT 마다 같은 파일의 첨부를 만들고 검사 의뢰 첨부는 지운다.
 */
const LinkLotsDialog = ({
  attachment,
  inspectionRequestId,
  lots,
  uomCode,
  onClose,
}: {
  attachment: Attachment;
  inspectionRequestId: number;
  lots: readonly InspectionLotForward[];
  uomCode: string;
  onClose: () => void;
}) => {
  const { client } = useApiClient();
  const queryClient = useQueryClient();
  const toast = useToast();
  const [lotIds, setLotIds] = useState<number[]>(lots.map((lot) => lot.lotId));
  const [tried, setTried] = useState(false);
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState(false);
  /* 같은 저장 시도의 재전송은 같은 키로 — 서버가 앞 응답을 돌려준다. */
  const idempotencyKey = useRef(createIdempotencyKey());

  const save = async (): Promise<void> => {
    setTried(true);
    if (lotIds.length === 0) return;
    setSaving(true);
    setFailed(false);
    const result = await client.POST('/app/attachments/{attachmentId}:link-lots', {
      params: {
        path: { attachmentId: attachment.attachmentId },
        header: { 'Idempotency-Key': idempotencyKey.current },
      },
      body: { lotIds },
    });
    await Promise.all([
      queryClient.invalidateQueries({
        queryKey: attachmentKeys.list('INSPECTION_REQUEST', inspectionRequestId),
      }),
      ...lots.map((lot) =>
        queryClient.invalidateQueries({ queryKey: attachmentKeys.list('LOT', lot.lotId) }),
      ),
    ]);
    setSaving(false);
    if (result.error !== undefined) {
      idempotencyKey.current = createIdempotencyKey();
      setFailed(true);
      return;
    }
    toast.show({ variant: 'success', description: t.linked(lotIds.length) });
    onClose();
  };

  return (
    <Dialog
      open
      size="md"
      showCloseButton={false}
      closeOnBackdropClick={false}
      title={t.linkTitle}
      onClose={() => {
        if (!saving) onClose();
      }}
      footer={
        <>
          <Button variant="outlined" disabled={saving} onClick={onClose}>
            {t.cancel}
          </Button>
          <Button loading={saving} onClick={() => void save()}>
            {t.save}
          </Button>
        </>
      }
    >
      <div className="iqc-inbound-attach-dialog">
        <p className="iqc-inbound-link-file">{attachment.fileName}</p>
        <LotMatchField
          lots={lots}
          otherResults={[]}
          uomCode={uomCode}
          value={lotIds}
          heading={t.lotHeading}
          disabled={saving}
          onChange={setLotIds}
        />
        {tried && lotIds.length === 0 ? (
          <p className="field-error" role="alert">
            {t.lotRequired}
          </p>
        ) : null}
        {failed ? <AlertBanner variant="error">{t.linkFailed}</AlertBanner> : null}
      </div>
    </Dialog>
  );
};

/**
 * [파일 첨부] 창(사용자 지시 2026-11-18 · omf-all-around#296) — 파일을 고르고 연결할 자재 관리 LOT 를 골라 [저장]. 파일 하나를 고른
 * LOT 마다 붙인다(서버는 요청 하나에 파일 하나 · 대상 하나). LOT 고르기는 선택이다 — 고르지 않으면 검사 의뢰(입하 LOT)에 붙인다
 * (사용자 지시 2026-11-19). 중간에 실패하면 올라간 것은 기억해 다시 [저장]할 때 남은 것만 보낸다.
 */
export const InboundAttachDialog = ({
  inspectionRequestId,
  lots,
  uomCode,
  onClose,
}: {
  inspectionRequestId: number;
  lots: readonly InspectionLotForward[];
  uomCode: string;
  onClose: () => void;
}) => {
  const { client } = useApiClient();
  const queryClient = useQueryClient();
  const toast = useToast();
  const inputRef = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<File[]>([]);
  /* 처음에는 LOT 전부 — 성적서 하나에 모든 LOT 결과가 담기는 경우가 많다. */
  const [lotIds, setLotIds] = useState<number[]>(lots.map((lot) => lot.lotId));
  const [tried, setTried] = useState(false);
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState(false);
  /* 이미 올라간 「파일 · LOT」 짝 — 다시 저장할 때 건너뛴다. */
  const sent = useRef(new Set<string>());

  const fileId = (file: File): string =>
    `${file.name}-${String(file.size)}-${String(file.lastModified)}`;

  const pick = (event: ChangeEvent<HTMLInputElement>): void => {
    const picked = Array.from(event.target.files ?? []);
    event.target.value = '';
    setFiles((prev) => [
      ...prev,
      ...picked.filter((file) => !prev.some((each) => fileId(each) === fileId(file))),
    ]);
  };

  const fileError = tried && files.length === 0 ? t.fileRequired : null;
  const hasPrecheckError = files.some((file) => precheck(file) !== null);

  const save = async (): Promise<void> => {
    setTried(true);
    if (files.length === 0 || hasPrecheckError) return;
    /* LOT 을 고르지 않았으면 검사 의뢰 하나에 붙인다. */
    const targets: { type: 'LOT' | 'INSPECTION_REQUEST'; id: number }[] =
      lotIds.length === 0
        ? [{ type: 'INSPECTION_REQUEST', id: inspectionRequestId }]
        : lotIds.map((lotId) => ({ type: 'LOT', id: lotId }));
    setSaving(true);
    setFailed(false);
    let ok = true;
    for (const file of files) {
      for (const target of targets) {
        const key = `${fileId(file)}@${target.type}:${String(target.id)}`;
        if (sent.current.has(key)) continue;
        const form = new FormData();
        form.append('targetTypeCode', target.type);
        form.append('targetId', String(target.id));
        form.append('file', file);
        const result = await client.POST('/app/attachments', {
          params: { header: { 'Idempotency-Key': createIdempotencyKey() } },
          body: form as unknown as AttachmentUpload,
        });
        if (result.error !== undefined) {
          ok = false;
          break;
        }
        sent.current.add(key);
      }
      if (!ok) break;
    }
    await Promise.all([
      queryClient.invalidateQueries({
        queryKey: attachmentKeys.list('INSPECTION_REQUEST', inspectionRequestId),
      }),
      ...lots.map((lot) =>
        queryClient.invalidateQueries({ queryKey: attachmentKeys.list('LOT', lot.lotId) }),
      ),
    ]);
    setSaving(false);
    if (!ok) {
      setFailed(true);
      return;
    }
    toast.show({ variant: 'success', description: t.saved(files.length) });
    onClose();
  };

  return (
    <Dialog
      open
      size="md"
      showCloseButton={false}
      closeOnBackdropClick={false}
      title={t.title}
      onClose={() => {
        if (!saving) onClose();
      }}
      footer={
        <>
          <Button variant="outlined" disabled={saving} onClick={onClose}>
            {t.cancel}
          </Button>
          <Button loading={saving} disabled={hasPrecheckError} onClick={() => void save()}>
            {t.save}
          </Button>
        </>
      }
    >
      <div className="iqc-inbound-attach-dialog">
        <section className="parts-iqc-card" aria-labelledby="iqc-inbound-attach-files">
          <div className="parts-iqc-block-head">
            <h3 id="iqc-inbound-attach-files" className="parts-iqc-sub-title">
              {t.fileHeading}{' '}
              <span className="required-mark" aria-hidden="true">
                *
              </span>
            </h3>
            <span className="parts-iqc-footer-gap" />
            <Button
              variant="outlined"
              size="sm"
              disabled={saving}
              leadingIcon={<Icon name="attach_file" size={16} aria-hidden />}
              onClick={() => inputRef.current?.click()}
            >
              {t.pick}
            </Button>
          </div>
          <p className="field-note">{td.help}</p>
          {files.length === 0 ? null : (
            <div
              className="inspection-documents-selected-list"
              role="group"
              aria-label={t.fileHeading}
            >
              {files.map((file) => {
                const error = precheck(file);
                return (
                  <div className="inspection-documents-selected" key={fileId(file)}>
                    <span className="inspection-documents-selected-name" title={file.name}>
                      {file.name}
                    </span>
                    <span className="inspection-documents-selected-size">
                      {sizeText(file.size)}
                    </span>
                    <IconButton
                      icon="delete"
                      size="md"
                      aria-label={t.removeFile(file.name)}
                      title={t.removeFile(file.name)}
                      disabled={saving}
                      onClick={() =>
                        setFiles((prev) => prev.filter((each) => fileId(each) !== fileId(file)))
                      }
                    />
                    {error === null ? null : <span className="field-error">{error}</span>}
                  </div>
                );
              })}
            </div>
          )}
          {fileError === null ? null : (
            <p className="field-error" role="alert">
              {fileError}
            </p>
          )}
          <input
            ref={inputRef}
            type="file"
            accept={ACCEPT}
            multiple
            hidden
            aria-label={t.pick}
            onChange={pick}
          />
        </section>
        <LotMatchField
          lots={lots}
          otherResults={[]}
          uomCode={uomCode}
          value={lotIds}
          heading={t.lotHeading}
          required={false}
          disabled={saving}
          onChange={setLotIds}
        />
        {failed ? <AlertBanner variant="error">{t.failed}</AlertBanner> : null}
      </div>
    </Dialog>
  );
};
