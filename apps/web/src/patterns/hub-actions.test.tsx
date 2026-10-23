import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { HUB_ACTIONS_ID, HubActions, useHubActionsTarget } from './hub-actions';

const Probe = () => {
  const target = useHubActionsTarget();

  return target === null ? (
    <span>자리 없음</span>
  ) : (
    <HubActions target={target}>
      <button type="button">일 단추</button>
    </HubActions>
  );
};

describe('HubActions — 탭 막대 오른쪽 일 단추 자리', () => {
  it('셸이 자리를 세웠으면 단추가 그 자리 안에 들어간다', async () => {
    render(
      <>
        <div id={HUB_ACTIONS_ID} data-testid="slot" />
        <Probe />
      </>,
    );

    const button = await screen.findByRole('button', { name: '일 단추' });

    expect(screen.getByTestId('slot')).toContainElement(button);
  });

  it('자리가 없으면 아무것도 넣지 않는다 — 부르는 쪽이 다른 길을 정한다', () => {
    render(<Probe />);

    expect(screen.getByText('자리 없음')).toBeInTheDocument();
    expect(screen.queryByRole('button')).toBeNull();
  });
});
