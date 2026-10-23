import { messages } from '@omf-mes/i18n';
import { waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { createStubFetch, jsonResponse, renderHookWithProviders } from '../test/api-harness';
import {
  popGateDeniedText,
  popGateProcessId,
  popGateUnidentifiedText,
  usePopProcessGate,
  type PopProcessGateInput,
} from './pop-process-gate';

const TERMINAL_ID = 501;
const PATH = `/mdm/terminals/${String(TERMINAL_ID)}/processes`;

const renderGate = (input: PopProcessGateInput, respond: () => Response) =>
  renderHookWithProviders(() => usePopProcessGate(input), {
    fetch: createStubFetch([
      { match: (request) => new URL(request.url).pathname === PATH, respond },
    ]),
  });

const mapping = () =>
  jsonResponse({
    items: [
      { processId: 1, processName: '합성 조립', canInputMaterial: false },
      { processId: 2, processName: '합성 사출', canInputMaterial: true },
    ],
  });

describe('popGateProcessId', () => {
  it('W/O 의 공정을 먼저 쓰고, 없으면 단말의 유일한 공정을 쓴다', () => {
    expect(popGateProcessId(2, [{ processId: 1 }, { processId: 2 }])).toBe(2);
    expect(popGateProcessId(null, [{ processId: 1 }])).toBe(1);
    expect(popGateProcessId(undefined, [{ processId: 1 }, { processId: 2 }])).toBeNull();
    expect(popGateProcessId(null, null)).toBeNull();
  });
});

describe('usePopProcessGate', () => {
  it('공정이 여럿이어도 고른 공정의 플래그로 판정한다', async () => {
    const open = renderGate(
      { terminalId: TERMINAL_ID, processId: 2, flag: 'canInputMaterial' },
      mapping,
    );
    await waitFor(() => expect(open.result.current.verdict).toBe('allowed'));
    expect(open.result.current.processName).toBe('합성 사출');

    const closed = renderGate(
      { terminalId: TERMINAL_ID, processId: 1, flag: 'canInputMaterial' },
      mapping,
    );
    await waitFor(() => expect(closed.result.current.verdict).toBe('denied'));
  });

  it('행이 없거나 필드가 없으면 닫힘이다', async () => {
    const { result } = renderGate(
      { terminalId: TERMINAL_ID, processId: 9, flag: 'canInputResult' },
      mapping,
    );
    await waitFor(() => expect(result.current.verdict).toBe('denied'));
  });

  it('작업지시를 읽는 중이면 「모른다」 대신 확인 중이다', () => {
    const { result } = renderGate(
      {
        terminalId: TERMINAL_ID,
        processId: null,
        workOrder: { isPending: true },
        flag: 'canInputMaterial',
      },
      mapping,
    );
    expect(result.current.verdict).toBe('checking');
  });

  it('단말이나 공정을 모르면 unidentified, 조회 실패면 unavailable 이다', async () => {
    expect(
      renderGate({ terminalId: null, processId: 2, flag: 'canInputMaterial' }, mapping).result
        .current.verdict,
    ).toBe('unidentified');
    expect(
      renderGate({ terminalId: TERMINAL_ID, processId: null, flag: 'canInputMaterial' }, mapping)
        .result.current.verdict,
    ).toBe('unidentified');

    const failed = renderGate(
      { terminalId: TERMINAL_ID, processId: 2, flag: 'canInputMaterial' },
      () => jsonResponse({ message: '합성 실패' }, { status: 500 }),
    );
    await waitFor(() => expect(failed.result.current.verdict).toBe('unavailable'));
  });

  it('매핑 행에 이름이 없으면 W/O 의 공정명으로 말한다', async () => {
    const { result } = renderGate(
      {
        terminalId: TERMINAL_ID,
        processId: 3,
        workOrder: { processName: '합성 포장' },
        flag: 'canInputMaterial',
      },
      () => jsonResponse({ items: [{ processId: 3, canInputMaterial: false }] }),
    );
    await waitFor(() => expect(result.current.verdict).toBe('denied'));
    expect(result.current.processName).toBe('합성 포장');
  });
});

describe('popGateDeniedText', () => {
  it('공정 이름, 기능, 켜는 메뉴 경로를 담는다', () => {
    const text = popGateDeniedText({ processName: '합성 사출' }, 'canInputMaterial');
    expect(text).toContain('합성 사출');
    expect(text).toContain(messages.terminalProcessMap.flags.canInputMaterial);
    expect(text).toContain(messages.terminalProcessMap.menuPath);
  });

  it('공정을 모를 때는 화면 문구 뒤에 매핑 확인 곳을, 있으면 서버 이유를 덧붙인다', () => {
    const t = messages.popChrome.processGate;
    expect(popGateUnidentifiedText('화면 문구.', null)).toBe(
      `화면 문구. ${t.checkMapping(messages.terminalProcessMap.menuPath)}`,
    );
    expect(popGateUnidentifiedText('화면 문구.', '단말 인증 범위 밖입니다.')).toBe(
      `화면 문구. ${t.checkMapping(messages.terminalProcessMap.menuPath)} ${t.serverReason('단말 인증 범위 밖입니다.')}`,
    );
  });

  it('작업지시를 일시적으로 읽지 못하면 unavailable, 권한(401)으로 거부되면 unidentified 다', () => {
    const transient = renderGate(
      {
        terminalId: TERMINAL_ID,
        processId: null,
        workOrder: { isError: true, failureReason: null },
        flag: 'canInputMaterial',
      },
      mapping,
    );
    expect(transient.result.current.verdict).toBe('unavailable');

    const denied = renderGate(
      {
        terminalId: TERMINAL_ID,
        processId: null,
        workOrder: { isError: true, failureReason: '단말 인증 범위 밖입니다.' },
        flag: 'canInputMaterial',
      },
      mapping,
    );
    expect(denied.result.current.verdict).toBe('unidentified');
  });
});
