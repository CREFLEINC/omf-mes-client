import { Button, Checkbox, EmptyState, SkeletonText } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { type ReactNode, useId } from 'react';

import { DisabledAction } from './disabled-action';
import type { RoleChoice } from './role-assign-draft';

const t = messages.usersRoles;

export interface RoleAssignPaneProps {
  choices: RoleChoice[];
  isLoading: boolean;
  /** 선택 목록이 잘렸거나 실패했다는 안내 슬롯 */
  optionsNotice: ReactNode;
  loadError: ReactNode;
  /** 저장 실패 배너 슬롯 */
  banner: ReactNode;
  isDirty: boolean;
  isSaving: boolean;
  onToggle: (roleId: number) => void;
  onSave: () => void;
  onCancel: () => void;
}

/**
 * 우 칸 가운데 — 역할 부여.
 *
 * **표가 아니라 확인칸 목록이다**(계획 결정 11). 디자인 시스템 `Table`의 선택 열은 머리글에
 * 전체 선택을 두는데, 이 자리에서 그것은 「이 사용자에게 모든 역할을 준다」가 된다 —
 * 화면이 관리 권한 회수를 판정하지 않기로 한 마당에(계획 결정 4) 그런 버튼을 둘 수 없다.
 *
 * **저장은 전체 치환이다.** 확인칸을 켤 때마다 서버를 부르지 않고 「저장」에서 최종 상태가
 * 한 번에 나간다 — 계약이 개별 부여·회수 경로를 두지 않았다.
 *
 * **확인칸이 잠기는 이유는 하나뿐이다** — 그 역할이 미사용이라는 사실이다. 「자기 자신」·
 * 「마지막 한 사람」 같은 판정을 화면이 하지 않는다. 그 판정에 필요한 것이 계약에 하나도 없다.
 */
export const RoleAssignPane = ({
  choices,
  isLoading,
  optionsNotice,
  loadError,
  banner,
  isDirty,
  isSaving,
  onToggle,
  onSave,
  onCancel,
}: RoleAssignPaneProps) => {
  const lockedNoteId = useId();
  const hasLocked = choices.some((choice) => choice.isLocked);

  const listSlot = (): ReactNode => {
    /*
     * 실패를 빈 목록으로 내면 「부여된 역할이 없다」로 읽힌다 — 그 상태로 저장하면
     * 사용자가 의도한 적 없는 전체 회수가 나간다.
     */
    if (loadError !== null && loadError !== undefined) return loadError;

    if (isLoading) {
      return (
        <div role="status" aria-label={t.loading.roleAssign}>
          <SkeletonText lines={3} />
        </div>
      );
    }

    if (choices.length === 0) {
      return (
        <EmptyState
          size="sm"
          live
          title={t.assign.empty.none}
          description={t.assign.empty.noneDescription}
        />
      );
    }

    return (
      <div className="check-group">
        {choices.map((choice) => (
          <Checkbox
            key={choice.roleId}
            checked={choice.isSelected}
            disabled={choice.isLocked}
            /* 여러 확인칸이 함께 보는 안내라 각 칸에 되풀이하지 않고 하나를 잇는다. */
            aria-describedby={choice.isLocked ? lockedNoteId : undefined}
            onChange={() => {
              onToggle(choice.roleId);
            }}
          >
            {choice.label}
          </Checkbox>
        ))}
      </div>
    );
  };

  return (
    <section className="pane" aria-label={t.panes.roleAssign}>
      {banner}
      {optionsNotice}

      {listSlot()}

      {/*
       * 비활성 컨트롤은 포커스를 받지 못해 사유를 시각으로만 두면 보조기술이 닿을 수 없다 —
       * 감추지 않고 항상 보이는 DOM 텍스트로 두고 `aria-describedby`로 잇는다(배치 규범 4).
       */}
      {hasLocked && (
        <p id={lockedNoteId} className="field-note">
          {t.assign.lockedInactiveNote}
        </p>
      )}

      <div className="form-actions">
        <Button variant="outlined" disabled={!isDirty} onClick={onCancel}>
          {messages.common.cancel}
        </Button>

        {/*
         * 고친 것이 없으면 주 액션을 **비활성 + 사유**로 둔다(배치 규범 4).
         * 저장 중에는 진행 표시가 그 자리를 대신하므로 사유를 내지 않는다.
         */}
        {isDirty || isSaving ? (
          <Button disabled={isSaving} loading={isSaving} onClick={onSave}>
            {messages.common.save}
          </Button>
        ) : (
          <DisabledAction
            variant="filled"
            label={messages.common.save}
            reason={t.actionReasons.saveNoChanges}
          />
        )}
      </div>
    </section>
  );
};
