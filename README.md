# @senlerio/bridge

Framework-independent bridge between a Senler host and an embedded application.
No React, CSS or other runtime dependencies.

```sh
npm install @senlerio/bridge@https://github.com/SenlerBot/senler-bridge/archive/refs/tags/v1.0.0.tar.gz
```


Applications opened inside Senler use the typed bridge instead of calling
`window.postMessage` directly. The bridge validates the parent origin, applies
the initial language and theme, and receives their live updates without
reloading the iframe:

```ts
import {
  createSenlerBridgeClient,
  resolveSenlerBridgeBootstrapContext,
} from '@senlerio/bridge';

const bootstrap = resolveSenlerBridgeBootstrapContext(
  location.search,
  navigator.language,
  matchMedia('(prefers-color-scheme: dark)').matches,
);
// bootstrap.mode identifies the surface before Bridge connects.

const bridge = createSenlerBridgeClient({
  parentOrigin: 'https://senler.io',
});

bridge.onContextChange(({ ui, launch }) => {
  // ui: { language: 'ru' | 'en', theme: 'light' | 'dark' }
  // launch identifies an embedded page, tool configurator, or automation step.
});

bridge.onToolConfiguratorSubmit(() => ({
  configuration: {},
  configured_parameters: [],
}));

await bridge.connect();
```

OAuth and signed launch sessions remain the authentication boundary. Do not
send Senler access tokens or application secrets through the bridge.

Subpath imports are also available when a project wants narrower imports:

```tsx
import { Button } from '@senler/ui/atoms/button';
import { SearchableSelect } from '@senler/ui/compound/searchable-select';
import { LayoutContainer } from '@senler/ui/layout/container';
```


## Migration and development

Replace imports from `@senler/ui/bridge` with `@senlerio/bridge`. The protocol and
exported APIs are unchanged; installations which only use the bridge can remove
`@senler/ui` and its UI peers. Follow the host/client origin and handshake checks
in the examples; never accept arbitrary message origins.

Canonical sources live in `senler-ui/packages/bridge`. The public GitHub repository
contains this package and its compiled `dist`. Run `npm ci` and `npm run build`
to compile declarations and exercise host/client handshakes, context updates,
configurators, frame sizing and disposal.
