import { SENLER_BRIDGE_BOOTSTRAP_CONTEXT_VERSION, type SenlerBridgeAutomationStepConfiguratorResult, type SenlerBridgeBootstrapMode, type SenlerBridgeContext, type SenlerBridgeElementActionRequest, type SenlerBridgeElementActionResult, type SenlerBridgeLanguage, type SenlerBridgeToolConfiguratorResult, type SenlerBridgeUiContext } from './protocol.js';
export interface SenlerBridgeBootstrapContext {
    context_version: typeof SENLER_BRIDGE_BOOTSTRAP_CONTEXT_VERSION | null;
    mode: SenlerBridgeBootstrapMode | null;
    ui: SenlerBridgeUiContext;
}
export interface SenlerBridgeClientOptions {
    parentOrigin: string;
    clientWindow?: Window;
    syncDocument?: boolean;
    connectTimeoutMs?: number;
}
export interface SenlerBridgeClient {
    connect(): Promise<SenlerBridgeContext>;
    getContext(): SenlerBridgeContext | null;
    onContextChange(listener: (context: SenlerBridgeContext) => void): () => void;
    onToolConfiguratorSubmit(handler: () => SenlerBridgeToolConfiguratorResult | Promise<SenlerBridgeToolConfiguratorResult>): () => void;
    onAutomationStepConfiguratorSubmit(handler: () => SenlerBridgeAutomationStepConfiguratorResult | Promise<SenlerBridgeAutomationStepConfiguratorResult>): () => void;
    onElementAction(handler: (request: SenlerBridgeElementActionRequest) => SenlerBridgeElementActionResult | Promise<SenlerBridgeElementActionResult>): () => void;
    onElementHighlightClear(handler: () => void): () => void;
    destroy(): void;
}
export declare function normalizeSenlerBridgeLanguage(language: string): SenlerBridgeLanguage;
export declare function resolveSenlerBridgeBootstrapUi(search: string, fallbackLanguage: string, prefersDark: boolean): SenlerBridgeUiContext;
export declare function resolveSenlerBridgeBootstrapContext(search: string, fallbackLanguage: string, prefersDark: boolean): SenlerBridgeBootstrapContext;
export declare function applySenlerBridgeUiContext(ui: SenlerBridgeUiContext, root?: HTMLElement): void;
export declare function createSenlerBridgeClient(options: SenlerBridgeClientOptions): SenlerBridgeClient;
