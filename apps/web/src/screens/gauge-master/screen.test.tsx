import { messages } from '@omf-mes/i18n';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { createStubFetch, jsonResponse, renderWithProviders } from '../../test/api-harness';
import {
  TODAY,
  closedPlant,
  codeValuesResponse,
  cycleCodeValues,
  gaugeDetail,
  gaugeItems,
  gaugeNotRequired,
  gaugeValid,
  gaugesResponse,
  lockedCode,
  makeCodeValue,
  makeGauge,
  pageOf,
  plantItems,
  plantsResponse,
  statusCodeValues,
  uomsResponse,
} from './fixtures';
import { GaugeMasterScreen } from './screen';
import type { Equipment } from './types';

const t = messages.gaugeMaster;

const isPath = (request: Request, pathname: string): boolean =>
  new URL(request.url).pathname === pathname;

interface RenderOptions {
  respondGauges?: (request: Request) => Response;
  respondPlants?: () => Response;
  respondCodeValues?: () => Response;
  respondUoms?: () => Response;
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
    const found = gaugeItems.find((item) => item.equipmentId === idOf(request));

    return found === undefined
      ? jsonResponse({ message: '없는 계측기' }, { status: 404 })
      : jsonResponse(gaugeDetail(found), { headers: { ETag: '9' } });
  };

  const fetch = createStubFetch([
    {
      match: (request) => isPath(request, '/mdm/equipments') && request.method !== 'GET',
      respond: (request) => {
        writes.push(request.clone());
        return (options.respondWrite ?? (() => jsonResponse(gaugeNotRequired)))(request);
      },
    },
    {
      match: (request) => isPath(request, '/mdm/equipments'),
      respond: (request) => {
        sent.push(new URL(request.url));
        return (options.respondGauges ?? (() => jsonResponse(gaugesResponse())))(request);
      },
    },
    {
      match: (request) =>
        new URL(request.url).pathname.startsWith('/mdm/equipments/') && request.method !== 'GET',
      respond: (request) => {
        writes.push(request.clone());
        return (options.respondWrite ?? (() => jsonResponse(gaugeNotRequired)))(request);
      },
    },
    {
      match: (request) => new URL(request.url).pathname.startsWith('/mdm/equipments/'),
      respond: (request) => (options.respondDetail ?? defaultDetail)(request),
    },
    {
      match: (request) => isPath(request, '/mdm/uoms'),
      respond: () => (options.respondUoms ?? (() => jsonResponse(uomsResponse())))(),
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
        const url = new URL(request.url);
        codeValueSent.push(url);

        if (options.respondCodeValues !== undefined) return options.respondCodeValues();

        return jsonResponse(
          codeValuesResponse(
            url.searchParams.get('codeGroupCode') === 'CYCLE_TYPE'
              ? cycleCodeValues
              : statusCodeValues,
          ),
        );
      },
    },
  ]);

  const user = userEvent.setup();
  const view = renderWithProviders(<GaugeMasterScreen today={TODAY} />, { fetch });

  return { ...view, user, sent, codeValueSent, plantSent, writes };
};

const listPane = () => screen.getByRole('region', { name: t.title });

const rowOf = async (code: string) => {
  const cell = await screen.findByRole('cell', { name: code });
  return cell.closest('tr') as HTMLElement;
};

describe('W-05-11 계측기 마스터 — 목록', () => {
  it('계측기를 조회해 목록에 보인다', async () => {
    renderScreen();

    expect(await screen.findByRole('cell', { name: 'GA-01' })).toBeInTheDocument();
    expect(screen.getByRole('cell', { name: 'GA-04' })).toBeInTheDocument();
  });

  /*
   * ⭐ 이 화면의 본론 — 네 모양이 **서로 다른 말**로 선다.
   * 「아직 안 함」이 「대상 아님」과 같은 말이면 채워야 할 것이 정상으로 보인다.
   */
  it('검교정을 네 모양으로 갈라 그린다 — 대상 아님·이력 없음·유효·만료', async () => {
    renderScreen();

    expect(within(await rowOf('GA-01')).getByText(t.calibration.notRequired)).toBeInTheDocument();
    expect(within(await rowOf('GA-02')).getByText(t.calibration.never)).toBeInTheDocument();
    expect(within(await rowOf('GA-03')).getByText(t.calibration.valid(26))).toBeInTheDocument();
    expect(within(await rowOf('GA-04')).getByText(t.calibration.expired(37))).toBeInTheDocument();
  });

  it('「대상 아님」과 「이력 없음」은 다른 말이다', () => {
    expect(t.calibration.notRequired).not.toBe(t.calibration.never);
  });

  it('운용상태 코드를 이름으로 푼다', async () => {
    renderScreen();

    expect(within(await rowOf('GA-01')).getByText('사용중')).toBeInTheDocument();
  });

  it('코드 그룹을 이름으로 부른다 — 정수 식별자를 싣지 않는다', async () => {
    const { codeValueSent } = renderScreen();

    await screen.findByRole('cell', { name: 'GA-01' });

    expect(codeValueSent.map((url) => url.searchParams.get('codeGroupCode'))).toContain(
      'EQUIPMENT_STATUS',
    );
    expect(codeValueSent.every((url) => url.searchParams.get('codeGroupId') === null)).toBe(true);
  });

  it('이름을 못 푸는 상태 코드는 코드를 그대로 보인다', async () => {
    renderScreen({
      respondGauges: () =>
        jsonResponse(gaugesResponse([makeGauge(3009, 'GA-09', { statusCode: 'MYSTERY' })])),
    });

    expect(within(await rowOf('GA-09')).getByText('MYSTERY')).toBeInTheDocument();
  });

  /*
   * ⛔ 이름 풀이표를 `isActive` 로 거르면 **쓰지 않기로 한 코드값을 가진 자산의 이름이 사라진다.**
   * 좁힘은 «고를 목록» 한 자리에만 건다.
   */
  it('쓰지 않기로 한 상태 코드도 이름으로 푼다', async () => {
    renderScreen({
      respondGauges: () =>
        jsonResponse(gaugesResponse([makeGauge(3010, 'GA-10', { statusCode: 'RETIRED_CODE' })])),
    });

    expect(within(await rowOf('GA-10')).getByText('쓰지 않는 상태')).toBeInTheDocument();
  });

  /* ⛔ 이름이 비었다고 빈 칸을 그리지 않는다 — 코드라도 있어야 무엇인지 알 수 있다. */
  it('상태 코드의 이름이 비면 코드를 그대로 보인다', async () => {
    renderScreen({
      respondGauges: () =>
        jsonResponse(gaugesResponse([makeGauge(3012, 'GA-12', { statusCode: 'BLANK_NAME' })])),
      respondCodeValues: () =>
        jsonResponse(codeValuesResponse([makeCodeValue('BLANK_NAME', '   ')])),
    });

    expect(within(await rowOf('GA-12')).getByText('BLANK_NAME')).toBeInTheDocument();
  });

  it('공장을 이름으로 보인다', async () => {
    renderScreen();

    expect(within(await rowOf('GA-01')).getByText('제1공장')).toBeInTheDocument();
  });

  /*
   * 이름을 풀려면 문 닫은 공장까지 받아 와야 한다 — 받지 않으면 이름 자리에 번호가 선다.
   * ⭐ 좁힘은 «고를 목록» 한 자리에만 걸고, 조회에는 걸지 않는다.
   */
  it('공장을 받아 올 때 문 닫은 것까지 함께 받는다', async () => {
    const { plantSent } = renderScreen();

    await screen.findByRole('cell', { name: 'GA-01' });

    expect(plantSent.at(-1)?.searchParams.get('includeInactive')).toBe('true');
  });

  it('문 닫은 공장의 이름도 목록에 그대로 보인다', async () => {
    renderScreen({
      respondPlants: () => jsonResponse(plantsResponse([...plantItems, closedPlant])),
      respondGauges: () =>
        jsonResponse(gaugesResponse([makeGauge(3011, 'GA-11', { plantId: 13 })])),
    });

    expect(within(await rowOf('GA-11')).getByText('제3공장')).toBeInTheDocument();
  });

  /* 좁힘은 «고를 목록» 한 자리에만 건다 — 이름 풀이와 고를 목록이 다른 규율을 쓴다. */
  it('문 닫은 공장은 고를 목록에 내지 않는다', async () => {
    const { user } = renderScreen({
      respondPlants: () => jsonResponse(plantsResponse([...plantItems, closedPlant])),
    });

    await screen.findByRole('cell', { name: 'GA-01' });
    await user.click(within(listPane()).getByRole('combobox', { name: t.fields.plant }));

    expect(await screen.findByRole('option', { name: '제1공장' })).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: /제3공장/ })).not.toBeInTheDocument();
  });

  /*
   * ⭐ 계측기 유형 값 목록이 아직 없다(설계 질의 omf-mes#195).
   * 자리표시 값으로 걸러 목록이 늘 비면 화면이 통째로 죽는다.
   */
  it('유형 값 목록이 없으면 유형 조건을 싣지 않는다', async () => {
    const { sent } = renderScreen();

    await screen.findByRole('cell', { name: 'GA-01' });

    expect(sent.every((url) => url.searchParams.get('equipmentTypeCode') === null)).toBe(true);
  });

  it('전체 설비가 보이고 있다는 사실을 밝힌다', async () => {
    renderScreen();

    expect(await screen.findByText(t.typeFilterUnavailable)).toBeInTheDocument();
  });

  /* ⛔ 검교정 여부로 거르면 검교정을 안 하는 계측기가 사라진다 — 다른 축이다. */
  it('검교정 여부를 조회 조건으로 싣지 않는다', async () => {
    const { sent } = renderScreen();

    await screen.findByRole('cell', { name: 'GA-01' });

    expect(sent.every((url) => url.searchParams.get('calibrationRequired') === null)).toBe(true);
  });

  it('기본은 사용 중인 자산만 조회한다', async () => {
    const { sent } = renderScreen();

    await screen.findByRole('cell', { name: 'GA-01' });

    expect(sent.at(-1)?.searchParams.get('statusCode')).toBe('IN_SERVICE');
  });

  it('폐기 포함을 켜면 자산 상태 조건을 뺀다', async () => {
    const { user, sent } = renderScreen();

    await screen.findByRole('cell', { name: 'GA-01' });
    await user.click(within(listPane()).getByRole('checkbox', { name: t.filters.includeDisposed }));

    await waitFor(() => {
      expect(sent.at(-1)?.searchParams.get('statusCode')).toBeNull();
    });
  });

  /*
   * ⛔ **모아서 내는 조건이 즉시 적용된 조건을 되돌리면 안 된다.**
   * 검색칸은 「조회」를 눌러야 나가고 체크칸은 바꾸는 즉시 나간다 — 두 축이 한 벌을 공유하면
   * 나중에 누른 쪽이 앞서 켠 것을 조용히 끈다.
   */
  it('폐기 포함을 켠 뒤 검색어로 조회해도 폐기 포함이 유지된다', async () => {
    const { user, sent } = renderScreen();

    await screen.findByRole('cell', { name: 'GA-01' });
    await user.click(within(listPane()).getByRole('checkbox', { name: t.filters.includeDisposed }));

    await waitFor(() => {
      expect(sent.at(-1)?.searchParams.get('statusCode')).toBeNull();
    });

    await user.type(within(listPane()).getByLabelText(t.filters.searchLabel), '캘리퍼');
    await user.click(within(listPane()).getByRole('button', { name: messages.common.search }));

    await waitFor(() => {
      expect(sent.at(-1)?.searchParams.get('q')).toBe('캘리퍼');
    });
    expect(sent.at(-1)?.searchParams.get('statusCode')).toBeNull();
    expect(
      within(listPane()).getByRole('checkbox', { name: t.filters.includeDisposed }),
    ).toBeChecked();
  });

  /*
   * 밖에서 조건이 되돌려지면(초기화·칩 제거) **입력칸도 따라가야 한다.**
   * 칸에 옛 낱말이 남아 있으면 목록과 칸이 어긋나고, 다음에 「조회」를 누르는 순간
   * 지운 줄 알았던 조건이 되살아난다.
   */
  it('칩으로 검색어를 거두면 검색칸도 함께 비워진다', async () => {
    const { user } = renderScreen();

    await screen.findByRole('cell', { name: 'GA-01' });

    const box = within(listPane()).getByLabelText(t.filters.searchLabel);
    await user.type(box, '캘리퍼{Enter}');

    await user.click(await screen.findByRole('button', { name: t.filters.chipRemoveKeyword }));

    await waitFor(() => {
      expect(box).toHaveValue('');
    });
  });

  /*
   * ⛔ **아직 적용하지 않은 입력도 초기화가 거둬야 한다.**
   * 적용된 값을 보고 칸을 맞추는 것만으로는 부족하다 — 적용된 값이 이미 비어 있으면
   * 「달라진 것이 없다」가 되어 칸에 남은 낱말을 아무도 지우지 않는다. 그 상태로 「조회」를
   * 누르면 초기화한 줄 알았던 조건이 되살아난다. (브라우저 확인에서 잡힌 자리)
   */
  it('적용하지 않은 입력도 초기화가 거둔다', async () => {
    const { user } = renderScreen();

    await screen.findByRole('cell', { name: 'GA-01' });

    const box = within(listPane()).getByLabelText(t.filters.searchLabel);
    await user.type(box, '게이지');
    expect(box).toHaveValue('게이지');

    await user.click(within(listPane()).getByRole('button', { name: messages.common.reset }));

    await waitFor(() => {
      expect(box).toHaveValue('');
    });
  });

  it('검색어를 서버 조건으로 싣는다', async () => {
    const { user, sent } = renderScreen();

    await screen.findByRole('cell', { name: 'GA-01' });
    await user.type(within(listPane()).getByLabelText(t.filters.searchLabel), '캘리퍼{Enter}');

    await waitFor(() => {
      expect(sent.at(-1)?.searchParams.get('q')).toBe('캘리퍼');
    });
  });

  /* ⚠ 밀림 조건은 계약에 없다 — 「만료」가 저장된 값이 아니라 화면 판정이라 그렇다. */
  it('밀림 조건은 이력 없음과 만료를 함께 남긴다', async () => {
    const { user } = renderScreen();

    await screen.findByRole('cell', { name: 'GA-01' });
    await user.click(within(listPane()).getByRole('checkbox', { name: t.filters.overdueOnly }));

    await waitFor(() => {
      expect(screen.queryByRole('cell', { name: 'GA-01' })).not.toBeInTheDocument();
    });
    expect(screen.getByRole('cell', { name: 'GA-02' })).toBeInTheDocument();
    expect(screen.queryByRole('cell', { name: 'GA-03' })).not.toBeInTheDocument();
    expect(screen.getByRole('cell', { name: 'GA-04' })).toBeInTheDocument();
  });

  it('밀림 조건을 서버로 보내지 않는다 — 화면이 판정한다', async () => {
    const { user, sent } = renderScreen();

    await screen.findByRole('cell', { name: 'GA-01' });
    await user.click(within(listPane()).getByRole('checkbox', { name: t.filters.overdueOnly }));

    await waitFor(() => {
      expect(screen.queryByRole('cell', { name: 'GA-01' })).not.toBeInTheDocument();
    });
    expect(sent.every((url) => url.searchParams.get('overdueOnly') === null)).toBe(true);
  });

  /*
   * ⭐ 목록이 잘린 채로 화면에서 거르면 잘려 나간 쪽의 밀린 계측기가 없는 것처럼 보인다.
   * 감추지 않고 밝힌다.
   */
  it('목록이 잘린 채 밀림 조건을 걸면 그 조건이 불러온 것만 덮는다고 알린다', async () => {
    const truncated = (items: Equipment[]) => ({ items, page: pageOf(items, 99) });
    const { user } = renderScreen({ respondGauges: () => jsonResponse(truncated(gaugeItems)) });

    await screen.findByRole('cell', { name: 'GA-01' });
    expect(screen.queryByText(t.overdueOnLoadedOnly)).not.toBeInTheDocument();

    await user.click(within(listPane()).getByRole('checkbox', { name: t.filters.overdueOnly }));

    expect(await screen.findByText(t.overdueOnLoadedOnly)).toBeInTheDocument();
  });

  it('목록이 잘리지 않았으면 밀림 안내를 세우지 않는다', async () => {
    const { user } = renderScreen();

    await screen.findByRole('cell', { name: 'GA-01' });
    await user.click(within(listPane()).getByRole('checkbox', { name: t.filters.overdueOnly }));

    await waitFor(() => {
      expect(screen.queryByRole('cell', { name: 'GA-01' })).not.toBeInTheDocument();
    });
    expect(screen.queryByText(t.overdueOnLoadedOnly)).not.toBeInTheDocument();
  });

  it('목록이 잘리면 전체 건수와 표시 건수를 알린다', async () => {
    renderScreen({
      respondGauges: () => jsonResponse({ items: gaugeItems, page: pageOf(gaugeItems, 99) }),
    });

    expect(await screen.findByText(t.listTruncated(4, 99))).toBeInTheDocument();
  });

  it('조회가 실패하면 다시 시도할 자리와 함께 알린다', async () => {
    renderScreen({ respondGauges: () => jsonResponse({ message: '서버 오류' }, { status: 500 }) });

    expect(await screen.findByText(messages.httpError.loadTitle)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: messages.common.retry })).toBeInTheDocument();
  });

  it('조건에 맞는 것이 없으면 조건을 되돌릴 자리를 준다', async () => {
    const { user } = renderScreen({ respondGauges: () => jsonResponse(gaugesResponse([])) });

    await user.click(within(listPane()).getByRole('checkbox', { name: t.filters.includeDisposed }));

    expect(await screen.findByText(t.empty.noMatchTitle)).toBeInTheDocument();
  });

  it('조건이 없는데 비었으면 조건 탓으로 돌리지 않는다', async () => {
    renderScreen({ respondGauges: () => jsonResponse(gaugesResponse([])) });

    expect(await screen.findByText(t.empty.noneTitle)).toBeInTheDocument();
    expect(screen.queryByText(t.empty.noMatchTitle)).not.toBeInTheDocument();
  });

  it('건 조건을 칩으로 보이고 칩에서 거둘 수 있다', async () => {
    const { user, sent } = renderScreen();

    await screen.findByRole('cell', { name: 'GA-01' });
    await user.click(within(listPane()).getByRole('checkbox', { name: t.filters.includeDisposed }));

    /* 조건을 걸면 그것을 거둘 자리가 함께 선다 — 어디서 걸었는지 잊어도 되돌릴 수 있다. */
    const remove = await screen.findByRole('button', {
      name: t.filters.chipRemoveIncludeDisposed,
    });

    await user.click(remove);

    await waitFor(() => {
      expect(sent.at(-1)?.searchParams.get('statusCode')).toBe('IN_SERVICE');
    });
  });

  it('선택 목록 조회가 실패해도 목록은 선다', async () => {
    renderScreen({ respondPlants: () => jsonResponse({ message: '서버 오류' }, { status: 500 }) });

    expect(await screen.findByRole('cell', { name: 'GA-01' })).toBeInTheDocument();
    expect(screen.getByText(t.optionsLoadFailed)).toBeInTheDocument();
  });
});

describe('W-05-11 계측기 마스터 — 등록·수정', () => {
  const form = () => screen.getByRole('dialog');

  const openEdit = async (user: ReturnType<typeof userEvent.setup>, code: string) => {
    await user.click(await screen.findByRole('button', { name: code }));
    return screen.findByRole('dialog');
  };

  it('코드를 누르면 수정 창이 열린다', async () => {
    const { user } = renderScreen();

    await openEdit(user, 'GA-03');

    expect(within(form()).getByLabelText(/계측기번호/)).toHaveValue('GA-03');
  });

  it('등록 창은 빈 값으로 연다', async () => {
    const { user } = renderScreen();

    await screen.findByRole('cell', { name: 'GA-01' });
    await user.click(within(listPane()).getByRole('button', { name: t.actions.addGauge }));

    expect(within(form()).getByLabelText(/계측기번호/)).toHaveValue('');
  });

  /* ⭐ 이 화면의 본론 — 형제 화면은 이 두 칸을 읽기만 한다. */
  it('검교정 주기를 이 화면에서 고친다', async () => {
    const { user } = renderScreen();

    await openEdit(user, 'GA-03');

    expect(within(form()).getByLabelText(/검교정 주기 간격/)).toBeEnabled();
    expect(within(form()).getByRole('combobox', { name: /검교정 주기 단위/ })).toBeEnabled();
  });

  it('정밀도도 이 화면에서 고친다', async () => {
    const { user } = renderScreen();

    await openEdit(user, 'GA-03');

    expect(within(form()).getByLabelText('정밀도')).toBeEnabled();
  });

  /* 대상이 아니면 주기는 뜻이 없다 — 감추지 않고 잠그고 사유를 붙인다(G-2). */
  it('검교정 대상이 아니면 주기 칸을 잠그고 사유를 밝힌다', async () => {
    const { user } = renderScreen();

    await openEdit(user, 'GA-01');

    expect(within(form()).getByLabelText(/검교정 주기 간격/)).toBeDisabled();
    expect(within(form()).getByRole('combobox', { name: /검교정 주기 단위/ })).toBeDisabled();
    expect(
      within(form()).getAllByText(t.actionReasons.cycleNeedsCalibration).length,
    ).toBeGreaterThan(0);
  });

  /*
   * ⛔ 형제 화면은 「주기 없이 켜면 거절당한다」는 이유로 켜기를 잠근다.
   * 여기서는 켜는 즉시 주기 칸이 열리므로 잠그면 검교정을 시작할 수가 없다.
   */
  it('검교정 대상을 켜면 주기 칸이 열린다', async () => {
    const { user } = renderScreen();

    await openEdit(user, 'GA-01');

    const toggle = within(form()).getByRole('switch', { name: /검교정 대상/ });
    expect(toggle).toBeEnabled();

    await user.click(toggle);

    expect(within(form()).getByLabelText(/검교정 주기 간격/)).toBeEnabled();
  });

  it('검교정 대상인데 주기를 비우면 저장하지 않고 짝을 요구한다', async () => {
    const { user, writes } = renderScreen();

    await openEdit(user, 'GA-01');
    await user.click(within(form()).getByRole('switch', { name: /검교정 대상/ }));
    await user.click(within(form()).getByRole('button', { name: messages.common.save }));

    expect(
      await within(form()).findAllByText(messages.gaugeMaster.validation.cycleRequired),
    ).toHaveLength(2);
    expect(writes).toHaveLength(0);
  });

  it('정밀도 값만 넣으면 단위를 요구한다', async () => {
    const { user, writes } = renderScreen();

    await openEdit(user, 'GA-01');
    await user.type(within(form()).getByLabelText('정밀도'), '0.01');
    await user.click(within(form()).getByRole('button', { name: messages.common.save }));

    expect(
      await within(form()).findByText(messages.gaugeMaster.validation.precisionUomRequired),
    ).toBeInTheDocument();
    expect(writes).toHaveLength(0);
  });

  it('고친 것을 저장하면 잠금 토큰과 멱등 키를 실어 보낸다', async () => {
    const { user, writes } = renderScreen();

    await openEdit(user, 'GA-03');
    await user.clear(within(form()).getByLabelText(/계측기명/));
    await user.type(within(form()).getByLabelText(/계측기명/), '새 이름');
    await user.click(within(form()).getByRole('button', { name: messages.common.save }));

    await waitFor(() => {
      expect(writes).toHaveLength(1);
    });
    expect(onlyWrite(writes).method).toBe('PUT');
    expect(onlyWrite(writes).headers.get('If-Match')).toBe('9');
    expect(onlyWrite(writes).headers.get('Idempotency-Key')).not.toBeNull();
  });

  /* ⭐ 전체 교체다 — 빼면 설비 마스터가 정한 소속이 지워진다. */
  it('보이지 않는 소속을 그대로 되돌려 보낸다', async () => {
    const withGroup = makeGauge(3020, 'GA-20', {
      productionLineId: 501,
      processId: 601,
      calibrationRequired: true,
      calibrationCycleTypeCode: 'MONTH',
      calibrationCycleInterval: 12,
    });
    const { user, writes } = renderScreen({
      respondGauges: () => jsonResponse(gaugesResponse([withGroup])),
      respondDetail: () => jsonResponse(gaugeDetail(withGroup), { headers: { ETag: '9' } }),
    });

    await openEdit(user, 'GA-20');
    await user.clear(within(form()).getByLabelText(/계측기명/));
    await user.type(within(form()).getByLabelText(/계측기명/), '새 이름');
    await user.click(within(form()).getByRole('button', { name: messages.common.save }));

    await waitFor(() => {
      expect(writes).toHaveLength(1);
    });

    const body = (await onlyWrite(writes).json()) as Record<string, unknown>;
    expect(body.productionLineId).toBe(501);
    expect(body.processId).toBe(601);
  });

  it('검교정 대상을 끄면 주기를 비워 보낸다', async () => {
    const cycled = makeGauge(3021, 'GA-21', {
      calibrationRequired: true,
      calibrationCycleTypeCode: 'MONTH',
      calibrationCycleInterval: 12,
    });
    const { user, writes } = renderScreen({
      respondGauges: () => jsonResponse(gaugesResponse([cycled])),
      respondDetail: () => jsonResponse(gaugeDetail(cycled), { headers: { ETag: '9' } }),
    });

    await openEdit(user, 'GA-21');
    await user.click(within(form()).getByRole('switch', { name: /검교정 대상/ }));
    await user.click(within(form()).getByRole('button', { name: messages.common.save }));

    await waitFor(() => {
      expect(writes).toHaveLength(1);
    });

    const body = (await onlyWrite(writes).json()) as Record<string, unknown>;
    expect(body.calibrationRequired).toBe(false);
    expect(body.calibrationCycleTypeCode).toBeNull();
    expect(body.calibrationCycleInterval).toBeNull();
  });

  it('코드가 잠겼으면 칸을 잠그고 사유를 밝히며 본문에서도 뺀다', async () => {
    const { user, writes } = renderScreen({
      respondDetail: () =>
        jsonResponse(gaugeDetail(gaugeNotRequired, { editability: lockedCode }), {
          headers: { ETag: '9' },
        }),
    });

    await openEdit(user, 'GA-01');

    await waitFor(() => {
      expect(within(form()).getByLabelText(/계측기번호/)).toBeDisabled();
    });

    await user.clear(within(form()).getByLabelText(/계측기명/));
    await user.type(within(form()).getByLabelText(/계측기명/), '새 이름');
    await user.click(within(form()).getByRole('button', { name: messages.common.save }));

    await waitFor(() => {
      expect(writes).toHaveLength(1);
    });
    expect(await onlyWrite(writes).json()).not.toHaveProperty('equipmentCode');
  });

  /* 공장을 옮기는 것은 자산을 옮기는 일이다 — 계약도 수정 본문에 받지 않는다. */
  it('수정에서 공장은 고를 수 없고 사유가 붙는다', async () => {
    const { user } = renderScreen();

    await openEdit(user, 'GA-01');

    expect(within(form()).queryByRole('combobox', { name: /공장/ })).not.toBeInTheDocument();
    expect(within(form()).getByText(t.actionReasons.plantFixed)).toBeInTheDocument();
  });

  it('등록에서는 공장을 고른다', async () => {
    const { user } = renderScreen();

    await screen.findByRole('cell', { name: 'GA-01' });
    await user.click(within(listPane()).getByRole('button', { name: t.actions.addGauge }));

    expect(within(form()).getByRole('combobox', { name: /공장/ })).toBeInTheDocument();
  });

  /* ⭐ 검교정 «일자»는 이 화면이 정하지 않는다 — 주기와 헷갈리기 쉬워 사유를 붙인다. */
  it('검교정 일자는 읽기만 하고 사유를 밝힌다', async () => {
    const { user } = renderScreen();

    await openEdit(user, 'GA-03');

    await waitFor(() => {
      expect(within(form()).getByText('2026-01-05')).toBeInTheDocument();
    });
    expect(
      within(form()).getByText(t.actionReasons.calibrationDateOwnedElsewhere),
    ).toBeInTheDocument();
    /* 잠긴 입력칸이 아니라 값 표기다 — 잠긴 칸은 「언젠가 여기서 고친다」를 뜻한다. */
    expect(
      within(form()).queryByRole('textbox', { name: /최근 검교정일/ }),
    ).not.toBeInTheDocument();
  });

  it('검교정 이력이 없으면 빈칸이 아니라 「기록 없음」이라 말한다', async () => {
    const { user } = renderScreen();

    await openEdit(user, 'GA-02');

    await waitFor(() => {
      expect(within(form()).getAllByText(t.fields.notRecorded).length).toBeGreaterThan(0);
    });
  });

  /* 고른 단위가 허용하는 자릿수를 넘기면 서버가 잘라 적은 것과 다른 값이 저장된다. */
  it('단위가 허용하는 소수 자릿수를 넘으면 막는다', async () => {
    const { user, writes } = renderScreen();

    await openEdit(user, 'GA-01');
    await user.type(within(form()).getByLabelText('정밀도'), '0.001');
    await user.click(within(form()).getByRole('combobox', { name: /정밀도 단위/ }));
    await user.click(await screen.findByRole('option', { name: '밀리미터' }));
    await user.click(within(form()).getByRole('button', { name: messages.common.save }));

    expect(
      await within(form()).findByText(messages.gaugeMaster.validation.precisionScale(2)),
    ).toBeInTheDocument();
    expect(writes).toHaveLength(0);
  });

  it('주기 단위 선택지를 공통코드에서 채운다', async () => {
    const { user } = renderScreen();

    await openEdit(user, 'GA-03');
    await user.click(within(form()).getByRole('combobox', { name: /검교정 주기 단위/ }));

    expect(await screen.findByRole('option', { name: '개월' })).toBeInTheDocument();
  });

  /*
   * ⛔ 코드값 시드가 아직 없거나(설계 omf-mes#182) 쓰지 않기로 한 값이 자료에 남아 있으면
   * 선택칸이 **자리표시만 보여 값이 없는 것처럼 보인다.** 사용자는 지워진 줄 알고 다시 고르고,
   * 원래 값은 그렇게 조용히 바뀐다. (브라우저 확인에서 잡힌 자리)
   */
  it('걸려 있는 주기 단위가 코드 목록에 없어도 칸이 그 값을 보인다', async () => {
    const { user } = renderScreen({
      respondCodeValues: () =>
        jsonResponse(codeValuesResponse([makeCodeValue('OTHER', '다른 값')])),
    });

    await openEdit(user, 'GA-03');
    await user.click(within(form()).getByRole('combobox', { name: /검교정 주기 단위/ }));

    expect(await screen.findByRole('option', { name: 'MONTH' })).toBeInTheDocument();
  });

  /* 세 선택칸(공장·주기 단위·정밀도 단위)이 같은 규율을 쓴다 — 걸린 값을 감추지 않는다. */
  it('걸려 있는 정밀도 단위가 목록에 없어도 칸이 그 값을 보인다', async () => {
    const gauge = makeGauge(3030, 'GA-30', { precisionValue: 0.5, precisionUomId: 9999 });
    const { user } = renderScreen({
      respondGauges: () => jsonResponse(gaugesResponse([gauge])),
      respondDetail: () => jsonResponse(gaugeDetail(gauge), { headers: { ETag: '9' } }),
    });

    await openEdit(user, 'GA-30');
    await user.click(within(form()).getByRole('combobox', { name: /정밀도 단위/ }));

    expect(await screen.findByRole('option', { name: '9999' })).toBeInTheDocument();
  });

  it('주기 단위 코드 그룹을 이름으로 부른다', async () => {
    const { user, codeValueSent } = renderScreen();

    await openEdit(user, 'GA-03');

    await waitFor(() => {
      expect(codeValueSent.map((url) => url.searchParams.get('codeGroupCode'))).toContain(
        'CYCLE_TYPE',
      );
    });
  });

  it('고치는 순간 그 칸의 오류를 거둔다', async () => {
    const { user } = renderScreen();

    await openEdit(user, 'GA-01');
    await user.clear(within(form()).getByLabelText(/계측기명/));
    await user.click(within(form()).getByRole('button', { name: messages.common.save }));

    expect(
      await within(form()).findByText(messages.gaugeMaster.validation.required),
    ).toBeInTheDocument();

    await user.type(within(form()).getByLabelText(/계측기명/), '새 이름');

    await waitFor(() => {
      expect(
        within(form()).queryByText(messages.gaugeMaster.validation.required),
      ).not.toBeInTheDocument();
    });
  });

  /*
   * ⭐ 확인 창과 이유가 다르다 — 저쪽은 되돌릴 수 없는 조작을 지키고, 이쪽은 **사용자가 친 값**을
   * 지킨다. 스크림 한 번에 입력이 통째로 사라지는 것은 말없는 유실이다.
   */
  it('스크림을 눌러도 창이 닫히지 않는다 — 친 값을 지킨다', async () => {
    const { user } = renderScreen();

    await openEdit(user, 'GA-01');
    await user.type(within(form()).getByLabelText(/계측기명/), '더 적는 중');

    fireEvent.click(screen.getByRole('dialog'));

    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('저장이 실패하면 창을 닫지 않고 알린다', async () => {
    const { user } = renderScreen({
      respondWrite: () => jsonResponse({ message: '서버 오류' }, { status: 500 }),
    });

    await openEdit(user, 'GA-03');
    await user.clear(within(form()).getByLabelText(/계측기명/));
    await user.type(within(form()).getByLabelText(/계측기명/), '새 이름');
    await user.click(within(form()).getByRole('button', { name: messages.common.save }));

    expect(await screen.findByText(messages.httpError.description)).toBeInTheDocument();
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('서버가 준 필드 오류를 그 칸 옆에 낸다', async () => {
    const { user } = renderScreen({
      respondWrite: () =>
        jsonResponse(
          {
            errors: [
              {
                scope: 'field',
                field: 'equipmentCode',
                code: 'DUPLICATE',
                message: '이미 있는 번호입니다.',
              },
            ],
          },
          { status: 400 },
        ),
    });

    await openEdit(user, 'GA-03');
    await user.clear(within(form()).getByLabelText(/계측기명/));
    await user.type(within(form()).getByLabelText(/계측기명/), '새 이름');
    await user.click(within(form()).getByRole('button', { name: messages.common.save }));

    expect(await within(form()).findByText('이미 있는 번호입니다.')).toBeInTheDocument();
  });

  /* 서버가 준 오류도 그 칸을 고치면 낡은 말이 된다 — 로컬 오류만 거두면 반쪽이다. */
  it('서버가 준 필드 오류도 그 칸을 고치면 거둔다', async () => {
    const { user } = renderScreen({
      respondWrite: () =>
        jsonResponse(
          {
            errors: [
              {
                scope: 'field',
                field: 'equipmentCode',
                code: 'DUPLICATE',
                message: '이미 있는 번호입니다.',
              },
            ],
          },
          { status: 400 },
        ),
    });

    await openEdit(user, 'GA-03');
    await user.click(within(form()).getByRole('button', { name: messages.common.save }));

    expect(await within(form()).findByText('이미 있는 번호입니다.')).toBeInTheDocument();

    await user.type(within(form()).getByLabelText(/계측기번호/), '9');

    await waitFor(() => {
      expect(within(form()).queryByText('이미 있는 번호입니다.')).not.toBeInTheDocument();
    });
  });

  /* 등록에는 낙관적 잠금이 없다 — 아직 아무도 고칠 수 없는 것에 「누가 먼저 고쳤나」는 없다. */
  it('등록은 POST 로 나가고 잠금 토큰을 싣지 않는다', async () => {
    const { user, writes } = renderScreen();

    await screen.findByRole('cell', { name: 'GA-01' });
    await user.click(within(listPane()).getByRole('button', { name: t.actions.addGauge }));

    await user.type(within(form()).getByLabelText(/계측기번호/), 'GA-77');
    await user.type(within(form()).getByLabelText(/계측기명/), '새 계측기');
    await user.click(within(form()).getByRole('combobox', { name: /공장/ }));
    await user.click(await screen.findByRole('option', { name: '제1공장' }));
    await user.click(within(form()).getByRole('button', { name: messages.common.save }));

    await waitFor(() => {
      expect(writes).toHaveLength(1);
    });

    const request = onlyWrite(writes);
    expect(request.method).toBe('POST');
    expect(request.headers.get('If-Match')).toBeNull();
    expect(request.headers.get('Idempotency-Key')).not.toBeNull();

    const body = (await request.json()) as Record<string, unknown>;
    expect(body.plantId).toBe(11);
    expect(body.equipmentCode).toBe('GA-77');
  });

  /* 저장하고 나면 목록이 옛 값을 그리고 있으면 안 된다 — 무효화가 그것을 막는다. */
  it('저장이 끝나면 목록을 다시 읽는다', async () => {
    let saved = false;
    const { user } = renderScreen({
      respondGauges: () =>
        jsonResponse(
          gaugesResponse([
            saved ? makeGauge(3003, 'GA-03', { equipmentName: '고친 이름' }) : gaugeValid,
          ]),
        ),
      respondWrite: () => {
        saved = true;
        return jsonResponse(gaugeValid);
      },
    });

    await openEdit(user, 'GA-03');
    await user.clear(within(form()).getByLabelText(/계측기명/));
    await user.type(within(form()).getByLabelText(/계측기명/), '고친 이름');
    await user.click(within(form()).getByRole('button', { name: messages.common.save }));

    expect(await screen.findByRole('cell', { name: '고친 이름' })).toBeInTheDocument();
  });

  /*
   * ⛔ 인라인으로 그릴 자리가 없는 칸의 오류를 「인라인」으로 분류하면 **어디에도 서지 않는다.**
   * 검교정 대상은 스위치라 오류 자리가 없으므로 배너로 올라와야 한다.
   */
  it('오류 자리가 없는 칸의 서버 오류는 배너로 올린다', async () => {
    const { user } = renderScreen({
      respondWrite: () =>
        jsonResponse(
          {
            errors: [
              {
                scope: 'field',
                field: 'calibrationRequired',
                code: 'INVALID',
                message: '검교정 대상은 이 유형에서 바꿀 수 없습니다.',
              },
            ],
          },
          { status: 400 },
        ),
    });

    await openEdit(user, 'GA-03');
    await user.click(within(form()).getByRole('button', { name: messages.common.save }));

    expect(
      await within(form()).findByText('검교정 대상은 이 유형에서 바꿀 수 없습니다.'),
    ).toBeInTheDocument();
  });

  /* 잠금 토큰을 못 얻으면 **보내지 않는다** — 빈 If-Match 는 계약 위반이라 서버가 400을 준다. */
  it('상세를 못 읽으면 저장을 시작하지 않고 그 사실을 알린다', async () => {
    const { user, writes } = renderScreen({
      respondDetail: () => jsonResponse({ message: '서버 오류' }, { status: 500 }),
    });

    await openEdit(user, 'GA-03');
    await user.click(within(form()).getByRole('button', { name: messages.common.save }));

    expect(await within(form()).findByText(messages.save.staleToken)).toBeInTheDocument();
    expect(writes).toHaveLength(0);
  });

  it('저장이 끝나면 창을 닫는다', async () => {
    const { user } = renderScreen();

    await openEdit(user, 'GA-03');
    await user.clear(within(form()).getByLabelText(/계측기명/));
    await user.type(within(form()).getByLabelText(/계측기명/), '새 이름');
    await user.click(within(form()).getByRole('button', { name: messages.common.save }));

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
  });
});

describe('W-05-11 계측기 마스터 — 나가는 중인 쓰기', () => {
  /*
   * ⛔ **나가는 중인 요청을 `reset()` 으로 끊지 않는다.** 끊으면 그 요청의 되먹임(성공 뒤
   * 창 닫기·알림, 실패 뒤 오류 표시)이 통째로 사라져, 화면은 아무 일도 없었다고 믿고 서버는
   * 이미 처리한 상태가 된다(client#96).
   */
  it('저장이 나가는 중에 Escape 로 나가도 그 저장의 결과가 사라지지 않는다', async () => {
    const user = userEvent.setup();

    /* 저장을 붙잡아 둘 손잡이. 초기값을 두어 「비어 있을 수 있는 값」이 되지 않게 한다. */
    let releaseWrite: () => void = () => undefined;
    const writeHeld = new Promise<void>((resolve) => {
      releaseWrite = () => {
        resolve();
      };
    });

    const fetchStub = async (request: Request): Promise<Response> => {
      const url = new URL(request.url);

      if (request.method === 'PUT' && url.pathname.startsWith('/mdm/equipments/')) {
        await writeHeld;
        return jsonResponse(gaugeValid);
      }
      if (url.pathname === '/mdm/plants') return jsonResponse(plantsResponse());
      if (url.pathname === '/mdm/uoms') return jsonResponse(uomsResponse());
      if (url.pathname === '/mdm/code-values') {
        return jsonResponse(
          codeValuesResponse(
            url.searchParams.get('codeGroupCode') === 'CYCLE_TYPE'
              ? cycleCodeValues
              : statusCodeValues,
          ),
        );
      }
      if (url.pathname === '/mdm/equipments') return jsonResponse(gaugesResponse());
      if (url.pathname.startsWith('/mdm/equipments/')) {
        return jsonResponse(gaugeDetail(gaugeValid), { headers: { ETag: '9' } });
      }

      throw new Error(`스텁에 없는 요청입니다: ${request.method} ${request.url}`);
    };

    renderWithProviders(<GaugeMasterScreen today={TODAY} />, { fetch: fetchStub });

    await user.click(await screen.findByRole('button', { name: 'GA-03' }));
    const dialog = await screen.findByRole('dialog');
    await user.clear(within(dialog).getByLabelText(/계측기명/));
    await user.type(within(dialog).getByLabelText(/계측기명/), '새 이름');
    await user.click(within(dialog).getByRole('button', { name: messages.common.save }));

    /*
     * 저장이 아직 나가는 중이다 — 이 상태에서 나간다.
     * ⚠ 「취소」는 저장 중 잠기지만 **Escape 는 막을 수 없다** — 그래서 나갈 수 있는 길이
     * 남아 있고, 그 길로 나가도 나가는 요청이 무너지지 않아야 한다.
     */
    await waitFor(() => {
      expect(within(dialog).getByRole('button', { name: messages.common.save })).toBeDisabled();
    });
    await user.keyboard('{Escape}');

    releaseWrite();

    // 되먹임이 끊기지 않았다면 성공 알림이 도착한다.
    expect(await screen.findByText(messages.common.saved)).toBeInTheDocument();
  });
});
