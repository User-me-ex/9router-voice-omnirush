// OmniRush CLI identity. The manager's mandatory-update gate reads
// X-OmniRush-Client on every call and rejects outdated clients with HTTP 426
// (`update_required`), so this must track the published CLI release.
export const OMNIRUSH_CLIENT_VERSION = "2.7.2";

export const OMNIRUSH_CLIENT_HEADER = `cli/${OMNIRUSH_CLIENT_VERSION}`;

export function omnirushUserAgent(version = OMNIRUSH_CLIENT_VERSION) {
  return `omnirush/${version} (${process.platform}; ${process.arch})`;
}
