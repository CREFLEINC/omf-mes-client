import { Button, Dialog, Select } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useId, useState } from 'react';

import { FieldLabel } from './field-label';
import { resolveVersionStatus } from './plan-version-status';
import { VersionPane, type VersionPaneProps } from './version-pane';

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
export const VersionBar = (props: VersionPaneProps) => {
  const { versions, isLoading, loadError, selectedVersionId, onSelect, onCreateVersion, banner } =
    props;
  const selectId = useId();
  const [isListOpen, setIsListOpen] = useState(false);

  const hasLoadError = loadError !== null && loadError !== undefined;
  const options = versions.map((version) => ({
    value: String(version.inspectionPlanVersionId),
    label: `${t.values.version(version.planVersion)} · ${resolveVersionStatus(version.statusCode).label}`,
  }));

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
        <Button variant="outlined" onClick={() => setIsListOpen(true)}>
          {t.versionBar.openList}
        </Button>
      </div>

      {isListOpen && (
        <Dialog
          open
          size="md"
          closeOnBackdropClick={false}
          showCloseButton={false}
          title={t.versionBar.openList}
          onClose={() => setIsListOpen(false)}
          footer={
            <Button variant="outlined" onClick={() => setIsListOpen(false)}>
              {t.versionBar.close}
            </Button>
          }
        >
          <div className="inspection-standard-version-dialog">
            <VersionPane
              {...props}
              /* 줄을 고르면 그 버전 상세를 보러 창을 닫는다. */
              onSelect={(inspectionPlanVersionId) => {
                onSelect(inspectionPlanVersionId);
                setIsListOpen(false);
              }}
              /* 첫 버전 등록 폼은 상세 칸에 열린다 — 창을 닫아 그 폼이 보이게 한다. */
              onCreateVersion={() => {
                onCreateVersion();
                setIsListOpen(false);
              }}
            />
          </div>
        </Dialog>
      )}
    </div>
  );
};
