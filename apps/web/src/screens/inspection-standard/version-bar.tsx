import { Button, Chip, Dialog, Select, type SelectOptionGroup } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { type ReactNode, useId } from 'react';

import { DisabledAction } from './disabled-action';
import { FieldLabel } from './field-label';
import { resolveVersionStatus } from './plan-version-status';
import { VersionPane, VersionPrimaryAction, type VersionPaneProps } from './version-pane';

const t = messages.inspectionStandard;

/**
 * 상세 칸 맨 위의 버전 고르기 줄(omf-all-around#196).
 *
 * 버전 목록 표를 상세 칸에 늘 세워 두지 않는다 — 선택칸으로 바로 고르고, 표가 필요하면 「버전 목록」 창을 연다.
 * 창 안은 종전 버전 목록(`VersionPane`) 그대로다: 줄을 눌러 고르고, 신규 버전 발행 · 버전 등록도 거기서 한다.
 * 고르기 · 발행 · 등록의 처리(주소 반영 · 편집 초기화 · 잠금)는 화면이 넘긴 그대로 쓴다.
 *
 * 기준을 고르기 전에는 서지 않는다 — 기준 정보 · 버전 정보 칸이 「먼저 고르세요」를 이미 말한다.
 */
export interface VersionBarProps extends VersionPaneProps {
  /** 「버전 목록」 창이 열렸는가 — 화면이 쥔다(목록에서 기준을 고르면 창을 바로 연다 · 사용자 지시 #196). */
  isListOpen: boolean;
  onListOpenChange: (open: boolean) => void;
  /** 고른 버전의 일 — 버전 설정 수정 · 확정 · 폐기(줄 오른쪽 끝 · #196) */
  versionActions?: ReactNode;
}

export const VersionBar = ({
  isListOpen,
  onListOpenChange,
  versionActions,
  ...props
}: VersionBarProps) => {
  const {
    versions,
    isLoading,
    loadError,
    selectedVersionId,
    onSelect,
    onCreateVersion,
    banner,
    newRevisionDisabledReason,
    isCreating,
    isPublishing,
    onNewRevision,
  } = props;
  const selectId = useId();
  const setIsListOpen = onListOpenChange;

  const hasLoadError = loadError !== null && loadError !== undefined;
  /*
   * 선택지는 글자만 받는다 — 상태는 묶음 머리(작성중 · 확정 · 폐기)로 가르고, 고른 버전의 상태는 선택칸 옆
   * 색 라벨로 보인다(사용자 지시 · #196). 묶음 안 순서는 서버 순서(최신이 위) 그대로다.
   */
  const options: SelectOptionGroup[] = [];
  for (const version of versions) {
    const status = resolveVersionStatus(version.statusCode).label;
    const option = {
      value: String(version.inspectionPlanVersionId),
      label: t.values.version(version.planVersion),
    };
    const group = options.find((each) => each.label === status);
    if (group === undefined) options.push({ label: status, options: [option] });
    else group.options.push(option);
  }
  const selected = versions.find(
    (version) => version.inspectionPlanVersionId === selectedVersionId,
  );
  const selectedStatus = selected === undefined ? null : resolveVersionStatus(selected.statusCode);

  return (
    <div className="inspection-standard-version-bar">
      {!isListOpen && banner}
      {/* 버전을 못 받았으면 창을 열기 전에도 알린다 — 잠긴 선택칸만 보이면 왜 못 고르는지 모른다. */}
      {!isListOpen && hasLoadError && loadError}

      <div className="inspection-standard-version-bar-row">
        <div className="field-cell wide-select">
          <FieldLabel htmlFor={selectId} label={t.versionBar.label} />
          <Select
            id={selectId}
            options={options}
            value={selectedVersionId === null ? null : String(selectedVersionId)}
            placeholder={t.versionBar.placeholder}
            disabled={isLoading || hasLoadError || versions.length === 0}
            onChange={(value) => {
              const next = Number(value);
              if (next > 0 && next !== selectedVersionId) onSelect(next);
            }}
          />
        </div>
        {selectedStatus !== null && (
          <Chip variant="status" status={selectedStatus.tone}>
            {selectedStatus.label}
          </Chip>
        )}
        <Button variant="outlined" onClick={() => setIsListOpen(true)}>
          {t.versionBar.openList}
        </Button>
        {/* 계약에 경로가 없다. 감추지 않고 사유와 함께 비활성으로 둔다(사유는 마우스를 올리면 보인다). */}
        <span title={t.actionReasons.compareVersionsUnavailable}>
          <DisabledAction
            label={t.actions.compareVersions}
            reason={t.actionReasons.compareVersionsUnavailable}
            className="inspection-standard-tooltip-reason"
          />
        </span>
        <span title={t.actionReasons.changeHistoryUnavailable}>
          <DisabledAction
            label={t.actions.changeHistory}
            reason={t.actionReasons.changeHistoryUnavailable}
            className="inspection-standard-tooltip-reason"
          />
        </span>
        {/* 오른쪽 끝 — 고른 버전의 일(버전 설정 수정 · 확정 · 폐기), 맨 끝에 「+ 신규 버전 발행」(사용자 시안 · #196). */}
        <div className="inspection-standard-version-actions">
          {versionActions}
          {!isLoading && !hasLoadError && (
            <VersionPrimaryAction
              hasVersions={versions.length > 0}
              newRevisionDisabledReason={newRevisionDisabledReason}
              isCreating={isCreating}
              isPublishing={isPublishing}
              onNewRevision={onNewRevision}
              onCreateVersion={onCreateVersion}
            />
          )}
        </div>
      </div>

      {isListOpen && (
        /*
         * 버전 목록 창(사용자 시안 · #196) — 제목 줄 오른쪽에 「+ 신규 버전 발행」, 표, 오른쪽 아래 「닫기」.
         * 제목 줄에 단추를 두려고 창 머리 대신 본문에 머리를 그리고, 창 이름은 `aria-label` 로 준다.
         */
        <Dialog
          open
          size="md"
          aria-label={t.versionBar.openList}
          closeOnBackdropClick={false}
          showCloseButton={false}
          onClose={() => setIsListOpen(false)}
        >
          <div className="inspection-standard-version-dialog">
            <div className="inspection-standard-section-head">
              <h2 className="pane-title">{t.versionBar.openList}</h2>
              {!isLoading && !hasLoadError && (
                <VersionPrimaryAction
                  emphasized
                  hasVersions={versions.length > 0}
                  newRevisionDisabledReason={newRevisionDisabledReason}
                  isCreating={isCreating}
                  isPublishing={isPublishing}
                  onNewRevision={onNewRevision}
                  /* 첫 버전 등록 폼은 상세 칸에 열린다 — 창을 닫아 그 폼이 보이게 한다. */
                  onCreateVersion={() => {
                    onCreateVersion();
                    setIsListOpen(false);
                  }}
                />
              )}
            </div>
            <VersionPane
              {...props}
              hideActions
              /* 줄을 고르면 그 버전 상세를 보러 창을 닫는다. */
              onSelect={(inspectionPlanVersionId) => {
                onSelect(inspectionPlanVersionId);
                setIsListOpen(false);
              }}
            />
            <div className="inspection-standard-dialog-close">
              <Button variant="outlined" onClick={() => setIsListOpen(false)}>
                {t.versionBar.close}
              </Button>
            </div>
          </div>
        </Dialog>
      )}
    </div>
  );
};
