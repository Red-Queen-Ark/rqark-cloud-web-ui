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

export default defineConfig({
  preset: combinePresetAndAppleSplashScreens(preset, {
    padding: 0.38,
    resizeOptions: { background: '#141414' },
    png: { compressionLevel: 9, quality: 80 },
    name: (landscape, size) => {
      const dir = landscape ? 'apple-splash/landscape' : 'apple-splash/portrait';
      return `${dir}/${size.width}x${size.height}.png`;
    },
  }),
  images: ['public/logo.svg'],
});
