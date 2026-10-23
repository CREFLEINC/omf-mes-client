import { messages } from '@omf-mes/i18n';
import { describe, expect, it } from 'vitest';

import { EMPTY_LOT_DRAFT } from './line-draft';
import { lotDraftError, parseMaterialLotNo } from './lot-format';

const t = messages.overReceiptSplit;

/** 서버 `core/lot/lot-number.ts` 의 예시와 같은 라벨. */
const LABEL = '040101-00022S|12.5|260731|100019|0001';

describe('parseMaterialLotNo — 사전부착 라벨 다섯 칸', () => {
  it('규칙에 맞는 라벨을 칸으로 읽는다', () => {
    expect(parseMaterialLotNo(LABEL)).toEqual({
      itemCode: '040101-00022S',
      qty: 12.5,
      date: '260731',
      supplierCode: '100019',
      serial: 1,
    });
  });

  it('앞뒤 공백은 다듬고, 수량은 관대하게 본다(12.50 도 통과)', () => {
    expect(parseMaterialLotNo('  A|12.50|260731|S|0002 ')?.qty).toBe(12.5);
  });

  it.each([
    ['칸이 넷', 'A|1|260731|S'],
    ['칸이 여섯', 'A|1|260731|S|0001|X'],
    ['빈 칸', '|1|260731|S|0001'],
    ['수량이 숫자가 아님', 'A|x|260731|S|0001'],
    ['수량 0', 'A|0|260731|S|0001'],
    ['없는 날짜', 'A|1|260230|S|0001'],
    ['번호가 세 자리', 'A|1|260731|S|001'],
    ['번호 0000', 'A|1|260731|S|0000'],
    ['비ASCII', '가|1|260731|S|0001'],
    ['빈 문자열', ''],
  ])('%s이면 라벨이 아니다', (_name, text) => {
    expect(parseMaterialLotNo(text)).toBeNull();
  });

  it('64자를 넘으면 라벨이 아니다', () => {
    expect(parseMaterialLotNo(`${'A'.repeat(50)}|1|260731|S|0001`)).toBeNull();
  });
});

describe('lotDraftError — 보낼 수 있는 모양인가', () => {
  it('라벨이 붙은 번호는 형식과 품목코드를 본다', () => {
    expect(lotDraftError({ ...EMPTY_LOT_DRAFT, lotNo: LABEL }, '040101-00022S')).toBeNull();
    expect(lotDraftError({ ...EMPTY_LOT_DRAFT, lotNo: LABEL }, null)).toBeNull();
    expect(lotDraftError({ ...EMPTY_LOT_DRAFT, lotNo: LABEL }, 'OTHER')).toBe(
      t.errors.lotItemMismatch('OTHER'),
    );
    expect(lotDraftError({ ...EMPTY_LOT_DRAFT, lotNo: 'DN-7' }, null)).toBe(t.errors.lotFormat);
  });

  it('라벨 없이 받아 적은 번호는 형식을 묻지 않는다', () => {
    expect(lotDraftError({ lotNo: 'DN-7', labelMissing: true, reasonCode: '' }, 'X')).toBeNull();
  });

  it('번호가 없으면 라벨 없음과 사유가 있어야 한다', () => {
    expect(lotDraftError(EMPTY_LOT_DRAFT, null)).toBe(t.errors.lotRequired);
    expect(lotDraftError({ lotNo: '', labelMissing: true, reasonCode: '' }, null)).toBe(
      t.errors.lotReasonRequired,
    );
    expect(
      lotDraftError({ lotNo: '', labelMissing: true, reasonCode: 'NO_LABEL' }, null),
    ).toBeNull();
  });
});
