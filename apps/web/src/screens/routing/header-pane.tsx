import { Chip, TextField } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { type ReactNode, useId } from 'react';

import { FieldLabel } from './field-label';
import { RoutingActions } from './routing-actions';
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
  /** 품목 · Rev 값 칸을 보일지. 상세 카드는 머리에 이미 보이므로 끈다(#231). */
  showSubject?: boolean;
  /** 취소 · 저장 · 확정 줄을 이 칸에 둘지. 상세 카드는 설정 탭 맨 아래 한 줄로 모은다(#231). */
  showActions?: boolean;
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
  showSubject = true,
  showActions = true,
}: HeaderPaneProps) => {
  const itemLabelId = useId();
  const revisionLabelId = useId();
  const statusLabelId = useId();
  const routingCodeId = useId();
  const routingCodeLabelId = useId();
  const codeLockNoteId = useId();

  /* 「코드 · 이름」을 나눠 칸마다 낸다. 구분자가 없으면(값 없음) 코드 칸에 그대로. */
  const separatorAt = itemLabel.indexOf(' · ');
  const itemParts =
    separatorAt < 0
      ? null
      : { code: itemLabel.slice(0, separatorAt), name: itemLabel.slice(separatorAt + 3) };

  const isLockedByState = status !== null && !status.isEditable;
  const isCodeReadOnly = isLockedByState || codeLockReason !== null;

  return (
    <section className="pane routing-header-pane" aria-label={t.panes.header}>
      {/* 확정 · 폐기 잠금은 경고 상자로 알리지 않는다 — 카드 머리 「Rev · 상태」와 읽기 전용 값이 대신 말한다(사용자 지시 · #231). */}
      {banner}

      <div className="form-grid">
        {/* 값을 보여 주기만 하면 되는 자리는 폼 컨트롤을 잠그지 말고 값 표기로 낸다. */}
        {showSubject && (
          <div>
            <span className="field-label" id={itemLabelId}>
              {t.fields.item}
            </span>
            <p aria-labelledby={itemLabelId}>{itemLabel}</p>
          </div>
        )}

        {/* 등록 전에는 판 번호가 없다 — 서버가 채우는 값을 미리 지어내 보이지 않는다. */}
        {showSubject && routingVersion !== null && (
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
        {/*
         * Routing 코드 — 라벨 · 값을 한 줄로(사용자 지시 · #231). 고칠 수 없으면(확정 · 폐기 · 사용 중) 입력칸 대신 읽기 전용 값으로 낸다.
         * 필수 표시는 디자인 시스템 내장 라벨에 끼울 자리가 없어 라벨을 직접 붙인다(배치 규범 3).
         */}
        {/*
         * 품목 · Routing 코드 요약 줄 — 테두리 상자 안에 칸이 나란히, 칸마다 이름 위 · 값 아래, 칸 사이 세로 구분선
         * (검사 기본 정보 줄과 같은 모양 · 사용자 지시 · #231). 고칠 수 없으면(확정 · 폐기 · 사용 중) 입력칸 대신 읽기 전용 값.
         */}
        <div className="routing-code-line">
          {/* 품목코드 · 품목명은 칸을 나눠 보인다(사용자 지시 · #231). 품목명이 길면 말줄임, 전체는 마우스를 올리면. */}
          {!showSubject && (
            <>
              <div className="routing-fact">
                <span className="field-label">{t.fields.itemCode}</span>
                <span className="routing-code-value">{itemParts?.code ?? itemLabel}</span>
              </div>
              <div className="routing-fact routing-fact-wide">
                <span className="field-label">{t.fields.itemName}</span>
                <span className="routing-fact-item-name" title={itemParts?.name}>
                  {itemParts?.name ?? t.values.empty}
                </span>
              </div>
            </>
          )}
          <div className="routing-fact">
            {isCodeReadOnly ? (
              <span className="field-label" id={routingCodeLabelId}>
                {t.fields.routingCode}
              </span>
            ) : (
              /* 필수 표시는 디자인 시스템 내장 라벨에 끼울 자리가 없어 라벨을 직접 붙인다(배치 규범 3). */
              <FieldLabel htmlFor={routingCodeId} label={t.fields.routingCode} required />
            )}
            <div className="routing-fact-value">
              {isCodeReadOnly ? (
                <span
                  className="routing-code-value"
                  role="textbox"
                  aria-readonly="true"
                  aria-labelledby={routingCodeLabelId}
                  {...(codeLockReason === null ? {} : { 'aria-describedby': codeLockNoteId })}
                >
                  {values.routingCode}
                </span>
              ) : (
                <TextField
                  id={routingCodeId}
                  value={values.routingCode}
                  onChange={(event) => onChange({ routingCode: event.target.value })}
                  error={fieldErrors.routingCode}
                  aria-required
                  /* 필수인데 비어 있으면 빨간 테두리(사용자 지시 · #231) — 채우면 사라진다. */
                  containerClassName={
                    values.routingCode.trim() === '' ? 'routing-required-empty' : undefined
                  }
                />
              )}
              {/* 코드 잠금 사유는 긴 문장 대신 값 옆 라벨로 줄인다(사용자 지시 · #231) — 문장은 라벨 위 마우스 · 숨긴 글. */}
              {codeLockReason !== null && (
                <>
                  <span title={codeLockReason}>
                    <Chip variant="status" status="idle" aria-hidden="true">
                      {t.values.codeLockedBadge}
                    </Chip>
                  </span>
                  <span id={codeLockNoteId} className="visually-hidden">
                    {codeLockReason}
                  </span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* 상세 카드는 상태를 구역 머리 칩(「Rev · 상태」)으로 보인다(#231). */}
        {showSubject && status !== null && (
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

        {/* 유효 시작일 · 종료일은 입력받지 않는다(사용자 지시 · #231). */}
      </div>

      {showActions && (
        <RoutingActions
          mode={mode}
          routingVersion={routingVersion}
          status={status}
          isDirty={isDirty}
          isSaving={isSaving}
          onSave={onSave}
          onCancel={onCancel}
          confirmDisabledReason={confirmDisabledReason}
          obsoleteDisabledReason={obsoleteDisabledReason}
          isTransitioning={isTransitioning}
          onConfirm={onConfirm}
          onObsolete={onObsolete}
        />
      )}
    </section>
  );
};
