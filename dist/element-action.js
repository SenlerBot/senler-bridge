const CONTEXT_ATTRIBUTE = 'data-ai-context-id';
const REVEALS_ATTRIBUTE = 'data-ai-reveals-context-id';
const REVEAL_ACTION_ATTRIBUTE = 'data-ai-reveal-action';
const HIGHLIGHT_ATTRIBUTE = 'data-senler-bridge-highlight';
const HIGHLIGHT_STYLE_ID = 'senler-bridge-element-highlight-style';
const MAX_REVEAL_DEPTH = 4;
function compactContextId(value) {
    return value.trim().toLowerCase();
}
function contextMatchesScope(contextId, scopes) {
    const normalizedContextId = compactContextId(contextId);
    return scopes.split(/\s+/u).some((scope) => {
        const normalizedScope = compactContextId(scope);
        return (normalizedScope.length > 0 &&
            (normalizedContextId === normalizedScope ||
                normalizedContextId.startsWith(`${normalizedScope}.`)));
    });
}
function isVisible(element) {
    const style = element.ownerDocument.defaultView?.getComputedStyle(element);
    if (style?.display === 'none' || style?.visibility === 'hidden')
        return false;
    const rect = element.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
}
function findContextElements(documentRoot, contextId) {
    return Array.from(documentRoot.querySelectorAll(`[${CONTEXT_ATTRIBUTE}]`)).filter((element) => element.getAttribute(CONTEXT_ATTRIBUTE) === contextId && isVisible(element));
}
function findRevealer(documentRoot, contextId) {
    const revealers = Array.from(documentRoot.querySelectorAll(`[${REVEALS_ATTRIBUTE}]`)).filter((element) => {
        const scopes = element.getAttribute(REVEALS_ATTRIBUTE);
        return Boolean(scopes && contextMatchesScope(contextId, scopes) && isVisible(element));
    });
    return revealers.length === 1 ? revealers[0] ?? null : null;
}
function waitForRender(documentRoot) {
    const view = documentRoot.defaultView;
    if (!view)
        return Promise.resolve();
    return new Promise((resolve) => {
        view.requestAnimationFrame(() => view.requestAnimationFrame(() => resolve()));
    });
}
async function revealContext(documentRoot, contextId) {
    for (let depth = 0; depth <= MAX_REVEAL_DEPTH; depth += 1) {
        const matches = findContextElements(documentRoot, contextId);
        if (matches.length > 0 || depth === MAX_REVEAL_DEPTH)
            return matches;
        const revealer = findRevealer(documentRoot, contextId);
        if (!revealer)
            return [];
        const action = revealer.getAttribute(REVEAL_ACTION_ATTRIBUTE) ?? 'click';
        if (action === 'focus')
            revealer.focus({ preventScroll: true });
        else
            revealer.click();
        await waitForRender(documentRoot);
    }
    return [];
}
function ensureHighlightStyle(documentRoot) {
    if (documentRoot.getElementById(HIGHLIGHT_STYLE_ID))
        return;
    const style = documentRoot.createElement('style');
    style.id = HIGHLIGHT_STYLE_ID;
    style.textContent = `
    [${HIGHLIGHT_ATTRIBUTE}="true"] {
      outline: 3px solid #f97316 !important;
      outline-offset: 4px !important;
      border-radius: 6px;
      transition: outline-color 120ms ease;
    }
  `;
    documentRoot.head.append(style);
}
export function clearSenlerBridgeElementHighlight(documentRoot = document) {
    documentRoot
        .querySelectorAll(`[${HIGHLIGHT_ATTRIBUTE}]`)
        .forEach((element) => element.removeAttribute(HIGHLIGHT_ATTRIBUTE));
}
function setControlValue(element, value) {
    if (!(element instanceof HTMLInputElement) &&
        !(element instanceof HTMLTextAreaElement) &&
        !(element instanceof HTMLSelectElement)) {
        return false;
    }
    const prototype = Object.getPrototypeOf(element);
    const setter = Object.getOwnPropertyDescriptor(prototype, 'value')?.set;
    if (setter)
        setter.call(element, value);
    else
        element.value = value;
    element.dispatchEvent(new Event('input', { bubbles: true }));
    element.dispatchEvent(new Event('change', { bubbles: true }));
    return true;
}
function runAction(element, request) {
    const success = () => ({
        status: 'success',
        matched_context_id: request.context_id,
        matched_count: 1,
    });
    const blocked = (code, message) => ({
        status: 'blocked',
        matched_context_id: request.context_id,
        matched_count: 1,
        error_code: code,
        error_message: message,
    });
    if (request.action === 'highlight') {
        clearSenlerBridgeElementHighlight(element.ownerDocument);
        ensureHighlightStyle(element.ownerDocument);
        element.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' });
        element.setAttribute(HIGHLIGHT_ATTRIBUTE, 'true');
        return success();
    }
    if (request.action === 'scroll_to') {
        element.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' });
        return success();
    }
    if (request.action === 'focus') {
        element.focus({ preventScroll: false });
        return success();
    }
    if (request.action === 'click') {
        if (element.matches(':disabled,[aria-disabled="true"]')) {
            return blocked('element_disabled', 'The requested element is disabled');
        }
        element.click();
        return success();
    }
    if (request.action === 'fill' || request.action === 'select') {
        if (request.value === undefined) {
            return blocked('value_required', 'This action requires a value');
        }
        return setControlValue(element, request.value)
            ? success()
            : blocked('unsupported_element', 'The requested element cannot accept a value');
    }
    if (request.action === 'clear') {
        return setControlValue(element, '')
            ? success()
            : blocked('unsupported_element', 'The requested element cannot be cleared');
    }
    if (request.action === 'toggle') {
        if (element instanceof HTMLInputElement &&
            (element.type === 'checkbox' || element.type === 'radio')) {
            element.click();
            return success();
        }
        if (element.getAttribute('role') === 'switch') {
            element.click();
            return success();
        }
        return blocked('unsupported_element', 'The requested element cannot be toggled');
    }
    return blocked('unsupported_action', 'The requested action is not supported');
}
export async function executeSenlerBridgeElementAction(request, documentRoot = document) {
    const matches = await revealContext(documentRoot, request.context_id);
    if (matches.length === 0) {
        return {
            status: 'not_found',
            matched_count: 0,
            error_code: 'element_not_found',
            error_message: 'No matching element was found in the application',
        };
    }
    if (matches.length > 1) {
        return {
            status: 'blocked',
            matched_count: matches.length,
            error_code: 'ambiguous_element',
            error_message: 'More than one matching element is visible in the application',
        };
    }
    const element = matches[0];
    return element
        ? runAction(element, request)
        : {
            status: 'not_found',
            matched_count: 0,
            error_code: 'element_not_found',
            error_message: 'No matching element was found in the application',
        };
}
