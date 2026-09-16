/**
 * P-06-01 창고 적재 위치 라벨 발행.
 *
 * 이 화면의 말은 「적재 위치」다 — 창고 안의 랙·셀에 붙는 **고정 표지**를 만든다. 물건에 붙는
 * LOT 라벨(P-01-01)·출고 QR(P-01-02)과 섞지 않는다. 그 둘은 물건을 따라 움직이고 이것은
 * 자리에 남는다.
 */
export const popLocationLabel = {
  title: '창고 적재 위치 라벨 발행',

  entry: {
    workerLabel: '사번',
    missingWorker: '사번이 확인되지 않아 발행할 수 없습니다. 사번 인증을 먼저 하세요.',
  },

  warehouse: {
    label: '창고',
    placeholder: '창고를 고르세요',
    loadFailed: '창고 목록을 불러오지 못했습니다. 연결을 확인한 뒤 다시 시도하세요.',
    /** 쓰는 창고가 하나도 없다. 마스터가 비어 있다는 뜻이라 이 화면에서 할 수 있는 일이 없다. */
    none: '쓸 수 있는 창고가 없습니다. 창고 마스터를 먼저 등록하세요.',
    retry: '다시 시도',
  },

  location: {
    heading: '적재 위치',
    /** 창고를 고르기 전. 목록 자리를 비워 두지 않고 무엇을 더 해야 하는지 적는다. */
    awaitingWarehouse: '창고를 고르면 그 창고의 적재 위치가 나옵니다.',
    empty: '이 창고에는 등록된 적재 위치가 없습니다.',
    loading: '적재 위치를 불러오는 중',
    loadFailed: '적재 위치를 불러오지 못했습니다. 연결을 확인한 뒤 다시 시도하세요.',
    retry: '다시 시도',
    columnCode: '위치 코드',
    columnName: '위치명',
    columnIssued: '발행',
    /** 아직 한 번도 안 찍은 자리. 「0회」보다 「처음」이 현장에서 빨리 읽힌다. */
    notIssued: '처음',
    issuedCount: (count: number) => `${String(count)}회`,
    /** 사용 중지된 위치도 찍는다 — 선반은 그 자리에 그대로 있다. */
    inactive: '사용 중지',
    selectedCount: (count: number) => `${String(count)}곳 선택`,
    /** 계약이 한 번에 받는 상한. 넘으면 전건이 실패하므로 미리 막는다. */
    tooMany: (max: number) => `한 번에 ${String(max)}곳까지 발행할 수 있습니다. 나눠서 찍으세요.`,
  },

  printer: {
    label: '프린터',
    unknown: '프린터 목록을 확인하지 못했습니다',
    retry: '다시 시도',
    /** 프린터가 없어도 발행은 막지 않는다 — 기록과 인쇄는 다른 걸음이다. */
    none: '이 단말에 등록된 프린터가 없습니다. 발행 기록은 남지만 라벨은 나오지 않습니다.',
    unselected: '고르지 않으면 서버 기본 프린터로 나갑니다.',
    noStatusMessage: '상태를 알 수 없음',
  },

  issue: {
    action: '라벨 발행',
    pending: '발행하는 중',
    /** 고른 것이 없을 때는 단추가 이미 말한다 — 문구를 덧붙이지 않는다. */
    succeeded: (count: number) => `${String(count)}건을 발행했습니다.`,
    /** 회차를 서버에 묻는 동안. 잠깐이라도 단추가 잠기는 까닭을 말한다. */
    checkingHistory: '발행 이력을 확인하는 중입니다.',
    /**
     * 회차를 못 물었다.
     *
     * ⛔ **「기다리세요」로 적지 않는다** — 기다려도 풀리지 않는다. 사용자가 할 수 있는 일을 적는다.
     */
    summaryFailed:
      '발행 이력을 확인하지 못해 발행할 수 없습니다. 연결을 확인한 뒤 다시 시도하세요.',
    retrySummary: '발행 이력 다시 확인',
  },

  reissue: {
    title: '다시 발행',
    /**
     * 이미 찍은 자리가 섞여 있다. **회차는 서버가 센다** — 화면은 물어서 알 뿐이다.
     */
    notice: (count: number) =>
      `고른 곳 가운데 ${String(count)}곳은 이미 라벨을 찍었습니다. 다시 찍는 사유를 고르세요.`,
    reason: '재발행 사유',
    reasonPlaceholder: '사유를 고르세요',
    reasonLoadFailed: '재발행 사유를 불러오지 못했습니다.',
    confirm: '다시 발행',
    cancel: '취소',
    /** 사유를 못 받으면 발행 자체를 열지 않는다 — 보내 봐야 서버가 거절한다. */
    required: '재발행 사유를 골라야 발행할 수 있습니다.',
  },

  print: {
    heading: '인쇄 결과',
    pending: '라벨을 프린터로 보내는 중',
    /**
     * 셸 밖(브라우저)에서 열었다.
     *
     * ⛔ **「인쇄했다」고 말하지 않는다** — 통로가 없어 시도조차 하지 않았다. 발행 기록은 남았다.
     */
    noBridge: '이 단말에는 인쇄 통로가 없어 라벨을 보내지 못했습니다. 발행 기록은 남았습니다.',
    summary: (printed: number, failed: number) =>
      `인쇄 성공 ${String(printed)}건 · 실패 ${String(failed)}건`,
    /** 보고가 실패해도 발행·인쇄는 그대로다 — 서버의 기록만 뒤처진다. */
    reportFailed: (count: number) =>
      `인쇄 결과 ${String(count)}건을 서버에 알리지 못했습니다. 라벨은 나왔습니다.`,
    failedAt: (locationCode: string, reason: string) => `${locationCode}: ${reason}`,
  },
} as const;
