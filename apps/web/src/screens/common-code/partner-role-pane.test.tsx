import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { partnerFixtures, partnerRoleFixtures } from './fixtures';
import { PartnerRolePane } from './partner-role-pane';
/* 코드 글자를 시험이 다시 적지 않는다(결정 2) — 리터럴은 어휘 고정 감지기 한 자리에만 둔다. */
import { PARTNER_ROLE_CODES } from './partner-role-vocab';

const renderPane = (overrides: Partial<Parameters<typeof PartnerRolePane>[0]> = {}) =>
  render(
    <PartnerRolePane
      partner={partnerFixtures[0]!}
      roles={partnerRoleFixtures}
      isRolesLoading={false}
      rolesLoadError={null}
      {...overrides}
    />,
  );

const detailPane = (): HTMLElement => screen.getByRole('region', { name: '거래처 기본 정보' });

const rolePane = (): HTMLElement => screen.getByRole('region', { name: '거래처 역할' });

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

describe('PartnerRolePane — 역할 읽기', () => {
  it('어휘 안의 역할은 이 화면의 표시명으로 낸다', () => {
    renderPane();

    const pane = rolePane();

    expect(within(pane).getByText('고객사')).toBeInTheDocument();
    expect(within(pane).getByText('폐기 업체')).toBeInTheDocument();
  });

  /* 어휘 안의 코드는 화면 표시명이 이긴다 — 서버가 준 이름으로 흔들리지 않는다. */
  it('어휘 안의 역할에 서버 이름을 쓰지 않는다', () => {
    renderPane();

    expect(within(rolePane()).queryByText('폐기처리')).not.toBeInTheDocument();
  });

  /*
   * **어휘 밖 코드를 감추지 않는다.** 통째 교체 저장에서 목록에 없는 역할은 조용히 해제되므로,
   * 감추면 사용자가 자기가 지우지 않은 것이 사라진 것을 알 방법이 없다.
   */
  it('어휘 밖 역할은 서버가 준 이름과 표식을 함께 낸다', () => {
    renderPane();

    const pane = rolePane();

    expect(within(pane).getByText('샘플 역할 엑스')).toBeInTheDocument();
    expect(within(pane).getByText('이 화면이 모르는 역할')).toBeInTheDocument();
  });

  it('어휘 안의 역할에는 모르는 역할 표식이 붙지 않는다', () => {
    renderPane({
      roles: [{ roleTypeCode: PARTNER_ROLE_CODES.disposal, roleTypeName: '폐기처리' }],
    });

    const pane = rolePane();

    expect(within(pane).getByText('폐기 업체')).toBeInTheDocument();
    expect(within(pane).queryByText('이 화면이 모르는 역할')).not.toBeInTheDocument();
  });

  /* 서버 응답 순서로 그리면 저장할 때마다 항목이 움직인다 — 차례는 화면이 정한다. */
  it('어휘 다섯을 먼저, 어휘 밖 코드를 뒤에 세운다', () => {
    renderPane();

    const items = within(rolePane())
      .getAllByRole('listitem')
      .map((item) => item.textContent);

    expect(items).toEqual(['고객사', '폐기 업체', '샘플 역할 엑스이 화면이 모르는 역할']);
  });

  it('역할이 없으면 없다고 낸다', () => {
    renderPane({ roles: [] });

    expect(within(rolePane()).getByText('지정된 역할이 없습니다')).toBeInTheDocument();
  });

  it('불러오는 중에는 목록 대신 진행 안내를 낸다', () => {
    renderPane({ roles: [], isRolesLoading: true });

    const pane = rolePane();

    expect(
      within(pane).getByRole('status', { name: '거래처 역할을 불러오는 중' }),
    ).toBeInTheDocument();
    expect(within(pane).queryByText('지정된 역할이 없습니다')).not.toBeInTheDocument();
  });

  /* 실패를 「지정된 역할이 없습니다」로 보이면 **역할이 없는 거래처로 읽힌다.** */
  it('조회 실패 표시가 있으면 빈 상태를 함께 내지 않는다', () => {
    renderPane({ roles: [], rolesLoadError: <p>불러오지 못했습니다</p> });

    const pane = rolePane();

    expect(within(pane).getByText('불러오지 못했습니다')).toBeInTheDocument();
    expect(within(pane).queryByText('지정된 역할이 없습니다')).not.toBeInTheDocument();
    expect(within(pane).queryAllByRole('listitem')).toHaveLength(0);
  });
});

describe('PartnerRolePane — 이 단위에는 편집 수단이 없다', () => {
  /*
   * 읽기만 하는 회차다. **비활성 상태로도 두지 않는다** — 죽은 컨트롤은
   * 「눌러도 아무 일이 없는 버튼」이 되어 사용자를 기다리게 한다.
   * 값이 실제로 그려진 뒤(양성 앵커)에 잰다.
   */
  it('저장·추가·삭제 버튼이 하나도 없다', () => {
    renderPane();

    expect(within(rolePane()).getByText('고객사')).toBeInTheDocument();
    expect(screen.queryAllByRole('button')).toHaveLength(0);
  });

  it('역할을 고치는 확인칸이 없다', () => {
    renderPane();

    expect(within(rolePane()).getByText('고객사')).toBeInTheDocument();
    expect(screen.queryAllByRole('checkbox')).toHaveLength(0);
  });

  /* 서버가 모르는 코드를 화면이 지어낼 수 있게 되면 저장이 400으로 막힌다. */
  it('역할 코드를 직접 칠 수 있는 칸이 없다', () => {
    renderPane();

    expect(within(rolePane()).getByText('고객사')).toBeInTheDocument();
    /* 우 칸 전체에 입력칸이 없다 — 기본 정보도 값 표기라 칠 자리가 어디에도 없다. */
    expect(screen.queryAllByRole('textbox')).toHaveLength(0);
  });
});
