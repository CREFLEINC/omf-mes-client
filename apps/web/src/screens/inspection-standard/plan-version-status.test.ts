import { describe, expect, it } from 'vitest';

import { resolveVersionStatus } from './plan-version-status';

describe('resolveVersionStatus', () => {
  it('확정 코드는 확정으로 읽고 편집을 닫는다', () => {
    const view = resolveVersionStatus('CONFIRMED');

    expect(view.status).toBe('confirmed');
    expect(view.label).toBe('확정');
    expect(view.isEditable).toBe(false);
    expect(view.isRecognized).toBe(true);
  });

  it('폐기 코드는 폐기로 읽고 편집을 닫는다', () => {
    const view = resolveVersionStatus('OBSOLETE');

    expect(view.status).toBe('obsolete');
    expect(view.label).toBe('폐기');
    expect(view.isEditable).toBe(false);
  });

  it('작성중 코드는 편집을 연다', () => {
    const view = resolveVersionStatus('DRAFT');

    expect(view.status).toBe('draft');
    expect(view.label).toBe('작성중');
    expect(view.isEditable).toBe(true);
  });

  it('한글 코드도 같은 매핑을 쓴다', () => {
    expect(resolveVersionStatus('확정').status).toBe('confirmed');
    expect(resolveVersionStatus('폐기').status).toBe('obsolete');
    expect(resolveVersionStatus('작성중').status).toBe('draft');
  });

  /* 실서버 어휘가 확정되지 않았다 — 대소문자·앞뒤 공백에 판정이 흔들리면 안 된다. */
  it('앞뒤 공백과 소문자를 견딘다', () => {
    expect(resolveVersionStatus('  confirmed  ').status).toBe('confirmed');
    expect(resolveVersionStatus('obsolete').status).toBe('obsolete');
  });

  /*
   * 미인식을 잠금으로 두면 실서버가 다른 문자열을 쓰는 순간 작성중 버전도 편집할 수 없고
   * 사용자가 풀 방법이 없다. 편집을 열어 두면 서버 400이 막고 화면이 사유를 안내한다 —
   * 데이터가 손상되지 않는다.
   */
  it('인식하지 못한 코드는 원문을 그대로 내고 편집을 연다', () => {
    const view = resolveVersionStatus('IN_REVIEW');

    expect(view.label).toBe('IN_REVIEW');
    expect(view.isEditable).toBe(true);
    expect(view.isRecognized).toBe(false);
    expect(view.status).toBe('draft');
  });

  it('인식하지 못한 코드에 임의의 이름을 붙이지 않는다', () => {
    expect(resolveVersionStatus('IN_REVIEW').label).not.toBe('작성중');
    expect(resolveVersionStatus('IN_REVIEW').label).not.toBe('확정');
  });

  /* 배지가 비면 상태 칸이 사라진 것처럼 보인다. */
  it('빈 코드는 작성중으로 낸다', () => {
    expect(resolveVersionStatus('').label).toBe('작성중');
    expect(resolveVersionStatus('   ').label).toBe('작성중');
    expect(resolveVersionStatus('').isRecognized).toBe(false);
  });
});
