import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { messageRow } from './fixtures';
import { MessageDetailPane } from './message-detail-pane';
import type { MessageDetailView } from './types';

const NOW = new Date('2026-08-06T12:00:00+09:00');

const renderPane = (props: Partial<Parameters<typeof MessageDetailPane>[0]> = {}) => {
  render(
    <MessageDetailPane
      view={messageRow()}
      isLoading={false}
      loadError={null}
      now={NOW}
      {...props}
    />,
  );
};

/** 라벨이 붙은 칸의 값만 읽는다. 「—」가 여럿이라 화면 전체에서 찾으면 어느 칸인지 알 수 없다. */
const fieldValue = (label: string): string => {
  const cell = screen.getByText(label).closest('.field-cell');

  return (cell?.textContent ?? '').replace(label, '');
};

describe('MessageDetailPane — 항목', () => {
  it('목록에 없던 항목이 전부 나온다', () => {
    renderPane({
      view: messageRow({
        directionCode: 'INBOUND',
        targetTypeCode: 'SAMPLE_TARGET',
        targetId: 9101,
        sentAt: '2026-08-04T09:13:00+09:00',
        completedAt: '2026-08-04T09:15:00+09:00',
        lockedBy: 'sync-worker-01',
        lockedAt: '2026-08-04T11:20:00+09:00',
      }),
    });

    expect(fieldValue('구분')).toBe('수신');
    expect(fieldValue('보낸 시각')).toBe('2026-08-04 07:13');
    expect(fieldValue('완료 시각')).toBe('2026-08-04 07:15');
    // 처리하는 워커 이름 · 대상 코드 같은 시스템 값은 보이지 않는다(사용자 지시 2026-10-27).
    expect(fieldValue('처리 중')).toBe('2026-08-04 09:20부터 처리 중');
    expect(fieldValue('다음 시도')).toBe('2026-08-04 07:20');
    expect(screen.queryByText('대상')).toBeNull();
    expect(screen.queryByText(/sync-worker-01/)).toBeNull();
    expect(screen.queryByText(/SAMPLE_TARGET/)).toBeNull();
  });

  it('null인 값은 빈 칸이 아니라 「—」로 나온다', () => {
    renderPane({
      view: messageRow({
        sentAt: null,
        completedAt: null,
        lockedAt: null,
        lockedBy: null,
        lastErrorMessage: null,
      }),
    });

    expect(fieldValue('보낸 시각')).toBe('—');
    expect(fieldValue('완료 시각')).toBe('—');
    expect(fieldValue('처리 중')).toBe('—');
    expect(fieldValue('오류 내용')).toBe('—');
  });

  it('시도 횟수가 0이어도 그대로 보인다', () => {
    renderPane({ view: messageRow({ retryCount: 0 }) });

    expect(fieldValue('재시도 횟수')).toBe('0');
  });

  it('처리 중인데 시작 시각이 없으면 「처리 중」만 낸다 — 시각을 지어내지 않는다', () => {
    renderPane({ view: messageRow({ lockedBy: 'sync-worker-01', lockedAt: null }) });

    // 이름표와 값이 같은 글자다 — 그 칸의 두 글자를 함께 본다.
    const cell = screen.getAllByText('처리 중')[0]?.closest('.field-cell');
    expect(cell?.textContent).toBe('처리 중처리 중');
  });
});

describe('MessageDetailPane — 전송 내용 구획', () => {
  it('늘 잠긴 「전송 내용 보기」 단추와 그 사유 안내를 두지 않는다(사용자 지시 2026-10-27)', () => {
    renderPane();

    expect(screen.queryByRole('button', { name: '전송 내용 보기' })).toBeNull();
    expect(screen.queryByText(/열람 범위가 정해진 뒤/)).toBeNull();
  });

  it('화면 타입에 전문이 없어 그릴 값 자체가 없다', () => {
    /*
     * 서버는 전문을 언제나 실어 보낸다. 화면 타입이 그 값을 담지 않는 것이 유일한 방어다 —
     * 이 단언이 깨지면 타입에 payload가 다시 생겼다는 뜻이다.
     */
    const view: MessageDetailView = messageRow();

    expect(Object.keys(view)).not.toContain('payload');
  });

  it('전문이 실린 객체가 들어와도 그 값을 그리지 않는다', () => {
    /*
     * 타입 방어가 뚫린 상황(조회가 응답을 통째로 넘기는 실수)을 일부러 만든다.
     * 타입만 검사하면 「타입에는 없는데 화면이 그리는」 회귀를 잡지 못한다.
     * 합성값임이 한눈에 보이는 이름만 쓴다(공개 저장소 경계).
     */
    const marker = 'SAMPLE-PAYLOAD-MARKER';
    const leaked = { ...messageRow(), payload: { sampleField: marker } } as MessageDetailView;

    renderPane({ view: leaked });

    expect(screen.queryByText(marker)).not.toBeInTheDocument();
    expect(document.body.textContent).not.toContain(marker);
    expect(document.body.textContent).not.toContain('sampleField');
  });
});

describe('MessageDetailPane — 불러오는 중과 실패', () => {
  it('아직 받지 못했으면 빈 값을 자료로 보이지 않는다', () => {
    renderPane({ view: undefined, isLoading: true });

    expect(
      screen.getByRole('status', { name: '연계 메시지 정보를 불러오는 중' }),
    ).toBeInTheDocument();
    expect(screen.queryByText('방향')).not.toBeInTheDocument();
  });

  it('실패하면 항목 대신 실패 표시를 낸다', () => {
    renderPane({ loadError: <p>불러오지 못했습니다</p> });

    expect(screen.getByText('불러오지 못했습니다')).toBeInTheDocument();
    expect(screen.queryByText('방향')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '전송 내용 보기' })).not.toBeInTheDocument();
  });
});
