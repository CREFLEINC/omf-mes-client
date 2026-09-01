import { BarcodeFormat, BarcodeScanner } from '@capacitor-mlkit/barcode-scanning';

export type CameraPermission = 'granted' | 'denied';

export interface QrCamera {
  /** 이 단말에서 카메라 인식을 쓸 수 있는가. 못 쓰면 화면이 등록 경로를 닫는다. */
  isSupported(): Promise<boolean>;
  requestPermission(): Promise<CameraPermission>;
  /**
   * 미리보기를 열고 코드를 읽을 때마다 onRead 를 부른다. 반환한 함수로 닫는다.
   *
   * 미리보기는 웹 화면 뒤에 그려지므로, 여는 쪽이 그 자리를 비워 두어야 보인다.
   */
  open(onRead: (value: string) => void): Promise<() => Promise<void>>;
}

/* 등록 QR 말고 다른 코드가 섞여 들어오면 값이 토큰이 아니게 된다. */
const REGISTRATION_FORMATS = [BarcodeFormat.QrCode];

export const createMlkitQrCamera = (): QrCamera => ({
  isSupported: async () => (await BarcodeScanner.isSupported()).supported,

  requestPermission: async () => {
    const { camera } = await BarcodeScanner.requestPermissions();
    return camera === 'granted' || camera === 'limited' ? 'granted' : 'denied';
  },

  open: async (onRead) => {
    const listener = await BarcodeScanner.addListener('barcodesScanned', (event) => {
      for (const barcode of event.barcodes) {
        // 값을 읽지 못한 코드도 인식 결과로 올라온다.
        if (barcode.rawValue !== undefined && barcode.rawValue !== '') {
          onRead(barcode.rawValue);
        }
      }
    });

    try {
      await BarcodeScanner.startScan({ formats: REGISTRATION_FORMATS });
    } catch (error) {
      // 열지 못했는데 듣는 것만 남으면 다시 시도할 때마다 쌓여 한 번 읽은 것이 여러 번이 된다.
      await listener.remove();
      throw error;
    }

    return async () => {
      await listener.remove();
      await BarcodeScanner.stopScan();
    };
  },
});
