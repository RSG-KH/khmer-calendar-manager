export async function navigate(page, name) {
  await page.getByRole('navigation', { name: 'Progress' }).getByRole('button', { name, exact: true }).click();
}

export async function openSection(page, title) {
  const summary = page.locator('summary').filter({ hasText: new RegExp(`^${title}(?:\\s|$)`) });
  if (!await summary.evaluate(el => el.parentElement.open)) await summary.click();
}
