/**
 * 전송 대기 기록 — 담겼지만 아직 보내지 못한 건을 보인다.
 *
 * 전송 실패와 다른 말을 쓴다. 이것은 기다리면 가고, 실패한 것은 기다려도 가지 않는다.
 */
export const outboxPending = {
  title: '전송 대기 기록',
  lead: '아직 보내지 못한 기록입니다. 연결되면 저절로 보냅니다.',
  empty: '전송 대기 중인 기록이 없습니다.',
  /** 무엇이 언제 있었던 일인지. 오래 묶여 있으면 담당자에게 물을 때 그때를 말해야 한다. */
  occurredAt: (at: string) => `${at}에 적음`,
  /** 교대 뒤에도 앞사람 기록이 남아 있을 수 있다. 누구 기록인지 함께 보인다. */
  worker: (workerNo: string) => `사번 ${workerNo}`,
  sendNow: '지금 보내기',
  /** 잠긴 이유(공유계약 G-1). */
  sendLocked: '연결되면 보낼 수 있습니다',
  result: {
    sent: (count: number) => `${String(count)}건을 보냈습니다`,
    unreachable: '보내지 못했습니다. 연결을 확인한 뒤 다시 누르세요.',
    rejected: (count: number) =>
      `${String(count)}건은 등록되지 않아 전송 실패한 기록으로 옮겼습니다`,
  },
} as const;
