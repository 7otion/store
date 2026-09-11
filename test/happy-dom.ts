import { GlobalRegistrator } from '@happy-dom/global-registrator';

// Its own preload: Testing Library binds `screen` to document.body on import,
// so the DOM has to exist before any module that touches it loads.
if (!('document' in globalThis)) GlobalRegistrator.register();
