/**
 * Marker appended to the end of a plain-text chat stream to carry structured
 * property-match data (a JSON array of listing ids) without changing the
 * stream's content-type. Shared between the server (/api/chat) and the client
 * (ChatClient) so the two can never drift out of sync. Never emitted by the
 * model itself — it appears nowhere in its prompt.
 */
export const MATCH_MARKER = "@@PROPERTIES@@";

/** Split a raw streamed string into the visible text and any attached ids. */
export function splitMatchMarker(raw: string): {
  display: string;
  propertyIds?: string[];
} {
  const idx = raw.indexOf(MATCH_MARKER);
  if (idx === -1) return { display: raw };
  const display = raw.slice(0, idx);
  const jsonPart = raw.slice(idx + MATCH_MARKER.length).trim();
  try {
    const parsed = JSON.parse(jsonPart);
    if (Array.isArray(parsed)) return { display, propertyIds: parsed };
    return { display };
  } catch {
    return { display };
  }
}
