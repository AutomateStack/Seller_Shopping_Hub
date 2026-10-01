/// <reference types="vite/client" />

declare global {
  interface Window {
    dataLayer: unknown[];
    gtag: (
      command: "js" | "config" | "event",
      targetOrEventName: string | Date,
      ...args: Record<string, unknown>[]
    ) => void;
  }
}

export {};
