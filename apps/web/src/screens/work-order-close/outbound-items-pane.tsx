import { messages } from '@omf-mes/i18n';
import { EmptyState, SkeletonText, Switch } from '@crefle/web-ui';
import type { JSX, ReactNode } from 'react';

import {
  isWorkOrderCloseOutboundItemSelected,
  type WorkOrderCloseOutboundSelection,
} from './outbound-selection';
import type { WorkOrderCloseOutboundItemSetting } from './queries';

export interface WorkOrderCloseOutboundItemsPaneProps {
  settings: readonly WorkOrderCloseOutboundItemSetting[];
  selection: WorkOrderCloseOutboundSelection;
  isLoading: boolean;
  loadError: ReactNode;
  onToggle: (setting: WorkOrderCloseOutboundItemSetting) => void;
}

const descriptionId = (
  code: WorkOrderCloseOutboundItemSetting['outboundItemCode'],
  kind: 'timing' | 'lock',
): string => `work-order-close-outbound-${code}-${kind}`;

export const WorkOrderCloseOutboundItemsPane = ({
  settings,
  selection,
  isLoading,
  loadError,
  onToggle,
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
      {settings.length === 0 ? (
        <EmptyState live size="sm" title={t.empty.title} description={t.empty.description} />
      ) : (
        <div aria-label={t.group} className="form-grid" role="group">
          {settings.map((setting) => {
            const timingId = descriptionId(setting.outboundItemCode, 'timing');
            const lockId = descriptionId(setting.outboundItemCode, 'lock');
            const timing =
              setting.sendTimingNote === null ? null : t.sendTiming(setting.sendTimingNote);
            const lock = setting.locked ? (setting.lockReason ?? t.lockedFallback) : null;
            const describedBy = [timing === null ? null : timingId, lock === null ? null : lockId]
              .filter((id): id is string => id !== null)
              .join(' ');

            return (
              <div className="field-cell" key={setting.outboundItemCode}>
                <Switch
                  aria-describedby={describedBy === '' ? undefined : describedBy}
                  checked={isWorkOrderCloseOutboundItemSelected(
                    selection,
                    setting.outboundItemCode,
                  )}
                  disabled={setting.locked}
                  label={setting.outboundItemName}
                  onChange={() => {
                    if (!setting.locked) {
                      onToggle(setting);
                    }
                  }}
                />
                {timing === null ? null : (
                  <p className="field-note" id={timingId}>
                    {timing}
                  </p>
                )}
                {lock === null ? null : (
                  <p className="field-note" id={lockId}>
                    {lock}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
};
