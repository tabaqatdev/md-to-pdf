export function portal(node: HTMLElement) {
    if (typeof document === 'undefined') return;
    document.body.appendChild(node);
    console.log("Portal: appended node to body with z-index", window.getComputedStyle(node).zIndex);
    return {
        destroy() {
            if (node.parentNode) {
                node.parentNode.removeChild(node);
            }
        }
    };
}
