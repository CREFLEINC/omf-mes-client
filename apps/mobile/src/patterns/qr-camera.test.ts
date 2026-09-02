import { beforeEach, describe, expect, it, vi } from 'vitest';

const plugin = vi.hoisted(() => ({
  listeners: 0,
  scans: 0,
  stops: 0,
  startFails: false,
  emit: null as ((event: { barcodes: { rawValue?: string }[] }) => void) | null,
}));

vi.mock('@capacitor-mlkit/barcode-scanning', () => ({
  BarcodeFormat: { QrCode: 'QR_CODE' },
  BarcodeScanner: {
    isSupported: () => Promise.resolve({ supported: true }),
    requestPermissions: () => Promise.resolve({ camera: 'granted' }),
    addListener: (
      _event: string,
      listener: (event: { barcodes: { rawValue?: string }[] }) => void,
    ) => {
      plugin.listeners += 1;
      plugin.emit = listener;
      return Promise.resolve({
        remove: () => {
          plugin.listeners -= 1;
          return Promise.resolve();
        },
      });
    },
    startScan: () => {
      if (plugin.startFails) {
        return Promise.reject(new Error('카메라를 열지 못했습니다'));
      }
      plugin.scans += 1;
      return Promise.resolve();
    },
    stopScan: () => {
      plugin.stops += 1;
      return Promise.resolve();
    },
  },
}));

const { createMlkitQrCamera } = await import('./qr-camera');

beforeEach(() => {
  plugin.listeners = 0;
  plugin.scans = 0;
  plugin.stops = 0;
  plugin.startFails = false;
  plugin.emit = null;
});

describe('QR 카메라 어댑터', () => {
  it('읽은 값을 그대로 넘긴다', async () => {
    const read = vi.fn();
    await createMlkitQrCamera().open(read);

    plugin.emit?.({ barcodes: [{ rawValue: 'SYN-TOKEN' }] });

    expect(read).toHaveBeenCalledWith('SYN-TOKEN');
  });

  /* 값을 읽지 못한 코드도 인식 결과로 올라온다. */
  it('빈 값이나 값 없는 코드는 넘기지 않는다', async () => {
    const read = vi.fn();
    await createMlkitQrCamera().open(read);

    plugin.emit?.({ barcodes: [{ rawValue: '' }, {}] });

    expect(read).not.toHaveBeenCalled();
  });

  it('닫으면 듣는 것과 미리보기를 함께 거둔다', async () => {
    const close = await createMlkitQrCamera().open(vi.fn());

    expect(plugin.listeners).toBe(1);
    await close();

    expect(plugin.listeners).toBe(0);
    expect(plugin.stops).toBe(1);
  });

  /* 듣는 것만 남으면 다시 시도할 때마다 쌓여 한 번 읽은 것이 여러 번이 된다. */
  it('미리보기를 열지 못하면 듣는 것도 남기지 않는다', async () => {
    plugin.startFails = true;

    await expect(createMlkitQrCamera().open(vi.fn())).rejects.toThrow();
    expect(plugin.listeners).toBe(0);
  });
});
