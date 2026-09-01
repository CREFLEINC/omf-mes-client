/**
 * M-01-13 긴급 IQC 생략 요청 — 현장이 검사 생략을 요청한다.
 *
 * 요청을 만들기만 한다. 승인과 한도는 관리웹이 정하므로 이 화면은 수량도 한도도 받지 않는다.
 * 긴급이라는 이름이 누르면 되는 것으로 읽히므로, 무엇이 아직 안 되는지를 먼저 말한다.
 */
export const iqcSkipRequest = {
  title: '긴급 IQC 생략 요청',
  /** 되돌아온 기록 목록에서 이 기록이 무엇인지 알리는 이름. */
  record: '긴급 IQC 생략 요청',
  lot: {
    legend: '어느 자재인가',
    scanLabel: '입하 LOT 스캔',
    scanPlaceholder: 'LOT 라벨을 비추세요',
    loading: 'LOT을 찾는 중입니다',
    loadFailed: 'LOT을 확인할 수 없습니다',
    notFound: (code: string) => `${code} LOT을 찾지 못했습니다`,
    pending: '수입검사 대기 중',
    /** 검사가 끝난 자재는 생략할 것이 없다. 요청 자체를 막는다. */
    notPending: '이미 검사가 끝난 자재입니다',
    quantity: (qty: string, uom: string) => `${qty} ${uom}`,
    /** 막지 않는다 - 다시 올리는 것이 취소를 대신하는 유일한 길이라(취소가 없다) 길을 막지 않는다. */
    alreadyRequested: (at: string) => `이미 요청이 올라가 있습니다 (${at})`,
  },
  reason: {
    legend: '왜 급한가',
    label: '사유',
    placeholder: '라인 정지 임박 · 대체 자재 없음',
    hint: '승인자가 이 사유만 보고 판단합니다.',
    required: '사유를 적어 주세요',
  },
  /** 이름이 긴급이라 누르면 되는 것으로 읽힌다. 무엇이 아직 안 되는지를 먼저 말한다. */
  expectation: '권한자 승인 후에 쓸 수 있습니다. 지금 바로 투입되지 않습니다.',
  submit: '요청',
  noWorker: '사번을 확인해야 요청할 수 있습니다',
  sent: {
    title: '요청했습니다',
    description: '승인 결과는 아래 목록에서 확인하세요.',
  },
  /** 담긴 것을 요청 완료로 보이지 않는다 - 아무에게도 가지 않은 상태다. */
  queued: {
    title: '요청을 담아 두었습니다',
    description: '연결되면 전송됩니다. 아직 아무에게도 가지 않았습니다.',
    urgent: '급하면 유선으로 함께 알리세요.',
  },
  rejected: {
    title: '요청이 되돌아왔습니다',
    description: '서버가 받지 않았습니다. 아직 아무에게도 가지 않았습니다.',
    action: '되돌아온 기록 보기',
  },
  /** 결재선이 없으면 승인자가 정해지지 않아 요청이 설 자리가 없다. */
  noRoute: '결재선이 없어 요청할 수 없습니다. 전산담당에게 문의하세요.',
  another: '다른 자재 요청',
  mine: {
    legend: '내가 올린 요청',
    loading: '불러오는 중입니다',
    loadFailed: '내가 올린 요청을 불러오지 못했습니다',
    empty: '올린 요청이 없습니다.',
    requestedAt: (at: string) => `${at} 올림`,
  },
} as const;
