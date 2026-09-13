import { Button, Card, EmptyState } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useState } from 'react';

import { useOutbox } from '../../patterns/outbox';
import { useScreenTitle } from '../../patterns/screen-title';
import { detailsOf, reasonOf, whenOf } from './record';
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
  /* 펼친 기록. 한 번에 하나만 연다 - 세로 화면이라 여럿이 펼쳐지면 목록을 잃는다. */
  const [openId, setOpenId] = useState<string | null>(null);
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
              <Card.Body className="card-body outbox-rejections__item">
                <h2 className="outbox-rejections__label">{record.entry.label}</h2>
                <p className="outbox-rejections__when">
                  {t.occurredAt(whenOf(record.entry.occurredAt))}
                </p>
                <p className="outbox-rejections__reason">{reasonOf(record.error)}</p>
                {record.cascaded ? (
                  <p className="outbox-rejections__cascaded">{t.cascaded}</p>
                ) : null}
                <Button
                  variant="text"
                  size="xl"
                  aria-expanded={openId === record.entry.id}
                  onClick={() => {
                    setOpenId((current) => (current === record.entry.id ? null : record.entry.id));
                  }}
                >
                  {openId === record.entry.id ? t.details.close : t.details.open}
                </Button>
                {openId === record.entry.id ? (
                  <dl
                    className="outbox-rejections__details"
                    role="group"
                    aria-label={t.details.pane}
                  >
                    {detailsOf(record).map((row) => (
                      <div key={row.label} className="outbox-rejections__detail">
                        <dt>{row.label}</dt>
                        <dd>{row.value}</dd>
                      </div>
                    ))}
                  </dl>
                ) : null}
                <Button
                  variant="outlined"
                  size="xl"
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
