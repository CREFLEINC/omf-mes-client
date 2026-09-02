import { describe, expect, it } from 'vitest';

import { readEquipmentCode, readEquipmentId } from './screen-params';

const params = (query: string): URLSearchParams => new URLSearchParams(query);

describe('readEquipmentId', () => {
  it('주소의 설비 번호를 읽는다', () => {
    expect(readEquipmentId(params('equipmentId=5101'))).toBe(5101);
  });

  it('없으면 조회할 것이 없다', () => {
    expect(readEquipmentId(params(''))).toBeNull();
  });

  it('있을 수 없는 값은 조회에 싣지 않는다 — 서버가 거절할 요청을 화면이 한 번 더 만든다', () => {
    /* `Number`는 빈 글자와 공백을 0으로 읽는다 — 자릿수 검사가 먼저 서야 하는 이유다. */
    expect(readEquipmentId(params('equipmentId='))).toBeNull();
    expect(readEquipmentId(params('equipmentId=%20'))).toBeNull();
    expect(readEquipmentId(params('equipmentId=0'))).toBeNull();
    expect(readEquipmentId(params('equipmentId=-3'))).toBeNull();
    expect(readEquipmentId(params('equipmentId=1.5'))).toBeNull();
    expect(readEquipmentId(params('equipmentId=abc'))).toBeNull();
  });

  it('안전한 정수 범위를 넘는 값도 받지 않는다', () => {
    expect(readEquipmentId(params('equipmentId=99999999999999999999'))).toBeNull();
  });

  it('숫자처럼 «읽히는» 글자를 번호로 삼지 않는다', () => {
    /*
     * `Number`는 16진수·지수 표기를 조용히 숫자로 바꾼다 — `0x10`이 16이 되고 `1e3`이
     * 1000이 된다. 주소에 그런 글자가 실렸다는 것은 **의도한 설비가 아니라는 뜻**이고,
     * 그대로 통과시키면 **엉뚱한 설비에 비가동이 붙는다.** 자릿수 검사가 그것을 먼저 막는다.
     */
    expect(readEquipmentId(params('equipmentId=0x10'))).toBeNull();
    expect(readEquipmentId(params('equipmentId=1e3'))).toBeNull();
    expect(readEquipmentId(params('equipmentId=%2B5101'))).toBeNull();
  });
});

describe('readEquipmentCode', () => {
  it('표시용 코드를 다듬어 낸다', () => {
    expect(readEquipmentCode(params('equipmentCode=%20SAMPLE-PRS-01%20'))).toBe('SAMPLE-PRS-01');
  });

  it('빈 글자를 이름 자리에 넣지 않는다', () => {
    expect(readEquipmentCode(params('equipmentCode=%20%20'))).toBeNull();
    expect(readEquipmentCode(params(''))).toBeNull();
  });
});
