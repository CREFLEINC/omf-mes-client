import {
  Button,
  Chip,
  Dialog,
  EmptyState,
  Icon,
  IconButton,
  SearchInput,
  Table,
  type Column,
} from '@crefle/web-ui';
import {
  createIdempotencyKey,
  type AttachmentTargetType,
  type components,
} from '@omf-mes/api-client';
import { messages } from '@omf-mes/i18n';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useRef, useState, type ChangeEvent, type ReactNode } from 'react';

import { useApiClient } from '../../patterns/api-context';
import { useFitColumns } from '../../patterns/column-fit';
import { useClientPage } from '../../patterns/client-page';
import { useColumnOrder } from '../../patterns/column-order';
import { useColumnWidths } from '../../patterns/column-resize';
import { SaveErrorBanner, useMasterWrite } from '../../patterns/master';
import { PageNav } from '../../patterns/page-nav';
import { runRequest } from '../../patterns/request';

import { uniqueNames, zipStore } from './zip-store';

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

/** 파일 유형 — 확장자를 대문자로(PDF · XLSX …). 확장자가 없으면 서버가 준 형식(image/png 등)이다. */
const fileTypeOf = (row: Attachment): string => {
  const dot = row.fileName.lastIndexOf('.');
  return dot < 0 ? row.contentType : row.fileName.slice(dot + 1).toUpperCase();
};

/** 표 부품(`Table selectable`)이 첫 열에 그리는 선택 체크칸의 폭(px). */
const SELECT_COLUMN_WIDTH = 48;

/** 파일 유형 묶음 — 거르기 칩이 쓴다(#185). */
const FILE_KINDS = ['image', 'pdf', 'excel', 'word', 'other'] as const;
type FileKind = (typeof FILE_KINDS)[number];
const KIND_EXTENSIONS: Record<Exclude<FileKind, 'other'>, readonly string[]> = {
  image: ['PNG', 'JPG', 'JPEG', 'WEBP'],
  pdf: ['PDF'],
  excel: ['XLSX', 'XLS', 'CSV'],
  word: ['DOCX', 'DOC'],
};
const kindOf = (row: Attachment): FileKind => {
  const type = fileTypeOf(row);
  return (
    FILE_KINDS.find((kind) => kind !== 'other' && KIND_EXTENSIONS[kind].includes(type)) ?? 'other'
  );
};

export const attachmentKeys = {
  list: (targetTypeCode: AttachmentTargetType, targetId: number) =>
    ['inspection-documents', targetTypeCode, targetId] as const,
};

export interface AttachmentPanelProps {
  /** 붙일 대상 — 검사 문서는 LOT 또는 검사 결과(서버 선행 P-57). */
  targetTypeCode: 'LOT' | 'INSPECTION_RESULT';
  targetId: number;
  /** 넘칠 때 줄이지 않고 표 안에서 가로로 구른다(좌우 배치 · 사용자 지시 2026-10-27 · #185). */
  scrollX?: boolean;
  /** 10 · 20 · 50건씩 쪽으로 나눈다(IQC 상세 탭 · 사용자 지시 2026-10-27 · #185). */
  paged?: boolean;
  /** 왼쪽 체크란으로 골라 zip 하나로 내려받는다(IQC 상세 탭 · 사용자 지시 2026-10-27 · #185). */
  bulkDownload?: boolean;
  /**
   * 주면 위 한 줄에 이것(형식 안내 등)과 [파일 선택] [업로드]를 오른쪽 끝에 세우고, 그 아래 파일명 찾기 · 유형 칩 ·
   * [선택 파일 내려받기]를 둔다(IQC 상세 탭 · 사용자 지시 2026-10-27 · #185). 없으면 종전처럼 단추가 표 아래다.
   */
  toolbarStart?: ReactNode;
}

/**
 * 검사 문서 첨부(omf-all-around#58) — 시험성적서·측정 엑셀 등을 LOT·검사 결과에 붙이고 연다.
 *
 * ⭐ 볼 수 있는 문서만 받는다 — 서버가 파일 머리 바이트로 판정하고 실행 파일은 거절한다. 화면의 고르는 창은
 *    편의일 뿐이다. 10MB 를 넘으면 보내기 전에 막는다.
 * ⛔ 지우기·이름 바꾸기는 없다 — 첨부는 기록이고 계약에 그 경로가 없다.
 *
 * 고르기와 올리기를 나눈다(3단계 검증 · 담당자 지시): [문서 올리기]로 고르면 이름·크기를 보이고(제거 가능),
 * [업로드]를 눌러야 보낸다. 사전 검사에 걸리면 [업로드]가 막힌다.
 *
 * 여러 파일을 한 번에 고르고 올린다(omf-all-around#133) — 서버는 요청 하나에 한 파일이라 고른 순서대로 하나씩
 * 보낸다. 올라간 파일은 목록에서 바로 빠지므로, 중간에 실패하면 남은 파일만 다시 올리면 된다(중복 없음).
 */
export const AttachmentPanel = ({
  targetTypeCode,
  targetId,
  scrollX = false,
  paged = false,
  bulkDownload = false,
  toolbarStart,
}: AttachmentPanelProps) => {
  const { client } = useApiClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [selected, setSelected] = useState<File[]>([]);
  const [checkedIds, setCheckedIds] = useState<string[]>([]);
  /* 묶는 중인 내려받기 — 선택 파일(`checked`) · 전체 파일(`all`) · 없음. */
  const [zipping, setZipping] = useState<'checked' | 'all' | null>(null);
  const [search, setSearch] = useState('');
  const [kind, setKind] = useState<FileKind | null>(null);
  /* 미리보기(#185) — 이미지 · PDF · 글(TXT · CSV)은 창 안에서 보이고, 그 밖은 내려받기만 권한다. */
  const [preview, setPreview] = useState<{
    row: Attachment;
    blob: Blob | null;
    url: string | null;
    text: string | null;
  } | null>(null);
  const queryClient = useQueryClient();
  const listKey = attachmentKeys.list(targetTypeCode, targetId);

  const list = useQuery({
    queryKey: attachmentKeys.list(targetTypeCode, targetId),
    queryFn: () =>
      runRequest(() =>
        client.GET('/app/attachments', { params: { query: { targetTypeCode, targetId } } }),
      ).then((response) => response.items),
  });

  /* 파일마다 따로 보내고 따로 멱등 키를 쓴다 — 한 키로 여러 파일을 보내면 서버가 뒤 파일을 앞의 중복으로 본다. */
  const send = (file: File) => {
    const form = new FormData();
    form.append('targetTypeCode', targetTypeCode);
    form.append('targetId', String(targetId));
    form.append('file', file);
    return client.POST('/app/attachments', {
      params: { header: { 'Idempotency-Key': createIdempotencyKey() } },
      body: form as unknown as AttachmentUpload,
    });
  };

  const upload = useMasterWrite<{ files: File[] }, Attachment>({
    request: async ({ files }) => {
      for (const [index, file] of files.entries()) {
        const result = await send(file);
        if (result.error !== undefined) {
          // 앞서 올라간 파일은 목록에 보이게 한다. 실패한 파일부터는 고른 목록에 남는다.
          void queryClient.invalidateQueries({ queryKey: listKey });
          return result;
        }
        setSelected((prev) => prev.filter((picked) => picked !== file));
        if (index === files.length - 1) return result;
      }
      // [업로드]는 고른 파일이 없으면 꺼져 있다 — 여기 오지 않는다.
      throw new Error('올릴 파일이 없습니다.');
    },
    etagPath: null,
    invalidateKeys: [listKey],
    knownFields: ['file'],
    onSuccess: () => {
      setNotice(t.uploaded);
    },
  });

  const pick = (event: ChangeEvent<HTMLInputElement>): void => {
    const files = Array.from(event.target.files ?? []);
    event.target.value = '';
    if (files.length === 0) return;
    upload.reset();
    setNotice(null);
    /* 다시 고르면 더한다 — 이미 고른 같은 파일은 한 번만 둔다. */
    setSelected((prev) => [
      ...prev,
      ...files.filter(
        (file) =>
          !prev.some(
            (picked) =>
              picked.name === file.name &&
              picked.size === file.size &&
              picked.lastModified === file.lastModified,
          ),
      ),
    ]);
  };

  const removeSelected = (file: File): void => {
    upload.reset();
    setSelected((prev) => prev.filter((picked) => picked !== file));
  };

  const hasSelectError = selected.some((file) => precheck(file) !== null);

  const contentOf = async (row: Attachment): Promise<Blob> =>
    (await runRequest(() =>
      client.GET('/app/attachments/{attachmentId}/content', {
        params: { path: { attachmentId: row.attachmentId } },
        parseAs: 'blob',
      }),
    )) as Blob;

  const save = (blob: Blob, fileName: string): void => {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    link.click();
    URL.revokeObjectURL(url);
  };

  /** PDF 는 새 탭에서 바로 열고, 그 밖은 내려받는다. 받지 못하면 그 사실을 알린다. */
  const open = async (row: Attachment): Promise<void> => {
    setNotice(null);
    try {
      const blob = await contentOf(row);
      if (blob.type === 'application/pdf') {
        const url = URL.createObjectURL(blob);
        if (window.open(url, '_blank') !== null) {
          // 새 탭이 다 읽기 전에 주소를 풀면 빈 화면이 된다 — 넉넉히 기다렸다 푼다.
          window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
          return;
        }
        URL.revokeObjectURL(url);
      }
      save(blob, row.fileName);
    } catch {
      setNotice(t.openFailed);
    }
  };

  const openPreview = async (row: Attachment): Promise<void> => {
    setNotice(null);
    setPreview({ row, blob: null, url: null, text: null });
    try {
      const blob = await contentOf(row);
      const isText = blob.type.startsWith('text/') || /\.(txt|csv)$/i.test(row.fileName);
      setPreview({
        row,
        blob,
        url: isText ? null : URL.createObjectURL(blob),
        text: isText ? await blob.text() : null,
      });
    } catch {
      setPreview(null);
      setNotice(t.openFailed);
    }
  };

  const closePreview = (): void => {
    if (preview?.url != null) URL.revokeObjectURL(preview.url);
    setPreview(null);
  };

  const previewBody = (): ReactNode => {
    if (preview === null || preview.blob === null) {
      return <p className="field-note">{t.previewLoading}</p>;
    }
    if (preview.text !== null) {
      return <pre className="inspection-documents-preview-text">{preview.text}</pre>;
    }
    if (preview.url !== null && preview.blob.type.startsWith('image/')) {
      return (
        <img
          className="inspection-documents-preview-image"
          src={preview.url}
          alt={preview.row.fileName}
        />
      );
    }
    if (preview.url !== null && preview.blob.type === 'application/pdf') {
      return (
        <iframe
          className="inspection-documents-preview-frame"
          src={preview.url}
          title={t.preview(preview.row.fileName)}
        />
      );
    }
    return <p className="field-note">{t.previewUnsupported}</p>;
  };

  /* 체크한 파일을 차례로 받아 zip 하나로 묶어 내려받는다(#185). 지금 목록에 없는 체크는 버린다. */
  const checkedRows = (list.data ?? []).filter((row) =>
    checkedIds.includes(String(row.attachmentId)),
  );
  /* 전체 파일 내려받기는 거르기와 관계없이 이 LOT 의 첨부 전부다(사용자 지시 2026-10-27 · #185). */
  const downloadZip = async (scope: 'checked' | 'all'): Promise<void> => {
    const rows = scope === 'checked' ? checkedRows : (list.data ?? []);
    setNotice(null);
    setZipping(scope);
    try {
      const names = uniqueNames(rows.map((row) => row.fileName));
      const files = [];
      for (const [index, row] of rows.entries()) {
        files.push({
          name: names[index] as string,
          data: new Uint8Array(await (await contentOf(row)).arrayBuffer()),
        });
      }
      const stamp = new Date().toISOString().slice(0, 16).replace(/[-:]/g, '').replace('T', '-');
      save(zipStore(files), `${t.zipName}-${stamp}.zip`);
    } catch {
      setNotice(t.zipFailed);
    } finally {
      setZipping(null);
    }
  };

  /*
   * 등록자 이름 — 첨부는 등록자 번호만 준다. 사용자 목록으로 이름을 풀고, 못 풀면(권한 · 실패) 「—」다.
   * 첨부가 하나라도 있을 때만 부른다.
   */
  const hasUploader = (list.data ?? []).some((row) => row.uploadedBy != null);
  const users = useQuery({
    queryKey: ['inspection-documents', 'users'],
    queryFn: () => runRequest(() => client.GET('/app/users', { params: { query: {} } })),
    enabled: hasUploader,
    retry: false,
    staleTime: 5 * 60_000,
  });
  const userNameOf = (id: number | null | undefined): string =>
    (id == null ? undefined : users.data?.items.find((user) => user.appUserId === id)?.userName) ??
    t.emptyValue;

  /* 목록 표와 같은 열 구성 규칙(사용자 지시 2026-10-26 · #185) — 파일명만 왼쪽, 나머지는 가운데. */
  const baseColumns: Column<Attachment>[] = [
    {
      key: 'fileName',
      header: t.columns.fileName,
      width: '280px',
      /*
       * 파일명 바로 옆에 내려받기 단추 — 따로 「관리」 열을 두지 않는다. 이름을 누르면 미리보기다 —
       * 내려받기는 단추로만 한다(사용자 지시 2026-10-27 · #185).
       */
      render: (row) => (
        <span className="inspection-documents-file-cell">
          <Button
            variant="text"
            size="sm"
            className="inspection-documents-file-name"
            title={row.fileName}
            aria-label={t.preview(row.fileName)}
            onClick={() => void openPreview(row)}
          >
            {row.fileName}
          </Button>
          <IconButton
            icon="download"
            size="sm"
            aria-label={t.download(row.fileName)}
            title={t.download(row.fileName)}
            onClick={() => void open(row)}
          />
        </span>
      ),
    },
    {
      key: 'fileType',
      header: t.columns.fileType,
      width: '96px',
      align: 'center',
      render: fileTypeOf,
    },
    {
      key: 'size',
      header: t.columns.size,
      width: '96px',
      align: 'center',
      render: (row) => sizeText(row.byteSize),
    },
    {
      key: 'uploadedBy',
      header: t.columns.uploadedBy,
      width: '120px',
      align: 'center',
      render: (row) => userNameOf(row.uploadedBy),
    },
    {
      key: 'uploadedAt',
      header: t.columns.uploadedAt,
      width: '150px',
      align: 'center',
      /* 오름 · 내림차순(사용자 지시 2026-10-27 · #185). */
      sortable: true,
      sortAccessor: (row) => row.uploadedAt,
      render: (row) => formatAt(row.uploadedAt),
    },
  ];
  /* 열 순서 · 폭은 사용자가 바꾸고 브라우저에 남는다 — 상자 폭에 맞춘다. */
  const ordered = useColumnOrder('omf-mes:inspection-documents:columns:order', baseColumns);
  const resizable = useColumnWidths('omf-mes:inspection-documents:columns', ordered, {
    fitContent: scrollX,
  });
  /* 선택 체크칸(표 부품이 그리는 48px)은 열 목록 밖이라 상자 폭에서 빼고 맞춘다 — 빼지 않으면 마지막 열이 넘쳐 가린다. */
  const fit = useFitColumns(resizable.columns, {
    scrollX,
    reserve: bulkDownload ? SELECT_COLUMN_WIDTH : 0,
  });
  /* 파일명 찾기 · 유형 칩으로 거른 뒤 정렬 · 쪽 나누기(#185). 칩의 건수는 거르기 전 전체에서 센다. */
  const all = list.data ?? [];
  const keyword = search.trim().toLowerCase();
  const filtered = all.filter(
    (row) =>
      (kind === null || kindOf(row) === kind) &&
      (keyword === '' || row.fileName.toLowerCase().includes(keyword)),
  );
  const paging = useClientPage(filtered, { uploadedAt: (row) => row.uploadedAt });
  const hasToolbar = toolbarStart !== undefined;

  /* 위 도구줄의 단추는 작게(사용자 지시 2026-10-27 · #185). 종전 배치는 그대로다. */
  const buttonSize = toolbarStart === undefined ? 'md' : 'sm';
  const uploadButtons = (
    <>
      <Button
        variant="outlined"
        size={buttonSize}
        disabled={upload.isSaving}
        onClick={() => inputRef.current?.click()}
      >
        {t.upload}
      </Button>
      <Button
        size={buttonSize}
        loading={upload.isSaving}
        disabled={selected.length === 0 || hasSelectError || upload.isSaving}
        onClick={() => upload.write({ files: selected })}
      >
        {upload.isSaving
          ? t.uploading
          : selected.length > 1
            ? t.submitCount(selected.length)
            : t.submit}
      </Button>
    </>
  );
  const downloadCheckedButton = (
    <div className="inspection-documents-bulk">
      <Button
        variant="outlined"
        size={buttonSize}
        leadingIcon={<Icon name="download" size={16} aria-hidden />}
        loading={zipping === 'checked'}
        disabled={checkedRows.length === 0 || zipping !== null}
        onClick={() => void downloadZip('checked')}
      >
        {zipping === 'checked' ? t.downloading : t.downloadSelected(checkedRows.length)}
      </Button>
      <Button
        variant="outlined"
        size={buttonSize}
        leadingIcon={<Icon name="download" size={16} aria-hidden />}
        loading={zipping === 'all'}
        disabled={(list.data ?? []).length === 0 || zipping !== null}
        onClick={() => void downloadZip('all')}
      >
        {zipping === 'all' ? t.downloading : t.downloadAll((list.data ?? []).length)}
      </Button>
    </div>
  );
  const pendingList = (
    <>
      {selected.length > 0 && (
        /* 업로드 대기 — 이미 올린 문서(위 표)와 다른 상자로 떼어 «아직 올라가지 않았음»을 보인다(#133). */
        <div className="inspection-documents-selected-list" aria-label={t.selected} role="group">
          <span className="field-label">{t.pending(selected.length)}</span>
          {selected.map((file) => {
            const error = precheck(file);
            return (
              <div
                className="inspection-documents-selected"
                key={`${file.name}-${String(file.size)}-${String(file.lastModified)}`}
              >
                {/* 이름 · 크기 · 제거 — 이름은 말줄임(전체 이름은 마우스를 올리면), 제거는 휴지통 표식 단추(#133). */}
                <span className="inspection-documents-selected-name" title={file.name}>
                  {file.name}
                </span>
                <span className="inspection-documents-selected-size">{sizeText(file.size)}</span>
                <IconButton
                  icon="delete"
                  size="md"
                  aria-label={t.removeFile(file.name)}
                  title={t.removeFile(file.name)}
                  disabled={upload.isSaving}
                  onClick={() => removeSelected(file)}
                />
                {error !== null && <span className="field-error">{error}</span>}
              </div>
            );
          })}
        </div>
      )}
    </>
  );

  return (
    /* 제목과 허용 형식 안내는 이 구획을 접는 줄(부르는 화면)이 맡는다(#133). */
    <section aria-label={t.heading} className="inspection-documents">
      {hasToolbar && (
        <>
          <div className="inspection-documents-toolbar">
            {toolbarStart}
            <div className="inspection-documents-toolbar-actions">{uploadButtons}</div>
          </div>
          {pendingList}
          <div className="inspection-documents-filters">
            <SearchInput
              size="sm"
              aria-label={t.search}
              placeholder={t.searchPlaceholder}
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              onClear={() => setSearch('')}
            />
            {bulkDownload && downloadCheckedButton}
          </div>
          {/* 유형 칩은 찾기 칸 아래 줄(사용자 지시 2026-10-27 · #185). */}
          <div className="inspection-documents-kinds" role="group" aria-label={t.kindLabel}>
            {([null, ...FILE_KINDS] as const).map((option) => (
              <Chip
                key={option ?? 'all'}
                variant="filter"
                size="sm"
                selected={kind === option}
                aria-pressed={kind === option}
                onSelectedChange={() => setKind(option)}
              >
                {t.kindCount(
                  t.kinds[option ?? 'all'],
                  option === null ? all.length : all.filter((row) => kindOf(row) === option).length,
                )}
              </Chip>
            ))}
          </div>
        </>
      )}
      {list.isError ? (
        <p className="field-note">{t.loadFailed}</p>
      ) : (
        /* 올린 파일이 없어도 표 모양은 그대로 두고 줄 안에 없다고 적는다(#133). */
        <div ref={fit.ref} className="inspection-queue-table" style={resizable.style}>
          <Table
            caption={t.caption}
            density="compact"
            columns={fit.columns}
            rows={paged ? paging.rows : all}
            {...(paged ? { sort: paging.sort, onSortChange: paging.onSortChange } : {})}
            {...(bulkDownload
              ? {
                  selectable: true,
                  selectedIds: checkedRows.map((row) => String(row.attachmentId)),
                  onSelectionChange: setCheckedIds,
                }
              : {})}
            getRowId={(row) => String(row.attachmentId)}
            empty={
              list.isPending ? (
                <p className="field-note">{t.loading}</p>
              ) : (
                <EmptyState
                  size="sm"
                  icon={<Icon name="contract_delete" size={32} />}
                  title={t.emptyTitle}
                  description={t.emptyHint}
                />
              )
            }
          />
        </div>
      )}
      {paged && paging.nav !== null && <PageNav {...paging.nav} />}
      <SaveErrorBanner error={upload.error} />
      {upload.fieldErrors.file !== undefined && (
        <p className="field-note">{upload.fieldErrors.file}</p>
      )}
      {notice !== null && <p className="field-note">{notice}</p>}
      {!hasToolbar && pendingList}
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT}
        multiple
        hidden
        aria-label={t.upload}
        onChange={pick}
      />
      {!hasToolbar && (
        <div className="form-actions">
          {bulkDownload && downloadCheckedButton}
          {uploadButtons}
        </div>
      )}
      <Dialog
        open={preview !== null}
        onClose={closePreview}
        size="lg"
        title={preview?.row.fileName}
        /* 닫기는 아래 [닫기] 단추로(사용자 지시 2026-10-27 · #185). Esc · 바깥 누르기도 닫는다. */
        showCloseButton={false}
        footer={
          <>
            <Button variant="text" size="md" onClick={closePreview}>
              {t.previewClose}
            </Button>
            <Button
              size="md"
              disabled={preview?.blob == null}
              onClick={() => {
                if (preview?.blob != null) save(preview.blob, preview.row.fileName);
              }}
            >
              {t.previewDownload}
            </Button>
          </>
        }
      >
        <div className="inspection-documents-preview">{previewBody()}</div>
      </Dialog>
    </section>
  );
};
