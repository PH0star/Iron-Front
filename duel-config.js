// GitHub Pages serves the PWA. The Worker and the local server also serve their own rooms.
globalThis.IRON_ROOM_ORIGIN = location.origin === 'https://ph0star.github.io'
  ? 'https://iron-front-duel-beta.phostudy.workers.dev'
  : '';
