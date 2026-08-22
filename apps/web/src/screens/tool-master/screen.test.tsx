import { messages } from '@omf-mes/i18n';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { createStubFetch, jsonResponse, renderWithProviders } from '../../test/api-harness';
import {
  closedPlant,
  codeValuesResponse,
  makeCodeValue,
  makeTool,
  pageOf,
  plantItems,
  plantsResponse,
  toolItems,
  toolsResponse,
} from './fixtures';
import { ToolMasterScreen } from './screen';

const t = messages.toolMaster;

const isPath = (request: Request, pathname: string): boolean =>
  new URL(request.url).pathname === pathname;

interface RenderOptions {
  respondTools?: (request: Request) => Response;
  respondPlants?: () => Response;
  respondCodeValues?: () => Response;
}

/** 요청이 실제로 무엇을 실어 갔는지 본다 — 조건을 서버로 몰았음을 그것으로 증명한다. */
const renderScreen = (options: RenderOptions = {}) => {
  const sent: URL[] = [];
  const codeValueSent: URL[] = [];
  /** 공장 조회가 실어 간 조건 — 문 닫은 공장까지 받아 오는지 본다 */
  const plantSent: URL[] = [];

  const fetch = createStubFetch([
    {
      match: (request) => isPath(request, '/mdm/molds'),
      respond: (request) => {
        sent.push(new URL(request.url));

        return (options.respondTools ?? (() => jsonResponse(toolsResponse())))(request);
      },
    },
    {
      match: (request) => isPath(request, '/mdm/plants'),
      respond: (request) => {
        plantSent.push(new URL(request.url));

        return (options.respondPlants ?? (() => jsonResponse(plantsResponse())))();
      },
    },
    {
      match: (request) => isPath(request, '/mdm/code-values'),
      respond: (request) => {
        codeValueSent.push(new URL(request.url));

        return (options.respondCodeValues ?? (() => jsonResponse(codeValuesResponse())))();
      },
    },
  ]);

  const user = userEvent.setup();
  const view = renderWithProviders(<ToolMasterScreen />, { fetch });

  return { ...view, user, sent, plantSent, codeValueSent };
};

const listPane = () => screen.getByRole('region', { name: t.title });

const rowOf = async (code: string) => {
  const cell = await screen.findByRole('cell', { name: code });

  return cell.closest('tr') as HTMLElement;
};

describe('W-05-13 툴 마스터 — 목록', () => {
  it('툴을 조회해 목록에 보인다', async () => {
    renderScreen();

    expect(await screen.findByRole('cell', { name: 'TL-01' })).toBeInTheDocument();
    expect(screen.getByRole('cell', { name: 'TL-06' })).toBeInTheDocument();
  });

  it('툴명을 함께 보인다', async () => {
    renderScreen();

    expect(within(await rowOf('TL-01')).getByText('TL-01 툴')).toBeInTheDocument();
  });

  /*
   * ⭐ 이 화면의 본론 하나 — 예방보전이 **서로 다른 말**로 선다.
   * 「판정 없음」이 「도래 전」과 같은 말이면 모르는 툴이 정상으로 보이고 그대로 돈다.
   */
  it('예방보전을 네 모양으로 갈라 그린다 — 대상 아님·도래·도래 전·판정 없음', async () => {
    renderScreen();

    expect(within(await rowOf('TL-01')).getByText(t.pm.notRequired)).toBeInTheDocument();
    expect(
      within(await rowOf('TL-02')).getByText(t.pm.dueByAxis(t.pm.axis.shot)),
    ).toBeInTheDocument();
    expect(
      within(await rowOf('TL-03')).getByText(t.pm.dueByAxis(t.pm.axis.date)),
    ).toBeInTheDocument();
    expect(within(await rowOf('TL-04')).getByText(t.pm.beforeDue)).toBeInTheDocument();
    expect(within(await rowOf('TL-05')).getByText(t.pm.unknown)).toBeInTheDocument();
  });

  it('「판정 없음」과 「도래 전」은 다른 말이다', () => {
    expect(t.pm.unknown).not.toBe(t.pm.beforeDue);
    expect(t.pm.notRequired).not.toBe(t.pm.beforeDue);
  });

  /* ⭐ 판정은 서버가 한다 — 축이 둘이고 타발수는 화면이 가진 값이 아니다. */
  it('도래 판정을 화면이 다시 세지 않는다 — 서버가 준 값을 그대로 그린다', async () => {
    renderScreen({
      respondTools: () =>
        jsonResponse(
          toolsResponse([
            /* 누계가 적정에 한참 못 미쳐도 서버가 도래라 하면 도래다. */
            makeTool(7101, 'TL-11', {
              pmTriggerTypeCode: 'SHOT',
              pmDue: true,
              pmDueAxisCode: 'SHOT',
              guaranteedShotCount: 900_000,
              currentShotCount: 10,
              availableShotCount: 899_990,
              shotUsageRatio: 0.001,
            }),
          ]),
        ),
    });

    expect(
      within(await rowOf('TL-11')).getByText(t.pm.dueByAxis(t.pm.axis.shot)),
    ).toBeInTheDocument();
  });

  it('사용 가능 타수를 세 자리마다 끊어 보인다', async () => {
    renderScreen();

    expect(within(await rowOf('TL-01')).getByText('371,600')).toBeInTheDocument();
  });

  /* 적정타수를 넘겨 쓰면 사용 가능 타수가 음수다 — 감추지 않는다. */
  it('사용 가능 타수가 음수면 음수로 보인다', async () => {
    renderScreen();

    expect(within(await rowOf('TL-02')).getByText('-2,500')).toBeInTheDocument();
  });

  /*
   * ⛔ **없는 값을 0 으로 채우지 않는다.** 사용 가능 타수 0 은 「다 썼다」는 사실이라
   * 예방보전이 즉시 도래한 것처럼 보인다.
   * ⭐ 못 세는 이유가 「적정타수가 비어서」이면 그렇게 말한다 — 채우면 풀리는 것이다.
   */
  it('적정타수가 비면 「적정타수 미입력」으로 그린다', async () => {
    renderScreen();

    const row = within(await rowOf('TL-04'));

    expect(row.getAllByText(t.shots.guaranteedMissing)).toHaveLength(2);
    expect(row.queryByText('0')).not.toBeInTheDocument();
  });

  it('적정타수는 있는데 셈이 안 오면 「산출 불가」로 그린다', async () => {
    renderScreen();

    const row = within(await rowOf('TL-05'));

    expect(row.getAllByText(t.shots.notCalculable)).toHaveLength(2);
    expect(row.queryByText(t.shots.guaranteedMissing)).not.toBeInTheDocument();
  });

  it('사용 가능 타수 0 은 0 으로 보인다 — 「산출 불가」가 아니다', async () => {
    renderScreen();

    const row = within(await rowOf('TL-06'));

    expect(row.getByText('0')).toBeInTheDocument();
    expect(row.queryByText(t.shots.notCalculable)).not.toBeInTheDocument();
  });

  it('초과율을 소수 한 자리까지 보인다', async () => {
    renderScreen();

    expect(within(await rowOf('TL-02')).getByText(t.shots.percent('102.5'))).toBeInTheDocument();
  });

  /* 적정타수를 다 쓴 것은 수치 자체가 말하되, 눈에 먼저 띄게 한다. */
  it('적정타수를 다 쓴 초과율은 글자로 짚어 준다', async () => {
    renderScreen();

    expect(within(await rowOf('TL-02')).getByText(t.shots.percent('102.5'))).toHaveClass(
      'figure-alert',
    );
    expect(within(await rowOf('TL-01')).getByText(t.shots.percent('25.7'))).not.toHaveClass(
      'figure-alert',
    );
  });

  it('운용상태 코드를 이름으로 푼다', async () => {
    renderScreen();

    expect(within(await rowOf('TL-01')).getByText('사용중')).toBeInTheDocument();
    expect(within(await rowOf('TL-06')).getByText('폐기')).toBeInTheDocument();
  });

  it('코드 그룹을 이름으로 부른다 — 정수 식별자를 싣지 않는다', async () => {
    const { codeValueSent } = renderScreen();

    await screen.findByRole('cell', { name: 'TL-01' });

    expect(codeValueSent.map((url) => url.searchParams.get('codeGroupCode'))).toContain(
      'EQUIPMENT_STATUS',
    );
    expect(codeValueSent.every((url) => url.searchParams.get('codeGroupId') === null)).toBe(true);
  });

  it('이름을 못 푸는 상태 코드는 코드를 그대로 보인다', async () => {
    renderScreen({
      respondTools: () =>
        jsonResponse(toolsResponse([makeTool(7009, 'TL-09', { statusCode: 'MYSTERY' })])),
    });

    expect(within(await rowOf('TL-09')).getByText('MYSTERY')).toBeInTheDocument();
  });

  /*
   * ⛔ 이름 풀이표를 `isActive` 로 거르면 **쓰지 않기로 한 코드값을 가진 툴의 이름이 사라진다.**
   * 좁힘은 «고를 목록» 한 자리에만 건다.
   */
  it('쓰지 않기로 한 상태 코드도 이름으로 푼다', async () => {
    renderScreen({
      respondTools: () =>
        jsonResponse(toolsResponse([makeTool(7010, 'TL-10', { statusCode: 'RETIRED_CODE' })])),
    });

    expect(within(await rowOf('TL-10')).getByText('쓰지 않는 상태')).toBeInTheDocument();
  });

  it('상태 코드의 이름이 비면 코드를 그대로 보인다', async () => {
    renderScreen({
      respondTools: () =>
        jsonResponse(toolsResponse([makeTool(7012, 'TL-12', { statusCode: 'BLANK_NAME' })])),
      respondCodeValues: () =>
        jsonResponse(codeValuesResponse([makeCodeValue('BLANK_NAME', '   ')])),
    });

    expect(within(await rowOf('TL-12')).getByText('BLANK_NAME')).toBeInTheDocument();
  });

  /* ⚠ 도구 유형 값 목록이 아직 없다(추적 omf-mes#145) — 이름을 지어내지 않는다. */
  it('도구 유형은 이름을 못 풀면 코드를 그대로 보인다', async () => {
    renderScreen();

    expect(within(await rowOf('TL-01')).getByText('MOLD')).toBeInTheDocument();
  });

  /*
   * ⭐ 「미사용 포함」을 켜면 **그 조건이 무엇을 데려왔는지 알 수 있어야 한다.**
   * 표식이 없으면 미사용 툴이 쓰는 툴과 같은 모양으로 서고, 조건이 아무 뜻도 갖지 못한다.
   */
  it('미사용 툴은 이름에 표식을 붙인다', async () => {
    renderScreen();

    expect(
      within(await rowOf('TL-06')).getByText(`TL-06 툴${t.values.inactiveSuffix}`),
    ).toBeInTheDocument();
    expect(within(await rowOf('TL-01')).getByText('TL-01 툴')).toBeInTheDocument();
  });

  /*
   * **좁힘은 «고를 목록» 한 자리에만 건다** — 받아 오는 자리에는 걸지 않는다.
   * 문 닫은 공장에 매인 툴을 열었을 때 선택칸이 비어 보이지 않으려면 이름이 있어야 한다.
   */
  it('공장을 받아 올 때 문 닫은 것까지 함께 받는다', async () => {
    const { plantSent } = renderScreen();

    await screen.findByRole('cell', { name: 'TL-01' });

    expect(plantSent.at(-1)?.searchParams.get('includeInactive')).toBe('true');
  });

  /*
   * 공장은 **거르는 축으로 남기고** 칸은 두지 않는다 — 그래서 이름을 푸는 자리가 칩이다.
   * 못 풀면 조건 칩에 공장 번호가 서고, 사용자는 무엇으로 좁혔는지 알 수 없다.
   */
  it('고른 공장을 조건 칩에 이름으로 보인다', async () => {
    const { user } = renderScreen();

    await screen.findByRole('cell', { name: 'TL-01' });
    await user.click(within(listPane()).getByRole('combobox', { name: t.fields.plant }));
    await user.click(await screen.findByRole('option', { name: '제2공장' }));
    await user.click(within(listPane()).getByRole('button', { name: messages.common.search }));

    expect(await screen.findByText(t.filters.chipPlant('제2공장'))).toBeInTheDocument();
  });

  /* 좁힘은 «고를 목록» 한 자리에만 건다 — 이름 풀이와 고를 목록이 다른 규율을 쓴다. */
  it('문 닫은 공장은 고를 목록에 내지 않는다', async () => {
    const { user } = renderScreen({
      respondPlants: () => jsonResponse(plantsResponse([...plantItems, closedPlant])),
    });

    await screen.findByRole('cell', { name: 'TL-01' });
    await user.click(within(listPane()).getByRole('combobox', { name: t.fields.plant }));

    expect(await screen.findByRole('option', { name: '제1공장' })).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: /제3공장/ })).not.toBeInTheDocument();
  });
});

describe('W-05-13 툴 마스터 — 조회 조건', () => {
  it('검색어를 서버 조건으로 싣는다', async () => {
    const { user, sent } = renderScreen();

    await screen.findByRole('cell', { name: 'TL-01' });
    await user.type(within(listPane()).getByLabelText(t.filters.searchLabel), '프레스{Enter}');

    await waitFor(() => {
      expect(sent.at(-1)?.searchParams.get('q')).toBe('프레스');
    });
  });

  it('공장을 서버 조건으로 싣는다', async () => {
    const { user, sent } = renderScreen();

    await screen.findByRole('cell', { name: 'TL-01' });
    await user.click(within(listPane()).getByRole('combobox', { name: t.fields.plant }));
    await user.click(await screen.findByRole('option', { name: '제2공장' }));
    await user.click(within(listPane()).getByRole('button', { name: messages.common.search }));

    await waitFor(() => {
      expect(sent.at(-1)?.searchParams.get('plantId')).toBe('12');
    });
  });

  /* ⭐ **거르는 일을 서버가 한다** — 받아 온 것만 거르면 잘린 쪽이 없는 것처럼 보인다. */
  it('적정타수 없는 것만 조건을 서버로 보낸다', async () => {
    const { user, sent } = renderScreen();

    await screen.findByRole('cell', { name: 'TL-01' });
    await user.click(
      within(listPane()).getByRole('checkbox', { name: t.filters.guaranteedMissingOnly }),
    );

    await waitFor(() => {
      expect(sent.at(-1)?.searchParams.get('guaranteedShotCountMissing')).toBe('true');
    });
  });

  it('예방보전 도래만 조건을 서버로 보낸다', async () => {
    const { user, sent } = renderScreen();

    await screen.findByRole('cell', { name: 'TL-01' });
    await user.click(within(listPane()).getByRole('checkbox', { name: t.filters.pmDueOnly }));

    await waitFor(() => {
      expect(sent.at(-1)?.searchParams.get('pmDueOnly')).toBe('true');
    });
  });

  /* ⛔ 끈 조건을 거짓으로 실으면 서버 기본값과 다툰다 — 뺀다. */
  it('끈 조건은 아예 싣지 않는다', async () => {
    const { sent } = renderScreen();

    await screen.findByRole('cell', { name: 'TL-01' });

    expect(sent.at(-1)?.searchParams.get('guaranteedShotCountMissing')).toBeNull();
    expect(sent.at(-1)?.searchParams.get('pmDueOnly')).toBeNull();
  });

  it('처음에는 사용 중인 것만 조회한다', async () => {
    const { sent } = renderScreen();

    await screen.findByRole('cell', { name: 'TL-01' });

    expect(sent.at(-1)?.searchParams.get('includeInactive')).toBe('false');
  });

  it('미사용 포함을 켜면 조건이 함께 나간다', async () => {
    const { user, sent } = renderScreen();

    await screen.findByRole('cell', { name: 'TL-01' });
    await user.click(
      within(listPane()).getByRole('checkbox', { name: messages.common.includeInactive }),
    );

    await waitFor(() => {
      expect(sent.at(-1)?.searchParams.get('includeInactive')).toBe('true');
    });
  });

  it('처음 차례는 코드 순이다', async () => {
    const { sent } = renderScreen();

    await screen.findByRole('cell', { name: 'TL-01' });

    expect(sent.at(-1)?.searchParams.get('sort')).toBe('CODE');
  });

  /* 정렬은 목록을 좁히지 않는다 — 모아서 적용할 이유가 없어 고르는 즉시 나간다. */
  it('정렬을 고르면 곧바로 서버 조건이 바뀐다', async () => {
    const { user, sent } = renderScreen();

    await screen.findByRole('cell', { name: 'TL-01' });
    await user.click(within(listPane()).getByRole('combobox', { name: t.filters.sortLabel }));
    await user.click(await screen.findByRole('option', { name: t.filters.sort.shotUsageDesc }));

    await waitFor(() => {
      expect(sent.at(-1)?.searchParams.get('sort')).toBe('SHOT_USAGE_DESC');
    });
  });

  /*
   * ⛔ **모아서 내는 조건이 즉시 적용된 조건을 되돌리면 안 된다.**
   * 검색칸은 「조회」를 눌러야 나가고 체크칸은 바꾸는 즉시 나간다 — 두 축이 한 벌을 공유하면
   * 나중에 누른 쪽이 앞서 켠 것을 조용히 끈다(client#314 에서 실제로 났던 결함).
   */
  it('도래만을 켠 뒤 검색어로 조회해도 도래만이 유지된다', async () => {
    const { user, sent } = renderScreen();

    await screen.findByRole('cell', { name: 'TL-01' });
    await user.click(within(listPane()).getByRole('checkbox', { name: t.filters.pmDueOnly }));

    await waitFor(() => {
      expect(sent.at(-1)?.searchParams.get('pmDueOnly')).toBe('true');
    });

    await user.type(within(listPane()).getByLabelText(t.filters.searchLabel), '프레스');
    await user.click(within(listPane()).getByRole('button', { name: messages.common.search }));

    await waitFor(() => {
      expect(sent.at(-1)?.searchParams.get('q')).toBe('프레스');
    });
    expect(sent.at(-1)?.searchParams.get('pmDueOnly')).toBe('true');
    expect(within(listPane()).getByRole('checkbox', { name: t.filters.pmDueOnly })).toBeChecked();
  });

  /* 정렬도 같은 축이다 — 「조회」가 앞서 고른 차례를 되돌리면 안 된다. */
  it('정렬을 바꾼 뒤 검색어로 조회해도 정렬이 유지된다', async () => {
    const { user, sent } = renderScreen();

    await screen.findByRole('cell', { name: 'TL-01' });
    await user.click(within(listPane()).getByRole('combobox', { name: t.filters.sortLabel }));
    await user.click(await screen.findByRole('option', { name: t.filters.sort.nextPmAsc }));

    await waitFor(() => {
      expect(sent.at(-1)?.searchParams.get('sort')).toBe('NEXT_PM_ASC');
    });

    await user.type(within(listPane()).getByLabelText(t.filters.searchLabel), '프레스{Enter}');

    await waitFor(() => {
      expect(sent.at(-1)?.searchParams.get('q')).toBe('프레스');
    });
    expect(sent.at(-1)?.searchParams.get('sort')).toBe('NEXT_PM_ASC');
  });

  it('칩으로 검색어를 거두면 검색칸도 함께 비워진다', async () => {
    const { user } = renderScreen();

    await screen.findByRole('cell', { name: 'TL-01' });

    const box = within(listPane()).getByLabelText(t.filters.searchLabel);
    await user.type(box, '프레스{Enter}');

    await user.click(await screen.findByRole('button', { name: t.filters.chipRemoveKeyword }));

    await waitFor(() => {
      expect(box).toHaveValue('');
    });
  });

  it('칩으로 도래만 조건을 거둔다', async () => {
    const { user, sent } = renderScreen();

    await screen.findByRole('cell', { name: 'TL-01' });
    await user.click(within(listPane()).getByRole('checkbox', { name: t.filters.pmDueOnly }));

    await user.click(await screen.findByRole('button', { name: t.filters.chipRemovePmDue }));

    await waitFor(() => {
      expect(sent.at(-1)?.searchParams.get('pmDueOnly')).toBeNull();
    });
  });

  /*
   * ⛔ **아직 적용하지 않은 입력도 초기화가 거둬야 한다.**
   * 적용된 값을 보고 칸을 맞추는 것만으로는 부족하다 — 적용된 값이 이미 비어 있으면
   * 「달라진 것이 없다」가 되어 칸에 남은 낱말을 아무도 지우지 않는다(client#316 계열).
   */
  it('적용하지 않은 입력도 초기화가 거둔다', async () => {
    const { user } = renderScreen();

    await screen.findByRole('cell', { name: 'TL-01' });

    const box = within(listPane()).getByLabelText(t.filters.searchLabel);
    await user.type(box, '프레스');
    expect(box).toHaveValue('프레스');

    await user.click(within(listPane()).getByRole('button', { name: messages.common.reset }));

    await waitFor(() => {
      expect(box).toHaveValue('');
    });
  });

  it('초기화는 즉시 적용된 조건까지 되돌린다', async () => {
    const { user, sent } = renderScreen();

    await screen.findByRole('cell', { name: 'TL-01' });
    await user.click(within(listPane()).getByRole('checkbox', { name: t.filters.pmDueOnly }));

    await waitFor(() => {
      expect(sent.at(-1)?.searchParams.get('pmDueOnly')).toBe('true');
    });

    await user.click(within(listPane()).getByRole('button', { name: messages.common.reset }));

    await waitFor(() => {
      expect(sent.at(-1)?.searchParams.get('pmDueOnly')).toBeNull();
    });
    expect(
      within(listPane()).getByRole('checkbox', { name: t.filters.pmDueOnly }),
    ).not.toBeChecked();
  });
});

describe('W-05-13 툴 마스터 — 빈 상태와 실패', () => {
  it('아무것도 없으면 등록을 권한다', async () => {
    renderScreen({ respondTools: () => jsonResponse(toolsResponse([])) });

    expect(await screen.findByText(t.empty.noneTitle)).toBeInTheDocument();
  });

  /* 조건이 걸려 있으면 「없다」가 아니라 「조건에 맞는 것이 없다」다 — 할 일이 다르다. */
  it('조건이 걸려 있으면 조건을 줄이라고 말한다', async () => {
    const { user } = renderScreen({
      respondTools: (request) =>
        jsonResponse(
          toolsResponse(
            new URL(request.url).searchParams.get('pmDueOnly') === null ? toolItems : [],
          ),
        ),
    });

    await screen.findByRole('cell', { name: 'TL-01' });
    await user.click(within(listPane()).getByRole('checkbox', { name: t.filters.pmDueOnly }));

    expect(await screen.findByText(t.empty.noMatchTitle)).toBeInTheDocument();
  });

  it('조회가 실패하면 다시 시도할 자리를 준다', async () => {
    renderScreen({ respondTools: () => jsonResponse({ message: '서버 오류' }, { status: 500 }) });

    expect(await screen.findByRole('button', { name: messages.common.retry })).toBeInTheDocument();
  });

  /* ⭐ 「다시 시도」를 누르면 실제로 다시 나가야 한다 — 누를 자리만 있으면 안 된다(G-23). */
  it('「다시 시도」가 조회를 다시 낸다', async () => {
    const { user, sent } = renderScreen({
      respondTools: () => jsonResponse({ message: '서버 오류' }, { status: 500 }),
    });

    await user.click(await screen.findByRole('button', { name: messages.common.retry }));

    await waitFor(() => {
      expect(sent.length).toBeGreaterThan(1);
    });
  });

  /* 권한 부족은 다시 시도해도 같은 답이 온다 — 누를 자리를 두지 않는다(G-23). */
  it('권한이 없으면 다시 시도를 권하지 않는다', async () => {
    renderScreen({ respondTools: () => jsonResponse({ message: '권한 없음' }, { status: 403 }) });

    expect(await screen.findByText(messages.httpError.forbidden)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: messages.common.retry })).not.toBeInTheDocument();
  });

  it('서버가 목록을 자르면 그 사실을 밝힌다', async () => {
    renderScreen({
      respondTools: () => jsonResponse({ items: toolItems, page: pageOf(toolItems, 99) }),
    });

    expect(await screen.findByText(t.listTruncated(toolItems.length, 99))).toBeInTheDocument();
  });

  it('선택 목록을 못 불러오면 그 사실을 밝힌다', async () => {
    renderScreen({ respondPlants: () => jsonResponse({ message: '서버 오류' }, { status: 500 }) });

    expect(await screen.findByText(t.optionsLoadFailed)).toBeInTheDocument();
  });

  it('선택 목록이 잘리면 그 사실을 밝힌다', async () => {
    renderScreen({
      respondPlants: () => jsonResponse({ items: plantItems, page: pageOf(plantItems, 99) }),
    });

    expect(await screen.findByText(t.optionsTruncated)).toBeInTheDocument();
  });
});
