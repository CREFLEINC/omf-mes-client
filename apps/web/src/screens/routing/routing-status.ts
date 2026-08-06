import { messages } from '@omf-mes/i18n';

/**
 * Routing 상태 코드 → 화면 상태 매핑. **이 화면의 상태 판정은 전부 이 파일에서 나온다.**
 *
 * 상태 코드 문자열이 아직 확정되지 않았다 — 값 등록은 다른 화면 소관이고 목 서버는 계약 예시값을 준다.
 * 값이 확정되면 아래 상수 세 줄만 고치면 화면 전체가 따라온다. **교체 지점은 여기 하나다.**
 *
 * 미인식 코드를 「작성중 취급」으로 두는 것은 두 실패의 대가를 비교한 결정이다.
 * - 미인식을 잠금으로 두면 → 실서버가 다른 문자열을 쓰는 순간 작성중 Rev도 편집할 수 없고 사용자가 풀 방법이 없다.
 * - 미인식을 편집 허용으로 두면 → 저장이 400(STATE_LOCKED)으로 막히고 화면이 그 사유를 안내한다.
 *   데이터가 손상되지 않는다.
 *
 * 즉 **서버 400이 최종 방어선**이고 이 매핑은 안내를 위한 것이다.
 */

export type RoutingScreenStatus = 'draft' | 'confirmed' | 'obsolete';

/** 배지 색조. DS `Chip`의 `status` 값과 같은 문자열을 쓰되 DS 타입에 묶지 않는다. */
export type RoutingStatusTone = 'success' | 'info' | 'idle';

export interface RoutingStatusView {
  status: RoutingScreenStatus;
  /** 배지에 보일 문구. 인식하지 못한 코드는 원본을 그대로 낸다 — 값을 지어내지 않는다. */
  label: string;
  tone: RoutingStatusTone;
  /** 화면이 편집을 열어 둘지. 잠금의 최종 판정은 서버가 한다. */
  isEditable: boolean;
  /** 코드를 인식했는가. 인식하지 못했다는 사실 자체를 화면이 감추지 않게 드러낸다. */
  isRecognized: boolean;
}

const CONFIRMED_CODES: readonly string[] = ['CONFIRMED', '확정'];
const OBSOLETE_CODES: readonly string[] = ['OBSOLETE', '폐기'];
const DRAFT_CODES: readonly string[] = ['DRAFT', '작성중'];

const t = messages.routing.values;

export const resolveRoutingStatus = (statusCode: string): RoutingStatusView => {
  const trimmed = statusCode.trim();
  const normalized = trimmed.toUpperCase();

  if (CONFIRMED_CODES.includes(normalized)) {
    return {
      status: 'confirmed',
      label: t.confirmed,
      tone: 'success',
      isEditable: false,
      isRecognized: true,
    };
  }

  if (OBSOLETE_CODES.includes(normalized)) {
    return {
      status: 'obsolete',
      label: t.obsolete,
      tone: 'idle',
      isEditable: false,
      isRecognized: true,
    };
  }

  if (DRAFT_CODES.includes(normalized)) {
    return {
      status: 'draft',
      label: t.draft,
      tone: 'info',
      isEditable: true,
      isRecognized: true,
    };
  }

  return {
    status: 'draft',
    // 빈 코드는 원본을 그대로 낼 수 없다 — 배지가 비면 상태 칸이 사라진 것처럼 보인다.
    label: trimmed === '' ? t.draft : trimmed,
    tone: 'idle',
    isEditable: true,
    isRecognized: false,
  };
};
