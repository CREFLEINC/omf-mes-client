import type { components } from '@omf-mes/api-client';

/**
 * 송신 항목과 연계 메시지의 짝 — **서버 `src/core/outbox/outbox.service.ts` 의 인터페이스 코드를 손으로 옮긴다.**
 *
 * 서버의 송신 항목 설정(`GET /integration/outbound-item-settings`)은 항목마다 인터페이스를 `interface_definition` 으로
 * 이어 세는데, 송신 인터페이스는 그 행이 아직 없어 `pendingMessageCount` 가 늘 0 이다(서버에 요청 2026-10-27).
 * 서버가 짝을 알려 주면 이 표를 지우고 응답을 쓴다.
 *
 * 반품 · 실사 조정은 서버에 아직 송신이 없다 — 짝이 `null` 이고 목록을 부르지 않는다.
 */
export const OUTBOUND_INTERFACE: Readonly<Record<string, string | null>> = {
  PRODUCTION_RESULT: 'IF-WO-CLOSE-SEND',
  GOODS_RECEIPT: 'IF-GR-SEND',
  SHIPMENT_PGI: 'IF-SHIPMENT-PGI-SEND',
  RETURN: null,
  STOCK_ADJUSTMENT: null,
};

export const interfaceCodeOf = (outboundItemCode: string): string | null =>
  OUTBOUND_INTERFACE[outboundItemCode] ?? null;

/** 연계 메시지의 방향 — 송신(MES → ERP). */
export const OUTBOUND_DIRECTION = 'OUTBOUND' as const;

/** 송신 예정 — 송신기가 아직 보내지 않은 건. 실패는 연동 현황·이력에서 다시 보낸다. */
export const MESSAGE_STATUS = { pending: 'PENDING', failed: 'FAILED' } as const;
export type CountedStatus = (typeof MESSAGE_STATUS)[keyof typeof MESSAGE_STATUS];

/**
 * 연계 메시지 목록은 기간이 필수다(계약 G-8). 「아직 보내지 않은 것」은 기간과 상관없어 넓은 기간으로 부른다 —
 * 값이 늘 같아야 조회 키가 렌더마다 바뀌지 않는다.
 */
export const ALL_TIME = {
  createdFrom: '2000-01-01T00:00:00.000Z',
  createdTo: '2100-01-01T00:00:00.000Z',
} as const;

type Setting = components['schemas']['OutboundItemSetting'];

/** 화면의 송신 항목 한 줄 — 서버 설정에 짝(`interfaceCode`)을 붙였다. */
export interface OutboundItem {
  outboundItemCode: string;
  outboundItemName: string;
  enabled: boolean;
  /** 끌 수 없는 항목(생산 실적). */
  locked: boolean;
  /** 짝인 송신 인터페이스. 없으면 이 항목은 아직 보내지 않는다. */
  interfaceCode: string | null;
}

export const toOutboundItem = (setting: Setting): OutboundItem => ({
  outboundItemCode: setting.outboundItemCode,
  outboundItemName: setting.outboundItemName,
  enabled: setting.enabled,
  locked: setting.locked,
  interfaceCode: interfaceCodeOf(setting.outboundItemCode),
});
