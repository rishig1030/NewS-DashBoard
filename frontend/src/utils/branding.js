// NEW FILE: small helpers that give every news channel its own "logo" look.
// NewsAPI does not send logos, so we make one: initials on a coloured badge.

// Turn a channel id like "the-hindu" into a colour that is ALWAYS the same
// for that channel. (Same id in, same colour out - no random flicker.)
export function getAccentColor(id) {
  let hue = 0;
  for (const character of id) {
    hue = (hue * 31 + character.charCodeAt(0)) % 360;
  }
  // 55% colour strength and 36% lightness keep white text easy to read
  return `hsl(${hue} 55% 36%)`;
}

// Words that make poor initials
const SKIPPED_WORDS = new Set(['the', 'of', 'and', 'a']);

// "Google News (India)" -> "GN",   "The Hindu" -> "HI",   "CNN" -> "CNN"
export function getInitials(name) {
  const words = name
    .replace(/\(.*?\)/g, '') // drop anything in brackets
    .split(/[\s.-]+/)
    .filter((word) => word && !SKIPPED_WORDS.has(word.toLowerCase()));

  if (words.length === 0) return name.slice(0, 2).toUpperCase();

  // One word: use its first letters (all three if the name is short, like CNN)
  if (words.length === 1) {
    const [word] = words;
    return word.slice(0, word.length <= 3 ? word.length : 2).toUpperCase();
  }

  // Several words: the first letter of the first two words
  return (words[0][0] + words[1][0]).toUpperCase();
}