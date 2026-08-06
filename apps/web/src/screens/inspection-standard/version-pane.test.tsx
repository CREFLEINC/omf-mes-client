import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { inspectionPlanVersionFixtures } from './fixtures';
import { VersionPane } from './version-pane';

const renderPane = (overrides: Partial<Parameters<typeof VersionPane>[0]> = {}) => {
  const onSelect = vi.fn<(id: number) => void>();
  const onNewRevision = vi.fn<() => void>();
  const onCreateVersion = vi.fn<() => void>();

  render(
    <VersionPane
      versions={inspectionPlanVersionFixtures}
      isLoading={false}
      isPlanSelected
      selectedVersionId={null}
      onSelect={onSelect}
      loadError={null}
      newRevisionDisabledReason={null}
      isCreating={false}
      isPublishing={false}
      onNewRevision={onNewRevision}
      onCreateVersion={onCreateVersion}
      banner={null}
      {...overrides}
    />,
  );

  return { onSelect, onNewRevision, onCreateVersion, user: userEvent.setup() };
};

describe('VersionPane — 목록', () => {
  it('버전과 상태 두 열만 낸다', () => {
    renderPane();

    const headers = screen.getAllByRole('columnheader').map((cell) => cell.textContent);
    expect(headers).toEqual(['버전', '상태']);
  });

  it('받은 순서를 그대로 그린다 — 최신이 위다', () => {
    renderPane();

    expect(screen.getByRole('button', { name: '버전 2' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '버전 1' })).toBeInTheDocument();
    expect(screen.getByText('작성중')).toBeInTheDocument();
    expect(screen.getByText('확정')).toBeInTheDocument();
  });

  it('버전을 누르면 그 버전 번호를 알린다', async () => {
    const { onSelect, user } = renderPane();

    await user.click(screen.getByRole('button', { name: '버전 1' }));

    expect(onSelect).toHaveBeenCalledWith(4001);
  });

  it('고른 버전의 행에 선택 표식이 붙는다', () => {
    renderPane({ selectedVersionId: 4001 });

    expect(screen.getByRole('button', { name: '버전 1' })).toHaveAttribute('aria-current', 'true');
    expect(screen.getByRole('button', { name: '버전 2' })).not.toHaveAttribute('aria-current');
  });

  /* 기준을 고르기 전에는 조회 자체를 하지 않는다 — 「없다」와 「아직 안 골랐다」는 다른 안내다. */
  it('기준을 고르기 전에는 선택 안내를 내고 액션도 내지 않는다', () => {
    renderPane({ isPlanSelected: false, versions: [] });

    expect(screen.getByText('좌측에서 검사기준을 먼저 고르세요')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '버전 등록' })).not.toBeInTheDocument();
  });

  it('조회 실패 표시가 있으면 표를 내지 않는다', () => {
    renderPane({ versions: [], loadError: <p>불러오지 못했습니다</p> });

    expect(screen.getByText('불러오지 못했습니다')).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    expect(screen.queryByText('등록된 버전이 없습니다')).not.toBeInTheDocument();
  });

  /* 좁은 페인에서 행마다 되풀이하면 표가 읽히지 않는다 — 임시 안내는 「버전 정보」가 한 번만 낸다. */
  it('상태 임시 안내를 목록에 되풀이하지 않는다', () => {
    renderPane();

    expect(screen.queryByText(/상태 표시는 임시입니다/)).not.toBeInTheDocument();
  });
});

describe('VersionPane — 신규 버전 두 갈래', () => {
  /* 버전이 하나도 없으면 복사할 원본이 없다 — 계약이 두 경로를 그렇게 나눴다. */
  it('버전이 0건이면 「버전 등록」을 낸다', () => {
    renderPane({ versions: [] });

    expect(screen.getByRole('button', { name: '버전 등록' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '신규 버전 발행' })).not.toBeInTheDocument();
  });

  it('버전이 1건 이상이면 「신규 버전 발행」을 낸다', () => {
    renderPane();

    expect(screen.getByRole('button', { name: '신규 버전 발행' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '버전 등록' })).not.toBeInTheDocument();
  });

  it('「버전 등록」을 누르면 상위에 알린다', async () => {
    const { onCreateVersion, user } = renderPane({ versions: [] });

    await user.click(screen.getByRole('button', { name: '버전 등록' }));

    expect(onCreateVersion).toHaveBeenCalled();
  });

  it('「신규 버전 발행」을 누르면 상위에 알린다', async () => {
    const { onNewRevision, user } = renderPane();

    await user.click(screen.getByRole('button', { name: '신규 버전 발행' }));

    expect(onNewRevision).toHaveBeenCalled();
  });

  it('발행을 막는 사유가 있으면 비활성이고 사유가 보인다', () => {
    renderPane({ newRevisionDisabledReason: '먼저 저장하세요.' });

    expect(screen.getByRole('button', { name: '신규 버전 발행' })).toBeDisabled();
    expect(screen.getByText('먼저 저장하세요.')).toBeInTheDocument();
  });

  /*
   * 갈림의 기준이 버전 건수라 불러오는 중의 0건을 「버전이 없다」로 읽으면
   * 개정해야 할 자리에서 생성 경로가 열리고 그 요청은 유일 제약 위반으로 거부된다.
   */
  it('목록을 받기 전에는 두 액션을 모두 내지 않는다', () => {
    renderPane({ versions: [], isLoading: true });

    expect(screen.queryByRole('button', { name: '버전 등록' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '신규 버전 발행' })).not.toBeInTheDocument();
  });

  it('조회에 실패하면 두 액션을 모두 내지 않는다', () => {
    renderPane({ versions: [], loadError: <p>불러오지 못했습니다</p> });

    expect(screen.queryByRole('button', { name: '버전 등록' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '신규 버전 발행' })).not.toBeInTheDocument();
  });

  it('등록 폼이 열려 있으면 같은 폼을 두 번 열지 않는다', () => {
    renderPane({ versions: [], isCreating: true });

    expect(screen.getByRole('button', { name: '버전 등록' })).toBeDisabled();
  });
});
