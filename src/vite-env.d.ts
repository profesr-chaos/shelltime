/// <reference types="vite/client" />
import type { ShelltimeApi } from '../electron/preload';

declare global {
  interface Window {
    api: ShelltimeApi;
  }
}

export {};
