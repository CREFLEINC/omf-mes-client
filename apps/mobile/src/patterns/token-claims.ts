export interface TerminalClaims {
  terminalCode: string;
  plantId: number;
}

const decodeSegment = (segment: string): unknown => {
  const padded = segment.replaceAll('-', '+').replaceAll('_', '/');
  return JSON.parse(atob(padded)) as unknown;
};

const readString = (claims: Record<string, unknown>, key: string): string | null => {
  const value = claims[key];
  return typeof value === 'string' && value !== '' ? value : null;
};

const readNumber = (claims: Record<string, unknown>, key: string): number | null => {
  const value = claims[key];
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
};

/**
 * 단말 토큰이 싣고 온 단말 정보를 읽는다.
 *
 * 서명은 보지 않는다 — 검증은 서버 몫이고, 여기서 통과시킨 값도 서버가 거절하면 등록이
 * 서지 않는다. 읽는 이유는 등록 전에 어느 단말·어느 공장의 QR 인지 화면에 보이기 위해서다.
 *
 * 토큰이 아닌 QR 을 비추는 일이 흔하므로 읽지 못하는 것을 예외로 다루지 않고 null 로 낸다.
 */
export const readTerminalClaims = (token: string): TerminalClaims | null => {
  const segments = token.split('.');

  if (segments.length !== 3) {
    return null;
  }

  let payload: unknown;
  try {
    payload = decodeSegment(segments[1] ?? '');
  } catch {
    return null;
  }

  if (typeof payload !== 'object' || payload === null) {
    return null;
  }

  const claims = payload as Record<string, unknown>;
  const terminalCode = readString(claims, 'terminalCode');
  const plantId = readNumber(claims, 'plantId');

  return terminalCode === null || plantId === null ? null : { terminalCode, plantId };
};
