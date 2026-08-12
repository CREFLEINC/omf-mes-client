import { Button, type Column, EmptyState, IconButton, SkeletonText, Table } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useId, useState, type ReactNode } from 'react';

import type { ApproverOption } from './approver-options';
import { DisabledAction } from './disabled-action';
import { describeApprover } from './lookups';
import { SelectField } from './select-field';
import {
  duplicateApproverIds,
  stepAddBlockedReason,
  stepRemoveBlockedReason,
  type StepDraft,
} from './step-draft';
import type { SelectOption } from './types';

const t = messages.approvalRoute;

/**
 * 우 칸 단계 표의 열 폭.
 *
 * **흡수 열은 승인자 하나뿐이다** — 「이름 · 부서」와 경고 문구를 담는다.
 * 순서 이동 열은 디자인 시스템이 붙이고 인라인 폭 대신 자기 클래스를 쓰므로 여기 담기지
 * 않는다. 예산에는 `REORDER_COLUMN_WIDTH`로 따로 더한다.
 */
export const STEP_COLUMN_WIDTH = {
  stepNo: '64px',
  approverStatus: '96px',
  rowActions: '88px',
} as const;

/**
 * 디자인 시스템이 붙이는 순서 이동 열의 폭. **우리가 지정하는 값이 아니라 예산에 더할 값이다** —
 * 열은 `columns`에 없으므로 폭 합을 셀 때 손으로 더하지 않으면 예산이 조용히 틀린다.
 */
export const REORDER_COLUMN_WIDTH = '96px';

export interface StepPaneProps {
  /**
   * 편집 중인 단계 초안. **`null`이면 아직 세우지 못했다**(불러오는 중이거나 조회 실패) —
   * 그때는 편집 수단을 내지 않는다. 무엇을 고치는지 알 수 없는 자리에 버튼을 두면
   * 사용자가 빈 목록을 저장해 단계를 통째로 지울 수 있다.
   */
  drafts: StepDraft[] | null;
  isLoading: boolean;
  /** 조회 실패 표시. null이 아니면 표·빈 상태 대신 이것을 낸다. */
  loadError: ReactNode;
  /** 치환 저장의 실패 표시. 구획 머리에 선다. */
  banner: ReactNode;
  approverOptions: ApproverOption[];
  /** 승인자 목록이 잘리거나 실패했다는 안내. */
  approverNote?: string;
  approverTypeOptions: SelectOption[];
  approverTypeNote?: string;
  isLocked: boolean;
  saveDisabledReason: string | null;
  onAdd: (approver: ApproverOption) => void;
  onRemove: (draftId: string) => void;
  /** 디자인 시스템이 주는 배열 인덱스 그대로 넘긴다 — 순서를 다루는 규칙은 초안 쪽이 갖는다. */
  onReorder: (from: number, to: number) => void;
  onSave: () => void;
}

/**
 * 고른 결재선의 결재 단계 — **추가·삭제·순서 이동과 전체 치환 저장**.
 *
 * **읽는 데는 조회가 하나도 붙지 않는다.** 계약이 단계 응답에 승인자의 표시 이름과 부서,
 * 사용 여부를 함께 실어 보내기 때문이다. 고를 때만 사용자 목록이 필요하고, 그 목록은
 * 컨테이너가 결재선을 고른 뒤에 부른다.
 *
 * **정렬을 켜지 않고 묶음도 두지 않는다.** 행 순서가 곧 자료이며, 디자인 시스템의 순서 이동
 * 열은 정렬이 켜지면 잠기고 묶음을 주면 아예 사라진다(설치본 실측).
 *
 * **승인자를 셀 안에서 고르지 않는다.** 표는 디자인 시스템이 가로 넘침 상자로 감싸므로 셀 안의
 * 펼침 목록이 상자 경계에서 잘릴 수 있다 — 이 저장소 이슈 #45와 같은 형태의 자리를 만들지
 * 않는다. 그래서 **추가는 표 아래 줄**에서 하고, 승인자를 **바꾸는** 조작은 두지 않는다:
 * 단계는 (순서, 승인자) 둘뿐이라 「바꾸기」가 「지우고 넣고 옮기기」와 같고, 조작을 하나 줄이면
 * 초안 규칙도 하나 줄어든다.
 *
 * **상시 안내 네 줄을 늘 낸다.** 전체 교체 · 승인자 부재 · 소급하지 않음 · 반려 후 재상신은
 * 결재선을 보는 내내 참인 사실이라, 성공 알림에 붙이면 알림과 함께 사라져 정작 읽어야 할
 * 사람이 못 읽는다.
 *
 * 이 화면 슬라이스가 소유한다 — 다른 화면 슬라이스의 같은 이름 부품을 참조하지 않는다.
 */
export const StepPane = ({
  drafts,
  isLoading,
  loadError,
  banner,
  approverOptions,
  approverNote,
  approverTypeOptions,
  approverTypeNote,
  isLocked,
  saveDisabledReason,
  onAdd,
  onRemove,
  onReorder,
  onSave,
}: StepPaneProps) => {
  /*
   * 추가 줄에서 고른 승인자. **이 구획 밖으로 나가지 않는 값이라 여기서 들고 있는다** —
   * 아직 어떤 단계도 되지 않았고 저장에도 실리지 않는다.
   *
   * 대상이 바뀌면 컨테이너가 이 부품을 통째로 다시 세워 값이 함께 사라진다(`key`) —
   * 앞 결재선에 넣으려던 승인자가 다음 결재선의 추가 줄에 남아 있으면 안 된다.
   */
  const [approverValue, setApproverValue] = useState('');
  const removeReasonId = useId();

  const selectedApprover = approverOptions.find((option) => option.value === approverValue) ?? null;
  const addDisabledReason = stepAddBlockedReason(selectedApprover);
  const removeDisabledReason = stepRemoveBlockedReason(drafts?.length ?? 0);
  const duplicated = duplicateApproverIds(drafts ?? []);

  const columns: Column<StepDraft>[] = [
    {
      key: 'stepNo',
      header: t.fields.stepNo,
      width: STEP_COLUMN_WIDTH.stepNo,
      align: 'end',
      /* 순서는 **배열의 위치**다. 서버가 준 값을 그리면 행을 옮긴 뒤 표시와 자료가 어긋난다. */
      render: (_step, index) => String(index + 1),
    },
    {
      key: 'approver',
      header: t.fields.approver,
      render: (step) => (
        <>
          <span>{describeApprover(step)}</span>
          {/* 색에만 기대지 않는다 — 사유가 글자로 함께 서야 한다. */}
          {!step.approverIsActive && (
            <span className="field-error">{t.notes.approverInactiveWarning}</span>
          )}
          {step.approverUserId !== null && duplicated.has(step.approverUserId) && (
            <span className="field-note">{t.notes.approverDuplicateWarning}</span>
          )}
        </>
      ),
    },
    {
      key: 'approverStatus',
      header: t.fields.approverStatus,
      width: STEP_COLUMN_WIDTH.approverStatus,
      render: (step) =>
        step.approverIsActive ? t.values.approverActive : t.values.approverInactive,
    },
    {
      key: 'rowActions',
      header: t.fields.stepRowActions,
      width: STEP_COLUMN_WIDTH.rowActions,
      render: (step, index) => (
        <IconButton
          icon="delete"
          size="sm"
          aria-label={t.actions.removeStep(index + 1)}
          /*
           * 마지막 한 단계는 지울 수 없다. 사유는 이 버튼의 접근 설명으로 잇는다 —
           * 비활성 컨트롤은 포커스를 받지 못해 툴팁만으로는 닿을 수 없다(배치 규범 4).
           */
          disabled={isLocked || removeDisabledReason !== null}
          aria-describedby={removeDisabledReason === null ? undefined : removeReasonId}
          onClick={() => {
            /* 누르는 자리가 스스로 한 번 더 본다 — 버튼의 잠금만 믿지 않는다. */
            if (removeDisabledReason !== null) return;

            onRemove(step.draftId);
          }}
        />
      ),
    },
  ];

  const stepsSlot = (): ReactNode => {
    if (loadError !== null && loadError !== undefined) return loadError;

    if (isLoading || drafts === null) {
      return (
        <div role="status" aria-label={t.loading.steps}>
          <SkeletonText lines={3} />
        </div>
      );
    }

    return (
      <Table
        density="compact"
        columns={columns}
        rows={drafts}
        getRowId={(step) => step.draftId}
        /*
         * 순서 이동 열은 디자인 시스템이 렌더하고 접근성 처리(포커스 이동·라이브 안내)도 맡는다.
         * 전송 중에는 이 열 자체를 내지 않는다 — 디자인 시스템에 「이동만 비활성」 스위치가 없고,
         * 눌러도 아무 일이 없는 버튼을 남기는 것보다 없는 편이 정직하다.
         */
        reorderable={!isLocked}
        onRowReorder={onReorder}
        empty={
          <EmptyState
            size="sm"
            live
            title={t.empty.noStepsTitle}
            description={t.empty.noStepsDescription}
          />
        }
      />
    );
  };

  const handleAdd = (): void => {
    /* 보내는 자리가 스스로 한 번 더 본다 — 승인자 없는 행이 서면 저장 자체가 막힌다. */
    if (selectedApprover === null) return;

    onAdd(selectedApprover);
    /* 같은 사람을 잇달아 두 번 넣는 실수를 줄인다 — 넣은 것은 이미 표에 보인다. */
    setApproverValue('');
  };

  return (
    <section className="pane" aria-label={t.panes.steps}>
      <div className="banner-slot">{banner}</div>

      {stepsSlot()}

      {/*
       * 사유를 담는 자리. 행마다 버튼이 서지만 사유는 하나라 한 번만 렌더하고 `aria-describedby`로
       * 잇는다 — 행마다 같은 문장을 되풀이하면 스크린리더가 목록을 읽는 내내 그것을 반복한다.
       *
       * **지울 것이 없으면 내지 않는다.** 사유는 삭제 버튼의 설명이라 그 버튼이 없으면 가리킬
       * 대상이 없고, 빈 상태 안내 옆에 서면 「지울 것도 없는데 지울 수 없다」가 된다.
       * 판정 함수는 건드리지 않는다 — 핸들러와 버튼의 잠금이 같은 함수를 보고 있다.
       */}
      {drafts !== null && drafts.length > 0 && removeDisabledReason !== null && (
        <span id={removeReasonId} className="field-note">
          {removeDisabledReason}
        </span>
      )}

      {drafts !== null && (
        <div className="filter-bar">
          {/*
           * 승인자 구분 — 1차에는 사용자만 열린다. **잠긴 선택지를 감추지 않는다**(`omf-mes#69`).
           * 값이 하나뿐이라 고를 것이 없지만, 그 사실을 보이는 것이 이 칸의 일이다.
           *
           * **`disabledReason`을 주지 않는다.** 그 prop이 묻는 것은 「왜 잠겼는가」인데 여기
           * 담을 값(역할·부서를 열지 않았다 · 목록이 잘렸다)은 그 답이 아니다 — 이 칸이 잠기는
           * 이유는 **전송 중**이고, 그것은 저장 버튼의 진행 표시가 이미 말한다. 잠긴 동안은
           * 고를 수 없으므로 「무엇을 고를 수 있는가」의 안내도 그 사이에는 읽을 일이 없다.
           */}
          <SelectField
            label={t.fields.approverType}
            options={approverTypeOptions}
            value="USER"
            note={approverTypeNote}
            disabled={isLocked}
            onChange={() => {
              /* 열린 값이 하나뿐이라 바뀔 값이 없다. 치환 본문의 구분은 상수이며 이 칸을 읽지 않는다. */
            }}
          />

          <SelectField
            label={t.fields.approver}
            options={approverOptions}
            value={approverValue}
            note={approverNote}
            disabled={isLocked}
            onChange={setApproverValue}
          />

          {addDisabledReason === null ? (
            <div className="field-cell">
              <Button variant="outlined" disabled={isLocked} onClick={handleAdd}>
                {t.actions.addStep}
              </Button>
            </div>
          ) : (
            <DisabledAction label={t.actions.addStep} reason={addDisabledReason} />
          )}
        </div>
      )}

      {/* 이 저장이 전체 교체라는 사실. 계약에 개별 추가·삭제 경로가 없어 배열이 곧 최종 순서다. */}
      <p className="field-note">{t.notes.stepReplaceWholeList}</p>
      <p className="field-note">{t.notes.stepGuideApproverAbsent}</p>
      <p className="field-note">{t.notes.stepGuideNotRetroactive}</p>
      <p className="field-note">{t.notes.stepGuideRejectResubmit}</p>

      {drafts !== null && (
        <div className="form-actions">
          {saveDisabledReason === null ? (
            <Button variant="filled" loading={isLocked} disabled={isLocked} onClick={onSave}>
              {t.actions.saveSteps}
            </Button>
          ) : (
            <DisabledAction
              variant="filled"
              label={t.actions.saveSteps}
              reason={saveDisabledReason}
            />
          )}
        </div>
      )}
    </section>
  );
};
