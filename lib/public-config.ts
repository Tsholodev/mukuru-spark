export function getPublicDemoConfig() {
  return {
    appName: process.env.NEXT_PUBLIC_APP_NAME ?? "Senda",
    ussdDemoCode: process.env.NEXT_PUBLIC_USSD_DEMO_CODE ?? "*120#",
  };
}

export const publicDemoConfig = getPublicDemoConfig();