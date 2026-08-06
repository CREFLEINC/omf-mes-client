import { describe, expect, it } from 'vitest';

import { resolveRoutingStatus } from './routing-status';

describe('resolveRoutingStatus', () => {
  it('확정 코드를 확정 상태로 읽고 편집을 잠근다', () => {
    const view = resolveRoutingStatus('CONFIRMED');

    expect(view.status).toBe('confirmed');
    expect(view.label).toBe('확정');
    expect(view.tone).toBe('success');
    expect(view.isEditable).toBe(false);
  });

  it('한국어 확정 코드도 같게 읽는다 — 코드 문자열이 확정되지 않았다', () => {
    expect(resolveRoutingStatus('확정').status).toBe('confirmed');
  });

  it('폐기 코드를 폐기 상태로 읽고 편집을 잠근다', () => {
    const view = resolveRoutingStatus('OBSOLETE');

    expect(view.status).toBe('obsolete');
    expect(view.label).toBe('폐기');
    expect(view.tone).toBe('idle');
    expect(view.isEditable).toBe(false);
    expect(resolveRoutingStatus('폐기').status).toBe('obsolete');
  });

  it('작성중 코드를 작성중 상태로 읽고 편집을 연다', () => {
    const view = resolveRoutingStatus('DRAFT');

    expect(view.status).toBe('draft');
    expect(view.label).toBe('작성중');
    expect(view.tone).toBe('info');
    expect(view.isEditable).toBe(true);
    expect(resolveRoutingStatus('작성중').status).toBe('draft');
  });

  it('대소문자·앞뒤 공백이 달라도 같은 코드로 읽는다', () => {
    expect(resolveRoutingStatus('  confirmed ').status).toBe('confirmed');
  });

  it('모르는 코드는 원본 코드를 라벨로 내고 중립 배지를 쓴다 — 값을 지어내지 않는다', () => {
    const view = resolveRoutingStatus('ACTIVE');

    expect(view.label).toBe('ACTIVE');
    expect(view.tone).toBe('idle');
    expect(view.isRecognized).toBe(false);
  });

  /*
   * 두 실패의 대가를 비교한 결과다. 잠금으로 두면 실서버가 다른 문자열을 쓰는 순간
   * 작성중 Rev도 편집할 수 없고 사용자가 풀 방법이 없다. 편집 허용으로 두면
   * 저장이 400으로 막히고 화면이 그 사유를 안내한다 — 데이터가 손상되지 않는다.
   */
  it('모르는 코드는 작성중으로 취급해 편집을 막지 않는다 — 서버 400이 최종 방어선이다', () => {
    const view = resolveRoutingStatus('ACTIVE');

    expect(view.status).toBe('draft');
    expect(view.isEditable).toBe(true);
  });

  it('빈 코드에서도 배지 문구가 비지 않는다', () => {
    const view = resolveRoutingStatus('');

    expect(view.label).toBe('작성중');
    expect(view.isEditable).toBe(true);
  });

  it('인식한 코드에는 인식 표식이 붙는다', () => {
    expect(resolveRoutingStatus('DRAFT').isRecognized).toBe(true);
    expect(resolveRoutingStatus('확정').isRecognized).toBe(true);
  });
});
