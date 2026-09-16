import {
  createElementActionResultMessage,
  createErrorResponseMessage,
  createReadyMessage,
  createSenlerBridgeFrameSizeMessage,
  createSuccessResponseMessage,
  isSenlerBridgeClearElementHighlightMessage,
  parseSenlerBridgeElementActionMessage,
  parseSenlerBridgeElementActionResult,
  parseSenlerBridgeInitMessage,
  parseSenlerBridgeAutomationStepConfiguratorResult,
  parseSenlerBridgeRequestMessage,
  parseSenlerBridgeToolConfiguratorResult,
  parseSenlerBridgeUiMessage,
  SENLER_BRIDGE_BOOTSTRAP_CONTEXT_VERSION,
  SENLER_BRIDGE_BOOTSTRAP_MODE,
  SENLER_BRIDGE_REQUEST,
  type SenlerBridgeAutomationStepConfiguratorResult,
  type SenlerBridgeBootstrapMode,
  type SenlerBridgeContext,
  type SenlerBridgeElementActionRequest,
  type SenlerBridgeElementActionResult,
  type SenlerBridgeLanguage,
  type SenlerBridgeToolConfiguratorResult,
  type SenlerBridgeUiContext,
} from './protocol.js';

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

interface SenlerBridgeClientWindow extends Window {
  ResizeObserver?: typeof ResizeObserver;
  MutationObserver?: typeof MutationObserver;
}

export interface SenlerBridgeClient {
  connect(): Promise<SenlerBridgeContext>;
  getContext(): SenlerBridgeContext | null;
  onContextChange(
    listener: (context: SenlerBridgeContext) => void,
  ): () => void;
  onToolConfiguratorSubmit(
    handler: () =>
      | SenlerBridgeToolConfiguratorResult
      | Promise<SenlerBridgeToolConfiguratorResult>,
  ): () => void;
  onAutomationStepConfiguratorSubmit(
    handler: () =>
      | SenlerBridgeAutomationStepConfiguratorResult
      | Promise<SenlerBridgeAutomationStepConfiguratorResult>,
  ): () => void;
  onElementAction(
    handler: (
      request: SenlerBridgeElementActionRequest,
    ) =>
      | SenlerBridgeElementActionResult
      | Promise<SenlerBridgeElementActionResult>,
  ): () => void;
  onElementHighlightClear(handler: () => void): () => void;
  destroy(): void;
}

function normalizeOrigin(origin: string): string {
  const normalized = new URL(origin).origin;
  if (normalized === 'null') throw new Error('Senler Bridge parentOrigin is invalid');
  return normalized;
}

function toErrorMessage(error: unknown): string {
  return error instanceof Error && error.message.trim()
    ? error.message.trim()
    : 'Unable to save tool settings';
}

const DEFAULT_CONNECT_TIMEOUT_MS = 20_000;

export function normalizeSenlerBridgeLanguage(
  language: string,
): SenlerBridgeLanguage {
  return language.toLowerCase().startsWith('en') ? 'en' : 'ru';
}

export function resolveSenlerBridgeBootstrapUi(
  search: string,
  fallbackLanguage: string,
  prefersDark: boolean,
): SenlerBridgeUiContext {
  const params = new URLSearchParams(search);
  const theme = params.get('senler_theme');
  const language = params.get('senler_language');
  return {
    language:
      language === 'ru' || language === 'en'
        ? language
        : normalizeSenlerBridgeLanguage(fallbackLanguage),
    theme:
      theme === 'light' || theme === 'dark'
        ? theme
        : prefersDark
          ? 'dark'
          : 'light',
  };
}

export function resolveSenlerBridgeBootstrapContext(
  search: string,
  fallbackLanguage: string,
  prefersDark: boolean,
): SenlerBridgeBootstrapContext {
  const params = new URLSearchParams(search);
  const rawMode = params.get('senler_mode');
  const modes = Object.values(SENLER_BRIDGE_BOOTSTRAP_MODE);
  return {
    context_version:
      params.get('senler_context_version') ===
      SENLER_BRIDGE_BOOTSTRAP_CONTEXT_VERSION
        ? SENLER_BRIDGE_BOOTSTRAP_CONTEXT_VERSION
        : null,
    mode:
      rawMode && modes.some((mode) => mode === rawMode)
        ? (rawMode as SenlerBridgeBootstrapMode)
        : null,
    ui: resolveSenlerBridgeBootstrapUi(
      search,
      fallbackLanguage,
      prefersDark,
    ),
  };
}

export function applySenlerBridgeUiContext(
  ui: SenlerBridgeUiContext,
  root: HTMLElement = document.documentElement,
): void {
  root.lang = ui.language;
  root.classList.toggle('dark', ui.theme === 'dark');
  root.style.colorScheme = ui.theme;
}

export function createSenlerBridgeClient(
  options: SenlerBridgeClientOptions,
): SenlerBridgeClient {
  const clientWindow = (options.clientWindow ?? window) as SenlerBridgeClientWindow;
  const parentOrigin = normalizeOrigin(options.parentOrigin);
  const syncDocument = options.syncDocument !== false;
  const connectTimeoutMs =
    options.connectTimeoutMs ?? DEFAULT_CONNECT_TIMEOUT_MS;
  if (!Number.isFinite(connectTimeoutMs) || connectTimeoutMs <= 0) {
    throw new Error('Senler Bridge connectTimeoutMs must be positive');
  }
  let context: SenlerBridgeContext | null = null;
  let destroyed = false;
  let submitHandler:
    | (() =>
        | SenlerBridgeToolConfiguratorResult
        | Promise<SenlerBridgeToolConfiguratorResult>)
    | null = null;
  let automationStepSubmitHandler:
    | (() =>
        | SenlerBridgeAutomationStepConfiguratorResult
        | Promise<SenlerBridgeAutomationStepConfiguratorResult>)
    | null = null;
  let elementActionHandler:
    | ((
        request: SenlerBridgeElementActionRequest,
      ) =>
        | SenlerBridgeElementActionResult
        | Promise<SenlerBridgeElementActionResult>)
    | null = null;
  const elementHighlightClearListeners = new Set<() => void>();
  const contextListeners = new Set<(value: SenlerBridgeContext) => void>();
  const connectResolvers = new Set<{
    resolve: (value: SenlerBridgeContext) => void;
    reject: (reason: Error) => void;
    timeoutId: number;
  }>();

  const postToParent = (message: unknown) => {
    if (destroyed || clientWindow.parent === clientWindow) return;
    clientWindow.parent.postMessage(message, parentOrigin);
  };

  let frameResizeObserver: ResizeObserver | null = null;
  let frameMutationObserver: MutationObserver | null = null;
  let frameAnimationId: number | null = null;
  let frameTimeoutId: number | null = null;
  let lastFrameHeight: number | null = null;
  let frameSizeSyncActive = false;

  const publishFrameSize = () => {
    frameAnimationId = null;
    frameTimeoutId = null;
    const document = clientWindow.document;
    const root = document?.documentElement;
    if (!root) return;
    const body = document.body;
    const measuredElement = body ?? root;
    const height = Math.ceil(
      Math.max(
        measuredElement.scrollHeight,
        measuredElement.offsetHeight,
        measuredElement.getBoundingClientRect().height,
      ),
    );
    if (height < 1 || height === lastFrameHeight) return;
    lastFrameHeight = height;
    postToParent(createSenlerBridgeFrameSizeMessage(height));
  };

  const scheduleFrameSize = () => {
    if (destroyed || frameAnimationId !== null || frameTimeoutId !== null) {
      return;
    }
    if (typeof clientWindow.requestAnimationFrame === 'function') {
      frameAnimationId = clientWindow.requestAnimationFrame(publishFrameSize);
      return;
    }
    frameTimeoutId = clientWindow.setTimeout(publishFrameSize, 0);
  };

  const stopFrameSizeSync = () => {
    if (!frameSizeSyncActive) return;
    frameSizeSyncActive = false;
    lastFrameHeight = null;
    frameResizeObserver?.disconnect();
    frameMutationObserver?.disconnect();
    frameResizeObserver = null;
    frameMutationObserver = null;
    if (frameAnimationId !== null) {
      clientWindow.cancelAnimationFrame(frameAnimationId);
      frameAnimationId = null;
    }
    if (frameTimeoutId !== null) {
      clientWindow.clearTimeout(frameTimeoutId);
      frameTimeoutId = null;
    }
    clientWindow.removeEventListener('load', scheduleFrameSize);
    clientWindow.removeEventListener('resize', scheduleFrameSize);
  };

  const startFrameSizeSync = () => {
    if (frameSizeSyncActive || !clientWindow.document?.documentElement) return;
    frameSizeSyncActive = true;
    const root = clientWindow.document.documentElement;
    const body = clientWindow.document.body;
    if (typeof clientWindow.ResizeObserver === 'function') {
      const observer = new clientWindow.ResizeObserver(scheduleFrameSize);
      frameResizeObserver = observer;
      observer.observe(root);
      if (body) observer.observe(body);
    }
    if (typeof clientWindow.MutationObserver === 'function') {
      const observer = new clientWindow.MutationObserver(scheduleFrameSize);
      frameMutationObserver = observer;
      observer.observe(root, {
        attributes: true,
        childList: true,
        subtree: true,
      });
    }
    clientWindow.addEventListener('load', scheduleFrameSize);
    clientWindow.addEventListener('resize', scheduleFrameSize);
    scheduleFrameSize();
  };

  const publishContext = (nextContext: SenlerBridgeContext) => {
    context = nextContext;
    if (syncDocument) applySenlerBridgeUiContext(nextContext.ui);
    if (nextContext.frame_size_sync === true) startFrameSizeSync();
    else stopFrameSizeSync();
    for (const listener of contextListeners) listener(nextContext);
    for (const resolver of connectResolvers) {
      clientWindow.clearTimeout(resolver.timeoutId);
      resolver.resolve(nextContext);
    }
    connectResolvers.clear();
  };

  const handleMessage = (event: MessageEvent<unknown>) => {
    if (
      destroyed ||
      event.origin !== parentOrigin ||
      event.source !== clientWindow.parent
    ) {
      return;
    }
    const initMessage = parseSenlerBridgeInitMessage(event.data);
    if (initMessage) {
      publishContext(initMessage.context);
      return;
    }
    const uiMessage = parseSenlerBridgeUiMessage(event.data);
    if (uiMessage && context) {
      publishContext({ ...context, ui: uiMessage.ui });
      return;
    }
    if (isSenlerBridgeClearElementHighlightMessage(event.data)) {
      for (const listener of elementHighlightClearListeners) listener();
      return;
    }
    const elementActionMessage = parseSenlerBridgeElementActionMessage(
      event.data,
    );
    if (elementActionMessage) {
      if (!elementActionHandler) {
        postToParent(
          createElementActionResultMessage(elementActionMessage.request_id, {
            status: 'blocked',
            error_code: 'handler_unavailable',
            error_message: 'The application cannot act on interface elements',
          }),
        );
        return;
      }
      void Promise.resolve()
        .then(() => elementActionHandler?.(elementActionMessage.request))
        .then((rawResult) => {
          const result = parseSenlerBridgeElementActionResult(rawResult);
          postToParent(
            createElementActionResultMessage(
              elementActionMessage.request_id,
              result ?? {
                status: 'failed',
                error_code: 'invalid_result',
                error_message: 'The application returned an invalid element action result',
              },
            ),
          );
        })
        .catch((error: unknown) => {
          postToParent(
            createElementActionResultMessage(elementActionMessage.request_id, {
              status: 'failed',
              error_code: 'execution_failed',
              error_message: toErrorMessage(error),
            }),
          );
        });
      return;
    }
    const requestMessage = parseSenlerBridgeRequestMessage(event.data);
    if (!requestMessage) return;
    const activeSubmitHandler =
      requestMessage.method === SENLER_BRIDGE_REQUEST.automationStepConfiguratorSubmit
        ? automationStepSubmitHandler
        : submitHandler;
    if (!activeSubmitHandler) {
      postToParent(
        createErrorResponseMessage(
          requestMessage.request_id,
          context?.ui.language === 'ru'
            ? 'Приложение ещё не готово сохранить настройки'
            : 'The application is not ready to save settings yet',
        ),
      );
      return;
    }
    void Promise.resolve()
      .then(() => activeSubmitHandler())
      .then((rawResult) => {
        const result =
          requestMessage.method === SENLER_BRIDGE_REQUEST.automationStepConfiguratorSubmit
            ? parseSenlerBridgeAutomationStepConfiguratorResult(rawResult)
            : parseSenlerBridgeToolConfiguratorResult(rawResult);
        if (!result) {
          throw new Error(
            context?.ui.language === 'ru'
              ? 'Приложение вернуло некорректные настройки'
              : 'The application returned invalid settings',
          );
        }
        postToParent(
          createSuccessResponseMessage(requestMessage.request_id, result),
        );
      })
      .catch((error: unknown) => {
        postToParent(
          createErrorResponseMessage(
            requestMessage.request_id,
            toErrorMessage(error),
          ),
        );
      });
  };

  clientWindow.addEventListener('message', handleMessage);

  return {
    connect() {
      if (destroyed) {
        return Promise.reject(new Error('Senler Bridge client is destroyed'));
      }
      if (context) {
        postToParent(createReadyMessage());
        return Promise.resolve(context);
      }
      const promise = new Promise<SenlerBridgeContext>((resolve, reject) => {
        const resolver = {
          resolve,
          reject,
          timeoutId: clientWindow.setTimeout(() => {
            connectResolvers.delete(resolver);
            reject(new Error('Senler Bridge connection timed out'));
          }, connectTimeoutMs),
        };
        connectResolvers.add(resolver);
      });
      postToParent(createReadyMessage());
      return promise;
    },
    getContext() {
      return context;
    },
    onContextChange(listener) {
      contextListeners.add(listener);
      if (context) listener(context);
      return () => contextListeners.delete(listener);
    },
    onToolConfiguratorSubmit(handler) {
      submitHandler = handler;
      return () => {
        if (submitHandler === handler) submitHandler = null;
      };
    },
    onAutomationStepConfiguratorSubmit(handler) {
      automationStepSubmitHandler = handler;
      return () => {
        if (automationStepSubmitHandler === handler) automationStepSubmitHandler = null;
      };
    },
    onElementAction(handler) {
      elementActionHandler = handler;
      return () => {
        if (elementActionHandler === handler) elementActionHandler = null;
      };
    },
    onElementHighlightClear(handler) {
      elementHighlightClearListeners.add(handler);
      return () => elementHighlightClearListeners.delete(handler);
    },
    destroy() {
      if (destroyed) return;
      destroyed = true;
      stopFrameSizeSync();
      clientWindow.removeEventListener('message', handleMessage);
      contextListeners.clear();
      elementHighlightClearListeners.clear();
      submitHandler = null;
      automationStepSubmitHandler = null;
      elementActionHandler = null;
      for (const resolver of connectResolvers) {
        clientWindow.clearTimeout(resolver.timeoutId);
        resolver.reject(new Error('Senler Bridge client is destroyed'));
      }
      connectResolvers.clear();
    },
  };
}
