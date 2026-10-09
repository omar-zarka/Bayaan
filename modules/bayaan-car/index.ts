import {requireOptionalNativeModule} from 'expo-modules-core';

interface BayaanCarNative {
  readonly __brand?: 'BayaanCar';
}

export const BayaanCarNativeModule: BayaanCarNative | null =
  requireOptionalNativeModule<BayaanCarNative>('BayaanCar');
