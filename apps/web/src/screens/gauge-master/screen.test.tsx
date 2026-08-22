import { messages } from '@omf-mes/i18n';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { createStubFetch, jsonResponse, renderWithProviders } from '../../test/api-harness';
import {
  TODAY,
  closedPlant,
  codeValuesResponse,
  gaugeItems,
  gaugesResponse,
  makeCodeValue,
  makeGauge,
  pageOf,
  plantItems,
  plantsResponse,
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
}

/** 요청이 실제로 무엇을 실어 갔는지 본다 — 조건을 서버로 몰았음을 그것으로 증명한다. */
const renderScreen = (options: RenderOptions = {}) => {
  const sent: URL[] = [];
  const codeValueSent: URL[] = [];
  /** 공장 조회가 실어 간 조건 — 문 닫은 공장까지 받아 오는지 본다 */
  const plantSent: URL[] = [];

  const fetch = createStubFetch([
    {
      match: (request) => isPath(request, '/mdm/equipments'),
      respond: (request) => {
        sent.push(new URL(request.url));
        return (options.respondGauges ?? (() => jsonResponse(gaugesResponse())))(request);
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
  const view = renderWithProviders(<GaugeMasterScreen today={TODAY} />, { fetch });

  return { ...view, user, sent, codeValueSent, plantSent };
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
