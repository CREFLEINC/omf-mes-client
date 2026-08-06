import {
  AlertBanner,
  Button,
  type Column,
  EmptyState,
  IconButton,
  SkeletonText,
  Table,
} from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import type { ReactNode } from 'react';

import { DisabledAction } from './disabled-action';
import type { QualificationDraft } from './qualification-draft';
import { duplicateDraftIds } from './qualification-validation';
import type { LookupEntry } from './types';

const t = messages.commonCode.qualification;

export interface QualificationPaneProps {
  drafts: QualificationDraft[];
  isLoading: boolean;
  isWorkerSelected: boolean;
  /** 공정 번호를 사람이 읽는 이름으로. 비운 값은 「(전체 공정)」이다 */
  processEntries: LookupEntry[];
  /** 선택 목록이 잘렸거나 실패했다는 안내 슬롯 */
  optionsNotice: ReactNode;
  loadError: ReactNode;
  /** 저장 실패 배너 슬롯 */
  banner: ReactNode;
  isDirty: boolean;
  isSaving: boolean;
  onAdd: () => void;
  onEdit: (draftId: string) => void;
  onRemove: (draftId: string) => void;
  onSave: () => void;
  onCancel: () => void;
}

/** 값이 없는 칸을 비워 두면 자료가 없는 것인지 화면이 빠뜨린 것인지 구분되지 않는다. */
const orEmptyMark = (value: string): string =>
  value === '' ? messages.commonCode.values.empty : value;

/**
 * 우 칸 아래 — 자격·인증.
 *
 * **저장은 전체 치환이다.** 창의 확인은 표에만 반영되고 서버로는 「저장」에서 최종 목록이
 * 한 번에 나간다 — 계약이 개별 부여·회수 경로를 두지 않았다.
 *
 * **쪽 이동을 두지 않는다** — 계약의 자격 목록에 쪽 나눔이 없다(`items`만 온다).
 *
 * **인증자는 값만 보인다.** 무엇을 가리키는 번호인지 근거가 없어(omf-mes#64) 이름을 만들 수 없고,
 * 화면에 입력칸도 두지 않는다 — 저장할 때 서버가 준 값을 그대로 되돌려 싣는다.
 */
export const QualificationPane = ({
  drafts,
  isLoading,
  isWorkerSelected,
  processEntries,
  optionsNotice,
  loadError,
  banner,
  isDirty,
  isSaving,
  onAdd,
  onEdit,
  onRemove,
  onSave,
  onCancel,
}: QualificationPaneProps) => {
  const duplicates = duplicateDraftIds(drafts);

  const processLabel = (processId: string): string => {
    if (processId === '') return t.values.allProcesses;

    return processEntries.find((entry) => entry.value === processId)?.label ?? processId;
  };

  const periodLabel = (draft: QualificationDraft): string => {
    if (draft.validFrom === '' && draft.validTo === '') return messages.commonCode.values.empty;

    return t.values.period(orEmptyMark(draft.validFrom), orEmptyMark(draft.validTo));
  };

  /*
   * 지정 폭의 합은 832px이라 `.wide-table`의 최소 폭(58rem = 928px) 안에 들어간다 —
   * 「자격 유형」만 폭을 지정하지 않고 남는 폭을 흡수한다.
   */
  const columns: Column<QualificationDraft>[] = [
    {
      key: 'qualificationTypeCode',
      header: t.fields.qualificationType,
      render: (row) => orEmptyMark(row.qualificationTypeCode),
    },
    {
      key: 'processId',
      header: t.fields.process,
      width: '140px',
      render: (row) => processLabel(row.processId),
    },
    {
      key: 'certificateNo',
      header: t.fields.certificateNo,
      width: '160px',
      render: (row) => orEmptyMark(row.certificateNo),
    },
    {
      key: 'validPeriod',
      header: t.fields.validPeriod,
      width: '200px',
      render: (row) => periodLabel(row),
    },
    {
      key: 'certifiedBy',
      header: t.fields.certifiedBy,
      width: '96px',
      align: 'end',
      /* 값만 표시한다 — 선택 목록을 두지 않기로 확정됐다(omf-mes#64). */
      render: (row) =>
        row.certifiedBy === null ? messages.commonCode.values.empty : String(row.certifiedBy),
    },
    {
      key: 'edit',
      header: t.fields.edit,
      width: '96px',
      render: (row) => (
        <>
          <IconButton
            icon="edit"
            size="sm"
            aria-label={t.actions.editRow(orEmptyMark(row.qualificationTypeCode))}
            onClick={() => onEdit(row.draftId)}
          />
          <IconButton
            icon="delete"
            size="sm"
            aria-label={t.actions.removeRow(orEmptyMark(row.qualificationTypeCode))}
            onClick={() => onRemove(row.draftId)}
          />
        </>
      ),
    },
  ];

  const listSlot = (): ReactNode => {
    if (loadError !== null && loadError !== undefined) return loadError;

    if (isLoading) {
      return (
        <div role="status" aria-label={t.loading.list}>
          <SkeletonText lines={3} />
        </div>
      );
    }

    return (
      <div className="wide-table">
        <Table
          density="compact"
          columns={columns}
          rows={drafts}
          getRowId={(row) => row.draftId}
          empty={
            <EmptyState
              size="sm"
              live
              title={t.empty.noneTitle}
              description={t.empty.noneDescription}
            />
          }
        />
      </div>
    );
  };

  if (!isWorkerSelected) {
    return (
      <section className="pane" aria-label={t.paneTitle}>
        <EmptyState size="sm" title={t.empty.notSelected} />
        {/*
         * 작업자를 고르기 전에도 「자격 추가」를 감추지 않는다 — 감추면 사용자가
         * 「이 화면에는 없는 기능」으로 오해하고 다른 곳을 찾는다(배치 규범 4).
         */}
        <div className="filter-bar">
          <DisabledAction label={t.actions.add} reason={t.actionReasons.needsWorker} />
        </div>
      </section>
    );
  }

  return (
    <section className="pane" aria-label={t.paneTitle}>
      {banner}
      {optionsNotice}

      {/*
       * 서버가 준 목록에 이미 겹친 짝이 있을 수 있다(옛 자료) — 그대로 보내면 서버가 거부한다.
       * 저장을 눌러야 알게 하지 않고 미리 밝힌다.
       */}
      {duplicates.size > 0 && (
        <div className="banner-slot">
          <AlertBanner variant="warning">{t.validation.duplicatePair}</AlertBanner>
        </div>
      )}

      <div className="filter-bar">
        <div className="field-cell">
          <Button variant="outlined" onClick={onAdd}>
            {t.actions.add}
          </Button>
        </div>
      </div>

      {listSlot()}

      <div className="form-actions">
        <Button variant="outlined" disabled={!isDirty} onClick={onCancel}>
          {messages.common.cancel}
        </Button>

        {duplicates.size > 0 ? (
          <DisabledAction
            label={messages.common.save}
            reason={t.actionReasons.saveBlockedByInvalid}
          />
        ) : (
          <Button disabled={!isDirty || isSaving} loading={isSaving} onClick={onSave}>
            {messages.common.save}
          </Button>
        )}
      </div>
    </section>
  );
};
