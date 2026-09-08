import { describe, expect, it } from 'vitest';

import {
  LabelCommandError,
  buildLabelFromFields,
  parseHandWrittenJson,
  parseLabelCommand,
  sampleLabel,
} from './label-command';

const lotFields = {
  label: 'lot',
  type: 'RM',
  status: 'OK',
  partNo: 'PC-1001',
  partName: 'PC RESIN BLK',
  lotNo: '260904-R01',
  qty: '25',
  uom: 'KG',
  dateCaption: 'RCV DT',
  dateTime: '26-09-04 09:10',
};

describe('명령줄 읽기', () => {
  // ⚠ 깃발이 없으면 평소 기동이다 — 여기서 막으면 단말이 켜지지 않는다.
  it.each([[[]], [['--inspect']], [['/path/to/app']]])('라벨 깃발이 없으면 비운다', (argv) => {
    expect(parseLabelCommand(argv)).toBeUndefined();
  });

  it.each([
    ['lot', 'lot'],
    ['shipping', 'shipping'],
  ])('견본 %s 을 읽는다', (given, expected) => {
    expect(parseLabelCommand(['app', '--print-sample', given])).toEqual({
      source: { kind: 'sample', label: expected },
      printerName: undefined,
    });
  });

  it('값 파일 경로를 읽는다', () => {
    expect(parseLabelCommand(['app', '--print-label', 'C:\\label.json'])).toEqual({
      source: { kind: 'file', path: 'C:\\label.json' },
      printerName: undefined,
    });
  });

  /* ⭐ 여러 대가 물린 단말에서만 이름으로 고른다. */
  it('보낼 프린터 이름을 명령에서 읽는다', () => {
    expect(
      parseLabelCommand(['app', '--print-sample', 'lot', '--printer', 'TSC TTP-247'])?.printerName,
    ).toBe('TSC TTP-247');
  });

  // ⚠ 이름을 안 주면 OS 기본 프린터로 간다 — 여기서 이름을 지어내지 않는다.
  it.each([
    [['app', '--print-sample', 'lot']],
    [['app', '--print-sample', 'lot', '--printer', '   ']],
  ])('이름을 주지 않으면 비운다', (argv) => {
    expect(parseLabelCommand(argv)?.printerName).toBeUndefined();
  });

  /* ⛔ 값을 빠뜨린 깃발이 다음 깃발을 값으로 삼키면 엉뚱한 프린터로 보낸다. */
  it('값을 빠뜨린 깃발이 다음 깃발을 삼키지 않는다', () => {
    expect(
      parseLabelCommand(['app', '--print-sample', 'lot', '--printer', '--print-label'])?.printerName,
    ).toBeUndefined();
  });

  /*
   * ⛔ 모르는 값을 견본으로 흘려보내지 않는다. 잘못 적은 것을 조용히 기본값으로 바꾸면
   *    엉뚱한 규격이 나오고, 그 종이는 이미 자재에 붙는다.
   */
  it.each([
    [['app', '--print-sample']],
    [['app', '--print-sample', 'pallet']],
    [['app', '--print-sample', '--print-label']],
  ])('모르는 견본 이름은 던진다', (argv) => {
    expect(() => parseLabelCommand(argv)).toThrow(LabelCommandError);
  });

  it.each([[['app', '--print-label']], [['app', '--print-label', '--print-sample']]])(
    '값 파일 경로가 없으면 던진다',
    (argv) => {
      expect(() => parseLabelCommand(argv)).toThrow(LabelCommandError);
    },
  );
});

describe('값 파일에서 라벨 만들기', () => {
  it('사양서 필수 항목을 그대로 싣는다', () => {
    const label = buildLabelFromFields(lotFields);

    expect(label).toContain('"PART NO.: PC-1001"');
    expect(label).toContain('"RCV DT: 26-09-04 09:10"');
    expect(label).toContain('"L1|RM|PC-1001|260904-R01|25|KG"');
  });

  it('숫자로 준 수량도 받는다 — 값 파일을 손으로 적는다', () => {
    expect(buildLabelFromFields({ ...lotFields, qty: 25 })).toContain('"QTY: 25 KG"');
  });

  it('유형별 추가 항목은 없어도 된다', () => {
    expect(() => buildLabelFromFields(lotFields)).not.toThrow();
    expect(buildLabelFromFields({ ...lotFields, extra: 'PO NO.: PO-77' })).toContain(
      '"PO NO.: PO-77"',
    );
  });

  /*
   * ⛔ 여기가 「빈 칸이 있는 라벨을 찍지 않는다」가 서는 자리다. 라벨은 나오는 순간 자재에
   *    붙고, 빠진 칸은 그 자재의 이력을 끊는다.
   */
  it('빠진 값을 한 번에 말하고 아무것도 만들지 않는다', () => {
    const broken = { ...lotFields, lotNo: '  ', qty: '' };

    expect(() => buildLabelFromFields(broken)).toThrow(/lotNo.*qty|qty.*lotNo/);
  });

  it.each([[null], ['lot'], [{}], [{ label: 'pallet' }]])(
    '무엇을 만들지 모르면 던진다 (%s)',
    (source) => {
      expect(() => buildLabelFromFields(source)).toThrow(LabelCommandError);
    },
  );

  it('출하 라벨도 필수 항목을 검사한다', () => {
    expect(() => buildLabelFromFields({ label: 'shipping', type: 'SHIP' })).toThrow(
      /customerPartNo/,
    );
  });
});

describe('견본', () => {
  /*
   * ⭐ **대지는 «걸린 라벨지»다**(사용자 확인 2026-09-08) — 서식 크기가 아니다. 어긋나게
   *    적으면 프린터가 오류를 내고 한 장도 안 나온다.
   */
  it.each(['lot', 'shipping'] as const)('%s 견본은 걸린 라벨지 대지를 잡는다', (kind) => {
    expect(sampleLabel(kind)).toContain('SIZE 100 mm,60 mm');
  });
});

describe('손으로 적은 JSON', () => {
  it('보통 파일을 읽는다', () => {
    expect(parseHandWrittenJson('{ "port": "COM3" }')).toEqual({ port: 'COM3' });
  });

  /*
   * ⚠ 메모장이 UTF-8 로 저장하면 보이지 않는 표식이 앞에 붙는다. 그대로 넘기면 파일은
   *   멀쩡해 보이는데 앱만 형식이 틀렸다고 해서 사람이 원인을 찾을 수 없다.
   */
  it('메모장이 붙인 BOM 을 견딘다', () => {
    expect(parseHandWrittenJson('﻿{ "port": "COM3" }')).toEqual({ port: 'COM3' });
  });

  it('진짜로 틀린 것은 무엇이 틀렸는지 말한다', () => {
    expect(() => parseHandWrittenJson('{ port: COM3 ')).toThrow(/쉼표·따옴표/);
  });
});
