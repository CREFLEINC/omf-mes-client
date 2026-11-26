import {
  AlertBanner,
  Button,
  type Column,
  EmptyState,
  Icon,
  IconButton,
  SkeletonText,
  Table,
} from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import type { ReactNode } from 'react';

import { lookupDisplayLabel, type LookupSource } from '../../patterns/lookup-display';
import type { QualificationDraft } from './qualification-draft';
import { duplicateDraftIds } from './qualification-validation';
import type { LookupEntry } from './types';

const t = messages.commonCode.qualification;

export interface QualificationPaneProps {
  drafts: QualificationDraft[];
  isLoading: boolean;
  /** 공정 번호를 사람이 읽는 이름으로. 비운 값은 「(전체 공정)」이다 */
  processes: LookupSource<LookupEntry>;
  /** 인증자 번호를 활성 사용자 이름으로 표시한다. 기존 값은 조회 실패 때도 원본을 보존한다 */
  certifiers: LookupSource<LookupEntry>;
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
 * **인증자는 활성 사용자 목록으로 푼다.** 목록 조회가 실패해도 기존 번호는 초안에 남아
 * 저장 과정에서 조용히 사라지지 않는다.
 */
export const QualificationPane = ({
  drafts,
  isLoading,
  processes,
  certifiers,
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

    return lookupDisplayLabel(processes, processId);
  };

  const periodLabel = (draft: QualificationDraft): string => {
    if (draft.validFrom === '' && draft.validTo === '') return messages.commonCode.values.empty;

    return t.values.period(orEmptyMark(draft.validFrom), orEmptyMark(draft.validTo));
  };

  /*
   * 상세 상자 폭에 맞춘다(사용자 지시 2026-11-25) — 종전 `.wide-table` 최소 폭(58rem)이 상세보다 넓어 첫 열이 잘리고
   * 가로로 밀렸다. 열은 모두 가운데 맞춤(생산 창고 표와 같다), 유효기간 · 인증자는 줄을 바꾸지 않는다(layout.css).
   * 「관리」 열만 폭을 정하고 나머지는 글자 폭대로 나눈다 — 자격 유형은 값 목록이 미정(§8-5)이라 고정 폭을 두지 않는다.
   */
  const columns: Column<QualificationDraft>[] = [
    {
      key: 'qualificationTypeCode',
      header: t.fields.qualificationType,
      align: 'center',
      render: (row) => orEmptyMark(row.qualificationTypeCode),
    },
    {
      key: 'processId',
      header: t.fields.process,
      align: 'center',
      render: (row) => processLabel(row.processId),
    },
    {
      key: 'certificateNo',
      header: t.fields.certificateNo,
      align: 'center',
      render: (row) => orEmptyMark(row.certificateNo),
    },
    {
      key: 'validPeriod',
      header: t.fields.validPeriod,
      align: 'center',
      render: (row) => periodLabel(row),
    },
    {
      key: 'certifiedBy',
      header: t.fields.certifiedBy,
      align: 'center',
      render: (row) => lookupDisplayLabel(certifiers, row.certifiedBy),
    },
    {
      key: 'edit',
      /* 생산 창고 · 결재 단계 표와 같은 「관리」 열(사용자 지시 2026-11-25). */
      header: t.fields.manage,
      align: 'center',
      width: '96px',
      /* 나가는 중에 표가 바뀌면 확인한 것과 다른 것이 저장된 것처럼 보인다. */
      render: (row) => (
        <span className="users-roles-row-actions">
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
        </span>
      ),
    },
  ];

  /** 저장 자리. 잠긴 까닭을 단추 아래 문구로 내지 않는다 — 꺼진 단추로만(사용자 지시 2026-11-25). */
  const saveAction = (): ReactNode => {
    /* 내 저장이 나가는 중이면 진행 표시가 사유 자리를 대신한다. */
    if (isSaving) {
      return (
        <Button disabled loading>
          {messages.common.save}
        </Button>
      );
    }

    /*
     * 남의 저장이 나가는 중이거나, 서버가 준 목록에 이미 겹친 짝이 있거나(그대로 보내면 서버가 거부한다 — 위 경고
     * 배너가 밝힌다), 고친 것이 없으면 잠그기만 한다. 저장 단추 아래 사유 문구는 두지 않는다(사용자 지시 2026-11-25).
     */
    return (
      <Button disabled={isLocked || duplicates.size > 0 || !isDirty} onClick={onSave}>
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
      <div className="wide-table common-code-qualification-table">
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

  return (
    <section className="pane" aria-label={t.paneTitle}>
      {banner}

      {/*
       * 서버가 준 목록에 이미 겹친 짝이 있을 수 있다(옛 자료) — 그대로 보내면 서버가 거부한다.
       * 저장을 눌러야 알게 하지 않고 미리 밝힌다.
       */}
      {duplicates.size > 0 && (
        <div className="banner-slot">
          <AlertBanner variant="warning">{t.validation.duplicatePair}</AlertBanner>
        </div>
      )}

      {/*
       * 「자격 추가」 — 기본 크기 빨간 단추를 줄 오른쪽 끝에(「+ 새 결재선」과 같은 모양 · 사용자 지시 2026-11-25).
       */}
      <div className="common-code-qualification-add-row">
        <Button leadingIcon={<Icon name="add" size={18} />} disabled={isLocked} onClick={onAdd}>
          {t.actions.add}
        </Button>
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
