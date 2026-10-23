import { usePopProcessGate } from '../../patterns/pop-process-gate';

/**
 * 단말 게이팅 — **이 단말이 이 공정의 작업을 시작할 수 있는가.**
 *
 * 스펙 §5-1 이 ⭐로 둔 자리이고, 착수 이슈 정정(2026-08-31)이 「이 호출이 빠져 있었다 · 지금
 * 지으면 버튼이 항상 열린 채로 굳는다」고 못박은 자리다. 계약의 `TerminalProcess.canStartWork`
 * 를 화면 진입 시 읽어 「작업 시작」을 선제 비활성한다.
 *
 * ⛔ **`flag !== false` 로 쓰지 않는다.** 여덟 플래그는 `required` 가 아니라 **없을 수 있고**,
 * 계약이 「기본은 닫힘」이라 적었다. 값이 없을 때 통과시키면 구성하지 않은 단말이 전부 열린다.
 * **`=== true` 일 때만** 연다.
 *
 * ⛔ **조회 실패를 통과로 처리하지 않는다**(공유계약 F-6). 막되 **「확인할 수 없습니다」**라고
 * 말한다 — 「권한이 없습니다」와 다른 문장이고, 앞의 것에는 다시 시도할 경로를 준다(G-3).
 *
 * ⛔ **계약 설명의 「0건이 정상인 단말이 있다」는 이 화면 이야기가 아니다** — 그것은 창고 전용
 * 단말 조항이다. 이 화면은 생산 단말이라 게이팅 범위 안이고, **행이 없으면 닫힘**이다.
 *
 * ⭐ **보안 경계가 아니다.** 없는 장비의 버튼을 감춰 오조작을 줄이는 장치이고, 최종 차단은
 * 서버가 한다(F-1 · F-5). 그래서 화면이 열어 준다고 통과하는 것이 아니다.
 *
 * 이 화면이 소유한다 — 다른 화면 슬라이스의 같은 이름 파일을 참조하지 않는다.
 */

/**
 * 게이팅 판정.
 *
 * | 값 | 뜻 | 화면 |
 * | --- | --- | --- |
 * | `allowed` | 이 단말·공정에서 작업을 시작할 수 있다 | 시작을 연다 |
 * | `denied` | 플래그가 닫혀 있거나 **그 공정 행이 아예 없다** | 막고 「권한이 없다」 + 푸는 곳 |
 * | `unavailable` | 조회가 실패했다 | 막고 **「확인할 수 없다」** + 다시 시도 |
 * | `unidentified` | 단말·공정을 알 수 없다(셸이 아직 채우지 않았다) | 막고 사유를 말한다 |
 * | `checking` | 조회 중 | 막는다 — 아직 모르는 것을 열어 두지 않는다 |
 */
export type StartGateVerdict = 'allowed' | 'denied' | 'unavailable' | 'unidentified' | 'checking';

export interface StartGate {
  verdict: StartGateVerdict;
  retry: () => void;
}

/** 작업지시를 다루는 POP 화면이 함께 쓰는 판정(`patterns/pop-process-gate`)의 「작업 시작」 몫이다. */
export const useStartGate = (terminalId: number | null, processId: number | null): StartGate => {
  const gate = usePopProcessGate({ terminalId, processId, flag: 'canStartWork' });

  return { verdict: gate.verdict, retry: gate.retry };
};
