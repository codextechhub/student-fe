/**
 * Puts `text` on the clipboard and answers whether it got there.
 *
 * The clipboard API is used where the web view allows it. Where it refuses (an
 * older web view, or a page the browser does not count as secure), a hidden
 * text field is selected and copied instead, which works from any tap.
 */
export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return selectAndCopy(text);
  }
}

function selectAndCopy(text: string): boolean {
  const field = document.createElement("textarea");
  field.value = text;
  field.setAttribute("readonly", "");
  field.style.position = "fixed";
  field.style.opacity = "0";
  document.body.appendChild(field);
  field.select();
  try {
    return document.execCommand("copy");
  } catch {
    return false;
  } finally {
    field.remove();
  }
}
