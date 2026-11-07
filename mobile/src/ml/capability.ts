import * as Device from 'expo-device';
import { llmSupported } from '../lib/modePolicy';

/** Whether this phone can run the on-phone language model (notes and questions). False on 32-bit phones; the leaf scan does not depend on it. */
export const offlineLlmSupported = () => llmSupported(Device.supportedCpuArchitectures);
