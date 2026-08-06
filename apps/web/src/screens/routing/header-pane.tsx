import { AlertBanner, Button, Chip, TextField } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { type ReactNode, useId } from 'react';

import { DisabledAction } from './disabled-action';
import { FieldLabel } from './field-label';
import type { RoutingStatusView } from './routing-status';
import type { RoutingHeaderFormValues } from './types';

const t = messages.routing;

export type HeaderPaneMode = 'edit' | 'create';

export interface HeaderPaneProps {
  /** `create`면 아직 없는 Rev를 만드는 폼이다 — 판 번호·상태가 없고 주 액션이 등록이다. */
  mode: HeaderPaneMode;
  /** 어느 품목의 Routing인지 값으로 밝힌다. 품목은 등록 후 바꿀 수 없어 입력칸을 두지 않는다. */
  itemLabel: string;
  /** 판 번호는 시스템 채번이라 값 표기로만 낸다. 등록 전에는 없으므로 null이다. */
  routingVersion: number | null;
  /** 상태도 서버가 정한다. 등록 전에는 없으므로 null이며, 없는 값을 지어내 보이지 않는다. */
  status: RoutingStatusView | null;
  values: RoutingHeaderFormValues;
  onChange: (patch: Partial<RoutingHeaderFormValues>) => void;
  /** 필드별 인라인 오류 — 로컬 검증 결과와 서버 필드 오류를 상위가 병합해 넘긴다. */
  fieldErrors: Record<string, string>;
  /** 저장 실패 배너 슬롯 */
  banner: ReactNode;
  /** null이면 Routing 코드를 편집할 수 있다. 상태 잠금과는 사유가 다르다. */
  codeLockReason: string | null;
  isDirty: boolean;
  isSaving: boolean;
  onSave: () => void;
  onCancel: () => void;
  /**
   * 상태 전이를 막는 사유. null이면 누를 수 있다.
   *
   * 판정은 화면이 한다 — 라인 건수·저장하지 않은 편집처럼 이 구획 밖의 사실이 조건에 들어간다.
   * 페인이 그것을 알면 두 곳에서 같은 판정을 하게 된다.
   */
  confirmDisabledReason: string | null;
  obsoleteDisabledReason: string | null;
  /** 전이 요청이 도는 동안 참. 두 번 눌러 두 번 전이하는 것을 막는다 */
  isTransitioning: boolean;
  onConfirm: () => void;
  onObsolete: () => void;
}

/**
 * 우 상단 — Routing 헤더.
 *
 * 편집 잠금은 두 갈래이며 사유가 다르다.
 * - **상태 잠금**: 확정·폐기 Rev는 전 입력이 잠긴다. 푸는 방법은 신규 Rev 발행이며 구획 배너로 안내한다.
 * - **코드 잠금**: `editability`가 Routing 코드 하나만 잠근다. 사유는 그 입력칸 아래에 붙는다.
 *
 * 둘 다 걸리면 둘 다 보인다 — 하나로 뭉뚱그리면 무엇을 하면 풀리는지 알 수 없게 된다.
 */
export const HeaderPane = ({
  mode,
  itemLabel,
  routingVersion,
  status,
  values,
  onChange,
  fieldErrors,
  banner,
  codeLockReason,
  isDirty,
  isSaving,
  onSave,
  onCancel,
  confirmDisabledReason,
  obsoleteDisabledReason,
  isTransitioning,
  onConfirm,
  onObsolete,
}: HeaderPaneProps) => {
  const itemLabelId = useId();
  const revisionLabelId = useId();
  const statusLabelId = useId();
  const routingCodeId = useId();
  const effectiveFromId = useId();

  const isLockedByState = status !== null && !status.isEditable;

  const stateLockMessage =
    status?.status === 'obsolete' ? t.stateLock.obsolete : t.stateLock.confirmed;

  return (
    <section className="pane" aria-label={t.panes.header}>
      {isLockedByState && (
        <div className="banner-slot">
          <AlertBanner variant="warning" title={t.stateLock.title}>
            {stateLockMessage}
          </AlertBanner>
        </div>
      )}

      {banner}

      <div className="form-grid">
        {/* 값을 보여 주기만 하면 되는 자리는 폼 컨트롤을 잠그지 말고 값 표기로 낸다. */}
        <div>
          <span className="field-label" id={itemLabelId}>
            {t.fields.item}
          </span>
          <p aria-labelledby={itemLabelId}>{itemLabel}</p>
        </div>

        {/* 등록 전에는 판 번호가 없다 — 서버가 채우는 값을 미리 지어내 보이지 않는다. */}
        {routingVersion !== null && (
          <div>
            <span className="field-label" id={revisionLabelId}>
              {t.fields.revision}
            </span>
            <p aria-labelledby={revisionLabelId}>{t.values.revision(routingVersion)}</p>
          </div>
        )}

        {/*
         * 필수 표시는 디자인 시스템 내장 라벨에 끼울 자리가 없어 라벨을 직접 붙인다(배치 규범 3).
         * 검증이 필수로 막는 칸에 표시가 없으면 저장을 눌러야 필수임을 알게 된다.
         */}
        <div className="field-cell">
          <FieldLabel htmlFor={routingCodeId} label={t.fields.routingCode} required />
          <TextField
            id={routingCodeId}
            value={values.routingCode}
            onChange={(event) => onChange({ routingCode: event.target.value })}
            disabled={isLockedByState || codeLockReason !== null}
            /*
             * 상태 잠금 사유는 여기 붙이지 않는다 — 구획 배너가 이미 한 번 말했고,
             * 입력칸마다 되풀이하면 무엇이 코드만의 사유인지 흐려진다.
             */
            disabledReason={codeLockReason}
            error={fieldErrors.routingCode}
            aria-required
          />
        </div>

        {status !== null && (
          <div>
            <span className="field-label" id={statusLabelId}>
              {t.fields.status}
            </span>
            <p aria-labelledby={statusLabelId}>
              <Chip variant="status" status={status.tone}>
                {status.label}
              </Chip>
            </p>
          </div>
        )}

        {/* DS에 DatePicker가 없다(고정 커밋 기준). 날짜 입력은 TextField의 date 형을 쓴다. */}
        <div className="field-cell">
          <FieldLabel htmlFor={effectiveFromId} label={t.fields.effectiveFrom} required />
          <TextField
            id={effectiveFromId}
            type="date"
            value={values.effectiveFrom}
            onChange={(event) => onChange({ effectiveFrom: event.target.value })}
            disabled={isLockedByState}
            error={fieldErrors.effectiveFrom}
            aria-required
          />
        </div>

        {/* 유효종료는 「지정하지 않음」이 정상 값이라 필수 표시를 붙이지 않는다. */}
        <TextField
          type="date"
          label={t.fields.effectiveTo}
          value={values.effectiveTo}
          onChange={(event) => onChange({ effectiveTo: event.target.value })}
          disabled={isLockedByState}
          error={fieldErrors.effectiveTo}
        />
      </div>

      <div className="form-actions">
        {/*
         * 사유가 붙은 비활성 액션은 줄 왼쪽에, 주 액션(취소·저장)은 오른쪽에 남긴다.
         * 왼쪽 묶음의 마지막 항목이 auto 여백을 가져 그 뒤가 오른쪽으로 밀린다.
         */}
        {confirmDisabledReason === null ? (
          <div className="field-cell">
            <Button variant="outlined" disabled={isTransitioning} onClick={onConfirm}>
              {t.actions.confirm}
            </Button>
          </div>
        ) : (
          <DisabledAction label={t.actions.confirm} reason={confirmDisabledReason} />
        )}

        {obsoleteDisabledReason === null ? (
          <div className="field-cell">
            <Button variant="outlined" disabled={isTransitioning} onClick={onObsolete}>
              {t.actions.obsolete}
            </Button>
          </div>
        ) : (
          <DisabledAction label={t.actions.obsolete} reason={obsoleteDisabledReason} />
        )}

        <DisabledAction
          label={t.actions.compareRevisions}
          reason={t.actionReasons.compareRevisionsUnavailable}
        />
        <DisabledAction
          label={t.actions.changeHistory}
          reason={t.actionReasons.changeHistoryUnavailable}
          className="form-actions-secondary"
        />

        <Button variant="outlined" disabled={!isDirty} onClick={onCancel}>
          {messages.common.cancel}
        </Button>

        {/* 잠긴 상태에서는 고칠 수도 없지만, 잠금 직전에 고친 값이 남아 있을 수 있어 함께 막는다. */}
        <Button
          disabled={!isDirty || isSaving || isLockedByState}
          loading={isSaving}
          onClick={onSave}
        >
          {mode === 'create' ? t.actions.createRouting : messages.common.save}
        </Button>
      </div>
    </section>
  );
};
