export declare const SENLER_BRIDGE_PROTOCOL_VERSION: 1;
export declare const SENLER_BRIDGE_SOURCE: "senler-bridge";
export declare const SENLER_BRIDGE_BOOTSTRAP_CONTEXT_VERSION: "2";
export declare const SENLER_BRIDGE_BOOTSTRAP_MODE: {
    readonly installed: "installed";
    readonly test: "test";
    readonly toolConfigurator: "tool_configurator";
    readonly automationStepConfigurator: "automation_step_configurator";
};
export type SenlerBridgeBootstrapMode = (typeof SENLER_BRIDGE_BOOTSTRAP_MODE)[keyof typeof SENLER_BRIDGE_BOOTSTRAP_MODE];
export declare const SENLER_BRIDGE_MESSAGE: {
    readonly ready: "senler:bridge:ready";
    readonly init: "senler:bridge:init";
    readonly ui: "senler:bridge:ui";
    readonly request: "senler:bridge:request";
    readonly response: "senler:bridge:response";
    readonly frameSize: "senler:bridge:frame-size";
    readonly elementAction: "senler:bridge:element-action";
    readonly elementActionResult: "senler:bridge:element-action-result";
    readonly clearElementHighlight: "senler:bridge:clear-element-highlight";
};
export declare const SENLER_BRIDGE_REQUEST: {
    readonly toolConfiguratorSubmit: "tool-configurator.submit";
    readonly automationStepConfiguratorSubmit: "automation-step-configurator.submit";
};
export type SenlerBridgeLanguage = 'ru' | 'en';
export type SenlerBridgeTheme = 'light' | 'dark';
export type SenlerBridgeJsonValue = string | number | boolean | null | SenlerBridgeJsonValue[] | {
    [key: string]: SenlerBridgeJsonValue;
};
export type SenlerBridgeJsonObject = {
    [key: string]: SenlerBridgeJsonValue;
};
export interface SenlerBridgeUiContext {
    language: SenlerBridgeLanguage;
    theme: SenlerBridgeTheme;
}
export interface SenlerBridgeConfiguredParameter {
    name: string;
    type: 'string' | 'number' | 'boolean';
    description?: string;
    required: boolean;
    allowed_values: Array<string | number | boolean>;
}
export interface SenlerBridgeToolInstance {
    id: string;
    title: string;
    configuration: SenlerBridgeJsonObject;
    configured_parameters: SenlerBridgeConfiguredParameter[];
    has_private_data: boolean;
    private_data_required: boolean;
    status: 'active' | 'setup_required';
}
export interface SenlerBridgeEmbeddedPageLaunch {
    type: 'embedded_page';
    app_id: string;
    project_id: string;
    installation_id?: string;
    mode: 'installed' | 'test';
}
export interface SenlerBridgeToolConfiguratorLaunch {
    type: 'tool_configurator';
    app_id: string;
    project_id: string;
    installation_id: string;
    agent_id: string;
    mode: 'create' | 'edit';
    tool: {
        id: string;
        name: string;
        description: string;
    };
    instance: SenlerBridgeToolInstance | null;
}
export interface SenlerBridgeAutomationStepBranch {
    branch_id: string;
    key: string;
    title: string;
}
export interface SenlerBridgeAutomationStepConfiguratorLaunch {
    type: 'automation_step_configurator';
    app_id: string;
    project_id: string;
    installation_id: string;
    automation_id: string;
    node_id: string;
    step: {
        id: string;
        name: string;
        continuation_mode: 'next' | 'fixed' | 'configured';
    };
    configuration: SenlerBridgeJsonObject;
    branches: SenlerBridgeAutomationStepBranch[];
}
export type SenlerBridgeLaunchContext = SenlerBridgeEmbeddedPageLaunch | SenlerBridgeToolConfiguratorLaunch | SenlerBridgeAutomationStepConfiguratorLaunch;
export interface SenlerBridgeContext {
    ui: SenlerBridgeUiContext;
    launch: SenlerBridgeLaunchContext;
    frame_size_sync?: boolean;
}
export interface SenlerBridgeToolConfiguratorResult {
    title?: string;
    configuration: SenlerBridgeJsonObject;
    configured_parameters: SenlerBridgeConfiguredParameter[];
    private_data_action?: 'preserve' | 'replace' | 'clear';
    private_data?: SenlerBridgeJsonObject;
    private_data_required?: boolean;
}
export interface SenlerBridgeAutomationStepConfiguratorResult {
    kind: 'automation_step_configurator';
    configuration: SenlerBridgeJsonObject;
    branches: SenlerBridgeAutomationStepBranch[];
}
export type SenlerBridgeSubmitResult = SenlerBridgeToolConfiguratorResult | SenlerBridgeAutomationStepConfiguratorResult;
export type SenlerBridgeElementAction = 'highlight' | 'scroll_to' | 'focus' | 'click' | 'fill' | 'clear' | 'select' | 'toggle';
export type SenlerBridgeElementActionStatus = 'success' | 'not_found' | 'failed' | 'blocked';
export interface SenlerBridgeElementActionRequest {
    context_id: string;
    action: SenlerBridgeElementAction;
    value?: string;
}
export interface SenlerBridgeElementActionResult {
    status: SenlerBridgeElementActionStatus;
    matched_context_id?: string;
    matched_count?: number;
    error_code?: string;
    error_message?: string;
}
interface SenlerBridgeReadyMessage {
    source: typeof SENLER_BRIDGE_SOURCE;
    type: typeof SENLER_BRIDGE_MESSAGE.ready;
    protocol_version: typeof SENLER_BRIDGE_PROTOCOL_VERSION;
}
interface SenlerBridgeInitMessage {
    source: typeof SENLER_BRIDGE_SOURCE;
    type: typeof SENLER_BRIDGE_MESSAGE.init;
    protocol_version: typeof SENLER_BRIDGE_PROTOCOL_VERSION;
    context: SenlerBridgeContext;
}
interface SenlerBridgeUiMessage {
    source: typeof SENLER_BRIDGE_SOURCE;
    type: typeof SENLER_BRIDGE_MESSAGE.ui;
    protocol_version: typeof SENLER_BRIDGE_PROTOCOL_VERSION;
    ui: SenlerBridgeUiContext;
}
interface SenlerBridgeFrameSizeMessage {
    source: typeof SENLER_BRIDGE_SOURCE;
    type: typeof SENLER_BRIDGE_MESSAGE.frameSize;
    protocol_version: typeof SENLER_BRIDGE_PROTOCOL_VERSION;
    height: number;
}
interface SenlerBridgeRequestMessage {
    source: typeof SENLER_BRIDGE_SOURCE;
    type: typeof SENLER_BRIDGE_MESSAGE.request;
    protocol_version: typeof SENLER_BRIDGE_PROTOCOL_VERSION;
    request_id: string;
    method: typeof SENLER_BRIDGE_REQUEST.toolConfiguratorSubmit | typeof SENLER_BRIDGE_REQUEST.automationStepConfiguratorSubmit;
}
interface SenlerBridgeSuccessResponseMessage {
    source: typeof SENLER_BRIDGE_SOURCE;
    type: typeof SENLER_BRIDGE_MESSAGE.response;
    protocol_version: typeof SENLER_BRIDGE_PROTOCOL_VERSION;
    request_id: string;
    ok: true;
    result: SenlerBridgeSubmitResult;
}
interface SenlerBridgeErrorResponseMessage {
    source: typeof SENLER_BRIDGE_SOURCE;
    type: typeof SENLER_BRIDGE_MESSAGE.response;
    protocol_version: typeof SENLER_BRIDGE_PROTOCOL_VERSION;
    request_id: string;
    ok: false;
    error: string;
}
interface SenlerBridgeElementActionMessage {
    source: typeof SENLER_BRIDGE_SOURCE;
    type: typeof SENLER_BRIDGE_MESSAGE.elementAction;
    protocol_version: typeof SENLER_BRIDGE_PROTOCOL_VERSION;
    request_id: string;
    request: SenlerBridgeElementActionRequest;
}
interface SenlerBridgeElementActionResultMessage {
    source: typeof SENLER_BRIDGE_SOURCE;
    type: typeof SENLER_BRIDGE_MESSAGE.elementActionResult;
    protocol_version: typeof SENLER_BRIDGE_PROTOCOL_VERSION;
    request_id: string;
    result: SenlerBridgeElementActionResult;
}
interface SenlerBridgeClearElementHighlightMessage {
    source: typeof SENLER_BRIDGE_SOURCE;
    type: typeof SENLER_BRIDGE_MESSAGE.clearElementHighlight;
    protocol_version: typeof SENLER_BRIDGE_PROTOCOL_VERSION;
}
export type SenlerBridgeMessage = SenlerBridgeReadyMessage | SenlerBridgeInitMessage | SenlerBridgeUiMessage | SenlerBridgeFrameSizeMessage | SenlerBridgeRequestMessage | SenlerBridgeSuccessResponseMessage | SenlerBridgeErrorResponseMessage | SenlerBridgeElementActionMessage | SenlerBridgeElementActionResultMessage | SenlerBridgeClearElementHighlightMessage;
export declare function parseSenlerBridgeUiContext(value: unknown): SenlerBridgeUiContext | null;
export declare function parseSenlerBridgeJsonObject(value: unknown): SenlerBridgeJsonObject | null;
export declare function parseSenlerBridgeContext(value: unknown): SenlerBridgeContext | null;
export declare function parseSenlerBridgeToolConfiguratorResult(value: unknown): SenlerBridgeToolConfiguratorResult | null;
export declare function parseSenlerBridgeAutomationStepConfiguratorResult(value: unknown): SenlerBridgeAutomationStepConfiguratorResult | null;
export declare function parseSenlerBridgeElementActionRequest(value: unknown): SenlerBridgeElementActionRequest | null;
export declare function parseSenlerBridgeElementActionResult(value: unknown): SenlerBridgeElementActionResult | null;
export declare function isSenlerBridgeReadyMessage(value: unknown): value is SenlerBridgeReadyMessage;
export declare function parseSenlerBridgeInitMessage(value: unknown): SenlerBridgeInitMessage | null;
export declare function parseSenlerBridgeUiMessage(value: unknown): SenlerBridgeUiMessage | null;
export declare function parseSenlerBridgeFrameSizeMessage(value: unknown): SenlerBridgeFrameSizeMessage | null;
export declare function parseSenlerBridgeRequestMessage(value: unknown): SenlerBridgeRequestMessage | null;
export declare function parseSenlerBridgeResponseMessage(value: unknown): SenlerBridgeSuccessResponseMessage | SenlerBridgeErrorResponseMessage | null;
export declare function parseSenlerBridgeElementActionMessage(value: unknown): SenlerBridgeElementActionMessage | null;
export declare function parseSenlerBridgeElementActionResultMessage(value: unknown): SenlerBridgeElementActionResultMessage | null;
export declare function isSenlerBridgeClearElementHighlightMessage(value: unknown): value is SenlerBridgeClearElementHighlightMessage;
export declare function createReadyMessage(): SenlerBridgeReadyMessage;
export declare function createInitMessage(context: SenlerBridgeContext): SenlerBridgeInitMessage;
export declare function createUiMessage(ui: SenlerBridgeUiContext): SenlerBridgeUiMessage;
export declare function createSenlerBridgeFrameSizeMessage(height: number): SenlerBridgeFrameSizeMessage;
export declare function createSubmitRequestMessage(requestId: string, method?: typeof SENLER_BRIDGE_REQUEST.toolConfiguratorSubmit | typeof SENLER_BRIDGE_REQUEST.automationStepConfiguratorSubmit): SenlerBridgeRequestMessage;
export declare function createElementActionMessage(requestId: string, request: SenlerBridgeElementActionRequest): SenlerBridgeElementActionMessage;
export declare function createElementActionResultMessage(requestId: string, result: SenlerBridgeElementActionResult): SenlerBridgeElementActionResultMessage;
export declare function createClearElementHighlightMessage(): SenlerBridgeClearElementHighlightMessage;
export declare function createSuccessResponseMessage(requestId: string, result: SenlerBridgeSubmitResult): SenlerBridgeSuccessResponseMessage;
export declare function createErrorResponseMessage(requestId: string, error: string): SenlerBridgeErrorResponseMessage;
export {};
