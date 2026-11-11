import { Button, Chip, Dialog, Icon } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';

import { resolveVersionStatus } from './plan-version-status';
import { VersionPane, VersionPrimaryAction, type VersionPaneProps } from './version-pane';

const t = messages.inspectionStandard;

/**
 * 버전 카드의 머리 줄(omf-all-around#196 · #258).
 *
 * 버전은 「버전 목록」 창에서만 고른다 — 선택칸은 걷었다(사용자 지시 · #258). 고른 버전 · 상태는 아래 요약 상자 첫 칸이 말한다.
 * 창 안은 종전 버전 목록(`VersionPane`) 그대로다: 줄을 눌러 고르고, 신규 버전 발행 · 버전 등록도 거기서 한다.
 * 고르기 · 발행 · 등록의 처리(주소 반영 · 편집 초기화 · 잠금)는 화면이 넘긴 그대로 쓴다.
 *
 * 기준을 고르기 전에는 서지 않는다 — 기준 정보 · 버전 정보 칸이 「먼저 고르세요」를 이미 말한다.
 */
export interface VersionBarProps extends VersionPaneProps {
  /** 「버전 목록」 창이 열렸는가 — 화면이 쥔다(신규 버전 발행에 성공하면 창을 닫는다 · #196). */
  isListOpen: boolean;
  onListOpenChange: (open: boolean) => void;
  /** 「버전 이력」 창을 연다 — 고른 버전이 있을 때만 넘긴다(종전 「이력」 탭 · omf-all-around#258). */
  onHistory?: () => void;
  /** 「버전 비교」 창을 연다(#196). 견줄 버전이 2개 미만이면 화면이 넘기지 않는다 — 단추가 서지 않는다(#208). */
  onCompare?: () => void;
}

export const VersionBar = ({
  isListOpen,
  onListOpenChange,
  onHistory,
  onCompare,
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
    newRevisionNotice,
    isCreating,
    isPublishing,
    onNewRevision,
  } = props;
  const setIsListOpen = onListOpenChange;

  const hasLoadError = loadError !== null && loadError !== undefined;
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
        {/* 왼쪽 「버전 N」 · 상태, 오른쪽 목록 · 비교 · 이력(사용자 시안 · #258). 버전은 「버전 목록」 창에서 고른다. */}
        {selected !== undefined && selectedStatus !== null && (
          <h2 className="inspection-standard-version-heading">
            {t.values.version(selected.planVersion)}
            <Chip variant="status" size="sm" status={selectedStatus.tone}>
              {selectedStatus.label}
            </Chip>
          </h2>
        )}
        {/* 고칠 수 없는 버전이면 상태 오른쪽에 안내 한 줄(사용자 지시 · #258). */}
        {selectedStatus !== null && !selectedStatus.isEditable && (
          <p className="iqc-inspection-action-note" data-tone="info">
            <Icon name="info" size={14} aria-hidden />
            {selectedStatus.status === 'obsolete' ? t.stateLock.obsolete : t.stateLock.confirmed}
          </p>
        )}
        {/* 오른쪽 끝 「+ 신규 버전 발행」(사용자 시안 · #196). 확정 · 사용 중지 등 고른 버전의 일은 카드 바닥 줄로 옮겼다(#258). */}
        <div className="inspection-standard-version-actions">
          <Button variant="outlined" onClick={() => setIsListOpen(true)}>
            {t.versionBar.openList}
          </Button>
          {/* 견줄 버전이 둘 이상일 때만 선다 — 쓸 수 없는 단추는 두지 않는다(사용자 지시 · #208). */}
          {onCompare !== undefined && (
            <Button variant="outlined" onClick={onCompare}>
              {t.actions.compareVersions}
            </Button>
          )}
          {onHistory !== undefined && (
            <Button variant="outlined" onClick={onHistory}>
              {t.versionSection.history}
            </Button>
          )}
          {/*
           * 작성중 버전을 보고 있으면 발행 단추를 두지 않는다 — 이미 고칠 수 있는 판이다(사용자 지시 · #196).
           * 작성중 버전이 따로 있으면 이 줄에는 단추도 안내도 두지 않는다 — 확정 버전을 보는 자리에 그 안내는
           * 군더더기다(사용자 지시 · #196). 안내는 「버전 목록」 창에만 남는다.
           */}
          {!isLoading &&
            !hasLoadError &&
            selectedStatus?.status !== 'draft' &&
            newRevisionNotice === null && (
              <VersionPrimaryAction
                /* 버전 줄의 주 단추 — 채운 단추로 낸다(사용자 시안 · #196). */
                emphasized
                hasVersions={versions.length > 0}
                newRevisionDisabledReason={newRevisionDisabledReason}
                newRevisionNotice={newRevisionNotice}
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
          size="lg"
          aria-label={t.versionBar.openList}
          closeOnBackdropClick={false}
          showCloseButton={false}
          onClose={() => setIsListOpen(false)}
        >
          <div className="inspection-standard-version-dialog">
            <div className="inspection-standard-section-head">
              <h2 className="pane-title">{t.versionBar.openList}</h2>
              {/* 작성중 버전이 있으면 제목 줄에는 단추를 두지 않고, 안내는 바닥 줄에 라벨로 낸다(사용자 지시 · #196). */}
              {!isLoading && !hasLoadError && newRevisionNotice === null && (
                <VersionPrimaryAction
                  emphasized
                  size="sm"
                  hasVersions={versions.length > 0}
                  newRevisionDisabledReason={newRevisionDisabledReason}
                  newRevisionNotice={newRevisionNotice}
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
              {newRevisionNotice !== null && (
                <p className="inspection-standard-notice-label">
                  <Icon name="info" size={18} aria-hidden />
                  {newRevisionNotice}
                </p>
              )}
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
