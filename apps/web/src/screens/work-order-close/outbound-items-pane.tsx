import { messages } from '@omf-mes/i18n';
import { Chip, EmptyState, SkeletonText } from '@crefle/web-ui';
import type { JSX, ReactNode } from 'react';

import type { WorkOrderCloseOutboundItemSetting } from './queries';

export interface WorkOrderCloseOutboundItemsPaneProps {
  settings: readonly WorkOrderCloseOutboundItemSetting[];
  isLoading: boolean;
  loadError: ReactNode;
}

/**
 * ERP 송신 항목 — **읽기 표시다.**
 *
 * 여기 보이는 다섯(생산 실적·입고·출하·반품·실사 조정)은 **전역 송신 설정**이고, 마감 한 건이 켜고
 * 끄는 것이 아니다 — 바꾸는 곳은 연계 설정 화면이다. 마감 본문의 `erpSendItems`는 이 목록이 아니라
 * 생산 실적 «부속 항목»(투입자재·공수·설비시간·비가동)의 자리인데 그 코드 표기가 아직 정해지지 않아
 * 선택칸을 열지 않는다(G-2) — 그 사실을 문장으로 둔다. 이전 판은 이 다섯을 토글로 그려 마감 본문에
 * 실었다 — 계약이 ⛔로 막은 자리였다.
 */
export const WorkOrderCloseOutboundItemsPane = ({
  settings,
  isLoading,
  loadError,
}: WorkOrderCloseOutboundItemsPaneProps): JSX.Element => {
  const t = messages.workOrderClose.outboundItems;

  if (loadError !== null && loadError !== undefined) {
    return (
      <section aria-label={t.pane} className="pane">
        {loadError}
      </section>
    );
  }

  if (isLoading) {
    return (
      <section aria-label={t.pane} className="pane">
        <div aria-label={t.loading} role="status">
          <SkeletonText lines={3} />
        </div>
      </section>
    );
  }

  return (
    <section aria-label={t.pane} className="pane work-order-close-outbound-pane">
      <h2 className="pane-title">{t.heading}</h2>
      <p className="pane-lead">{t.lead}</p>
      {settings.length === 0 ? (
        <EmptyState live size="sm" title={t.empty.title} description={t.empty.description} />
      ) : (
        <dl aria-label={t.group} className="form-grid" role="group">
          {settings.map((setting) => {
            const timing =
              setting.sendTimingNote === null ? null : t.sendTiming(setting.sendTimingNote);
            const lock = setting.locked ? (setting.lockReason ?? t.lockedFallback) : null;

            return (
              <div className="field-cell" key={setting.outboundItemCode}>
                <dt className="field-label">{setting.outboundItemName}</dt>
                <dd>
                  <Chip variant="status" size="sm">
                    {setting.enabled ? t.state.on : t.state.off}
                  </Chip>
                </dd>
                {/* 설명은 dd 로 — dl 안에 p 를 두지 않는다(마크업 유효성). */}
                {timing === null ? null : <dd className="field-note">{timing}</dd>}
                {lock === null ? null : <dd className="field-note">{lock}</dd>}
              </div>
            );
          })}
        </dl>
      )}
      <p className="field-note">{t.appendixPending}</p>
    </section>
  );
};
