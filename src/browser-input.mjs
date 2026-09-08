export function browserAddress(value) {
  const input = value.trim();
  if (!input) throw new Error("Enter a URL or search term");
  if (/^https?:\/\//i.test(input)) return new URL(input).href;
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(input))
    throw new Error("Use an HTTP or HTTPS address");
  if (/^(localhost|127\.0\.0\.1|\[::1\])(?::\d+)?(?:\/|$)/i.test(input))
    return new URL("http://" + input).href;
  if (!/\s/.test(input) && /^[^/]+\.[^/]+/.test(input))
    return new URL("https://" + input).href;
  return "https://www.google.com/search?q=" + encodeURIComponent(input);
}
