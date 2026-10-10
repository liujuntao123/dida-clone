import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'com.dida.clone',
  appName: '滴答清单',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
  },
  android: {
    allowMixedContent: false,
  },
  plugins: {
    StatusBar: {
      style: 'DEFAULT',
    },
    Keyboard: {
      resize: 'body',
    },
  },
}

export default config
