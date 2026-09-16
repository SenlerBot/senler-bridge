export const SENLER_BRIDGE_PROTOCOL_VERSION = 1;
export const SENLER_BRIDGE_SOURCE = 'senler-bridge';
export const SENLER_BRIDGE_BOOTSTRAP_CONTEXT_VERSION = '2';
export const SENLER_BRIDGE_BOOTSTRAP_MODE = {
    installed: 'installed',
    test: 'test',
    toolConfigurator: 'tool_configurator',
    automationStepConfigurator: 'automation_step_configurator',
};
export const SENLER_BRIDGE_MESSAGE = {
    ready: 'senler:bridge:ready',
    init: 'senler:bridge:init',
    ui: 'senler:bridge:ui',
    request: 'senler:bridge:request',
    response: 'senler:bridge:response',
    frameSize: 'senler:bridge:frame-size',
    elementAction: 'senler:bridge:element-action',
    elementActionResult: 'senler:bridge:element-action-result',
    clearElementHighlight: 'senler:bridge:clear-element-highlight',
};
export const SENLER_BRIDGE_REQUEST = {
    toolConfiguratorSubmit: 'tool-configurator.submit',
    automationStepConfiguratorSubmit: 'automation-step-configurator.submit',
};
const MAX_JSON_DEPTH = 20;
const MAX_JSON_NODES = 5000;
const MAX_JSON_BYTES = 64 * 1024;
const MAX_REQUEST_ID_LENGTH = 128;
const MAX_TITLE_LENGTH = 160;
const MAX_PARAMETER_NAME_LENGTH = 64;
const MAX_PARAMETER_DESCRIPTION_LENGTH = 500;
const MAX_CONFIGURED_PARAMETERS = 50;
const MAX_ALLOWED_VALUES = 100;
const MAX_ERROR_MESSAGE_LENGTH = 1000;
const MAX_FRAME_HEIGHT = 100000;
const MAX_CONTEXT_ID_LENGTH = 160;
const MAX_AUTOMATION_BRANCHES = 20;
const AUTOMATION_BRANCH_KEY_PATTERN = /^[A-Za-z][A-Za-z0-9_-]{0,63}$/;
const UUID_PATTERN = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$/;
const FORBIDDEN_JSON_KEYS = new Set(['__proto__', 'constructor', 'prototype']);
function isRecord(value) {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}
function hasBridgeEnvelope(value) {
    return (isRecord(value) &&
        value.source === SENLER_BRIDGE_SOURCE &&
        value.protocol_version === SENLER_BRIDGE_PROTOCOL_VERSION);
}
function isNonEmptyString(value) {
    return typeof value === 'string' && value.length > 0;
}
export function parseSenlerBridgeUiContext(value) {
    if (isRecord(value) &&
        (value.language === 'ru' || value.language === 'en') &&
        (value.theme === 'light' || value.theme === 'dark')) {
        return { language: value.language, theme: value.theme };
    }
    return null;
}
function isJsonValue(value, depth, state) {
    if (depth > MAX_JSON_DEPTH)
        return false;
    state.visitedNodes += 1;
    if (state.visitedNodes > MAX_JSON_NODES)
        return false;
    if (value === null ||
        typeof value === 'string' ||
        typeof value === 'boolean') {
        return typeof value !== 'string' || value.length <= MAX_JSON_BYTES;
    }
    if (typeof value === 'number')
        return Number.isFinite(value);
    if (typeof value !== 'object' || state.seen.has(value))
        return false;
    state.seen.add(value);
    if (Array.isArray(value)) {
        return value.every((item) => isJsonValue(item, depth + 1, state));
    }
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null)
        return false;
    return (isRecord(value) &&
        Object.keys(value).every((key) => !FORBIDDEN_JSON_KEYS.has(key)) &&
        Object.values(value).every((item) => isJsonValue(item, depth + 1, state)));
}
function isJsonObject(value) {
    if (!isRecord(value))
        return false;
    const state = { seen: new Set(), visitedNodes: 0 };
    if (!isJsonValue(value, 0, state))
        return false;
    return new TextEncoder().encode(JSON.stringify(value)).byteLength <= MAX_JSON_BYTES;
}
export function parseSenlerBridgeJsonObject(value) {
    return isJsonObject(value) ? value : null;
}
function parseConfiguredParameter(value) {
    if (!isRecord(value) ||
        !isNonEmptyString(value.name) ||
        value.name.length > MAX_PARAMETER_NAME_LENGTH ||
        (value.type !== 'string' &&
            value.type !== 'number' &&
            value.type !== 'boolean') ||
        (value.description !== undefined &&
            (typeof value.description !== 'string' ||
                value.description.length > MAX_PARAMETER_DESCRIPTION_LENGTH)) ||
        typeof value.required !== 'boolean' ||
        !Array.isArray(value.allowed_values) ||
        value.allowed_values.length > MAX_ALLOWED_VALUES) {
        return null;
    }
    const parameterType = value.type;
    const allowedValues = value.allowed_values.filter((allowedValue) => typeof allowedValue === parameterType);
    if (allowedValues.length !== value.allowed_values.length)
        return null;
    return {
        name: value.name,
        type: parameterType,
        ...(typeof value.description === 'string'
            ? { description: value.description }
            : {}),
        required: value.required,
        allowed_values: allowedValues,
    };
}
function parseConfiguredParameters(value) {
    if (!Array.isArray(value) || value.length > MAX_CONFIGURED_PARAMETERS) {
        return null;
    }
    const parameters = value.map(parseConfiguredParameter);
    if (parameters.some((parameter) => parameter === null))
        return null;
    return parameters.filter((parameter) => parameter !== null);
}
function parseToolInstance(value) {
    if (!isRecord(value) ||
        !isNonEmptyString(value.id) ||
        typeof value.title !== 'string' ||
        !isJsonObject(value.configuration) ||
        typeof value.has_private_data !== 'boolean' ||
        typeof value.private_data_required !== 'boolean' ||
        (value.status !== 'active' && value.status !== 'setup_required')) {
        return null;
    }
    const configuredParameters = parseConfiguredParameters(value.configured_parameters);
    if (!configuredParameters)
        return null;
    return {
        id: value.id,
        title: value.title,
        configuration: value.configuration,
        configured_parameters: configuredParameters,
        has_private_data: value.has_private_data,
        private_data_required: value.private_data_required,
        status: value.status,
    };
}
function parseAutomationStepBranches(value) {
    if (!Array.isArray(value) || value.length > MAX_AUTOMATION_BRANCHES)
        return null;
    const branches = value.flatMap((branch) => {
        if (!isRecord(branch) ||
            !isNonEmptyString(branch.branch_id) ||
            !UUID_PATTERN.test(branch.branch_id) ||
            !isNonEmptyString(branch.key) ||
            !AUTOMATION_BRANCH_KEY_PATTERN.test(branch.key) ||
            !isNonEmptyString(branch.title) ||
            branch.title.length > MAX_TITLE_LENGTH) {
            return [];
        }
        return [
            {
                branch_id: branch.branch_id,
                key: branch.key,
                title: branch.title,
            },
        ];
    });
    if (branches.length !== value.length)
        return null;
    const branchIds = new Set(branches.map((branch) => branch.branch_id));
    const branchKeys = new Set(branches.map((branch) => branch.key));
    return branchIds.size === branches.length && branchKeys.size === branches.length
        ? branches
        : null;
}
function parseLaunchContext(value) {
    if (!isRecord(value) ||
        !isNonEmptyString(value.app_id) ||
        !isNonEmptyString(value.project_id)) {
        return null;
    }
    if (value.type === 'embedded_page') {
        if ((value.mode !== 'installed' && value.mode !== 'test') ||
            (value.installation_id !== undefined &&
                !isNonEmptyString(value.installation_id))) {
            return null;
        }
        return {
            type: 'embedded_page',
            app_id: value.app_id,
            project_id: value.project_id,
            ...(typeof value.installation_id === 'string'
                ? { installation_id: value.installation_id }
                : {}),
            mode: value.mode,
        };
    }
    if (value.type === 'automation_step_configurator') {
        if (!isNonEmptyString(value.installation_id) ||
            !isNonEmptyString(value.automation_id) ||
            !isNonEmptyString(value.node_id) ||
            !isRecord(value.step) ||
            !isNonEmptyString(value.step.id) ||
            !isNonEmptyString(value.step.name) ||
            (value.step.continuation_mode !== 'next' &&
                value.step.continuation_mode !== 'fixed' &&
                value.step.continuation_mode !== 'configured') ||
            !isJsonObject(value.configuration)) {
            return null;
        }
        const branches = parseAutomationStepBranches(value.branches);
        if (!branches)
            return null;
        return {
            type: 'automation_step_configurator',
            app_id: value.app_id,
            project_id: value.project_id,
            installation_id: value.installation_id,
            automation_id: value.automation_id,
            node_id: value.node_id,
            step: {
                id: value.step.id,
                name: value.step.name,
                continuation_mode: value.step.continuation_mode,
            },
            configuration: value.configuration,
            branches,
        };
    }
    if (value.type !== 'tool_configurator' ||
        !isNonEmptyString(value.installation_id) ||
        !isNonEmptyString(value.agent_id) ||
        (value.mode !== 'create' && value.mode !== 'edit') ||
        !isRecord(value.tool) ||
        !isNonEmptyString(value.tool.id) ||
        !isNonEmptyString(value.tool.name) ||
        typeof value.tool.description !== 'string') {
        return null;
    }
    const instance = value.instance === null ? null : parseToolInstance(value.instance);
    if (value.instance !== null && !instance)
        return null;
    return {
        type: 'tool_configurator',
        app_id: value.app_id,
        project_id: value.project_id,
        installation_id: value.installation_id,
        agent_id: value.agent_id,
        mode: value.mode,
        tool: {
            id: value.tool.id,
            name: value.tool.name,
            description: value.tool.description,
        },
        instance,
    };
}
export function parseSenlerBridgeContext(value) {
    if (!isRecord(value) ||
        (value.frame_size_sync !== undefined &&
            typeof value.frame_size_sync !== 'boolean')) {
        return null;
    }
    const ui = parseSenlerBridgeUiContext(value.ui);
    if (!ui)
        return null;
    const launch = parseLaunchContext(value.launch);
    return launch
        ? {
            ui,
            launch,
            ...(typeof value.frame_size_sync === 'boolean'
                ? { frame_size_sync: value.frame_size_sync }
                : {}),
        }
        : null;
}
export function parseSenlerBridgeToolConfiguratorResult(value) {
    if (!isRecord(value) ||
        (value.title !== undefined &&
            (typeof value.title !== 'string' || value.title.length > MAX_TITLE_LENGTH)) ||
        !isJsonObject(value.configuration) ||
        (value.private_data_action !== undefined &&
            value.private_data_action !== 'preserve' &&
            value.private_data_action !== 'replace' &&
            value.private_data_action !== 'clear') ||
        (value.private_data !== undefined && !isJsonObject(value.private_data)) ||
        (value.private_data_required !== undefined &&
            typeof value.private_data_required !== 'boolean')) {
        return null;
    }
    if ((value.private_data_action === 'replace' && value.private_data === undefined) ||
        (value.private_data !== undefined && value.private_data_action !== 'replace')) {
        return null;
    }
    const configuredParameters = parseConfiguredParameters(value.configured_parameters);
    if (!configuredParameters)
        return null;
    return {
        ...(typeof value.title === 'string' ? { title: value.title } : {}),
        configuration: value.configuration,
        configured_parameters: configuredParameters,
        ...(value.private_data_action === 'preserve' ||
            value.private_data_action === 'replace' ||
            value.private_data_action === 'clear'
            ? { private_data_action: value.private_data_action }
            : {}),
        ...(value.private_data !== undefined
            ? { private_data: value.private_data }
            : {}),
        ...(typeof value.private_data_required === 'boolean'
            ? { private_data_required: value.private_data_required }
            : {}),
    };
}
export function parseSenlerBridgeAutomationStepConfiguratorResult(value) {
    if (!isRecord(value) ||
        value.kind !== 'automation_step_configurator' ||
        !isJsonObject(value.configuration)) {
        return null;
    }
    const branches = parseAutomationStepBranches(value.branches);
    return branches
        ? {
            kind: 'automation_step_configurator',
            configuration: value.configuration,
            branches,
        }
        : null;
}
const SENLER_BRIDGE_ELEMENT_ACTIONS = [
    'highlight',
    'scroll_to',
    'focus',
    'click',
    'fill',
    'clear',
    'select',
    'toggle',
];
const SENLER_BRIDGE_ELEMENT_ACTION_STATUSES = [
    'success',
    'not_found',
    'failed',
    'blocked',
];
function isElementAction(value) {
    return (typeof value === 'string' &&
        SENLER_BRIDGE_ELEMENT_ACTIONS.some((action) => action === value));
}
function isElementActionStatus(value) {
    return (typeof value === 'string' &&
        SENLER_BRIDGE_ELEMENT_ACTION_STATUSES.some((status) => status === value));
}
export function parseSenlerBridgeElementActionRequest(value) {
    if (!isRecord(value) ||
        !isNonEmptyString(value.context_id) ||
        value.context_id.length > MAX_CONTEXT_ID_LENGTH ||
        !isElementAction(value.action) ||
        (value.value !== undefined && typeof value.value !== 'string')) {
        return null;
    }
    return {
        context_id: value.context_id,
        action: value.action,
        ...(typeof value.value === 'string' ? { value: value.value } : {}),
    };
}
export function parseSenlerBridgeElementActionResult(value) {
    if (!isRecord(value) ||
        !isElementActionStatus(value.status) ||
        (value.matched_context_id !== undefined &&
            (typeof value.matched_context_id !== 'string' ||
                value.matched_context_id.length > MAX_CONTEXT_ID_LENGTH)) ||
        (value.matched_count !== undefined &&
            (typeof value.matched_count !== 'number' ||
                !Number.isInteger(value.matched_count) ||
                value.matched_count < 0)) ||
        (value.error_code !== undefined && typeof value.error_code !== 'string') ||
        (value.error_message !== undefined &&
            (typeof value.error_message !== 'string' ||
                value.error_message.length > MAX_ERROR_MESSAGE_LENGTH))) {
        return null;
    }
    return {
        status: value.status,
        ...(typeof value.matched_context_id === 'string'
            ? { matched_context_id: value.matched_context_id }
            : {}),
        ...(typeof value.matched_count === 'number'
            ? { matched_count: value.matched_count }
            : {}),
        ...(typeof value.error_code === 'string'
            ? { error_code: value.error_code }
            : {}),
        ...(typeof value.error_message === 'string'
            ? { error_message: value.error_message }
            : {}),
    };
}
export function isSenlerBridgeReadyMessage(value) {
    return hasBridgeEnvelope(value) && value.type === SENLER_BRIDGE_MESSAGE.ready;
}
export function parseSenlerBridgeInitMessage(value) {
    if (!hasBridgeEnvelope(value) || value.type !== SENLER_BRIDGE_MESSAGE.init) {
        return null;
    }
    const context = parseSenlerBridgeContext(value.context);
    return context
        ? {
            source: SENLER_BRIDGE_SOURCE,
            type: SENLER_BRIDGE_MESSAGE.init,
            protocol_version: SENLER_BRIDGE_PROTOCOL_VERSION,
            context,
        }
        : null;
}
export function parseSenlerBridgeUiMessage(value) {
    if (!hasBridgeEnvelope(value) || value.type !== SENLER_BRIDGE_MESSAGE.ui) {
        return null;
    }
    const ui = parseSenlerBridgeUiContext(value.ui);
    if (!ui) {
        return null;
    }
    return {
        source: SENLER_BRIDGE_SOURCE,
        type: SENLER_BRIDGE_MESSAGE.ui,
        protocol_version: SENLER_BRIDGE_PROTOCOL_VERSION,
        ui,
    };
}
export function parseSenlerBridgeFrameSizeMessage(value) {
    if (!hasBridgeEnvelope(value) ||
        value.type !== SENLER_BRIDGE_MESSAGE.frameSize ||
        typeof value.height !== 'number' ||
        !Number.isInteger(value.height) ||
        value.height < 1 ||
        value.height > MAX_FRAME_HEIGHT) {
        return null;
    }
    return {
        source: SENLER_BRIDGE_SOURCE,
        type: SENLER_BRIDGE_MESSAGE.frameSize,
        protocol_version: SENLER_BRIDGE_PROTOCOL_VERSION,
        height: value.height,
    };
}
export function parseSenlerBridgeRequestMessage(value) {
    if (!hasBridgeEnvelope(value) ||
        value.type !== SENLER_BRIDGE_MESSAGE.request ||
        (value.method !== SENLER_BRIDGE_REQUEST.toolConfiguratorSubmit &&
            value.method !== SENLER_BRIDGE_REQUEST.automationStepConfiguratorSubmit) ||
        !isNonEmptyString(value.request_id) ||
        value.request_id.length > MAX_REQUEST_ID_LENGTH) {
        return null;
    }
    return {
        source: SENLER_BRIDGE_SOURCE,
        type: SENLER_BRIDGE_MESSAGE.request,
        protocol_version: SENLER_BRIDGE_PROTOCOL_VERSION,
        request_id: value.request_id,
        method: value.method,
    };
}
export function parseSenlerBridgeResponseMessage(value) {
    if (!hasBridgeEnvelope(value) ||
        value.type !== SENLER_BRIDGE_MESSAGE.response ||
        !isNonEmptyString(value.request_id) ||
        value.request_id.length > MAX_REQUEST_ID_LENGTH) {
        return null;
    }
    if (value.ok === false) {
        if (!isNonEmptyString(value.error) ||
            value.error.length > MAX_ERROR_MESSAGE_LENGTH) {
            return null;
        }
        return {
            source: SENLER_BRIDGE_SOURCE,
            type: SENLER_BRIDGE_MESSAGE.response,
            protocol_version: SENLER_BRIDGE_PROTOCOL_VERSION,
            request_id: value.request_id,
            ok: false,
            error: value.error.trim(),
        };
    }
    if (value.ok !== true)
        return null;
    const result = parseSenlerBridgeAutomationStepConfiguratorResult(value.result) ??
        parseSenlerBridgeToolConfiguratorResult(value.result);
    return result
        ? {
            source: SENLER_BRIDGE_SOURCE,
            type: SENLER_BRIDGE_MESSAGE.response,
            protocol_version: SENLER_BRIDGE_PROTOCOL_VERSION,
            request_id: value.request_id,
            ok: true,
            result,
        }
        : null;
}
export function parseSenlerBridgeElementActionMessage(value) {
    if (!hasBridgeEnvelope(value) ||
        value.type !== SENLER_BRIDGE_MESSAGE.elementAction ||
        !isNonEmptyString(value.request_id) ||
        value.request_id.length > MAX_REQUEST_ID_LENGTH) {
        return null;
    }
    const request = parseSenlerBridgeElementActionRequest(value.request);
    return request
        ? {
            source: SENLER_BRIDGE_SOURCE,
            type: SENLER_BRIDGE_MESSAGE.elementAction,
            protocol_version: SENLER_BRIDGE_PROTOCOL_VERSION,
            request_id: value.request_id,
            request,
        }
        : null;
}
export function parseSenlerBridgeElementActionResultMessage(value) {
    if (!hasBridgeEnvelope(value) ||
        value.type !== SENLER_BRIDGE_MESSAGE.elementActionResult ||
        !isNonEmptyString(value.request_id) ||
        value.request_id.length > MAX_REQUEST_ID_LENGTH) {
        return null;
    }
    const result = parseSenlerBridgeElementActionResult(value.result);
    return result
        ? {
            source: SENLER_BRIDGE_SOURCE,
            type: SENLER_BRIDGE_MESSAGE.elementActionResult,
            protocol_version: SENLER_BRIDGE_PROTOCOL_VERSION,
            request_id: value.request_id,
            result,
        }
        : null;
}
export function isSenlerBridgeClearElementHighlightMessage(value) {
    return (hasBridgeEnvelope(value) &&
        value.type === SENLER_BRIDGE_MESSAGE.clearElementHighlight);
}
export function createReadyMessage() {
    return {
        source: SENLER_BRIDGE_SOURCE,
        type: SENLER_BRIDGE_MESSAGE.ready,
        protocol_version: SENLER_BRIDGE_PROTOCOL_VERSION,
    };
}
export function createInitMessage(context) {
    return {
        source: SENLER_BRIDGE_SOURCE,
        type: SENLER_BRIDGE_MESSAGE.init,
        protocol_version: SENLER_BRIDGE_PROTOCOL_VERSION,
        context,
    };
}
export function createUiMessage(ui) {
    return {
        source: SENLER_BRIDGE_SOURCE,
        type: SENLER_BRIDGE_MESSAGE.ui,
        protocol_version: SENLER_BRIDGE_PROTOCOL_VERSION,
        ui,
    };
}
export function createSenlerBridgeFrameSizeMessage(height) {
    const normalizedHeight = Math.ceil(height);
    if (!Number.isFinite(normalizedHeight) ||
        normalizedHeight < 1 ||
        normalizedHeight > MAX_FRAME_HEIGHT) {
        throw new Error('Senler Bridge frame height is invalid');
    }
    return {
        source: SENLER_BRIDGE_SOURCE,
        type: SENLER_BRIDGE_MESSAGE.frameSize,
        protocol_version: SENLER_BRIDGE_PROTOCOL_VERSION,
        height: normalizedHeight,
    };
}
export function createSubmitRequestMessage(requestId, method = SENLER_BRIDGE_REQUEST.toolConfiguratorSubmit) {
    return {
        source: SENLER_BRIDGE_SOURCE,
        type: SENLER_BRIDGE_MESSAGE.request,
        protocol_version: SENLER_BRIDGE_PROTOCOL_VERSION,
        request_id: requestId,
        method,
    };
}
export function createElementActionMessage(requestId, request) {
    return {
        source: SENLER_BRIDGE_SOURCE,
        type: SENLER_BRIDGE_MESSAGE.elementAction,
        protocol_version: SENLER_BRIDGE_PROTOCOL_VERSION,
        request_id: requestId,
        request,
    };
}
export function createElementActionResultMessage(requestId, result) {
    return {
        source: SENLER_BRIDGE_SOURCE,
        type: SENLER_BRIDGE_MESSAGE.elementActionResult,
        protocol_version: SENLER_BRIDGE_PROTOCOL_VERSION,
        request_id: requestId,
        result,
    };
}
export function createClearElementHighlightMessage() {
    return {
        source: SENLER_BRIDGE_SOURCE,
        type: SENLER_BRIDGE_MESSAGE.clearElementHighlight,
        protocol_version: SENLER_BRIDGE_PROTOCOL_VERSION,
    };
}
export function createSuccessResponseMessage(requestId, result) {
    return {
        source: SENLER_BRIDGE_SOURCE,
        type: SENLER_BRIDGE_MESSAGE.response,
        protocol_version: SENLER_BRIDGE_PROTOCOL_VERSION,
        request_id: requestId,
        ok: true,
        result,
    };
}
export function createErrorResponseMessage(requestId, error) {
    return {
        source: SENLER_BRIDGE_SOURCE,
        type: SENLER_BRIDGE_MESSAGE.response,
        protocol_version: SENLER_BRIDGE_PROTOCOL_VERSION,
        request_id: requestId,
        ok: false,
        error: error.slice(0, MAX_ERROR_MESSAGE_LENGTH),
    };
}
