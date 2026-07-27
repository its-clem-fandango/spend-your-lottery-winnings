// @ts-check
import { defineConfig } from 'astro/config';
import svelte from '@astrojs/svelte';

export default defineConfig({
  site: 'https://spend-your-lottery-winnings.vercel.app',
  integrations: [svelte()],
  // Static output: a plain directory of HTML/CSS/JS/images. No adapter, no
  // runtime, deployable anywhere. Add @astrojs/vercel only if a route ever
  // needs on-demand rendering.
  output: 'static',
  build: { inlineStylesheets: 'auto' },
  image: {
    // Both of these are OFF by default in Astro and their absence is silent:
    // without `layout` there is no srcset, and without `responsiveStyles` the
    // generated srcset never actually resizes anything.
    layout: 'constrained',
    responsiveStyles: true,
    objectFit: 'cover',
    service: {
      entrypoint: 'astro/assets/services/sharp',
      config: {
        avif: { effort: 5 },
        webp: { effort: 5 }
      }
    }
  }
});
