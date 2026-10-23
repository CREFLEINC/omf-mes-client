/**
 * 모바일 작업 화면이 함께 쓰는 틀의 문구 — 작업 헤더와 단계 표시.
 *
 * 화면마다 따로 적으면 같은 자리가 화면마다 다른 말이 된다.
 */
export const taskFlow = {
  header: {
    /** 작업 헤더의 접근명. 지금 무엇을 처리 중인지 묶는 자리다. */
    label: '처리 중인 작업',
    more: '자세히',
    less: '접기',
    /** 진행 표시. 「몇 개 중 몇 개를 했는가」 */
    progress: (done: number, total: number) => `${String(done)}/${String(total)} 완료`,
  },
  /**
   * 스캔 구역에 서는 한 낱말. 무엇을 쏘는지는 단계 제목이 말한다 - 구역에 지시 · 형식을 또 적으니
   * 어수선했다(사용자 지시 2026-10-21). 단말 스캐너 단추에 적힌 글자와 같다.
   */
  scanZone: 'SCAN',
  /** 단계 표시. 한 화면에 지시 하나가 서고, 지금 몇 번째인지 함께 보인다. */
  step: (index: number, total: number) => `단계 ${String(index)}/${String(total)}`,
} as const;
