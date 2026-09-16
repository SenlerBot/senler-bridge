import {
  createClearElementHighlightMessage,
  createElementActionMessage,
  createInitMessage,
  createSubmitRequestMessage,
  createUiMessage,
  SENLER_BRIDGE_REQUEST,
  isSenlerBridgeReadyMessage,
  parseSenlerBridgeContext,
  parseSenlerBridgeElementActionRequest,
  parseSenlerBridgeElementActionResultMessage,
  parseSenlerBridgeFrameSizeMessage,
  parseSenlerBridgeResponseMessage,
  parseSenlerBridgeUiContext,
  type SenlerBridgeContext,
  type SenlerBridgeElementActionRequest,
  type SenlerBridgeElementActionResult,
  type SenlerBridgeAutomationStepConfiguratorResult,
  type SenlerBridgeSubmitResult,
  type SenlerBridgeToolConfiguratorResult,
  type SenlerBridgeUiContext,
} from './protocol.js';

const DEFAULT_REQUEST_TIMEOUT_MS = 20_000;

export interface SenlerBridgeHostOptions {
  targetOrigin: string;
  getTargetWindow: () => Window | null;
  context: SenlerBridgeContext;
  hostWindow?: Window;
  requestTimeoutMs?: number;
  onFrameSizeChange?: (height: number) => void;
}

export interface SenlerBridgeHost {
  notifyFrameLoaded(): void;
  setContext(context: SenlerBridgeContext): void;
  setUi(ui: SenlerBridgeUiContext): void;
  requestToolConfiguratorSubmit(): Promise<SenlerBridgeToolConfiguratorResult>;
  requestAutomationStepConfiguratorSubmit(): Promise<SenlerBridgeAutomationStepConfiguratorResult>;
  requestElementAction(
    request: SenlerBridgeElementActionRequest,
  ): Promise<SenlerBridgeElementActionResult>;
  clearElementHighlight(): void;
  destroy(): void;
}

export type SenlerBridgeHostErrorCode =
  | 'destroyed'
  | 'invalid_context'
  | 'invalid_launch'
  | 'frame_unavailable'
  | 'request_timeout'
  | 'remote_error';

export class SenlerBridgeHostError extends Error {
  constructor(
    readonly code: SenlerBridgeHostErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'SenlerBridgeHostError';
  }
}

interface PendingRequest {
  resolve: (result: SenlerBridgeSubmitResult) => void;
  reject: (error: Error) => void;
  timeoutId: number;
}

interface PendingElementAction {
  resolve: (result: SenlerBridgeElementActionResult) => void;
  reject: (error: Error) => void;
  timeoutId: number;
}

function normalizeOrigin(origin: string): string {
  const normalized = new URL(origin).origin;
  if (normalized === 'null') throw new Error('Senler Bridge targetOrigin is invalid');
  return normalized;
}

function createRequestId(hostWindow: Window): string {
  if (typeof hostWindow.crypto?.randomUUID === 'function') {
    return hostWindow.crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function createSenlerBridgeHost(
  options: SenlerBridgeHostOptions,
): SenlerBridgeHost {
  const hostWindow = options.hostWindow ?? window;
  const targetOrigin = normalizeOrigin(options.targetOrigin);
  const requestTimeoutMs =
    options.requestTimeoutMs ?? DEFAULT_REQUEST_TIMEOUT_MS;
  const initialContext = parseSenlerBridgeContext(options.context);
  if (!initialContext) {
    throw new SenlerBridgeHostError(
      'invalid_context',
      'Senler Bridge context is invalid',
    );
  }
  let context = initialContext;
  let connected = false;
  let destroyed = false;
  const pendingRequests = new Map<string, PendingRequest>();
  const pendingElementActions = new Map<string, PendingElementAction>();

  const postToFrame = (message: unknown): boolean => {
    if (destroyed) return false;
    const targetWindow = options.getTargetWindow();
    if (!targetWindow) return false;
    targetWindow.postMessage(message, targetOrigin);
    return true;
  };

  const sendInit = () => postToFrame(createInitMessage(context));

  const handleMessage = (event: MessageEvent<unknown>) => {
    if (
      destroyed ||
      event.origin !== targetOrigin ||
      event.source !== options.getTargetWindow()
    ) {
      return;
    }
    if (isSenlerBridgeReadyMessage(event.data)) {
      connected = true;
      sendInit();
      return;
    }
    const frameSize = parseSenlerBridgeFrameSizeMessage(event.data);
    if (frameSize) {
      options.onFrameSizeChange?.(frameSize.height);
      return;
    }
    const elementActionResult = parseSenlerBridgeElementActionResultMessage(
      event.data,
    );
    if (elementActionResult) {
      const pending = pendingElementActions.get(elementActionResult.request_id);
      if (!pending) return;
      hostWindow.clearTimeout(pending.timeoutId);
      pendingElementActions.delete(elementActionResult.request_id);
      pending.resolve(elementActionResult.result);
      return;
    }
    const response = parseSenlerBridgeResponseMessage(event.data);
    if (!response) return;
    const pending = pendingRequests.get(response.request_id);
    if (!pending) return;
    hostWindow.clearTimeout(pending.timeoutId);
    pendingRequests.delete(response.request_id);
    if (response.ok) pending.resolve(response.result);
    else pending.reject(new SenlerBridgeHostError('remote_error', response.error));
  };

  hostWindow.addEventListener('message', handleMessage);

  const requestSubmit = (
    method:
      | typeof SENLER_BRIDGE_REQUEST.toolConfiguratorSubmit
      | typeof SENLER_BRIDGE_REQUEST.automationStepConfiguratorSubmit,
  ): Promise<SenlerBridgeSubmitResult> => {
    if (destroyed) {
      return Promise.reject(
        new SenlerBridgeHostError(
          'destroyed',
          'Senler Bridge host is destroyed',
        ),
      );
    }
    const requestId = createRequestId(hostWindow);
    return new Promise<SenlerBridgeSubmitResult>((resolve, reject) => {
      const timeoutId = hostWindow.setTimeout(() => {
        pendingRequests.delete(requestId);
        reject(
          new SenlerBridgeHostError(
            'request_timeout',
            'The embedded application did not respond in time',
          ),
        );
      }, requestTimeoutMs);
      pendingRequests.set(requestId, { resolve, reject, timeoutId });
      if (!postToFrame(createSubmitRequestMessage(requestId, method))) {
        hostWindow.clearTimeout(timeoutId);
        pendingRequests.delete(requestId);
        reject(
          new SenlerBridgeHostError(
            'frame_unavailable',
            'The embedded application is unavailable',
          ),
        );
      }
    });
  };

  return {
    notifyFrameLoaded() {
      connected = true;
      sendInit();
    },
    setContext(nextContext) {
      const parsedContext = parseSenlerBridgeContext(nextContext);
      if (!parsedContext) {
        throw new SenlerBridgeHostError(
          'invalid_context',
          'Senler Bridge context is invalid',
        );
      }
      context = parsedContext;
      if (connected) sendInit();
    },
    setUi(ui) {
      const parsedUi = parseSenlerBridgeUiContext(ui);
      if (!parsedUi) {
        throw new SenlerBridgeHostError(
          'invalid_context',
          'Senler Bridge UI context is invalid',
        );
      }
      context = { ...context, ui: parsedUi };
      if (connected) postToFrame(createUiMessage(parsedUi));
    },
    requestToolConfiguratorSubmit() {
      if (context.launch.type !== 'tool_configurator') {
        return Promise.reject(
          new SenlerBridgeHostError(
            'invalid_launch',
            'Tool configurator is unavailable for this iframe',
          ),
        );
      }
      return requestSubmit(SENLER_BRIDGE_REQUEST.toolConfiguratorSubmit).then(
        (result) => {
          if ('kind' in result) {
            throw new SenlerBridgeHostError(
              'remote_error',
              'Embedded application returned an automation step result',
            );
          }
          return result;
        },
      );
    },
    requestAutomationStepConfiguratorSubmit() {
      if (context.launch.type !== 'automation_step_configurator') {
        return Promise.reject(
          new SenlerBridgeHostError(
            'invalid_launch',
            'Automation step configurator is unavailable for this iframe',
          ),
        );
      }
      return requestSubmit(
        SENLER_BRIDGE_REQUEST.automationStepConfiguratorSubmit,
      ).then((result) => {
        if (!('kind' in result)) {
          throw new SenlerBridgeHostError(
            'remote_error',
            'Embedded application returned a tool configuration result',
          );
        }
        return result;
      });
    },
    requestElementAction(request) {
      if (destroyed) {
        return Promise.reject(
          new SenlerBridgeHostError('destroyed', 'Senler Bridge host is destroyed'),
        );
      }
      const parsedRequest = parseSenlerBridgeElementActionRequest(request);
      if (!parsedRequest) {
        return Promise.reject(
          new SenlerBridgeHostError(
            'invalid_context',
            'Senler Bridge element action is invalid',
          ),
        );
      }
      const requestId = createRequestId(hostWindow);
      return new Promise<SenlerBridgeElementActionResult>((resolve, reject) => {
        const timeoutId = hostWindow.setTimeout(() => {
          pendingElementActions.delete(requestId);
          reject(
            new SenlerBridgeHostError(
              'request_timeout',
              'The embedded application did not respond in time',
            ),
          );
        }, requestTimeoutMs);
        pendingElementActions.set(requestId, { resolve, reject, timeoutId });
        if (!postToFrame(createElementActionMessage(requestId, parsedRequest))) {
          hostWindow.clearTimeout(timeoutId);
          pendingElementActions.delete(requestId);
          reject(
            new SenlerBridgeHostError(
              'frame_unavailable',
              'The embedded application is unavailable',
            ),
          );
        }
      });
    },
    clearElementHighlight() {
      postToFrame(createClearElementHighlightMessage());
    },
    destroy() {
      if (destroyed) return;
      destroyed = true;
      hostWindow.removeEventListener('message', handleMessage);
      for (const pending of pendingRequests.values()) {
        hostWindow.clearTimeout(pending.timeoutId);
        pending.reject(
          new SenlerBridgeHostError(
            'destroyed',
            'Senler Bridge host is destroyed',
          ),
        );
      }
      pendingRequests.clear();
      for (const pending of pendingElementActions.values()) {
        hostWindow.clearTimeout(pending.timeoutId);
        pending.reject(
          new SenlerBridgeHostError(
            'destroyed',
            'Senler Bridge host is destroyed',
          ),
        );
      }
      pendingElementActions.clear();
    },
  };
}
