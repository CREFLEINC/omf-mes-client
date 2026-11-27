/**
 * 판정 확정 확인 창 — OQC · PQC 관리웹이 같은 모양을 쓴다(사용자 시안 2026-11-17 · omf-all-around#286).
 */
export const judgmentConfirm = {
  title: '판정 확정',
  question: '판정을 확정하시겠습니까?',
  requestNo: '검사 의뢰 번호',
  judgmentHeading: '최종 판정',
  resultRow: '검사 결과',
  accepted: '합격',
  rejected: '불합격',
  held: '보류',
  lotRow: 'LOT 상태',
  /** 확정 뒤 LOT 상태 — 서버 전이표 C4 · C5 · C6(합격 → 정상 · 불합격 → 불량 · 보류 → 검사 대기). */
  lotState: {
    release: '정상',
    hold: '불량',
    pending: '검사 대기',
    unknown: '변경',
  },
  /** 대상 LOT 이 없는 출하작업지시 OQC — 집은(피킹) LOT 에 판정을 남긴다(omf-all-around#119). */
  pickedLotState: {
    release: '출하 가능',
    hold: '불량',
    pending: '변경 없음',
    unknown: '변경',
  },
  /** PQC — 작업지시 단위 전이(서버 inspection-confirm.service: 합격 → 검사 대기 생산 LOT 정상, 불합격은 합격판정개수를 넘을 때만 검사 대기, 보류는 그대로). */
  pqcLotState: {
    release: '정상',
    hold: '불합격량이 허용 기준을 넘으면 검사 대기',
    pending: '변경 없음',
    unknown: '변경',
  },
  applyHeading: '확정 시 적용 사항',
  irreversible:
    '확정 후 판정은 수정하거나 취소할 수 없습니다. 변경이 필요한 경우 재검사를 진행해야 합니다.',
  back: '취소',
  confirm: '판정 확정',
} as const;
