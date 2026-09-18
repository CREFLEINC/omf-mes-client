import { act, fireEvent, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { renderWithProviders } from '../test/api-harness';
import { PopSelect } from './pop-select';

const OPTIONS = Array.from({ length: 7 }, (_, index) => ({
  value: `value-${String(index + 1)}`,
  label: `항목 ${String(index + 1)}`,
}));

describe('PopSelect — G-34 선택 팝업', () => {
  it('닫힌 상태에서 현재 값과 선택 버튼을 함께 보인다', () => {
    renderWithProviders(
      <PopSelect aria-label="사유" options={OPTIONS} value="value-2" onChange={vi.fn()} />,
    );

    expect(screen.getByText('항목 2')).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: '사유' })).toHaveTextContent('선택');
  });

  it('이미 받은 목록을 검색하고 고른 값을 반영한다', async () => {
    const user = userEvent.setup();

    const Harness = () => {
      const [value, setValue] = useState<string | null>(null);

      return <PopSelect aria-label="사유" options={OPTIONS} value={value} onChange={setValue} />;
    };

    renderWithProviders(<Harness />);
    await user.click(screen.getByRole('combobox', { name: '사유' }));
    await user.type(screen.getByRole('searchbox', { name: '목록 검색' }), '항목 3');

    expect(screen.getByRole('option', { name: '항목 3' })).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: '항목 2' })).not.toBeInTheDocument();

    await user.click(screen.getByRole('option', { name: '항목 3' }));
    expect(screen.getByText('항목 3')).toBeInTheDocument();
  });

  it('페이지 위·아래와 현재 페이지·전체 건수를 제공한다', async () => {
    const user = userEvent.setup();

    renderWithProviders(<PopSelect aria-label="사유" options={OPTIONS} />);
    await user.click(screen.getByRole('combobox', { name: '사유' }));

    expect(screen.getByText('1 / 2 · 전체 7건')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '페이지 아래' }));
    expect(screen.getByRole('option', { name: '항목 7' })).toBeInTheDocument();
    expect(screen.getByText('2 / 2 · 전체 7건')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '페이지 위' })).toBeEnabled();
  });

  /**
   * ⛔ **한 쪽에 다섯을 넘겨 담지 않는다**(사용자 지시 2026-09-09). 목록이 스크롤하지 않으므로
   * 한 쪽이 팝업보다 길어지면 **마지막 줄이 잘린 채 고를 수 없게 된다** — 앞서 여섯을 담아
   * 실제로 그랬다. 잘림은 화면에서만 보이고 시험에서는 안 보이므로, 여기서는 «수»를 못박는다.
   */
  it('한 쪽에 다섯 줄까지만 놓는다', async () => {
    const user = userEvent.setup();

    renderWithProviders(<PopSelect aria-label="사유" options={OPTIONS} />);
    await user.click(screen.getByRole('combobox', { name: '사유' }));

    expect(screen.getAllByRole('option')).toHaveLength(5);

    await user.click(screen.getByRole('button', { name: '페이지 아래' }));
    expect(screen.getAllByRole('option')).toHaveLength(2);
  });

  it('검색어를 한 번에 지운다', async () => {
    const user = userEvent.setup();

    renderWithProviders(<PopSelect aria-label="사유" options={OPTIONS} />);
    await user.click(screen.getByRole('combobox', { name: '사유' }));
    const search = screen.getByRole('searchbox', { name: '목록 검색' });
    await user.type(search, '항목 7');
    await user.click(screen.getByRole('button', { name: '검색어 지우기' }));

    expect(search).toHaveValue('');
    expect(screen.getByText('1 / 2 · 전체 7건')).toBeInTheDocument();
  });
});

/**
 * 팝업이 닫히는 길 — **[✕] 하나다**(사용자 지시 2026-09-10).
 *
 * ⛔ 전에는 팝업 «바깥»을 눌러도 닫혔다. 터치 단말에서 목록 팝업은 화면 대부분을 덮어
 *    손이 스치기 쉽고, 그때 고르려던 항목과 검색어·쪽 위치가 함께 사라졌다.
 *
 * ⚠ 설계(G-34)는 팝업의 «내용»만 정하고 닫는 방법을 적지 않았다. 회신이 오면 맞춘다.
 */
describe('PopSelect — 팝업을 닫는 길 (#1005)', () => {
  const openPopup = async (): Promise<ReturnType<typeof userEvent.setup>> => {
    const user = userEvent.setup();

    renderWithProviders(
      <PopSelect aria-label="사유" options={OPTIONS} value={null} onChange={vi.fn()} />,
    );
    await user.click(screen.getByRole('combobox', { name: '사유' }));

    expect(screen.getByRole('searchbox', { name: '목록 검색' })).toBeInTheDocument();

    return user;
  };

  it('바깥을 눌러도 닫히지 않는다', async () => {
    const user = await openPopup();

    /* 스크림은 `dialog` 요소 자신이다 — 그 바깥 여백을 누르는 것이 「바깥 누르기」다. */
    await user.click(screen.getByRole('dialog'));

    expect(screen.getByRole('searchbox', { name: '목록 검색' })).toBeInTheDocument();
  });

  it('닫기 단추를 누르면 닫힌다', async () => {
    const user = await openPopup();

    await user.click(screen.getByRole('button', { name: /닫기|close/iu }));

    expect(screen.queryByRole('searchbox', { name: '목록 검색' })).not.toBeInTheDocument();
  });
});

/**
 * 스캔 목록(`scannable` · #1351) — **찍어서 고르는 길**.
 *
 * ⚠ 이 구역의 둘은 리뷰가 잡은 결함을 그대로 재는 감지기다. 지우면 그 결함이 조용히 돌아온다.
 */
describe('PopSelect — 스캔 목록', () => {
  const SHORT = [
    { value: '1', label: 'SH-0001' },
    { value: '2', label: 'SH-0002' },
  ];

  /*
   * ⛔ **검색 줄만 켠다 — 쪽 이동은 켜지 않는다.** 한때 `isShortList` 자체에 `&& !scannable` 을
   *    붙였더니 후보가 둘뿐인 목록에 양쪽 다 눌리지 않는 [페이지 위]·[페이지 아래]가 함께 섰다.
   *    「짧은 목록에는 검색도 쪽 이동도 두지 않는다」(2026-09-10)가 지우려던 바로 그 모양이다.
   */
  it('짧은 목록에서 검색 줄은 서고 쪽 이동은 서지 않는다', async () => {
    const user = userEvent.setup();
    renderWithProviders(<PopSelect aria-label="출하대상" options={SHORT} scannable />);

    await user.click(screen.getByRole('combobox', { name: '출하대상' }));

    expect(screen.getByRole('searchbox', { name: '스캔 또는 목록 검색' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '페이지 위' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '페이지 아래' })).not.toBeInTheDocument();
    expect(screen.queryByText(/전체 2건/u)).not.toBeInTheDocument();
  });

  /*
   * ⛔ **후보가 매 렌더 새 배열이어도 자동 선택이 뜬다.** 부르는 쪽이 `options` 를 인라인으로
   *    만들면(`screen.tsx` 가 그렇다) 그 배열은 렌더마다 새 값이다 — 그것을 효과의 의존성에
   *    넣으면 타이머가 렌더마다 다시 서서 자동 선택이 **영영 뜨지 않는다.**
   */
  it('찍고 나서 부모가 다시 그려져도 «멎은 때»를 기준으로 고른다', async () => {
    /*
     * ⚠ **가짜 시계로 잰다.** 진짜 시계로는 `user.type` 이 끝나는 사이에 150ms 가 이미 지나
     *   버려, 되돌린 코드에서도 시험이 통과한다(실측 — 결함을 못 잡는 감지기였다).
     *   여기서는 「100ms 뒤 다시 그리기 → 다시 100ms」로 **되서는 안 되는 리셋**을 겨눈다.
     */
    vi.useFakeTimers();
    const onChange = vi.fn();

    const Host = () => {
      const [tick, setTick] = useState(0);

      return (
        <>
          <button
            type="button"
            onClick={() => {
              setTick((n) => n + 1);
            }}
          >
            다시 그리기 {tick}
          </button>
          {/* 매 렌더 새 배열 — 부르는 쪽의 실제 모양이다. */}
          <PopSelect
            aria-label="출하대상"
            options={SHORT.map((option) => ({ ...option }))}
            scannable
            onChange={onChange}
          />
        </>
      );
    };

    try {
      renderWithProviders(<Host />);
      /* ⚠ 가짜 시계에서는 `userEvent` 가 멎는다(실측 — 15초 시간 초과). 사건을 직접 쏜다. */
      fireEvent.click(screen.getByRole('combobox', { name: '출하대상' }));
      fireEvent.change(screen.getByRole('searchbox', { name: '스캔 또는 목록 검색' }), {
        target: { value: 'SH-0002' },
      });

      /* 아직 멎은 지 100ms — 여기서는 아무것도 골라지지 않아야 한다. */
      act(() => {
        vi.advanceTimersByTime(100);
      });
      expect(onChange).not.toHaveBeenCalled();

      /* 부모가 다시 그린다 — 후보 배열이 새 값이 된다. 타이머는 «이것 때문에» 다시 서면 안 된다. */
      fireEvent.click(screen.getByRole('button', { name: /다시 그리기/u }));
      act(() => {
        vi.advanceTimersByTime(100);
      });

      /* 멎은 지 200ms — 리셋이 없었다면 150ms 에 이미 골라졌다. */
      expect(onChange).toHaveBeenCalledWith('2');
    } finally {
      vi.useRealTimers();
    }
  });
});
