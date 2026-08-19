import { messages } from '@omf-mes/i18n';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { WriteErrorBanner, describeWriteError, writeFailureTitle } from './write-error-banner';

const t = messages.notificationCenter;

describe('describeWriteError', () => {
  it('갈래마다 다른 사유를 낸다', () => {
    expect(describeWriteError({ kind: 'network' })).toBe(messages.httpError.offline);
    expect(describeWriteError({ kind: 'http', status: 403 })).toBe(messages.httpError.forbidden);
    expect(describeWriteError({ kind: 'http', status: 500, message: '합성 서버 사유' })).toBe(
      '합성 서버 사유',
    );
  });

  /**
   * ⭐ **404를 따로 가른다.** 이 갈래는 **목록이 낡았을 때** 난다 — 「잠시 뒤 다시 시도하세요」로
   * 뭉뚱그리면 몇 번을 눌러도 같은 답이 오는데, 실제로 푸는 조치는 **기간을 다시 조회하는 것**이다.
   */
  it('없는 알림에는 다시 조회하라고 말한다', () => {
    expect(describeWriteError({ kind: 'http', status: 404 })).toBe(t.writeError.notFound);
    /* 짝 양성 — 다른 상태 코드는 그 문구로 가지 않는다. */
    expect(describeWriteError({ kind: 'http', status: 500, message: '' })).not.toBe(
      t.writeError.notFound,
    );
  });

  it('빈 문구와 공백뿐인 문구를 걸러 낸다', () => {
    expect(describeWriteError({ kind: 'http', status: 500, message: '' })).toBe(
      messages.httpError.description,
    );
    expect(describeWriteError({ kind: 'http', status: 500, message: '   ' })).toBe(
      messages.httpError.description,
    );
    expect(describeWriteError({ kind: 'conflict', cause: 'user', message: '  ' })).toBe(
      messages.httpError.description,
    );
  });

  it('여러 오류를 이을 때 공백뿐인 항목을 잇기 전에 걸러 낸다', () => {
    expect(
      describeWriteError({
        kind: 'validation',
        errors: [
          { scope: 'screen', code: 'SYN_CODE_A', message: '  ' },
          { scope: 'screen', code: 'SYN_CODE_B', message: '합성 사유 나' },
        ],
      }),
    ).toBe('합성 사유 나');
  });
});

describe('writeFailureTitle', () => {
  it('요청이 실패하면 못 바꿨다고 말한다', () => {
    expect(writeFailureTitle('request', 'read')).toBe(t.writeError.readTitle);
    expect(writeFailureTitle('request', 'allRead')).toBe(t.writeError.allReadTitle);
  });

  /**
   * ⭐ **되먹임 갈래에 「바꾸지 못했습니다」로 말하면 거짓이다.** 서버는 이미 바꿨고 사용자가
   * 다시 눌러도 아무 일이 없다 — 못 바꾼 것이 아니라 **바꾼 결과를 화면이 반영하지 못한 것**이다.
   *
   * 이 갈래는 **화면을 거쳐 도달할 수 없어**(화면의 되먹임이 나중에 도는 상태 갱신이라
   * 이 자리에서 동기적으로 던지지 않는다 — T3 실측) 화면 시험으로 규격을 고정할 수단이 없다.
   */
  it('되먹임이 실패하면 바꿨다는 사실을 지우지 않는다', () => {
    expect(writeFailureTitle('feedback', 'read')).toBe(t.writeError.feedbackTitle);
    expect(writeFailureTitle('feedback', 'allRead')).toBe(t.writeError.allReadFeedbackTitle);
  });

  it('네 자리가 전부 다른 문면이다 — 무엇이 막혔는지 가릴 수 있어야 한다', () => {
    const titles = [
      writeFailureTitle('request', 'read'),
      writeFailureTitle('request', 'allRead'),
      writeFailureTitle('feedback', 'read'),
      writeFailureTitle('feedback', 'allRead'),
    ];

    expect(new Set(titles).size).toBe(4);
  });
});

describe('WriteErrorBanner', () => {
  it('제목과 사유를 함께 낸다', () => {
    render(
      <WriteErrorBanner
        error={{ kind: 'http', status: 403 }}
        title={writeFailureTitle('request', 'read')}
      />,
    );

    expect(screen.getByText(t.writeError.readTitle)).toBeInTheDocument();
    expect(screen.getByText(messages.httpError.forbidden)).toBeInTheDocument();
  });

  /**
   * ⭐ **「다시 시도」를 붙이지 않는다.** 읽음 처리는 **카드를 다시 누르면** 되고 「모두 읽음」은
   * 버튼이 그 자리에 그대로 있다 — 배너에 또 하나를 두면 같은 조작으로 가는 문이 둘이 된다.
   * 조회 실패 배너와 갈리는 자리다.
   */
  it('다시 시도 액션을 두지 않는다', () => {
    render(
      <WriteErrorBanner
        error={{ kind: 'network' }}
        title={writeFailureTitle('request', 'allRead')}
      />,
    );

    /* 짝 양성 — 배너는 실제로 섰다. */
    expect(screen.getByText(t.writeError.allReadTitle)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: messages.common.retry })).not.toBeInTheDocument();
  });
});
