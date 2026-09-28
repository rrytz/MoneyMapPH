/**
 * What "unassigned" means, in one place.
 *
 * It exists because the column is nullable and a row serialised before tagging
 * existed can carry `null` OR `undefined` - and `AccountSelect` represents "no
 * account" as the empty string. All three are the same state, and a filter that
 * recognised only one of them would report a complete list while omitting rows.
 *
 * That failure is quiet: the view would simply show fewer rows, and a count
 * beside it would agree with the rows shown, so nothing would look wrong.
 */

/** The shape this needs, kept minimal so the filter can be tested bare. */
export interface AccountTagged {
  account_id?: string | null;
}

export function isUnassignedEntry(entry: AccountTagged): boolean {
  const id = entry.account_id;
  return id === null || id === undefined || id === "";
}
