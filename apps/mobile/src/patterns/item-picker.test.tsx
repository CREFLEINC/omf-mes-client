import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { createStubFetch, jsonResponse, renderWithProviders } from '../test/api-harness';
import { itemRoutes } from '../test/master-routes';
import { ItemPicker } from './item-picker';

/*
 * 입하 등록의 「자재 P/O 없이 등록」에서 쓰던 품목 찾기다. 그 길은 뺐고(사용자 결정 2026-10-27)
 * 지금은 실사가 쓴다 - 화면 시험에 있던 것을 부품 시험으로 옮겼다.
 */
const manyItems = (count: number) =>
  Array.from({ length: count }, (_, index) => ({
    itemId: 9000 + index + 1,
    itemCode: `MANY-${String(index + 1)}`,
    itemName: `품목${String(index + 1)}`,
    fifoPolicyCode: 'FIFO',
  }));

const page = { page: 1, size: 50, total: 0 };

const mount = (fetch = createStubFetch(itemRoutes(manyItems(120)))) =>
  renderWithProviders(<ItemPicker onPick={vi.fn()} onCancel={vi.fn()} />, { fetch });

describe('품목 찾기', () => {
  /*
   * 글자마다 물으면 한 번 찾는 데 요청이 글자 수만큼 나간다. 9,000건 마스터를 현장 무선으로
   * 부르는 자리라 그 값이 그대로 기다림이 되고, 글자마다 결과가 비었다 찼다 해 깜빡인다.
   */
  it('찾는 말을 이어 적는 동안에는 묻지 않는다', async () => {
    const asked: string[] = [];
    const user = userEvent.setup();
    mount(
      createStubFetch([
        {
          match: (req) => new URL(req.url).pathname === '/mdm/items',
          respond: (req) => {
            asked.push(new URL(req.url).searchParams.get('q') ?? '');
            return jsonResponse({ items: [], page });
          },
        },
      ]),
    );
    await screen.findByLabelText('품목 검색');

    /* 여는 순간 한 쪽을 받는다. 그 한 번만 세어 두고 적는 동안 늘어나는지 본다. */
    await waitFor(() => {
      expect(asked.length).toBeGreaterThan(0);
    });
    const opened = asked.length;
    await user.type(screen.getByLabelText('품목 검색'), 'ABC');

    await waitFor(() => {
      expect(asked).toContain('ABC');
    });

    /* 다 적은 뒤의 한 번뿐이다. 글자마다 물으면 A · AB · ABC 로 세 번이 된다. */
    expect(asked.slice(opened)).toEqual(['ABC']);
  });

  /*
   * 한 쪽으로 끝나지 않는다. 남은 수를 달고 선 단추를 누르면 뒤에 이어 붙고, 다 받으면
   * 단추가 사라져 끝이라는 것이 보인다.
   */
  it('더보기로 다음 쪽을 이어 붙인다', async () => {
    const user = userEvent.setup();
    mount();

    expect(await screen.findByRole('button', { name: 'MANY-1 품목1' })).toBeTruthy();
    /* 120건 중 50건을 받았으니 70건이 남는다. */
    const more = await screen.findByRole('button', { name: '더보기 (+70)' });
    expect(screen.queryByRole('button', { name: 'MANY-51 품목51' })).toBeNull();

    await user.click(more);

    /* 앞 쪽은 그대로 있고 뒤 쪽이 붙는다. */
    expect(await screen.findByRole('button', { name: 'MANY-51 품목51' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'MANY-1 품목1' })).toBeTruthy();

    await user.click(await screen.findByRole('button', { name: '더보기 (+20)' }));

    expect(await screen.findByRole('button', { name: 'MANY-120 품목120' })).toBeTruthy();
    /* 다 받았으면 단추가 서지 않는다. */
    expect(screen.queryByRole('button', { name: /더보기/ })).toBeNull();
  });

  /*
   * 찾은 결과도 한 쪽씩이다. 찾는 말을 지우면 쪽이 처음부터 다시 세어져, 앞서 더 받아 둔
   * 것이 찾은 결과에 섞이지 않는다.
   */
  it('찾은 결과도 쪽으로 나뉘고 말을 지우면 다시 센다', async () => {
    const user = userEvent.setup();
    mount();
    await screen.findByRole('button', { name: '더보기 (+70)' });

    /* MANY-1 · MANY-10~19 · MANY-100~119 로 31건이 걸린다. 한 쪽에 들어가 단추가 사라진다. */
    await user.type(screen.getByLabelText('품목 검색'), 'MANY-1');

    await waitFor(() => {
      expect(screen.queryByRole('button', { name: /더보기/ })).toBeNull();
    });
    expect(screen.queryByRole('button', { name: 'MANY-2 품목2' })).toBeNull();

    await user.clear(screen.getByLabelText('품목 검색'));

    /* 지우면 전체로 돌아오고 남은 수도 처음 것으로 돌아온다. */
    expect(await screen.findByRole('button', { name: '더보기 (+70)' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'MANY-2 품목2' })).toBeTruthy();
  });

  /*
   * 펼친 것은 찾는 말과 함께 접힌다. 남겨 두면 처음부터 다시 보려고 지운 사람 앞에 펼쳐진
   * 목록이 그대로 서고, 더 받을 자리는 그 끝에 있어 손이 닿지 않는다.
   */
  it('찾는 말을 지우면 펼친 것이 첫 쪽으로 접힌다', async () => {
    const user = userEvent.setup();
    mount();

    await user.click(await screen.findByRole('button', { name: '더보기 (+70)' }));
    expect(await screen.findByRole('button', { name: 'MANY-51 품목51' })).toBeTruthy();

    await user.type(screen.getByLabelText('품목 검색'), 'MANY-1');
    await waitFor(() => {
      expect(screen.queryByRole('button', { name: 'MANY-2 품목2' })).toBeNull();
    });

    await user.clear(screen.getByLabelText('품목 검색'));

    /* 다시 첫 쪽이다 - 펼쳐 둔 둘째 쪽은 접혔고 남은 수도 처음 것으로 돌아왔다. */
    expect(await screen.findByRole('button', { name: '더보기 (+70)' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'MANY-51 품목51' })).toBeNull();
  });

  /*
   * 지우기는 다 적었다는 뜻이다. DS 의 지우기가 칸에 포커스를 되돌려 두어, 그대로 두면
   * 단말 자판이 목록을 절반 덮은 채로 남는다.
   */
  it('지우기를 누르면 칸에서 포커스를 거둔다', async () => {
    const user = userEvent.setup();
    mount();

    const field = await screen.findByLabelText('품목 검색');
    await user.type(field, 'MANY-1');
    expect(field).toHaveFocus();

    await user.click(screen.getByRole('button', { name: '지우기' }));

    expect(field).not.toHaveFocus();
  });

  /* 목록이 길어 맨 끝까지 내려간 손이 처음으로 돌아올 길이 없다. */
  it('맨 위로 단추가 목록을 처음으로 되돌린다', async () => {
    const user = userEvent.setup();
    const scrolled: string[] = [];
    mount();
    await screen.findByRole('button', { name: '더보기 (+70)' });

    /*
     * jsdom 은 구르지 않는다. 무엇을 화면 안으로 들이라 했는지로 잰다 - 어느 요소에 부를지를
     * 재려는 것이라 미리 집어 둘 수 없어 원형에 심는다.
     */
    const original = Object.getOwnPropertyDescriptor(Element.prototype, 'scrollIntoView');

    Object.defineProperty(Element.prototype, 'scrollIntoView', {
      configurable: true,
      value(this: Element) {
        scrolled.push(this.textContent?.slice(0, 12) ?? '');
      },
    });

    try {
      await user.click(screen.getByRole('button', { name: '맨 위로' }));

      expect(scrolled).toEqual(['품목 고르기']);
    } finally {
      if (original === undefined) {
        delete (Element.prototype as { scrollIntoView?: unknown }).scrollIntoView;
      } else {
        Object.defineProperty(Element.prototype, 'scrollIntoView', original);
      }
    }
  });
});
