// Pure shared policy: no environment, filesystem, provider or network access.
/** @param {string} value */
export function isSupportedNodeSecurityVersion(value) {
  if (!/^24\.\d+\.\d+$/.test(value)) return false;
  const [, minor, patch] = value.split(".").map(Number);
  return minor > 22 || (minor === 22 && patch >= 1);
}

// Serialize that same policy into the existing standalone entry. The deployed
// bootstrap is self-contained and needs no source files or runtime imports.
export function nodeSecurityRuntimeGuardSource() {
  return `// CCPUN_NODE_SECURITY_BOOTSTRAP\nif (!(${isSupportedNodeSecurityVersion.toString()})(process.versions.node)) throw new Error("NODE_SECURITY_BASELINE_DENIED");\n`;
}
