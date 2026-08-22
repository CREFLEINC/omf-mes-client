import {
  AlertBanner,
  Button,
  Checkbox,
  type Column,
  Dialog,
  EmptyState,
  SkeletonText,
  Table,
} from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import type { ReactNode } from 'react';

import {
  failedLine,
  formatObservedAt,
  isAlreadyMapped,
  isSelectable,
  orNotRecorded,
  type ImportSummary,
} from './observation';
import type { CollectionChannelObservation } from './types';

const t = messages.collectionChannel.importLog;

export interface ImportDialogProps {
  observations: CollectionChannelObservation[];
  isLoading: boolean;
  isError: boolean;
  unmappedOnly: boolean;
  onChangeUnmappedOnly: (unmappedOnly: boolean) => void;
  selected: readonly string[];
  onToggle: (observation: CollectionChannelObservation) => void;
  /** 보낸 결과. 아직 안 보냈으면 `null` */
  summary: ImportSummary | null;
  isSaving: boolean;
  onClose: () => void;
  onImport: () => void;
}

/**
 * 수신 로그에서 채널을 가져오는 창.
 *
 * ⭐ **외부에서 오는 이름은 손으로 치게 하지 않는다**(스펙 §9-1) — 채널명은 설비가 정하고,
 * 옮겨 적다 한 글자만 틀려도 그 신호의 값은 조용히 버려진다.
 *
 * ⛔ **이미 등록된 신호를 감추지 않는다**(공유계약 G-2) — 보이되 고르지 못하게 하고 사유를
 * 붙인다. 감추면 「찾던 그 신호가 왜 없지」가 되고 그 답이 화면에 없다.
 */
export const ImportDialog = ({
  observations,
  isLoading,
  isError,
  unmappedOnly,
  onChangeUnmappedOnly,
  selected,
  onToggle,
  summary,
  isSaving,
  onClose,
  onImport,
}: ImportDialogProps) => {
  const columns: Column<CollectionChannelObservation>[] = [
    {
      key: 'pick',
      header: '',
      width: '52px',
      render: (row) => (
        <Checkbox
          checked={selected.includes(row.channelKey)}
          disabled={!isSelectable(row)}
          onChange={() => onToggle(row)}
          aria-label={row.channelKey}
        />
      ),
    },
    {
      key: 'channelKey',
      header: t.fields.channelKey,
      /* 설비가 정한 이름이다 — 다듬지 않고 온 그대로 세운다. */
      render: (row) =>
        isAlreadyMapped(row) ? `${row.channelKey} (${t.alreadyMapped})` : row.channelKey,
    },
    {
      key: 'lastValue',
      header: t.fields.lastValue,
      width: '120px',
      align: 'end',
      /* ⭐ 이름만으로는 무엇인지 모른다 — 최근 값이 어느 항목에 이을지의 판단 근거다(§9-1). */
      render: (row) => orNotRecorded(row.lastValue),
    },
    {
      key: 'observedAt',
      header: t.fields.observedAt,
      /* 날짜와 시각이 한 줄에 들어갈 만큼 준다 — 접히면 두 값이 서로 다른 것처럼 읽힌다. */
      width: '168px',
      /* ⚠ 보는 사람의 시간대로 옮기지 않는다 — 이것은 «설비가 있는 곳»의 시각이다. */
      render: (row) => formatObservedAt(row.observedAt),
    },
  ];

  const listSlot = (): ReactNode => {
    if (isError) {
      return (
        <div className="banner-slot">
          <AlertBanner variant="error">{t.loadFailed}</AlertBanner>
        </div>
      );
    }

    if (isLoading) {
      return (
        <div role="status" aria-label={t.loading}>
          <SkeletonText lines={3} />
        </div>
      );
    }

    return (
      <Table
        density="compact"
        columns={columns}
        rows={observations}
        getRowId={(row) => row.channelKey}
        empty={<EmptyState size="sm" live title={t.emptyTitle} description={t.emptyDescription} />}
      />
    );
  };

  return (
    <Dialog
      open
      onClose={onClose}
      closeOnBackdropClick={false}
      size="lg"
      title={t.title}
      footer={
        <>
          <Button variant="outlined" onClick={onClose} disabled={isSaving}>
            {messages.common.close}
          </Button>
          <Button onClick={onImport} loading={isSaving} disabled={selected.length === 0}>
            {t.confirm}
          </Button>
        </>
      }
    >
      <div className="dialog-scroll">
        {/*
         * 창 폭 전체를 쓰는 안내다 — `.field-note` 는 규범 4에 따라 20rem 에 갇혀 있어
         * 넓은 창에서 좁은 기둥이 된다(브라우저 확인 실측).
         */}
        <p className="dialog-lead">{t.description}</p>

        {/*
         * ⭐ **보낸 결과를 창 안에 남긴다.** 창을 닫아 버리면 무엇이 되고 무엇이 안 됐는지
         * 사라진다 — 계약에 일괄 등록이 없어 **일부만 성공하는 것이 정상**이다.
         */}
        {summary !== null && (
          <div className="banner-slot">
            <AlertBanner
              variant={summary.failed.length === 0 ? 'success' : 'warning'}
              title={t.resultTitle}
            >
              <>
                <p>{t.createdCount(summary.createdCount)}</p>
                {summary.failed.length > 0 && (
                  <>
                    <p>{t.failedCount(summary.failed.length)}</p>
                    <ul>
                      {summary.failed.map((outcome) => (
                        <li key={outcome.channelKey}>{failedLine(outcome)}</li>
                      ))}
                    </ul>
                  </>
                )}
              </>
            </AlertBanner>
          </div>
        )}

        <div className="filter-bar">
          <div className="field-cell field-cell-unlabeled">
            <div className="check-group">
              <Checkbox
                checked={unmappedOnly}
                onChange={(event) => onChangeUnmappedOnly(event.target.checked)}
              >
                {t.unmappedOnly}
              </Checkbox>
            </div>
          </div>
          <div className="field-cell field-cell-unlabeled">
            <p className="field-note">{t.selectedCount(selected.length)}</p>
          </div>
        </div>

        {listSlot()}
      </div>
    </Dialog>
  );
};
