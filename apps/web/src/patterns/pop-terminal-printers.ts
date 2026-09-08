import type { components } from '@omf-mes/api-client';

type Printer = components['schemas']['Printer'];

/**
 * **이 단말에 실제로 붙어 있는 프린터**를 셸에서 받아 계약 모양으로 옮긴다.
 *
 * ⭐ **왜 있는가.** 계약은 프린터 목록을 서버가 갖는 것으로 적었고(`/app/printers` — 「이
 * 단말이 쓸 수 있는 프린터」), 화면도 그대로 서버 값을 보였다. 그런데 그 경로가 서버에 아직
 * 없어(`x-implemented: false`) 화면에는 계약 예시의 「샘플 라벨 프린터 A」가 떴다 — **단말에
 * 프린터가 하나도 없어도 「대기 중」이라 말하고**, 발행을 누르면 인쇄만 조용히 실패했다
 * (실측 2026-09-08). 사용자에게는 「프린터는 멀쩡하다는데 안 나온다」로 보인다.
 *
 * ⛔ **계약을 대신 정한 것이 아니다.** 목록의 주인이 서버라는 계약은 그대로 두고, **셸이
 *    답할 수 있을 때만** 그쪽을 먼저 쓴다(사용자 지시 2026-09-08). 서버가 이 경로를 구현하면
 *    무엇을 정본으로 삼을지 다시 정한다.
 *
 * ⚠ **관리웹(브라우저)에는 이 통로가 없다.** 그때 `null` 을 돌려주고, 부르는 쪽은 서버 목록을
 *   그대로 쓴다 — 통로가 없는 것은 오류가 아니다.
 *
 * ⛔ **상태를 지어내지 않는다.** 셸이 아는 것은 「등록돼 있다」와 「어디로 보낼 것인가」뿐이다.
 *    프린터가 켜졌는지 종이가 있는지는 아무도 모르므로 `READY` 이상을 말하지 않는다.
 */
interface PrinterShell {
  list: () => Promise<{
    printers: { name: string; displayName?: string }[];
    target: string | null;
  }>;
}

interface ShellCarrier {
  pop?: { printers?: PrinterShell };
}

/** 셸 통로. 없으면 `null` — 브라우저에서 열었다는 뜻이다. */
export const printerShell = (): PrinterShell | null => {
  if (typeof window === 'undefined') return null;

  const carrier = window as unknown as ShellCarrier;

  return carrier.pop?.printers ?? null;
};

/**
 * 단말 프린터 목록. **통로가 없으면 `null`** 이고, 통로는 있는데 프린터가 없으면 **빈 배열**이다.
 *
 * ⭐ 이 둘을 가르는 것이 요점이다 — 빈 배열은 「이 단말에 프린터가 없다」는 **판정**이고,
 * `null` 은 「여기서는 알 수 없다」는 **모름**이다. 섞으면 브라우저에서 연 화면이 프린터가
 * 없다고 잘못 말한다.
 */
export const terminalPrinters = async (): Promise<Printer[] | null> => {
  const shell = printerShell();

  if (shell === null) return null;

  const { printers, target } = await shell.list();

  return printers.map(({ name, displayName }) => ({
    printerName: name,
    displayName: displayName === undefined || displayName === '' ? name : displayName,
    status: 'READY' as const,
    statusMessage:
      target === null ? '이 단말에 등록됨 — 기본 프린터로 나갑니다' : '이 프린터로 나갑니다',
    isDefault: target !== null && name === target,
  }));
};
