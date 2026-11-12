import { Button, Icon } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useId, useState } from 'react';

/** 「지금(바뀌기 전)」 띠의 글 — 언어별 문구(C7 에서 i18n 으로 옮김). */
export const NOW_BAND = messages.dispositionDecision.nowBand;

/**
 * 「지금(바뀌기 전)」 띠(005 · mockups/W0310-After.html) — 처분 방식이 바뀐 점(처분 수량 없어짐 · 선별 바뀜 · 일부 특채
 * 없어짐)을 알린다. 접힌 채로 시작한다.
 */
export const NowBand = () => {
  const [isOpen, setIsOpen] = useState(false);
  const bodyId = useId();

  return (
    <section className="disposition-now-band" aria-label={NOW_BAND.title}>
      <div className="disposition-now-band-head">
        <Icon name="history_edu" size={18} aria-hidden />
        <strong>{NOW_BAND.title}</strong>
        <span className="disposition-now-band-summary">{NOW_BAND.summary}</span>
        <Button
          variant="text"
          size="sm"
          aria-expanded={isOpen}
          aria-controls={bodyId}
          onClick={() => setIsOpen((open) => !open)}
        >
          {isOpen ? NOW_BAND.collapse : NOW_BAND.expand}
          <Icon name={isOpen ? 'expand_less' : 'expand_more'} size={18} aria-hidden />
        </Button>
      </div>
      <dl id={bodyId} className="disposition-now-band-body" hidden={!isOpen}>
        {NOW_BAND.items.map((item) => (
          <div key={item.label} className="disposition-now-band-item">
            <dt>
              {item.label} <span className="disposition-now-band-tag">{item.tag}</span>
            </dt>
            <dd>{item.note}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
};
