import { AlertBanner, SkeletonText, Switch } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import type { ReactNode } from 'react';

import { warnsNoRatio, type EnabledState } from './enabled-state';

const t = messages.shotConversion.enabled;

export interface EnabledPaneProps {
  state: EnabledState;
  isLoading: boolean;
  isSaving: boolean;
  /**
   * 지금 있는 비율 정책 수. 켜 두었는데 0이면 동작하지 않는다.
   * **셀 수 없으면 `null`** — 그때는 경고하지 않는다(없다고 단정하지 않는다).
   */
  ratioCount: number | null;
  onChange: (next: boolean) => void;
  /** 저장 실패 배너 슬롯 */
  banner: ReactNode;
  loadError: ReactNode;
}

/**
 * 환산을 켜고 끄는 자리.
 *
 * ⛔ **켜도 손 입력이 사라지지 않는다**(스펙 §5-4 · QA #12). 손 입력이 **기본 경로**이고
 * 환산은 보조다 — 적지 않으면 **켜는 순간 손 입력이 막히는 줄 안다.** 그 문장을 스위치
 * 바로 곁에 둔다.
 *
 * ⭐ **상태가 셋이다**(G-9) — 켬 · 끔 · **아직 정하지 않음.** 셋째를 「끔」으로 그리면
 * 아무도 정한 적 없는 값이 정해진 것처럼 보인다.
 */
export const EnabledPane = ({
  state,
  isLoading,
  isSaving,
  ratioCount,
  onChange,
  banner,
  loadError,
}: EnabledPaneProps) => {
  const body = (): ReactNode => {
    if (loadError !== null && loadError !== undefined) return loadError;

    if (isLoading) {
      return (
        <div role="status" aria-label={t.loading}>
          <SkeletonText lines={2} />
        </div>
      );
    }

    return (
      <>
        <Switch
          label={t.switchLabel}
          checked={state === 'on'}
          disabled={isSaving}
          onChange={(event) => onChange(event.target.checked)}
        />

        {/*
         * ⭐ **켤 때 반드시 함께 읽혀야 하는 문장** — 스위치 바로 아래에 둔다.
         * 창을 열어야 보이는 곳에 두면 켜는 사람은 읽지 않는다.
         */}
        <p className="dialog-lead">{state === 'on' ? t.stillManual : t.offNote}</p>

        {/* ⛔ 아직 정하지 않은 것을 「끔」으로 그리지 않는다(G-9). */}
        {state === 'unset' && (
          <div className="banner-slot">
            <AlertBanner variant="info" title={t.notSetTitle}>
              {t.notSet}
            </AlertBanner>
          </div>
        )}

        {/* ⚠ 막지 않고 알린다 — 정책은 나중에 더할 수 있다(G-12·G-15). */}
        {warnsNoRatio(state, ratioCount) && (
          <div className="banner-slot">
            <AlertBanner variant="warning" title={t.noRatioTitle}>
              {t.noRatioWarning}
            </AlertBanner>
          </div>
        )}
      </>
    );
  };

  return (
    <section className="pane" aria-label={t.paneTitle}>
      <h3>{t.paneTitle}</h3>
      {banner}
      {body()}
    </section>
  );
};
