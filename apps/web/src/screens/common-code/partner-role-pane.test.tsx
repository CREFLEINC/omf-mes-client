import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { partnerFixtures, partnerRoleFixtures } from './fixtures';
import { toPartnerRoleChoices, toPartnerRoleDraft } from './partner-role-draft';
import { PartnerRolePane, type PartnerRolePaneProps } from './partner-role-pane';
/* 코드 글자를 시험이 다시 적지 않는다(결정 2) — 리터럴은 어휘 고정 감지기 한 자리에만 둔다. */
import { PARTNER_ROLE_CODES } from './partner-role-vocab';

const BASELINE = toPartnerRoleDraft(partnerRoleFixtures);

const CHOICES = toPartnerRoleChoices(partnerRoleFixtures, BASELINE);

/** 어휘 밖 코드. 어휘 표에 없으므로 여기서 짓는다 — 화면이 모르는 값이 이 시험의 요점이다. */
const UNKNOWN_CODE = 'SAMPLE-ROLE-X';

/** 이름과 표식이 붙어 읽히지 않게 사이에 낱말 공백 하나가 든다. */
const UNKNOWN_LABEL = '샘플 역할 엑스 이 화면이 모르는 역할';

const renderPane = (overrides: Partial<PartnerRolePaneProps> = {}) => {
  const props: PartnerRolePaneProps = {
    partner: partnerFixtures[0]!,
    choices: CHOICES,
    hasSavedRole: true,
    isRolesLoading: false,
    rolesLoadError: null,
    banner: null,
    isDirty: false,
    isSaving: false,
    onToggleRole: vi.fn<(roleTypeCode: string) => void>(),
    onSave: vi.fn<() => void>(),
    onCancel: vi.fn<() => void>(),
    ...overrides,
  };

  render(<PartnerRolePane {...props} />);

  return { props, user: userEvent.setup() };
};

const detailPane = (): HTMLElement => screen.getByRole('region', { name: '거래처 기본 정보' });

const rolePane = (): HTMLElement => screen.getByRole('region', { name: '거래처 역할' });

const roleCheckbox = (name: string): HTMLElement =>
  within(rolePane()).getByRole('checkbox', { name });

describe('PartnerRolePane — 기본 정보는 고칠 수 없다 (결정 12)', () => {
  /*
   * 거래처 본체는 **ERP 수신 마스터**다 — 계약에 등록·수정 경로가 아예 없다.
   * 그래서 폼 컨트롤을 **잠그는 것이 아니라 두지 않는다** — 잠긴 칸은 「언젠가 열린다」는
   * 뜻이 되는데 그 경로가 없다. 같은 화면의 작업자 기본 정보가 세운 형태를 그대로 되풀이한다.
   */
  it('기본 정보 구획에 입력칸이 하나도 없다', () => {
    renderPane();

    const pane = detailPane();

    expect(within(pane).queryAllByRole('textbox')).toHaveLength(0);
    expect(within(pane).queryAllByRole('combobox')).toHaveLength(0);
    expect(within(pane).queryAllByRole('checkbox')).toHaveLength(0);
    expect(within(pane).queryAllByRole('spinbutton')).toHaveLength(0);
  });

  /* 「할 수 없다」를 감추지 않는다 — 구획 머리에 사유를 상시 표시한다. */
  it('구획 머리에 외부 수신본 안내가 보인다', () => {
    renderPane();

    expect(
      within(detailPane()).getByText(
        '외부 시스템에서 받은 자료라 여기서 수정할 수 없습니다. 원본 시스템에서 변경하세요.',
      ),
    ).toBeInTheDocument();
  });

  it('거래처코드와 거래처명을 그대로 낸다', () => {
    renderPane();

    const pane = detailPane();

    expect(within(pane).getByText('SAMPLE-PTNR-A')).toBeInTheDocument();
    expect(within(pane).getByText('샘플 거래처 가')).toBeInTheDocument();
  });

  /* 값 표기도 이름을 갖는다 — 라벨이 없으면 무엇의 값인지 보조기술이 읽을 수 없다. */
  it('값마다 이름이 붙어 있다', () => {
    renderPane();

    const pane = detailPane();

    expect(within(pane).getByLabelText('거래처코드')).toHaveTextContent('SAMPLE-PTNR-A');
    expect(within(pane).getByLabelText('거래처명')).toHaveTextContent('샘플 거래처 가');
    expect(within(pane).getByLabelText('ERP 코드')).toHaveTextContent('SAMPLE-ERP-A');
  });

  /* 빈 칸으로 두면 자료가 없는 것인지 화면이 빠뜨린 것인지 구분되지 않는다. */
  it('국가·ERP 코드가 없으면 미지정 표기를 낸다', () => {
    renderPane({ partner: partnerFixtures[1]! });

    const pane = detailPane();

    expect(within(pane).getByLabelText('국가')).toHaveTextContent('—');
    expect(within(pane).getByLabelText('ERP 코드')).toHaveTextContent('—');
  });

  it('사용 여부를 값으로 낸다', () => {
    renderPane();
    expect(within(detailPane()).getByLabelText('사용 여부')).toHaveTextContent('사용 중');
  });

  it('미사용 거래처는 미사용으로 낸다', () => {
    renderPane({ partner: partnerFixtures[2]! });
    expect(within(detailPane()).getByLabelText('사용 여부')).toHaveTextContent('미사용');
  });

  /* 내부 번호는 주소와 조회에만 쓴다 — 보이면 사용자가 자료로 읽는다. */
  it('거래처 번호를 화면에 내지 않는다', () => {
    renderPane();

    expect(within(detailPane()).getByText('SAMPLE-PTNR-A')).toBeInTheDocument();
    expect(screen.queryByText('9001')).not.toBeInTheDocument();
  });
});

describe('PartnerRolePane — 역할 체크칸', () => {
  /*
   * 붙어 있지 않은 어휘도 전부 서야 **역할을 붙일 수 있다.** 서버가 준 것만 그리면
   * 「역할이 없는 거래처에는 역할을 붙일 수 없는」 화면이 된다.
   */
  it('어휘 다섯과 붙어 있는 어휘 밖 역할이 체크칸으로 선다', () => {
    renderPane();

    expect(within(rolePane()).getAllByRole('checkbox')).toHaveLength(6);
  });

  /* 어휘 밖 코드는 **체크된 상태로 시작한다** — 서버에 이미 붙어 있는 역할이다. */
  it('붙어 있는 역할이 체크돼 있고 나머지는 꺼져 있다', () => {
    renderPane();

    expect(roleCheckbox('고객사')).toBeChecked();
    expect(roleCheckbox('폐기 업체')).toBeChecked();
    expect(roleCheckbox(UNKNOWN_LABEL)).toBeChecked();
    expect(roleCheckbox('공급사')).not.toBeChecked();
    expect(roleCheckbox('기타')).not.toBeChecked();
  });

  /* 서버 응답 순서로 그리면 저장할 때마다 항목이 움직인다 — 차례는 화면이 정한다. */
  it('어휘 다섯을 먼저, 어휘 밖 코드를 뒤에 세운다', () => {
    renderPane();

    expect(within(rolePane()).getAllByRole('checkbox')).toEqual([
      roleCheckbox('고객사'),
      roleCheckbox('공급사'),
      roleCheckbox('외주 제작사'),
      roleCheckbox('폐기 업체'),
      roleCheckbox('기타'),
      roleCheckbox(UNKNOWN_LABEL),
    ]);
  });

  /* 어휘 안의 코드는 화면 표시명이 이긴다 — 서버가 준 이름으로 흔들리지 않는다. */
  it('어휘 안의 역할에 서버 이름을 쓰지 않는다', () => {
    renderPane();

    expect(within(rolePane()).queryByText('폐기처리')).not.toBeInTheDocument();
  });

  /*
   * **어휘 밖 코드를 감추지 않는다**(결정 8). 통째 교체 저장에서 목록에 없는 역할은 조용히
   * 해제되므로, 감추면 사용자가 자기가 지우지 않은 것이 사라진 것을 알 방법이 없다.
   */
  it('어휘 밖 역할에는 모르는 역할 표식이 이름과 떨어져 붙는다', () => {
    renderPane();

    expect(roleCheckbox(UNKNOWN_LABEL)).toBeInTheDocument();
  });

  it('어휘 안의 역할에는 모르는 역할 표식이 붙지 않는다', () => {
    renderPane();

    expect(within(rolePane()).getAllByText('이 화면이 모르는 역할')).toHaveLength(1);
  });

  /* 해제하면 이 화면에서 다시 붙일 수 없다 — 그 비대칭을 누르기 전에 밝힌다. */
  it('어휘 밖 역할에 해제만 된다는 안내가 보이고 그 칸에 이어져 있다', () => {
    renderPane();

    const note = within(rolePane()).getByText(/이 화면이 모르는 역할은 해제만 할 수 있습니다/);

    expect(roleCheckbox(UNKNOWN_LABEL).getAttribute('aria-describedby')).toBe(
      note.getAttribute('id'),
    );
    expect(roleCheckbox('고객사').getAttribute('aria-describedby')).toBeNull();
  });

  it('어휘 밖 역할이 없으면 그 안내를 내지 않는다', () => {
    renderPane({ choices: toPartnerRoleChoices([], []) });

    expect(within(rolePane()).getAllByRole('checkbox')).toHaveLength(5);
    expect(
      within(rolePane()).queryByText(/이 화면이 모르는 역할은 해제만 할 수 있습니다/),
    ).not.toBeInTheDocument();
  });

  it('체크칸을 누르면 그 역할 코드가 올라간다', async () => {
    const { props, user } = renderPane();

    await user.click(roleCheckbox('공급사'));
    expect(props.onToggleRole).toHaveBeenCalledWith(PARTNER_ROLE_CODES.supplier);

    await user.click(roleCheckbox(UNKNOWN_LABEL));
    expect(props.onToggleRole).toHaveBeenCalledWith(UNKNOWN_CODE);
  });
});

describe('PartnerRolePane — 역할 구획의 세 갈래 (C19)', () => {
  /* 붙은 역할이 없다는 사실을 말로도 밝힌다 — 못 불러온 것과 없는 것이 구분돼야 한다. */
  it('붙은 역할이 하나도 없으면 없다고 밝힌다', () => {
    renderPane({ choices: toPartnerRoleChoices([], []), hasSavedRole: false });

    expect(within(rolePane()).getByText('지정된 역할이 없습니다')).toBeInTheDocument();
  });

  /*
   * 거래처를 옮겨 이 문장이 **새로 뜨는 순간**은 좌 목록을 보고 있는 사용자에게 읽혀야 한다 —
   * 체크칸 여섯은 그대로 서 있어 화면이 바뀐 티가 나지 않는다.
   */
  it('그 안내가 안내 영역으로 선다', () => {
    renderPane({ choices: toPartnerRoleChoices([], []), hasSavedRole: false });

    expect(within(rolePane()).getByRole('status')).toHaveTextContent('지정된 역할이 없습니다');
  });

  it('붙은 역할이 있으면 그 문구를 내지 않는다', () => {
    renderPane();

    expect(within(rolePane()).queryByText('지정된 역할이 없습니다')).not.toBeInTheDocument();
  });

  it('불러오는 중에는 체크칸 대신 진행 안내를 낸다', () => {
    renderPane({ choices: [], hasSavedRole: false, isRolesLoading: true });

    const pane = rolePane();

    expect(
      within(pane).getByRole('status', { name: '거래처 역할을 불러오는 중' }),
    ).toBeInTheDocument();
    expect(within(pane).queryAllByRole('checkbox')).toHaveLength(0);
    expect(within(pane).queryByText('지정된 역할이 없습니다')).not.toBeInTheDocument();
  });

  /*
   * 실패를 「지정된 역할이 없습니다」로 보이면 **역할이 없는 거래처로 읽힌다** —
   * 그 상태에서 저장하면 사용자가 의도한 적 없는 전체 해제가 나간다.
   */
  it('조회 실패 표시가 있으면 체크칸도 빈 상태도 내지 않는다', () => {
    renderPane({
      choices: [],
      hasSavedRole: false,
      rolesLoadError: <p>불러오지 못했습니다</p>,
    });

    const pane = rolePane();

    expect(within(pane).getByText('불러오지 못했습니다')).toBeInTheDocument();
    expect(within(pane).queryAllByRole('checkbox')).toHaveLength(0);
    expect(within(pane).queryByText('지정된 역할이 없습니다')).not.toBeInTheDocument();
    expect(within(pane).queryByRole('button', { name: '저장' })).not.toBeInTheDocument();
  });
});

describe('PartnerRolePane — 저장과 취소', () => {
  it('고친 것이 없으면 저장이 비활성이고 사유가 보인다', () => {
    renderPane();

    const save = within(rolePane()).getByRole('button', { name: '저장' });

    expect(save).toBeDisabled();
    expect(within(rolePane()).getByText(/저장은 역할을 고친 뒤에/)).toBeInTheDocument();
  });

  it('고친 것이 있으면 저장과 취소를 누를 수 있다', async () => {
    const { props, user } = renderPane({ isDirty: true });

    await user.click(within(rolePane()).getByRole('button', { name: '저장' }));
    await user.click(within(rolePane()).getByRole('button', { name: '취소' }));

    expect(props.onSave).toHaveBeenCalledTimes(1);
    expect(props.onCancel).toHaveBeenCalledTimes(1);
  });

  /* C33 — 저장이 나가는 중에 체크가 바뀌면 확인한 것과 다른 것이 저장된 것처럼 보인다. */
  it('저장 중에는 체크칸과 저장·취소가 잠긴다', () => {
    renderPane({ isDirty: true, isSaving: true });

    const pane = rolePane();

    for (const box of within(pane).getAllByRole('checkbox')) {
      expect(box).toBeDisabled();
    }
    expect(within(pane).getByRole('button', { name: '저장' })).toBeDisabled();
    expect(within(pane).getByRole('button', { name: '취소' })).toBeDisabled();
  });

  it('저장 실패 배너를 받은 자리에 낸다', () => {
    renderPane({ banner: <p>저장하지 못했습니다</p> });

    expect(within(rolePane()).getByText('저장하지 못했습니다')).toBeInTheDocument();
  });
});

describe('PartnerRolePane — 화면이 역할 코드를 지어내지 않는다 (C35)', () => {
  /* 서버가 모르는 코드를 화면이 지어낼 수 있게 되면 저장이 400으로 막힌다. */
  it('역할 코드를 직접 칠 수 있는 칸이 없다', () => {
    renderPane();

    /* 짝 방향 — 체크칸이 실제로 그려졌다(아무것도 없어서 통과하는 것이 아니다). */
    expect(roleCheckbox('고객사')).toBeInTheDocument();
    /* 우 칸 전체에 입력칸이 없다 — 기본 정보도 값 표기라 칠 자리가 어디에도 없다. */
    expect(screen.queryAllByRole('textbox')).toHaveLength(0);
    expect(screen.queryAllByRole('combobox')).toHaveLength(0);
  });

  /* 역할을 하나씩 더하거나 지우는 요청은 계약에 없다 — 그런 버튼을 두면 눌러도 아무 일이 없다. */
  it('역할을 개별로 더하거나 지우는 버튼이 없다', () => {
    renderPane({ isDirty: true });

    const names = within(rolePane())
      .getAllByRole('button')
      .map((button) => button.textContent);

    expect(names).toEqual(['취소', '저장']);
  });
});
