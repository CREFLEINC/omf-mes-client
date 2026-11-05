import { Button } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';

import { DisabledAction } from './disabled-action';
import type { RoutingStatusView } from './routing-status';

const t = messages.routing;

export interface RoutingActionsProps {
  mode: 'create' | 'edit';
  /** 지금 판 번호. 첫 등록은 null — Rev 비교 · 변경 이력을 세우지 않는다. */
  routingVersion: number | null;
  status: RoutingStatusView | null;
  isDirty: boolean;
  isSaving: boolean;
  /** 저장을 막는 사유(예: 공정 구성에 덜 채운 행). null 이면 막지 않는다. */
  saveBlockedReason?: string | null;
  onSave: () => void;
  onCancel: () => void;
  confirmDisabledReason: string | null;
  obsoleteDisabledReason: string | null;
  isTransitioning: boolean;
  onConfirm: () => void;
  onObsolete: () => void;
  /** 작성중 Rev 취소(삭제 · #231). 작성중에서만 단추가 선다. */
  onDiscard?: () => void;
  /** Rev 비교 · 변경 이력 창을 연다(#231). 주지 않으면 단추를 사유와 함께 비활성으로 둔다. */
  onCompare?: () => void;
  onHistory?: () => void;
}

/**
 * Routing 편집 단추 줄 — [Rev 비교 · 변경 이력] … [취소][저장][확정][폐기](사용자 시안 · #231).
 * 상세 카드는 이 줄 하나를 설정 탭 맨 아래에 둔다 — 저장은 기본 정보 · 공정 구성을 함께 저장한다.
 */
export const RoutingActions = ({
  mode,
  routingVersion,
  status,
  isDirty,
  isSaving,
  saveBlockedReason = null,
  onSave,
  onCancel,
  confirmDisabledReason,
  obsoleteDisabledReason,
  isTransitioning,
  onConfirm,
  onObsolete,
  onDiscard,
  onCompare,
  onHistory,
}: RoutingActionsProps) => {
  const isLockedByState = status !== null && !status.isEditable;
  const showObsolete = status !== null && status.status !== 'draft';
  const hasEarlierRevision = routingVersion !== null && routingVersion > 1;
  const saveLabel = mode === 'create' ? t.actions.createRouting : messages.common.save;

  return (
    <div className="form-actions">
      {/*
       * 사유가 붙은 보조 액션(Rev 비교 · 변경 이력)은 줄 왼쪽에, 나머지는 오른쪽에 — 취소 · 저장 · 확정 · 폐기 순(사용자 시안 · #231).
       * 왼쪽 묶음의 마지막 항목이 auto 여백을 가져 그 뒤가 오른쪽으로 밀린다.
       */}
      {/* 견줄 앞 판이 없는 Rev 1 · 첫 등록에는 Rev 비교 · 변경 이력을 세우지 않는다(사용자 지시 · #231). */}
      {hasEarlierRevision && (
        <>
          {onCompare === undefined ? (
            <DisabledAction
              label={t.actions.compareRevisions}
              reason={t.actionReasons.compareRevisionsUnavailable}
            />
          ) : (
            <div className="field-cell">
              <Button variant="outlined" onClick={onCompare}>
                {t.actions.compareRevisions}
              </Button>
            </div>
          )}
          {onHistory === undefined ? (
            <DisabledAction
              label={t.actions.changeHistory}
              reason={t.actionReasons.changeHistoryUnavailable}
              className="form-actions-secondary"
            />
          ) : (
            <div className="field-cell form-actions-secondary">
              <Button variant="outlined" onClick={onHistory}>
                {t.actions.changeHistory}
              </Button>
            </div>
          )}
        </>
      )}

      {/*
       * 지금 할 수 있는 작업만 세운다(사용자 지시 · #231) — 확정 · 폐기 Rev 에는 취소 · 저장 · 확정을 두지 않는다.
       * 작성중은 오른쪽에 취소 · 저장 · 확정. 첫 등록은 아직 확정할 대상이 없어 확정을 두지 않는다.
       */}
      {!isLockedByState && (
        <>
          {/* 작성 취소 — 저장한 작성중 Rev 를 지운다. 입력만 되돌리는 「취소」와 떨어뜨려 왼쪽에 둔다(#231). */}
          {mode === 'edit' && status?.status === 'draft' && onDiscard !== undefined && (
            <div className="field-cell routing-discard-action">
              <Button variant="outlined" disabled={isTransitioning} onClick={onDiscard}>
                {t.actions.discard}
              </Button>
            </div>
          )}

          <Button variant="outlined" disabled={!isDirty} onClick={onCancel}>
            {messages.common.cancel}
          </Button>

          {saveBlockedReason !== null && isDirty ? (
            <DisabledAction label={saveLabel} reason={saveBlockedReason} quiet />
          ) : (
            <Button disabled={!isDirty || isSaving} loading={isSaving} onClick={onSave}>
              {saveLabel}
            </Button>
          )}

          {mode === 'edit' &&
            (confirmDisabledReason === null ? (
              <div className="field-cell">
                <Button variant="outlined" disabled={isTransitioning} onClick={onConfirm}>
                  {t.actions.confirm}
                </Button>
              </div>
            ) : (
              /* 확정을 막는 사유(공정 0건 · 저장하지 않은 변경)는 사용자가 풀 수 있는 것이라 남긴다. */
              <DisabledAction label={t.actions.confirm} reason={confirmDisabledReason} quiet />
            ))}
        </>
      )}

      {/* 폐기는 확정 Rev 에서만 — 다른 작업과 떨어뜨려 둔다. 쓸 수 없으면 세우지 않는다. */}
      {showObsolete && obsoleteDisabledReason === null && (
        <div className="field-cell routing-obsolete-action">
          <Button variant="outlined" disabled={isTransitioning} onClick={onObsolete}>
            {t.actions.obsolete}
          </Button>
        </div>
      )}
    </div>
  );
};
