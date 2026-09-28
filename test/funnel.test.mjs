import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  parseSenlerBridgeContext, parseSenlerBridgeFunnelConfiguratorResult,
  parseSenlerBridgeRequestMessage, createSubmitRequestMessage,
  SENLER_BRIDGE_REQUEST, resolveSenlerBridgeBootstrapContext,
} from '../dist/index.js';

const launch = {
  type: 'funnel_configurator', app_id: 'app', project_id: 'project', installation_id: 'installation',
  funnel_id: 'funnel', source_id: null, element: { id: 'element', key: 'visitors', title: 'Visitors' },
  configuration: { counter: '42' }, metric_key: 'visitors',
};

test('funnel launch preserves its own context and configuration', () => {
  const context = { ui: { language: 'ru', theme: 'dark' }, launch };
  assert.deepEqual(parseSenlerBridgeContext(context), context);
  for (const key of ['funnel_id', 'installation_id', 'element', 'metric_key']) {
    assert.equal(parseSenlerBridgeContext({ ...context, launch: { ...launch, [key]: null } }), null);
  }
  assert.equal(resolveSenlerBridgeBootstrapContext('?senler_mode=funnel_configurator&senler_context_version=2', 'ru', false).mode, 'funnel_configurator');
});

test('funnel submission accepts bounded JSON and rejects another configurator kind', () => {
  const result = { kind: 'funnel_configurator', configuration: { counter: '42', filters: ['paid'] }, data_source_key: 'metrika:counter:42' };
  assert.deepEqual(parseSenlerBridgeFunnelConfiguratorResult(result), result);
  for (const data_source_key of [undefined, null, '', ' ', 'x'.repeat(257), 'counter\n42']) {
    assert.equal(parseSenlerBridgeFunnelConfiguratorResult({ ...result, data_source_key }), null);
  }
  assert.equal(parseSenlerBridgeFunnelConfiguratorResult({ ...result, kind: 'automation_step_configurator' }), null);
  assert.equal(parseSenlerBridgeFunnelConfiguratorResult({ ...result, configuration: JSON.parse('{"__proto__":{}}') }), null);
  assert.equal(parseSenlerBridgeFunnelConfiguratorResult({ ...result, configuration: { value: 'x'.repeat(65_536) } }), null);
  const request = createSubmitRequestMessage('funnel-submit', SENLER_BRIDGE_REQUEST.funnelConfiguratorSubmit);
  assert.equal(parseSenlerBridgeRequestMessage(request)?.method, 'funnel-configurator.submit');
});
