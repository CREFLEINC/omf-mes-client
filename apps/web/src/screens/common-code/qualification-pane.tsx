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
  /**
   * **막을 것 — 전역이다.** 이 화면의 자격 저장은 한 번에 하나뿐이라(훅 하나에 요청 하나),
   * 다른 작업자의 저장이 나가는 중이면 여기서도 새 저장을 시작할 수 없다. 두 번째를 내면
   * 앞 저장의 무효화·성공·**실패**가 통째로 오지 않는다.
   *
   * **구획 전체를 잠근다.** 저장에 성공하면 초안이 서버 응답으로 다시 서므로, 나가는 중에
   * 표를 고칠 수 있게 두면 성공이 그 편집을 조용히 지운다.
   */
  isLocked: boolean;
  /**
   * **가릴 것 — 지금 이 구획의 저장인가.** 진행 표시는 자기 저장에만 돈다 —
   * 남의 저장으로 스피너를 돌리면 화면이 손댄 적 없는 작업자를 「저장 중」이라고 말한다.
   */
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
  isLocked,
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
   * 지정 폭의 합은 **692px**(140+160+200+96+96)이라 `.wide-table`의 최소 폭(58rem = 928px)
   * 안에 들어간다 — 「자격 유형」만 폭을 지정하지 않고 남는 폭을 흡수한다.
   *
   * 계획 결정 11은 자격 유형에 140px을 줘 832px로 잡았으나 그 열을 흡수 열로 돌렸다.
   * 자격 유형은 **값 목록이 미정**이라(§8-5) 어떤 길이의 문구가 들어올지 아직 모르는데,
   * 좁은 고정 폭을 주면 목록이 확정된 뒤 그 열부터 짓눌린다.
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
      /* 나가는 중에 표가 바뀌면 확인한 것과 다른 것이 저장된 것처럼 보인다. */
      render: (row) => (
        <>
          <IconButton
            icon="edit"
            size="sm"
            disabled={isLocked}
            aria-label={t.actions.editRow(orEmptyMark(row.qualificationTypeCode))}
            onClick={() => onEdit(row.draftId)}
          />
          <IconButton
            icon="delete"
            size="sm"
            disabled={isLocked}
            aria-label={t.actions.removeRow(orEmptyMark(row.qualificationTypeCode))}
            onClick={() => onRemove(row.draftId)}
          />
        </>
      ),
    },
  ];

  /**
   * 저장 자리의 네 상태. **잠금에서 오는 비활성에는 반드시 사유가 붙는다**(배치 규범 4) —
   * 남의 저장이 왜 내 저장을 막는지는 이 구획 어디에도 드러나지 않아, 사유가 없으면
   * 사용자에게 「고장」으로 읽힌다.
   *
   * **넷째 갈래에는 사유를 두지 않는다.** 그 비활성은 잠김(남의 사정)이 아니라
   * **고친 것이 없음**(자기 사정)이라 원인이 사용자가 방금 한 일에 그대로 있다.
   * 형제 구획(거래처 역할)은 그 자리에도 사유를 두지만 이 구획에는 그 문구가 없고
   * D-9가 새 키를 **잠금 사유 하나만** 승인했다 — 갈래 순서 ①②③은 전례와 같고
   * 넷째만 이 구획의 기존 형태를 지킨다.
   */
  const saveAction = (): ReactNode => {
    /* 내 저장이 나가는 중이면 진행 표시가 사유 자리를 대신한다. */
    if (isSaving) {
      return (
        <Button disabled loading>
          {messages.common.save}
        </Button>
      );
    }

    /* 남의 저장이 나가는 중이다 — 잠그되 **무엇을 기다리는지** 밝힌다. */
    if (isLocked) {
      return (
        <DisabledAction
          label={messages.common.save}
          reason={t.actionReasons.saveLockedByOtherWorker}
        />
      );
    }

    /* 서버가 준 목록에 이미 겹친 짝이 있으면 그대로 보내도 서버가 거부한다. */
    if (duplicates.size > 0) {
      return (
        <DisabledAction
          label={messages.common.save}
          reason={t.actionReasons.saveBlockedByInvalid}
        />
      );
    }

    return (
      <Button disabled={!isDirty} onClick={onSave}>
        {messages.common.save}
      </Button>
    );
  };

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
          <Button variant="outlined" disabled={isLocked} onClick={onAdd}>
            {t.actions.add}
          </Button>
        </div>
      </div>

      {listSlot()}

      <div className="form-actions">
        <Button variant="outlined" disabled={!isDirty || isLocked} onClick={onCancel}>
          {messages.common.cancel}
        </Button>

        {saveAction()}
      </div>
    </section>
  );
};
