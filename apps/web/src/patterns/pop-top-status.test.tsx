import { messages } from '@omf-mes/i18n';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { PopHeader } from './pop-header';
import {
  PopTopPrinter,
  PopTopPrinterTarget,
  PopTopStatus,
  PopTopStatusTarget,
} from './pop-top-status';

const header = messages.popChrome.header;

describe('PopTopStatus·PopTopPrinter — 공통 메뉴 맨 위 줄 자리(#291)', () => {
  it('공통 메뉴가 없으면(단독 실행) 그 자리에 그대로 그린다', () => {
    render(
      <>
        <PopTopStatus>
          <span>상태 칩</span>
        </PopTopStatus>
        <PopTopPrinter>
          <span>프린터 칩</span>
        </PopTopPrinter>
      </>,
    );
    expect(screen.getByText('상태 칩')).toBeInTheDocument();
    expect(screen.getByText('프린터 칩')).toBeInTheDocument();
  });

  it('자리가 아직 서지 않았으면 아무것도 그리지 않는다', () => {
    render(
      <PopTopStatusTarget.Provider value={null}>
        <PopTopPrinterTarget.Provider value={null}>
          <PopTopStatus>상태 칩</PopTopStatus>
          <PopTopPrinter>프린터 칩</PopTopPrinter>
        </PopTopPrinterTarget.Provider>
      </PopTopStatusTarget.Provider>,
    );
    expect(screen.queryByText('상태 칩')).toBeNull();
    expect(screen.queryByText('프린터 칩')).toBeNull();
  });

  it('자리가 서면 그 자리 안에 그린다', () => {
    const statusSlot = document.createElement('div');
    const printerSlot = document.createElement('div');
    document.body.append(statusSlot, printerSlot);
    render(
      <PopTopStatusTarget.Provider value={statusSlot}>
        <PopTopPrinterTarget.Provider value={printerSlot}>
          <PopTopStatus>상태 칩</PopTopStatus>
          <PopTopPrinter>프린터 칩</PopTopPrinter>
        </PopTopPrinterTarget.Provider>
      </PopTopStatusTarget.Provider>,
    );
    expect(statusSlot).toHaveTextContent('상태 칩');
    expect(printerSlot).toHaveTextContent('프린터 칩');
    statusSlot.remove();
    printerSlot.remove();
  });
});

describe('PopHeader — 연결 표시', () => {
  it('공통 메뉴 밖에서는 머리줄이 연결 상태를 말한다', () => {
    render(
      <PopHeader
        titleId="t"
        title="화면"
        equipmentCode={null}
        equipmentName={null}
        isConnected={false}
      />,
    );
    expect(screen.getByText(header.disconnected)).toBeInTheDocument();
  });

  it('공통 메뉴 안에서는 맨 위 줄이 말하므로 머리줄은 연결 상태를 그리지 않는다', () => {
    const slot = document.createElement('div');
    document.body.append(slot);
    render(
      <PopTopStatusTarget.Provider value={slot}>
        <PopHeader
          titleId="t"
          title="화면"
          equipmentCode={null}
          equipmentName={null}
          isConnected={false}
          unsentCount={2}
        />
      </PopTopStatusTarget.Provider>,
    );
    expect(screen.queryByText(header.disconnected)).toBeNull();
    expect(slot).toHaveTextContent(header.unsent(2));
    slot.remove();
  });
});
