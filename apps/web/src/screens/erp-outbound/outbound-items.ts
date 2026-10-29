import type { components } from '@omf-mes/api-client';

/** 연계 메시지의 방향 — 송신(MES → ERP). */
export const OUTBOUND_DIRECTION = 'OUTBOUND' as const;

/** 송신 예정 — 송신기가 아직 보내지 않은 건. 실패는 연동 현황·이력에서 다시 보낸다. */
export const MESSAGE_STATUS = { pending: 'PENDING', failed: 'FAILED' } as const;
export type CountedStatus = (typeof MESSAGE_STATUS)[keyof typeof MESSAGE_STATUS];

/**
 * 서버 설정 한 줄 — 짝(`interfaceCode`) · 실패 건수는 서버 #849(장부 P-129)가 더한 칸이라 계약 사본에 아직 없어 여기서
 * 넓힌다. 계약에 실리면 이 교차를 걷는다. 반품 · 실사 조정은 서버에 송신이 없어 짝이 `null` 이다.
 */
export type OutboundItemSettingRow = components['schemas']['OutboundItemSetting'] & {
  interfaceCode?: string | null;
  failedMessageCount?: number;
};

/** 화면의 송신 항목 한 줄 — 짝과 대기 · 실패 건수는 서버가 센다(PENDING · FAILED). */
export interface OutboundItem {
  outboundItemCode: string;
  outboundItemName: string;
  enabled: boolean;
  /** 끌 수 없는 항목(생산 실적). */
  locked: boolean;
  /** 짝인 송신 인터페이스. 없으면 이 항목은 아직 보내지 않는다. */
  interfaceCode: string | null;
  /** 송신 대기(PENDING) 건수. */
  pendingCount: number;
  /** 송신 실패(FAILED) 건수. 옛 서버는 주지 않는다 — 0 으로 둔다. */
  failedCount: number;
}

export const toOutboundItem = (setting: OutboundItemSettingRow): OutboundItem => ({
  outboundItemCode: setting.outboundItemCode,
  outboundItemName: setting.outboundItemName,
  enabled: setting.enabled,
  locked: setting.locked,
  interfaceCode: setting.interfaceCode ?? null,
  pendingCount: setting.pendingMessageCount,
  failedCount: setting.failedMessageCount ?? 0,
});
