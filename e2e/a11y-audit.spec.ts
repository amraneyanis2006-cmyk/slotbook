import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { seedReference, switchUser } from './helpers';

// AC-84 (NFR-09): axe-core (WCAG 2.1 A/AA rules) finds no serious or critical violation on any route, both roles.
const blocking: string[] = [];
async function audit(page: Page, label: string) {
  const { violations } = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
  blocking.push(...violations.filter((v) => v.impact === 'serious' || v.impact === 'critical')
    .map((v) => `${label}: ${v.id} (${v.impact}) ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`));
}

test('E2E-20: axe-core finds no serious or critical violation on the login page and every customer and staff route', async ({ page }) => {
  test.setTimeout(120_000);
  await page.goto('/login');
  await expect(page.getByRole('button', { name: 'Log in' })).toBeVisible();
  await audit(page, '/login');

  const ref = await seedReference(page, 'staff.anan@slotbook.test', 3, '10:00');
  const routes: [string, string[], string][] = [
    ['cust.ken@slotbook.test', ['/book', '/search', '/bookings', `/bookings/${ref}`, `/bookings/${ref}/reschedule`, '/notifications'], 'main h1'],
    ['staff.anan@slotbook.test', ['/staff/slots', '/staff/templates', '/staff/schedule', '/staff/services', '/staff/dashboard', '/staff/users', `/staff/bookings/${ref}`], 'main h1'],
  ];
  for (const [email, paths, ready] of routes) {
    await switchUser(page, email);
    for (const path of paths) {
      await page.goto(path);
      await expect(page.locator(ready).first()).toBeVisible();
      await expect(page.getByLabel(/^Loading/)).toHaveCount(0);
      await audit(page, path);
    }
  }
  expect(blocking, blocking.join('\n')).toEqual([]); // every route is audited before failing, so all findings are listed
});
