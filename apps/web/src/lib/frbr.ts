/** Convert a FRBR URI to a peraturan page path.
 *  Example: /akn/id/act/uu/2003/13 -> /peraturan/uu/uu-13-2003 */
export function frbrToPath(frbrUri: string): string {
  const parts = frbrUri.split("/");
  const type = parts[4] || "uu";
  const year = parts[5];
  const number = parts[6];
  return `/peraturan/${type}/${type}-${number}-${year}`;
}
