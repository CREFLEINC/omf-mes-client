import { Button, Icon } from '@crefle/web-ui';
import { useId, useState } from 'react';

/**
 * 「지금」 띠의 글 — **언어와 상관없이 한국어 그대로**다(screens/W-03-10.md 「지금」 띠 · 베트남어 화면도 같다).
 * 그래서 언어별 문구 파일(`@omf-mes/i18n`)에 두지 않는다 — 베트남어 묶음에는 한국어가 남지 않아야 한다(vi-messages 시험).
 */
export const NOW_BAND = {
  title: '지금(바뀌기 전)',
  summary:
    '처분 수량을 나눠 여러 번 판정 · 선별 = 양품/불량 수량으로 LOT 를 쪼갬(자식 LOT) · 특채 = LOT 1개 고르고 일부 수량도 가능', // ui-check-ignore: C-13 설계 확정 문구(screens/W-03-10.md)
  expand: '펼치기',
  collapse: '접기',
  items: [
    {
      label: '처분 수량',
      tag: '없어짐',
      note: '처분 수량을 나눠 일부만 판정할 수 있었습니다(입력 / 미입력).',
    },
    {
      label: '양품 · 불량 수량 (선별)', // ui-check-ignore: C-13 설계 확정 문구(screens/W-03-10.md)
      tag: '바뀜',
      note: '불량 수량은 새 LOT 으로 나뉘어(자식 LOT) 새 부적합이 됐습니다.',
    },
    {
      label: '특채 요청',
      tag: '일부 특채 없어짐',
      note: 'LOT 하나를 고르고 일부 수량만 승인할 수 있었고, 나머지는 새 LOT 과 부적합으로 나뉘었습니다.',
    },
  ],
} as const;

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
