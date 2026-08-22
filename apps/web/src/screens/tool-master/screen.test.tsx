import { messages } from '@omf-mes/i18n';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { createStubFetch, jsonResponse, renderWithProviders } from '../../test/api-harness';
import {
  closedPlant,
  codeValuesResponse,
  labelIssuedCode,
  makeCodeValue,
  makeTool,
  pageOf,
  plantItems,
  plantsResponse,
  referencedCode,
  toolDetail,
  toolItems,
  toolNotRequired,
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
  respondDetail?: (request: Request) => Response;
  respondWrite?: (request: Request) => Response;
}

/** 나간 쓰기 하나. 없으면 시험이 거기서 멈추는 편이 낫다 — 다음 단언이 헛통과하지 않는다. */
const onlyWrite = (writes: readonly Request[]): Request => {
  const [first] = writes;

  if (first === undefined) throw new Error('나간 쓰기가 없습니다.');

  return first;
};

/** 경로 끝의 식별자. 스텁이 늘 같은 건을 돌려주지 않게 한다. */
const idOf = (request: Request): number => Number(new URL(request.url).pathname.split('/').at(-1));

/** 요청이 실제로 무엇을 실어 갔는지 본다 — 조건을 서버로 몰았음을 그것으로 증명한다. */
const renderScreen = (options: RenderOptions = {}) => {
  const sent: URL[] = [];
  const codeValueSent: URL[] = [];
  /** 공장 조회가 실어 간 조건 — 문 닫은 공장까지 받아 오는지 본다 */
  const plantSent: URL[] = [];

  /** 쓰기 요청 원본 — 본문과 헤더를 그대로 본다 */
  const writes: Request[] = [];

  const defaultDetail = (request: Request): Response => {
    const found = toolItems.find((item) => item.moldId === idOf(request));

    return found === undefined
      ? jsonResponse({ message: '없는 툴' }, { status: 404 })
      : jsonResponse(toolDetail(found), { headers: { ETag: '9' } });
  };

  const fetch = createStubFetch([
    {
      match: (request) => isPath(request, '/mdm/molds') && request.method !== 'GET',
      respond: (request) => {
        writes.push(request.clone());

        return (options.respondWrite ?? (() => jsonResponse(toolNotRequired, { status: 201 })))(
          request,
        );
      },
    },
    {
      match: (request) => isPath(request, '/mdm/molds'),
      respond: (request) => {
        sent.push(new URL(request.url));

        return (options.respondTools ?? (() => jsonResponse(toolsResponse())))(request);
      },
    },
    {
      match: (request) =>
        new URL(request.url).pathname.startsWith('/mdm/molds/') && request.method !== 'GET',
      respond: (request) => {
        writes.push(request.clone());

        return (options.respondWrite ?? (() => jsonResponse(toolNotRequired)))(request);
      },
    },
    {
      match: (request) => new URL(request.url).pathname.startsWith('/mdm/molds/'),
      respond: (request) => (options.respondDetail ?? defaultDetail)(request),
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

  return { ...view, user, sent, plantSent, codeValueSent, writes };
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

/** 지금 떠 있는 폼 창. 필터 바에도 같은 이름의 선택칸이 있어 **범위를 좁혀 찾는다.** */
const formDialog = () => screen.getByRole('dialog');

const openEditOf = async (
  user: ReturnType<typeof userEvent.setup>,
  code: string,
): Promise<void> => {
  await user.click(await screen.findByRole('button', { name: code }));
  await screen.findByRole('dialog', { name: t.form.editTitle });
};

const openCreate = async (user: ReturnType<typeof userEvent.setup>): Promise<void> => {
  await screen.findByRole('cell', { name: 'TL-01' });
  await user.click(within(listPane()).getByRole('button', { name: t.actions.addTool }));
  await screen.findByRole('dialog', { name: t.form.createTitle });
};

describe('W-05-13 툴 마스터 — 등록·수정 창', () => {
  it('툴코드를 누르면 수정 창이 열린다', async () => {
    const { user } = renderScreen();

    await openEditOf(user, 'TL-01');

    expect(screen.getByRole('textbox', { name: /툴코드/ })).toHaveValue('TL-01');
  });

  it('툴 등록을 누르면 빈 창이 열린다', async () => {
    const { user } = renderScreen();

    await openCreate(user);

    expect(screen.getByRole('textbox', { name: /툴코드/ })).toHaveValue('');
  });

  /* 계약의 기본값이고, 금형이 아닌 도구도 하나로 센다. */
  it('등록 창의 캐비티 수는 1 로 시작한다', async () => {
    const { user } = renderScreen();

    await openCreate(user);

    expect(screen.getByRole('textbox', { name: /캐비티 수/ })).toHaveValue('1');
  });

  /*
   * ⛔ **누계 타발수에 입력칸을 만들지 않는다**(스펙 §6). 더하는 것은 툴 사용실적 입력이고
   * 되돌리는 것은 툴 예방보전 실적 등록이다 — 여기서 고칠 수 있으면 실적과 마스터가 어긋난다.
   */
  it('누계 타발수는 고칠 수 없고 어디서 정해지는지 밝힌다', async () => {
    const { user } = renderScreen();

    await openEditOf(user, 'TL-01');

    expect(
      screen.queryByRole('textbox', { name: new RegExp(t.fields.currentShotCount) }),
    ).not.toBeInTheDocument();
    expect(screen.getByLabelText(t.fields.currentShotCount)).toHaveTextContent('128,400');
    expect(screen.getByText(t.actionReasons.shotCountOwnedElsewhere)).toBeInTheDocument();
  });

  /* 마지막 시행일도 같다 — 예방보전 실적 등록이 정한다(스펙 §6). */
  it('마지막 예방보전일은 고칠 수 없고 어디서 정해지는지 밝힌다', async () => {
    const { user } = renderScreen();

    await openEditOf(user, 'TL-03');

    expect(
      screen.queryByRole('textbox', { name: new RegExp(t.fields.lastPmDate) }),
    ).not.toBeInTheDocument();
    expect(screen.getByLabelText(t.fields.lastPmDate)).toHaveTextContent('2026-01-02');
    expect(screen.getByText(t.actionReasons.pmDateOwnedElsewhere)).toBeInTheDocument();
  });

  /* ⛔ 없는 값을 빈칸으로 두면 「없다」와 「아직 안 불러왔다」가 같은 모양이 된다(G-9). */
  it('마지막 예방보전일이 없으면 「기록 없음」을 밝힌다', async () => {
    const { user } = renderScreen();

    await openEditOf(user, 'TL-01');

    expect(screen.getByLabelText(t.fields.lastPmDate)).toHaveTextContent(t.fields.notRecorded);
  });

  it('사용 가능 타수와 초과율을 창에서도 셈한 대로 보인다', async () => {
    const { user } = renderScreen();

    await openEditOf(user, 'TL-04');

    expect(screen.getByLabelText(t.fields.availableShotCount)).toHaveTextContent(
      t.shots.guaranteedMissing,
    );
    expect(screen.getByLabelText(t.fields.shotUsageRatio)).toHaveTextContent(
      t.shots.guaranteedMissing,
    );
  });

  /*
   * ⭐ **참조 건수가 0인데도 코드가 잠긴다**(스펙 §6). 참조 0은 「시스템 안에서 아무도 안 쓴다」
   * 이지 「현장에 아무것도 없다」가 아니다 — 라벨이 이미 나가 있으면 코드를 바꿀 수 없다.
   */
  it('라벨이 발행됐으면 참조 0이어도 코드를 잠근다', async () => {
    const { user } = renderScreen({
      respondDetail: () =>
        jsonResponse(
          toolDetail(toolNotRequired, { editability: labelIssuedCode, labelIssueCount: 2 }),
          { headers: { ETag: '9' } },
        ),
    });

    await openEditOf(user, 'TL-01');

    expect(screen.getByRole('textbox', { name: /툴코드/ })).toBeDisabled();
    expect(screen.getByText(messages.editability.labelIssued(null))).toBeInTheDocument();
  });

  /* 잠금 사유 문구만으로는 「몇 장이 현장에 나가 있는가」를 알 수 없다. */
  it('발행한 라벨 회차를 밝힌다', async () => {
    const { user } = renderScreen({
      respondDetail: () =>
        jsonResponse(
          toolDetail(toolNotRequired, { editability: labelIssuedCode, labelIssueCount: 2 }),
          { headers: { ETag: '9' } },
        ),
    });

    await openEditOf(user, 'TL-01');

    expect(screen.getByLabelText(t.fields.labelIssueCount)).toHaveTextContent(
      t.form.labelIssued(2),
    );
  });

  it('참조가 있어도 코드를 잠그고 건수를 밝힌다', async () => {
    const { user } = renderScreen({
      respondDetail: () =>
        jsonResponse(toolDetail(toolNotRequired, { editability: referencedCode }), {
          headers: { ETag: '9' },
        }),
    });

    await openEditOf(user, 'TL-01');

    expect(screen.getByRole('textbox', { name: /툴코드/ })).toBeDisabled();
    expect(screen.getByText(messages.editability.referenced(3))).toBeInTheDocument();
  });

  /* 공장을 옮기는 것은 자산을 옮기는 일이라 이 화면의 일이 아니다 — 계약도 받지 않는다. */
  it('수정에서는 공장을 고르지 않고 읽는다', async () => {
    const { user } = renderScreen();

    await openEditOf(user, 'TL-01');

    expect(within(formDialog()).queryByRole('combobox', { name: /공장/ })).not.toBeInTheDocument();
    expect(within(formDialog()).getByLabelText(t.fields.plant)).toHaveTextContent('제1공장');
    expect(screen.getByText(t.actionReasons.plantFixed)).toBeInTheDocument();
  });

  it('등록에서는 공장을 고른다', async () => {
    const { user } = renderScreen();

    await openCreate(user);

    expect(within(formDialog()).getByRole('combobox', { name: /공장/ })).toBeInTheDocument();
  });

  /* 등록에는 아직 실적도 상태도 없다 — 빈 읽기 전용 칸을 늘어놓지 않는다. */
  it('등록 창에는 읽기 전용 칸을 그리지 않는다', async () => {
    const { user } = renderScreen();

    await openCreate(user);

    expect(screen.queryByLabelText(t.fields.currentShotCount)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(t.fields.lastPmDate)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(t.fields.labelIssueCount)).not.toBeInTheDocument();
  });
});

describe('W-05-13 툴 마스터 — 예방보전 주기 짝', () => {
  /* 감추지 않고 잠그고 사유를 붙인다(G-2) — 사라진 칸은 「원래 없는 것」과 구분되지 않는다. */
  it('날짜 축을 쓰지 않으면 주기 두 칸을 잠그고 사유를 밝힌다', async () => {
    const { user } = renderScreen();

    await openEditOf(user, 'TL-01');

    expect(screen.getByRole('textbox', { name: /예방보전 주기 간격/ })).toBeDisabled();
    expect(screen.getByRole('combobox', { name: /예방보전 주기 단위/ })).toBeDisabled();
    expect(screen.getAllByText(t.actionReasons.cycleNeedsDateAxis).length).toBeGreaterThan(0);
  });

  it('날짜 축을 고르면 주기 두 칸이 열린다', async () => {
    const { user } = renderScreen();

    await openEditOf(user, 'TL-01');
    await user.click(screen.getByRole('combobox', { name: /예방보전 판정 기준/ }));
    await user.click(await screen.findByRole('option', { name: t.pmTrigger.date }));

    expect(screen.getByRole('textbox', { name: /예방보전 주기 간격/ })).toBeEnabled();
    expect(screen.getByRole('combobox', { name: /예방보전 주기 단위/ })).toBeEnabled();
  });

  /*
   * ⭐ **적힌 값을 지우지 않는다** — 다시 날짜 축으로 바꾸면 방금 적은 것이 그대로 있어야 한다.
   * 비우는 자리는 보낼 때 하나다(`toToolUpdate`).
   */
  it('축을 바꿔도 적어 둔 주기를 지우지 않는다', async () => {
    const { user } = renderScreen();

    await openEditOf(user, 'TL-03');
    expect(screen.getByRole('textbox', { name: /예방보전 주기 간격/ })).toHaveValue('6');

    await user.click(screen.getByRole('combobox', { name: /예방보전 판정 기준/ }));
    await user.click(await screen.findByRole('option', { name: t.pmTrigger.none }));

    expect(screen.getByRole('textbox', { name: /예방보전 주기 간격/ })).toHaveValue('6');
  });

  /*
   * ⭐ **막지 않고 알린다.** 「적정타수 없는 것만」 조회 조건이 이 상태를 전제한다 —
   * 다만 타발수로 판정하겠다고 해 놓고 비워 두면 그 축이 서지 않는다는 사실은 말해야 한다.
   */
  it('타발수 축인데 적정타수가 비면 무엇이 서지 않는지 말한다', async () => {
    const { user } = renderScreen();

    await openEditOf(user, 'TL-04');

    expect(screen.getByText(t.notes.guaranteedMissingBlocksShotAxis)).toBeInTheDocument();
  });

  it('적정타수를 채우면 그 안내가 사라진다', async () => {
    const { user } = renderScreen();

    await openEditOf(user, 'TL-04');
    await user.type(screen.getByRole('textbox', { name: /적정타수/ }), '100000');

    expect(screen.queryByText(t.notes.guaranteedMissingBlocksShotAxis)).not.toBeInTheDocument();
  });

  /*
   * 적정타수가 비어 있는 것만으로는 안내를 붙이지 않는다 — 타발수로 판정하지 않는 툴에는
   * 그 축이 서지 않는다는 말이 뜻이 없다. **비었다**와 **비어서 축이 안 선다**는 다른 사실이다.
   */
  it('타발수 축이 아니면 적정타수가 비어도 안내를 붙이지 않는다', async () => {
    const dateOnly = makeTool(7001, 'TL-01', {
      pmTriggerTypeCode: 'DATE',
      pmCycleInterval: 6,
      pmCycleUnitCode: 'MONTH',
    });
    const { user } = renderScreen({
      respondTools: () => jsonResponse(toolsResponse([dateOnly])),
      respondDetail: () => jsonResponse(toolDetail(dateOnly), { headers: { ETag: '9' } }),
    });

    await openEditOf(user, 'TL-01');

    expect(within(formDialog()).getByRole('textbox', { name: /적정타수/ })).toHaveValue('');
    expect(screen.queryByText(t.notes.guaranteedMissingBlocksShotAxis)).not.toBeInTheDocument();
  });

  /*
   * ⭐ **저장된 값이 선택지에 없어도 칸이 비어 보이면 안 된다.** 계약이 좁힌 둘 밖의 단위가
   * 서버 자료에 남아 있을 수 있고, 그때 빼 버리면 사용자가 값이 사라진 줄 알고 다시 고른다 —
   * 원래 값은 그렇게 조용히 바뀐다(W-05-11 에서 브라우저 확인으로 잡혔던 결함과 같은 갈래).
   */
  it('계약 밖 단위가 걸려 있어도 그 값을 보인다', async () => {
    const week = makeTool(7001, 'TL-01', {
      pmTriggerTypeCode: 'DATE',
      pmCycleInterval: 2,
      pmCycleUnitCode: 'WEEK',
    });
    const { user } = renderScreen({
      respondTools: () => jsonResponse(toolsResponse([week])),
      respondDetail: () => jsonResponse(toolDetail(week), { headers: { ETag: '9' } }),
    });

    await openEditOf(user, 'TL-01');

    expect(
      within(formDialog()).getByRole('combobox', { name: /예방보전 주기 단위/ }),
    ).toHaveTextContent('WEEK');
  });

  /* 도구 유형도 같다 — 값 목록이 자리표시뿐이라 저장된 코드는 늘 목록 밖이다. */
  it('저장된 도구 유형이 자리표시 목록에 없어도 그 값을 보인다', async () => {
    const { user } = renderScreen();

    await openEditOf(user, 'TL-01');

    expect(within(formDialog()).getByRole('combobox', { name: /도구 유형/ })).toHaveTextContent(
      'MOLD',
    );
  });

  /* ⛔ 계약이 좁힌 두 값만 낸다 — 고를 수 있는데 저장이 안 되는 선택지는 두지 않는다. */
  it('주기 단위 선택지는 계약이 정한 둘뿐이다', async () => {
    const { user } = renderScreen();

    await openEditOf(user, 'TL-03');
    await user.click(screen.getByRole('combobox', { name: /예방보전 주기 단위/ }));

    const options = await screen.findAllByRole('option');

    expect(options).toHaveLength(2);
    expect(screen.getByRole('option', { name: t.pmCycleUnit.day })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: t.pmCycleUnit.month })).toBeInTheDocument();
  });
});

describe('W-05-13 툴 마스터 — 저장', () => {
  it('등록은 멱등 키만 싣고 잠금 토큰은 싣지 않는다', async () => {
    const { user, writes } = renderScreen();

    await openCreate(user);
    await user.type(screen.getByRole('textbox', { name: /툴코드/ }), 'TL-90');
    await user.type(screen.getByRole('textbox', { name: /툴명/ }), '신규 금형');
    await user.click(within(formDialog()).getByRole('combobox', { name: /공장/ }));
    await user.click(await screen.findByRole('option', { name: '제1공장' }));
    await user.click(screen.getByRole('button', { name: messages.common.save }));

    await waitFor(() => {
      expect(writes.length).toBe(1);
    });

    const request = onlyWrite(writes);

    expect(request.method).toBe('POST');
    expect(request.headers.get('Idempotency-Key')).not.toBeNull();
    expect(request.headers.get('If-Match')).toBeNull();
    expect(await request.json()).toMatchObject({ moldCode: 'TL-90', plantId: 11, cavityCount: 1 });
  });

  /* ⭐ 잠금 토큰은 상세 응답의 ETag 에서 온다 — 목록만으로는 저장을 시작할 수 없다. */
  it('수정은 상세가 준 잠금 토큰을 그대로 싣는다', async () => {
    const { user, writes } = renderScreen();

    await openEditOf(user, 'TL-01');
    await user.click(screen.getByRole('button', { name: messages.common.save }));

    await waitFor(() => {
      expect(writes.length).toBe(1);
    });

    const request = onlyWrite(writes);

    expect(request.method).toBe('PUT');
    expect(request.headers.get('If-Match')).toBe('9');
    expect(request.headers.get('Idempotency-Key')).not.toBeNull();
  });

  it('수정 본문에 공장을 싣지 않는다', async () => {
    const { user, writes } = renderScreen();

    await openEditOf(user, 'TL-01');
    await user.click(screen.getByRole('button', { name: messages.common.save }));

    await waitFor(() => {
      expect(writes.length).toBe(1);
    });

    expect(await onlyWrite(writes).json()).not.toHaveProperty('plantId');
  });

  it('코드가 잠겨 있으면 본문에 코드를 싣지 않는다', async () => {
    const { user, writes } = renderScreen({
      respondDetail: () =>
        jsonResponse(toolDetail(toolNotRequired, { editability: labelIssuedCode }), {
          headers: { ETag: '9' },
        }),
    });

    await openEditOf(user, 'TL-01');
    await user.click(screen.getByRole('button', { name: messages.common.save }));

    await waitFor(() => {
      expect(writes.length).toBe(1);
    });

    expect(await onlyWrite(writes).json()).not.toHaveProperty('moldCode');
  });

  /* 화면에서 잡을 수 있는 것은 보내기 전에 잡는다 — 헛되이 왕복하지 않는다. */
  it('검증에 걸리면 저장이 나가지 않는다', async () => {
    const { user, writes } = renderScreen();

    await openEditOf(user, 'TL-01');
    await user.clear(screen.getByRole('textbox', { name: /툴명/ }));
    await user.click(screen.getByRole('button', { name: messages.common.save }));

    expect(await screen.findByText(t.validation.required)).toBeInTheDocument();
    expect(writes.length).toBe(0);
  });

  it('고치는 순간 그 칸의 오류가 사라진다', async () => {
    const { user } = renderScreen();

    await openEditOf(user, 'TL-01');
    await user.clear(screen.getByRole('textbox', { name: /툴명/ }));
    await user.click(screen.getByRole('button', { name: messages.common.save }));
    await screen.findByText(t.validation.required);

    await user.type(screen.getByRole('textbox', { name: /툴명/ }), '새 이름');

    expect(screen.queryByText(t.validation.required)).not.toBeInTheDocument();
  });

  /*
   * ⭐ **서버가 준 오류도 고치는 순간 낡은 말이 된다.** 로컬 검증만 거두면 서버 오류가 칸에
   * 눌어붙어, 사용자가 이미 고친 값을 두고 「이미 쓰는 코드입니다」가 계속 서 있게 된다.
   */
  it('서버가 준 오류도 그 칸을 고치면 사라진다', async () => {
    const { user } = renderScreen({
      respondWrite: () =>
        jsonResponse(
          {
            errors: [
              { scope: 'field', field: 'moldCode', code: 'DUP', message: '이미 쓰는 코드입니다.' },
            ],
          },
          { status: 400 },
        ),
    });

    await openEditOf(user, 'TL-01');
    await user.click(screen.getByRole('button', { name: messages.common.save }));
    await screen.findByText('이미 쓰는 코드입니다.');

    await user.type(within(formDialog()).getByRole('textbox', { name: /툴코드/ }), '-A');

    expect(screen.queryByText('이미 쓰는 코드입니다.')).not.toBeInTheDocument();
  });

  /* 서버가 준 필드 오류는 그 칸 옆에 선다 — 배너로만 내면 어느 칸을 고쳐야 할지 모른다. */
  it('서버가 준 필드 오류를 그 칸 옆에 낸다', async () => {
    const { user } = renderScreen({
      respondWrite: () =>
        jsonResponse(
          {
            errors: [
              { scope: 'field', field: 'moldCode', code: 'DUP', message: '이미 쓰는 코드입니다.' },
            ],
          },
          { status: 400 },
        ),
    });

    await openEditOf(user, 'TL-01');
    await user.click(screen.getByRole('button', { name: messages.common.save }));

    expect(await screen.findByText('이미 쓰는 코드입니다.')).toBeInTheDocument();
    /* ⭐ **그 칸에 붙었는지까지 본다** — 배너에만 서면 어느 칸을 고쳐야 할지 알 수 없다. */
    expect(within(formDialog()).getByRole('textbox', { name: /툴코드/ })).toBeInvalid();
  });

  /* ⛔ 화면이 모르는 필드명을 버리면 어디에도 표시되지 않는 오류가 생긴다. */
  it('화면이 모르는 필드의 오류는 배너로 올린다', async () => {
    const { user } = renderScreen({
      respondWrite: () =>
        jsonResponse(
          {
            errors: [
              {
                scope: 'field',
                field: 'mysteryField',
                code: 'X',
                message: '알 수 없는 칸이 잘못됐습니다.',
              },
            ],
          },
          { status: 400 },
        ),
    });

    await openEditOf(user, 'TL-01');
    await user.click(screen.getByRole('button', { name: messages.common.save }));

    expect(await screen.findByText('알 수 없는 칸이 잘못됐습니다.')).toBeInTheDocument();
    /* 어느 입력칸에도 붙지 않았다 — 붙일 자리가 없는 오류는 배너가 받는다. */
    expect(within(formDialog()).getByRole('textbox', { name: /툴코드/ })).not.toBeInvalid();
  });

  it('저장에 성공하면 창이 닫히고 목록을 다시 읽는다', async () => {
    const { user, sent } = renderScreen();

    await openEditOf(user, 'TL-01');
    const before = sent.length;
    await user.click(screen.getByRole('button', { name: messages.common.save }));

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
    await waitFor(() => {
      expect(sent.length).toBeGreaterThan(before);
    });
  });
});

const openRetire = async (
  user: ReturnType<typeof userEvent.setup>,
  code: string,
  action: 'deactivate' | 'dispose',
): Promise<void> => {
  await openEditOf(user, code);
  await user.click(
    within(formDialog()).getByRole('button', {
      name: action === 'dispose' ? t.retire.disposeConfirm : t.retire.deactivateConfirm,
    }),
  );
  await screen.findByRole('dialog', {
    name: action === 'dispose' ? t.retire.disposeTitle : t.retire.deactivateTitle,
  });
};

/** 확인 창. 폼 창이 뒤에 남아 있어 **가장 나중에 열린 창**을 고른다. */
const confirmDialog = () => screen.getAllByRole('dialog').at(-1) as HTMLElement;

describe('W-05-13 툴 마스터 — 사용 중지·폐기', () => {
  /* 되돌릴 수 없는 두 조작은 폼 «본문»에 둔다 — 바닥에 두면 저장·취소가 밀려난다. */
  it('수정 창에 두 조작이 선다', async () => {
    const { user } = renderScreen();

    await openEditOf(user, 'TL-01');

    expect(
      within(formDialog()).getByRole('button', { name: t.retire.deactivateConfirm }),
    ).toBeEnabled();
    expect(
      within(formDialog()).getByRole('button', { name: t.retire.disposeConfirm }),
    ).toBeEnabled();
  });

  it('등록 창에는 두 조작이 서지 않는다', async () => {
    const { user } = renderScreen();

    await openCreate(user);

    expect(
      within(formDialog()).queryByRole('button', { name: t.retire.deactivateConfirm }),
    ).not.toBeInTheDocument();
  });

  /* 감추지 않고 잠그고 사유를 붙인다(G-2). */
  it('이미 중지된 툴은 사용 중지를 잠그고 사유를 보인다', async () => {
    const { user } = renderScreen();

    await openEditOf(user, 'TL-06');

    expect(
      within(formDialog()).getByRole('button', { name: t.retire.deactivateConfirm }),
    ).toBeDisabled();
    expect(screen.getByText(t.actionReasons.alreadyInactive)).toBeInTheDocument();
  });

  it('이미 폐기된 툴은 폐기를 잠그고 사유를 보인다', async () => {
    const { user } = renderScreen();

    await openEditOf(user, 'TL-06');

    expect(
      within(formDialog()).getByRole('button', { name: t.retire.disposeConfirm }),
    ).toBeDisabled();
    expect(screen.getByText(t.actionReasons.alreadyDisposed)).toBeInTheDocument();
  });

  /* 폐기 코드값이 없으면 이미 폐기된 자산인지 판정할 수 없다 — 판정 없이 열지 않는다. */
  it('자산 상태 값 목록에 폐기 코드가 없으면 폐기를 잠근다', async () => {
    const { user } = renderScreen({
      respondCodeValues: () =>
        jsonResponse(codeValuesResponse([makeCodeValue('IN_SERVICE', '사용중')])),
    });

    await openEditOf(user, 'TL-01');

    expect(
      within(formDialog()).getByRole('button', { name: t.retire.disposeConfirm }),
    ).toBeDisabled();
    expect(screen.getByText(t.actionReasons.disposeUnavailable)).toBeInTheDocument();
  });

  /*
   * ⭐ **계약이 시킨 것이다** — 「참조가 있으면 확인 문구에 건수를 함께 보인 뒤 부른다」(B-4).
   * 물리 삭제가 없는 자원이라 그 건수가 판단의 근거다.
   */
  it('확인 창이 참조 건수를 함께 보인다', async () => {
    const { user } = renderScreen({
      respondDetail: () =>
        jsonResponse(toolDetail(toolNotRequired, { editability: referencedCode }), {
          headers: { ETag: '9' },
        }),
    });

    await openRetire(user, 'TL-01', 'deactivate');

    expect(within(confirmDialog()).getByText(t.retire.referenceCount(3))).toBeInTheDocument();
  });

  /* ⛔ 모르는 것을 「없다」로 그리지 않는다(G-9). */
  it('참조 건수를 셀 수 없으면 그렇게 말한다', async () => {
    const { user } = renderScreen({
      respondDetail: () =>
        jsonResponse(
          toolDetail(toolNotRequired, {
            editability: { codeEditable: false, reason: 'NOT_COUNTABLE' },
          }),
          { headers: { ETag: '9' } },
        ),
    });

    await openRetire(user, 'TL-01', 'deactivate');

    expect(within(confirmDialog()).getByText(t.retire.referenceUnknown)).toBeInTheDocument();
  });

  /* 라벨은 시스템 «밖»에 나가 있어 회수할 수 없다 — 참조 건수와 다른 축이다. */
  it('라벨이 나가 있으면 확인 창이 그 사실을 함께 말한다', async () => {
    const { user } = renderScreen({
      respondDetail: () =>
        jsonResponse(
          toolDetail(toolNotRequired, { editability: labelIssuedCode, labelIssueCount: 2 }),
          { headers: { ETag: '9' } },
        ),
    });

    await openRetire(user, 'TL-01', 'dispose');

    expect(within(confirmDialog()).getByText(t.retire.labelIssued(2))).toBeInTheDocument();
    expect(within(confirmDialog()).getByText(t.retire.referenceNone)).toBeInTheDocument();
  });

  it('라벨이 나간 적이 없으면 그 줄을 세우지 않는다', async () => {
    const { user } = renderScreen();

    await openRetire(user, 'TL-01', 'dispose');

    expect(within(confirmDialog()).queryByText(/라벨이/)).not.toBeInTheDocument();
  });

  /* 두 처리의 무게가 다르다 — 창이 한 벌을 굳히면 그 차이가 사라진다. */
  it('두 처리가 서로 다른 말을 한다', async () => {
    const { user } = renderScreen();

    await openRetire(user, 'TL-01', 'deactivate');
    expect(
      within(confirmDialog()).getByText(t.retire.deactivateNotReversibleHere),
    ).toBeInTheDocument();
    expect(
      within(confirmDialog()).queryByText(t.retire.disposeNotReversible),
    ).not.toBeInTheDocument();

    await user.click(within(confirmDialog()).getByRole('button', { name: messages.common.cancel }));
    await user.click(within(formDialog()).getByRole('button', { name: t.retire.disposeConfirm }));
    await screen.findByRole('dialog', { name: t.retire.disposeTitle });

    expect(within(confirmDialog()).getByText(t.retire.disposeNotReversible)).toBeInTheDocument();
  });

  it('사용 중지가 잠금 토큰과 멱등 키를 싣고 나간다', async () => {
    const { user, writes } = renderScreen();

    await openRetire(user, 'TL-01', 'deactivate');
    await user.click(
      within(confirmDialog()).getByRole('button', { name: t.retire.deactivateConfirm }),
    );

    await waitFor(() => {
      expect(writes.length).toBe(1);
    });

    const request = onlyWrite(writes);

    expect(new URL(request.url).pathname).toBe('/mdm/molds/7001:deactivate');
    expect(request.headers.get('If-Match')).toBe('9');
    expect(request.headers.get('Idempotency-Key')).not.toBeNull();
  });

  it('폐기가 폐기 경로로 나간다', async () => {
    const { user, writes } = renderScreen();

    await openRetire(user, 'TL-01', 'dispose');
    await user.click(
      within(confirmDialog()).getByRole('button', { name: t.retire.disposeConfirm }),
    );

    await waitFor(() => {
      expect(writes.length).toBe(1);
    });

    expect(new URL(onlyWrite(writes).url).pathname).toBe('/mdm/molds/7001:dispose');
  });

  /* 중지된 툴도 이름·주기는 계속 고칠 수 있다 — 창을 닫을 이유가 없다. */
  it('사용 중지 뒤에는 수정 창을 열어 둔다', async () => {
    const { user } = renderScreen();

    await openRetire(user, 'TL-01', 'deactivate');
    await user.click(
      within(confirmDialog()).getByRole('button', { name: t.retire.deactivateConfirm }),
    );

    await waitFor(() => {
      expect(
        screen.queryByRole('dialog', { name: t.retire.deactivateTitle }),
      ).not.toBeInTheDocument();
    });
    expect(screen.getByRole('dialog', { name: t.form.editTitle })).toBeInTheDocument();
  });

  /*
   * ⛔ **폐기 뒤에는 창도 함께 닫는다.** 폐기된 자산은 편집이 풀리지 않으므로, 열린 폼을
   * 남기면 사용자가 고칠 수 있다고 믿고 치다가 저장에서 거절당한다.
   */
  it('폐기 뒤에는 수정 창도 닫는다', async () => {
    const { user } = renderScreen();

    await openRetire(user, 'TL-01', 'dispose');
    await user.click(
      within(confirmDialog()).getByRole('button', { name: t.retire.disposeConfirm }),
    );

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
  });

  /* 창을 닫지 않고 이유를 보여야 다시 시도할 수 있다. */
  it('실패하면 확인 창을 닫지 않고 이유를 보인다', async () => {
    const { user } = renderScreen({
      respondWrite: () =>
        jsonResponse(
          { errors: [{ scope: 'screen', code: 'LOCKED', message: '지금은 처리할 수 없습니다.' }] },
          { status: 400 },
        ),
    });

    await openRetire(user, 'TL-01', 'dispose');
    await user.click(
      within(confirmDialog()).getByRole('button', { name: t.retire.disposeConfirm }),
    );

    expect(await screen.findByText('지금은 처리할 수 없습니다.')).toBeInTheDocument();
    expect(screen.getByRole('dialog', { name: t.retire.disposeTitle })).toBeInTheDocument();
  });
});
