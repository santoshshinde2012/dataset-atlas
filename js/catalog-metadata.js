/** Keep source API activity separate from the editorial data timeline. */
export function recordSourceModifiedYear(entry, year, currentYear = new Date().getUTCFullYear()) {
  if (!Number.isInteger(year) || year < 1990 || year > currentYear || year === entry.sourceModifiedYear) {
    return false;
  }
  entry.sourceModifiedYear = year;
  return true;
}
