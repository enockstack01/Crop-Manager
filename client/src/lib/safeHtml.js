/**
 * Makes the text of a confirmation dialog safe to show as HTML.
 *
 * The dialog needs a little formatting (<strong> for a name, <br> for a line break), and the names put into it come from people: a user chooses
 * their own display name, so a name such as <img src=x onerror=...> must never become a tag. Every "<" is turned into the text "&lt;" unless it
 * starts exactly <strong>, </strong> or <br> (no attributes), so nothing else can run. A plain "&" is left alone, so a name such as
 * "Tom & Jerry", or one already escaped by the caller, still reads correctly.
 */
const ALLOWED = /<(?!\/?(?:strong|br)\s*\/?>)/gi;

export function safeHtml(message) {
  return String(message ?? '').replace(ALLOWED, '&lt;');
}
