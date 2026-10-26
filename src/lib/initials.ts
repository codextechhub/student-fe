/** The first letters of a name past any title, for the round mark beside a teacher. */
export function initialsOf(name: string): string {
  const letters = name
    .split(/\s+/)
    .filter((word) => /^\p{L}/u.test(word) && !/^(mr|mrs|miss|ms|mx|dr|prof|engr|chief)\.?$/i.test(word))
    .slice(0, 2)
    .map((word) => Array.from(word)[0]);
  return letters.join("").toUpperCase() || "?";
}
