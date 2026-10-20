import { afterEach, describe, expect, it } from 'vitest';

import { readWorkOrderIdParam } from './current-work';
import { clockText, countPendingOutbox, dateText } from './device-state';

afterEach(() => {
  localStorage.clear();
});

describe('전송 대기 합계', () => {
  it('화면별 대기열을 모두 더하고 대기열이 아닌 열쇠는 세지 않는다', () => {
    localStorage.setItem('omf-mes.material-input-scan.outbox', JSON.stringify([{}, {}]));
    localStorage.setItem('omf-mes.production-result.outbox', JSON.stringify([{}]));
    localStorage.setItem('omf-mes.shell.locale', 'vi');

    expect(countPendingOutbox(localStorage)).toBe(3);
  });

  it('모양이 깨진 대기열은 0 으로 센다', () => {
    localStorage.setItem('omf-mes.pqc-inspection.outbox', '{깨짐');
    localStorage.setItem('omf-mes.downtime-register.outbox', JSON.stringify({ not: 'array' }));

    expect(countPendingOutbox(localStorage)).toBe(0);
  });
});

describe('단말 시각', () => {
  it('시:분 두 자리로 쓴다', () => {
    expect(clockText(new Date(2026, 9, 20, 7, 5))).toBe('07:05');
  });

  it('날짜는 월.일 (요일)로 쓴다', () => {
    const weekdays = ['일', '월', '화', '수', '목', '금', '토'];

    expect(dateText(new Date(2026, 9, 20, 7, 5), weekdays)).toBe('10.20 (화)');
    expect(dateText(new Date(2026, 0, 4), weekdays)).toBe('01.04 (일)');
  });
});

describe('주소의 작업지시', () => {
  it('양의 정수만 받는다', () => {
    expect(readWorkOrderIdParam('?workOrderId=42')).toBe(42);
    expect(readWorkOrderIdParam('?workOrderId=0')).toBeNull();
    expect(readWorkOrderIdParam('?workOrderId=1e3')).toBeNull();
    expect(readWorkOrderIdParam('?workOrderId=%2012')).toBeNull();
    expect(readWorkOrderIdParam('')).toBeNull();
  });
});
