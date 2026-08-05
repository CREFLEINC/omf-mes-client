import { Button } from '@crefle/web-ui';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

// 도구 사슬 전체(React 19 → RTL → jsdom → DS의 ESM 임포트)가 실제로 도는지 확인한다.
// 이 테스트는 이후에도 남겨 DS 렌더 경로의 회귀를 잡는다.
describe('테스트 실행 기반', () => {
  it('DS Button을 렌더하고 접근성 이름으로 조회할 수 있다', () => {
    render(<Button>저장</Button>);

    expect(screen.getByRole('button', { name: '저장' })).toBeInTheDocument();
  });
});
