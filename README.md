# @senlerio/bridge

Framework-independent bridge between a Senler host and an embedded application.
No React, CSS or other runtime dependencies.

This source package implements Bridge 2.0.0. Install its tested package archive
in the host and the embedded application:

```sh
npm install ./senlerio-bridge-2.0.0.tgz
```

To produce the archive from this directory, run `npm ci`, `npm run build`, and
`npm pack`. Public release tags are usable only after that release is published.

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
  // launch identifies an embedded page, tool, automation step, or funnel configurator.
});

bridge.onToolConfiguratorSubmit(() => ({
  configuration: {},
  configured_parameters: [],
}));

await bridge.connect();
```

OAuth and signed launch sessions remain the authentication boundary. Do not
send Senler access tokens or application secrets through the bridge.

## Funnel configurators

Funnel forms require Bridge 2.0.0 in both the host and the embedded application.
The launch context includes `metric_key`, `element`, `source_id` (null for a new
connection), and the saved `configuration`. Read it with `onContextChange`.
The host requests submission when the user saves the form:

```ts
bridge.onFunnelConfiguratorSubmit(() => ({
  kind: 'funnel_configurator',
  configuration: { counter_id: '42' },
  data_source_key: 'metrika:counter:42',
}));
```

`data_source_key` is required and identifies the selected dataset. Keep it stable
when display settings change; change it when the counter or account changes.
The key accepts 1–256 ASCII letters, digits, or `._:/-`. The host uses a changed
key to request confirmation before replacing the connection. Configuration
contains settings, not access tokens or application secrets.

## Development

Import the bridge from `@senlerio/bridge`. Follow the host/client origin and
handshake checks in the examples; never accept arbitrary message origins.

Canonical sources live in `senler-ui/packages/bridge`. The public GitHub repository
contains this package and its compiled `dist`. Run `npm ci` and `npm run build`
to compile declarations and exercise host/client handshakes, context updates,
configurators, frame sizing and disposal.
