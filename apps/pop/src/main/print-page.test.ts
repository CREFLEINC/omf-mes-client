import { describe, expect, it } from 'vitest';

import { labelFileName, renderPrintPage } from './print-page';

describe('인쇄면', () => {
  // ⛔ 이 셋이 「급지는 되는데 백지」를 막는다. 하나라도 빠지면 그림이 대지 밖으로 밀린다.
  it('대지에 여백을 두지 않는다', () => {
    expect(renderPrintPage('label.png')).toContain('@page { margin: 0; }');
  });

  it('그림이 대지를 꽉 채운다', () => {
    const html = renderPrintPage('label.png');

    expect(html).toContain('width: 100%');
    expect(html).toContain('height: 100%');
  });

  it('비율은 지킨다 — 라벨이 찌그러지면 바코드를 못 읽는다', () => {
    expect(renderPrintPage('label.png')).toContain('object-fit: contain');
  });

  it('가리키는 그림 파일이 형식을 따라간다', () => {
    expect(labelFileName('png')).toBe('label.png');
    expect(renderPrintPage(labelFileName('png'))).toContain('src="label.png"');
  });
});
