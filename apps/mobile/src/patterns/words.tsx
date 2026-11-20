import { Fragment } from 'react';

import { keepHyphens } from './keep-hyphens';

/**
 * 품목명 · 공급사명 — 낱말마다 꺾이지 않는 조각으로 그린다. 한글은 음절 사이에서도 꺾여 「검사불 / 필요」가 되는데,
 * 모바일 규칙(`code-wrapping`)이 `word-break: keep-all` 을 막아 조각(inline-block)으로 낱말 단위 꺾기를 만든다.
 * 하이픈에서도 꺾이지 않는다(「30100-001WHR」).
 */
export const Words = ({ text }: { text: string }) => (
  <>
    {keepHyphens(text)
      .split(' ')
      .filter((word) => word !== '')
      .map((word, index) => (
        <Fragment key={`${String(index)}-${word}`}>
          {index === 0 ? null : ' '}
          <span className="word-chunk">{word}</span>
        </Fragment>
      ))}
  </>
);
