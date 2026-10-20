import { Card, EmptyState } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useState } from 'react';

import { BottomActionBar } from '../../patterns/bottom-action-bar';
import { useOnlineStatus } from '../../patterns/online-status';
import { useOutbox } from '../../patterns/outbox';
import { useScreenTitle } from '../../patterns/screen-title';
import { whenOf } from '../outbox-rejections/record';
import './screen.css';

const t = messages.outboxPending;

/**
 * 전송 대기 기록 목록. 앱바의 「전송 대기 N」을 누르면 온다.
 *
 * 전에는 그 건수만 보였고 무엇이 묶여 있는지 볼 자리가 없었다. 셸은 연결이 돌아오거나 화면을
 * 다시 켤 때만 스스로 보낸다 - 무선은 붙어 있는데 받는 쪽만 살아난 경우에는 그 신호가 오지
 * 않아, 사람이 직접 보낼 길을 둔다.
 */
export const OutboxPendingScreen = () => {
  useScreenTitle(t.title);

  const { pendingEntries, flush } = useOutbox();
  const online = useOnlineStatus();
  const [busy, setBusy] = useState(false);
  const [outcome, setOutcome] = useState<string | null>(null);

  const sendNow = async () => {
    setBusy(true);
    setOutcome(null);

    const result = await flush().catch(() => null);

    setBusy(false);

    if (result === null) {
      setOutcome(t.result.unreachable);
      return;
    }

    const lines = [
      result.outcome === 'unreachable' ? t.result.unreachable : null,
      result.sent > 0 ? t.result.sent(result.sent) : null,
      result.rejected.length > 0 ? t.result.rejected(result.rejected.length) : null,
    ].filter((line): line is string => line !== null);

    setOutcome(lines.length === 0 ? null : lines.join(' '));
  };

  return (
    <div className="outbox-pending with-bottom-action-bar">
      {pendingEntries.length === 0 ? (
        <EmptyState title={t.empty} />
      ) : (
        <>
          <p className="outbox-pending__lead">{t.lead}</p>
          <ul className="outbox-pending__list">
            {pendingEntries.map((entry) => (
              <li key={entry.id}>
                <Card bordered>
                  <Card.Body className="card-body outbox-pending__item">
                    <h2 className="outbox-pending__label">{entry.label}</h2>
                    <p className="outbox-pending__meta">
                      {t.occurredAt(whenOf(entry.occurredAt))}
                      {entry.workerNo === undefined ? null : ` · ${t.worker(entry.workerNo)}`}
                    </p>
                  </Card.Body>
                </Card>
              </li>
            ))}
          </ul>
        </>
      )}

      {outcome === null ? null : (
        <p className="outbox-pending__outcome" role="status">
          {outcome}
        </p>
      )}

      {pendingEntries.length === 0 ? null : (
        <BottomActionBar
          primary={{
            label: t.sendNow,
            onClick: () => void sendNow(),
            busy,
            disabled: busy || !online,
            lockReason: online ? undefined : t.sendLocked,
          }}
        />
      )}
    </div>
  );
};
