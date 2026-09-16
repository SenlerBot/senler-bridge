import type { SenlerBridgeElementActionRequest, SenlerBridgeElementActionResult } from './protocol.js';
export declare function clearSenlerBridgeElementHighlight(documentRoot?: Document): void;
export declare function executeSenlerBridgeElementAction(request: SenlerBridgeElementActionRequest, documentRoot?: Document): Promise<SenlerBridgeElementActionResult>;
