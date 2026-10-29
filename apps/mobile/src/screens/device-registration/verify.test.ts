import { describe, expect, it } from 'vitest';

import { autoSignInOf, verifyWorkerNo } from './verify';

describe('확인 없이 들어가는 사번', () => {
  const people = [
    { workerNo: '100027', workerName: '홍길동' },
    { workerNo: '1000', workerName: '짧은 사번' },
    { workerNo: '100028', workerName: '김영수' },
  ];

  it('명부의 사번 하나와 꼭 같으면 그 사람이다', () => {
    expect(autoSignInOf(people, '100027')).toEqual({ workerNo: '100027', workerName: '홍길동' });
  });

  it('치는 중이면 아직 아니다', () => {
    expect(autoSignInOf(people, '10002')).toBeNull();
  });

  /* 여기서 넘기면 더 긴 사번을 가진 사람은 들어올 길이 없다. 그때는 「확인」을 누른다. */
  it('더 쳐서 될 다른 사번이 있으면 넘기지 않는다', () => {
    expect(autoSignInOf(people, '1000')).toBeNull();
  });

  it('명부를 받지 못했으면 넘기지 않는다', () => {
    expect(autoSignInOf(null, '100027')).toBeNull();
  });
});

const directory = [
  { workerNo: 'SYN-W-0001', workerName: '작업자 1' },
  { workerNo: 'SYN-W-0002', workerName: '작업자 2' },
];

describe('사번 확인', () => {
  it('받아 둔 목록에 있으면 그 작업자다', () => {
    expect(verifyWorkerNo(directory, 'SYN-W-0002')).toEqual({
      kind: 'ok',
      worker: { workerNo: 'SYN-W-0002', workerName: '작업자 2' },
    });
  });

  it('없는 사번은 없다고 한다', () => {
    expect(verifyWorkerNo(directory, 'SYN-W-9999')).toEqual({ kind: 'unknown' });
  });

  /* 없는 사번은 다시 치면 되고, 목록 미수신은 작업자가 할 수 있는 것이 없다. */
  it('목록을 받지 못한 것은 없는 사번과 다르다', () => {
    expect(verifyWorkerNo(null, 'SYN-W-0001')).toEqual({ kind: 'no-directory' });
  });

  it('재직자가 0명이면 어느 사번도 없다', () => {
    expect(verifyWorkerNo([], 'SYN-W-0001')).toEqual({ kind: 'unknown' });
  });

  it('앞뒤가 겹치는 사번을 골라 내지 않는다', () => {
    expect(verifyWorkerNo(directory, 'SYN-W-000')).toEqual({ kind: 'unknown' });
  });
});
