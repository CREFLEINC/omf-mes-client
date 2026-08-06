import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { createQualificationDraft, type QualificationDraft } from './qualification-draft';
import { QualificationPane } from './qualification-pane';
import type { LookupEntry } from './types';

const processEntries: LookupEntry[] = [{ value: '6001', label: '합성 공정 A', isActive: true }];

const draft = (overrides: Partial<QualificationDraft> = {}): QualificationDraft => ({
  ...createQualificationDraft(),
  qualificationTypeCode: 'PENDING',
  processId: '6001',
  certificateNo: 'SYN-CERT-01',
  validFrom: '2026-08-01',
  validTo: '2026-12-31',
  certifiedBy: 7001,
  ...overrides,
});

const renderPane = (overrides: Partial<Parameters<typeof QualificationPane>[0]> = {}) => {
  const onAdd = vi.fn<() => void>();
  const onEdit = vi.fn<(draftId: string) => void>();
  const onRemove = vi.fn<(draftId: string) => void>();
  const onSave = vi.fn<() => void>();
  const onCancel = vi.fn<() => void>();

  render(
    <QualificationPane
      drafts={[draft()]}
      isLoading={false}
      isWorkerSelected
      processEntries={processEntries}
      optionsNotice={null}
      loadError={null}
      banner={null}
      isDirty
      isSaving={false}
      onAdd={onAdd}
      onEdit={onEdit}
      onRemove={onRemove}
      onSave={onSave}
      onCancel={onCancel}
      {...overrides}
    />,
  );

  return { onAdd, onEdit, onRemove, onSave, onCancel, user: userEvent.setup() };
};

describe('QualificationPane — 표', () => {
  it('여섯 열을 낸다', () => {
    renderPane();

    expect(screen.getAllByRole('columnheader').map((cell) => cell.textContent)).toEqual([
      '자격 유형',
      '공정',
      '인증번호',
      '유효기간',
      '인증자',
      '편집',
    ]);
  });

  /* 계약이 비운 공정을 「모든 공정」으로 정했다(A-7) — 빈 칸으로 두면 뜻이 사라진다. */
  it('공정을 비운 줄은 「(전체 공정)」으로 표기한다', () => {
    renderPane({ drafts: [draft({ processId: '' })] });

    expect(screen.getByText('(전체 공정)')).toBeInTheDocument();
  });

  it('공정 번호를 이름으로 낸다', () => {
    renderPane();

    expect(screen.getByText('합성 공정 A')).toBeInTheDocument();
  });

  /* 값만 표시한다 — 무엇을 가리키는 번호인지 근거가 없어 이름을 만들 수 없다(omf-mes#64). */
  it('인증자를 값 그대로 낸다', () => {
    renderPane();

    expect(screen.getByText('7001')).toBeInTheDocument();
  });

  it('인증자가 없으면 미지정 표기다', () => {
    renderPane({ drafts: [draft({ certifiedBy: null })] });

    const row = screen.getAllByRole('row')[1];
    expect(within(row!).getByText('—')).toBeInTheDocument();
  });

  it('유효기간을 한 칸에 이어 담는다', () => {
    renderPane();

    expect(screen.getByText('2026-08-01 ~ 2026-12-31')).toBeInTheDocument();
  });

  /* 쪽 나눔이 없다 — 계약의 자격 목록에 `page`가 없다. */
  it('쪽 이동을 두지 않는다', () => {
    renderPane();

    expect(screen.queryByRole('navigation', { name: '쪽 이동' })).not.toBeInTheDocument();
  });

  it('행마다 편집·삭제 버튼의 이름이 다르다', async () => {
    const { onEdit, onRemove, user } = renderPane();

    await user.click(screen.getByRole('button', { name: 'PENDING 자격 수정' }));
    await user.click(screen.getByRole('button', { name: 'PENDING 자격 삭제' }));

    expect(onEdit).toHaveBeenCalledTimes(1);
    expect(onRemove).toHaveBeenCalledTimes(1);
  });

  it('자격이 0건이면 빈 상태를 낸다', () => {
    renderPane({ drafts: [] });

    expect(screen.getByText('등록된 자격·인증이 없습니다')).toBeInTheDocument();
  });
});

describe('QualificationPane — 작업자 선택 전', () => {
  /* 감추면 사용자가 「이 화면에는 없는 기능」으로 오해하고 다른 곳을 찾는다(배치 규범 4). */
  it('작업자를 고르기 전에는 자격 추가가 비활성이고 사유가 붙는다', () => {
    renderPane({ isWorkerSelected: false, drafts: [] });

    expect(screen.getByRole('button', { name: '자격 추가' })).toBeDisabled();
    expect(
      screen.getByText('자격 추가는 좌측에서 작업자를 고른 뒤에 할 수 있습니다.'),
    ).toBeInTheDocument();
  });

  it('작업자를 고르기 전에는 표를 그리지 않는다', () => {
    renderPane({ isWorkerSelected: false, drafts: [] });

    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });
});

describe('QualificationPane — 겹친 짝', () => {
  /*
   * C70 — 서버가 준 목록에 이미 겹친 짝이 있으면 그대로 보내도 서버가 거부한다.
   * 저장을 눌러야 알게 하지 않는다.
   */
  it('겹친 짝이 있으면 저장이 비활성이고 사유가 붙는다', () => {
    renderPane({ drafts: [draft({ processId: '' }), draft({ processId: '' })] });

    expect(screen.getByRole('button', { name: '저장' })).toBeDisabled();
    expect(screen.getByText(/저장은 자격 유형과 공정 짝이 겹치는 줄이 있어/)).toBeInTheDocument();
  });

  it('겹친 짝이 있으면 표 위에도 그 사실을 알린다', () => {
    renderPane({ drafts: [draft({ processId: '' }), draft({ processId: '' })] });

    expect(screen.getByText(/자격 유형과 공정 짝이 이미 있습니다/)).toBeInTheDocument();
  });

  it('겹친 짝이 없으면 저장을 누를 수 있다', async () => {
    const { onSave, user } = renderPane();

    await user.click(screen.getByRole('button', { name: '저장' }));

    expect(onSave).toHaveBeenCalledTimes(1);
  });
});

describe('QualificationPane — 액션', () => {
  it('고친 것이 없으면 저장도 취소도 누를 수 없다', () => {
    renderPane({ isDirty: false });

    expect(screen.getByRole('button', { name: '저장' })).toBeDisabled();
    expect(screen.getByRole('button', { name: '취소' })).toBeDisabled();
  });

  it('자격 추가를 누르면 알린다', async () => {
    const { onAdd, user } = renderPane();

    await user.click(screen.getByRole('button', { name: '자격 추가' }));

    expect(onAdd).toHaveBeenCalledTimes(1);
  });

  it('불러오는 중에는 표 대신 진행 안내를 낸다', () => {
    renderPane({ drafts: [], isLoading: true });

    expect(screen.getByRole('status', { name: '자격·인증을 불러오는 중' })).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });

  it('조회 실패 표시가 있으면 표를 함께 내지 않는다', () => {
    renderPane({ drafts: [], loadError: <p>불러오지 못했습니다</p> });

    expect(screen.getByText('불러오지 못했습니다')).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });
});
