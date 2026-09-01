import { Button, Card, EmptyState } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';

import { useOutbox } from '../../patterns/outbox';
import { useScreenTitle } from '../../patterns/screen-title';
import { reasonOf, whenOf } from './record';
import './screen.css';

const t = messages.outboxRejections;

/**
 * 되돌아온 기록 목록.
 *
 * 다시 보내는 단추를 두지 않는다. 거부는 다시 보내서 풀리는 것이 아니라, 무엇을 할지 사람이
 * 정하고 다시 적어야 하는 결과다.
 */
export const OutboxRejectionsScreen = () => {
  useScreenTitle(t.title);

  const { rejected, dismissRejected } = useOutbox();
  // 방금 되돌아온 것이 위로 온다 - 아직 손쓸 수 있는 것이 그쪽이다.
  const records = [...rejected].reverse();

  if (records.length === 0) {
    return (
      <div className="outbox-rejections">
        <EmptyState title={t.empty} />
      </div>
    );
  }

  return (
    <div className="outbox-rejections">
      <p className="outbox-rejections__lead">{t.lead}</p>
      <ul className="outbox-rejections__list">
        {records.map((record) => (
          <li key={record.entry.id}>
            <Card bordered>
              <Card.Body className="outbox-rejections__item">
                <h2 className="outbox-rejections__label">{record.entry.label}</h2>
                <p className="outbox-rejections__when">
                  {t.occurredAt(whenOf(record.entry.occurredAt))}
                </p>
                <p className="outbox-rejections__reason">{reasonOf(record.error)}</p>
                {record.cascaded ? (
                  <p className="outbox-rejections__cascaded">{t.cascaded}</p>
                ) : null}
                <Button
                  variant="outlined"
                  size="lg"
                  onClick={() => void dismissRejected(record.entry.id)}
                >
                  {t.dismiss}
                </Button>
              </Card.Body>
            </Card>
          </li>
        ))}
      </ul>
    </div>
  );
};
