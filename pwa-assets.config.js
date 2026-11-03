import { combinePresetAndAppleSplashScreens, defineConfig, minimal2023Preset } from '@vite-pwa/assets-generator/config';

const preset = {
  ...minimal2023Preset,
  maskable: {
    ...minimal2023Preset.maskable,
    resizeOptions: { background: '#000000' },
  },
  apple: {
    ...minimal2023Preset.apple,
    resizeOptions: { background: '#000000' },
  },
};

/**
 * iPads that postdate the generator's own device table. iOS only uses a launch
 * image that matches the device exactly; without one it stretches whatever it
 * has, so a model missing here gets a distorted splash in landscape.
 */
const newerIPads = {
  'iPad Pro 13" (M4)': { width: 2064, height: 2752, scaleFactor: 2 },
  'iPad Pro 11" (M4)': { width: 1668, height: 2420, scaleFactor: 2 },
};

export default defineConfig({
  preset: combinePresetAndAppleSplashScreens(
    preset,
    {
      padding: 0.38,
      resizeOptions: { background: '#141414' },
      png: { compressionLevel: 9, quality: 80 },
      name: (landscape, size) => {
        const dir = landscape ? 'apple-splash/v3/landscape' : 'apple-splash/v3/portrait';
        return `${dir}/${size.width}x${size.height}.png`;
      },
    },
    undefined,
    newerIPads,
  ),
  images: ['public/logo.svg'],
});
