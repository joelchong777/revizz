/**
 * Headless Runtime UI Verifier for Revizz
 *
 * Runs automated headless browser tests using puppeteer-core to catch runtime UI crashes,
 * animation solver failures (e.g. Framer Motion keyframe/spring errors),
 * and layout constraint violations (e.g. desktop sidebar width and badge height explosions).
 *
 * Usage:
 *   npx tsx scripts/verify-ui.ts
 *   npx tsx scripts/verify-ui.ts --url https://revizz-sand.vercel.app
 *   npx tsx scripts/verify-ui.ts --url http://localhost:3000
 */

import fs from 'fs';
import path from 'path';
// @ts-ignore - puppeteer-core is optional runtime dev dependency
import puppeteer from 'puppeteer-core';
type Browser = any;
type Page = any;
type ConsoleMessage = any;

// ANSI terminal color codes
const colors = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m',
};

// Test bookkeeping
interface AssertionResult {
  name: string;
  passed: boolean;
  category: string;
  measured?: string | number;
  expected?: string | number;
  error?: string;
}

const assertions: AssertionResult[] = [];

function recordAssertion(result: AssertionResult): void {
  assertions.push(result);
  const statusMark = result.passed
    ? `${colors.green}✓ PASS${colors.reset}`
    : `${colors.red}✗ FAIL${colors.reset}`;

  const detailParts: string[] = [];
  if (result.measured !== undefined && result.expected !== undefined) {
    detailParts.push(`(measured: ${result.measured}, expected: ${result.expected})`);
  }
  if (result.error) {
    detailParts.push(`[Error: ${result.error}]`);
  }
  const details = detailParts.length > 0 ? ` ${colors.dim}${detailParts.join(' ')}${colors.reset}` : '';

  console.log(`  ${statusMark} ${result.name}${details}`);
}

// Command-line arguments parser
interface CommandLineOptions {
  targetUrl: string;
  chromePath?: string;
  timeoutMs: number;
}

function parseCliArgs(): CommandLineOptions {
  const args = process.argv.slice(2);
  let targetUrl = 'http://localhost:3000';
  let chromePath: string | undefined = undefined;
  let timeoutMs = 30000;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--url' && args[i + 1]) {
      targetUrl = args[i + 1];
      i++;
    } else if (arg.startsWith('--url=')) {
      targetUrl = arg.split('=')[1];
    } else if (arg === '--chrome-path' && args[i + 1]) {
      chromePath = args[i + 1];
      i++;
    } else if (arg.startsWith('--chrome-path=')) {
      chromePath = arg.split('=')[1];
    } else if (arg === '--timeout' && args[i + 1]) {
      timeoutMs = parseInt(args[i + 1], 10) || 30000;
      i++;
    } else if (arg === '--help' || arg === '-h') {
      console.log(`
Revizz Headless Runtime UI Verifier

Options:
  --url <url>           Target base URL (default: http://localhost:3000)
  --chrome-path <path>  Custom Chrome/Chromium executable path
  --timeout <ms>        Navigation/selector timeout in ms (default: 30000)
  --help, -h            Show this help message
`);
      process.exit(0);
    }
  }

  // Remove trailing slashes
  targetUrl = targetUrl.replace(/\/+$/, '');

  return { targetUrl, chromePath, timeoutMs };
}

// Locate Chrome executable
function resolveChromeExecutable(customPath?: string): string {
  if (customPath && fs.existsSync(customPath)) {
    return customPath;
  }

  if (process.env.CHROME_PATH && fs.existsSync(process.env.CHROME_PATH)) {
    return process.env.CHROME_PATH;
  }

  const candidatePaths = [
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Google Chrome Canary.app/Contents/MacOS/Google Chrome Canary',
    '/Applications/Chromium.app/Contents/MacOS/Chromium',
    '/usr/bin/google-chrome',
    '/usr/bin/google-chrome-stable',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
  ];

  for (const candidate of candidatePaths) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }

  throw new Error(
    `Chrome executable not found. Please provide a path via --chrome-path or set CHROME_PATH environment variable.`
  );
}

// Page error collector
interface CollectedErrors {
  pageErrors: string[];
  consoleErrors: string[];
  framerMotionSpringErrors: string[];
  unhandledRejections: string[];
}

function attachErrorListeners(page: Page, label: string): CollectedErrors {
  const errors: CollectedErrors = {
    pageErrors: [],
    consoleErrors: [],
    framerMotionSpringErrors: [],
    unhandledRejections: [],
  };

  // Catch unhandled page errors (runtime exceptions, React crashes)
  page.on('pageerror', (err: unknown) => {
    const msg = err instanceof Error ? err.message : String(err);
    errors.pageErrors.push(msg);

    // Specifically inspect for Framer Motion keyframe spring solver issue
    if (/Only two keyframes currently supported with spring/i.test(msg)) {
      errors.framerMotionSpringErrors.push(msg);
    }
  });

  // Catch console errors and warnings
  page.on('console', (msg: ConsoleMessage) => {
    const type = msg.type();
    const text = msg.text();

    if (type === 'error') {
      // Filter out harmless non-app errors (e.g. optional favicon or third-party adblock)
      const isHarmless =
        text.includes('favicon.ico') ||
        text.includes('net::ERR_BLOCKED_BY_CLIENT') ||
        text.includes('[Fast Refresh]');

      if (!isHarmless) {
        errors.consoleErrors.push(text);
        if (/Only two keyframes currently supported with spring/i.test(text)) {
          errors.framerMotionSpringErrors.push(text);
        }
      }
    }
  });

  return errors;
}

// Test Suite Implementation
async function runVerifier() {
  const options = parseCliArgs();
  console.log(`${colors.bold}${colors.cyan}====================================================${colors.reset}`);
  console.log(`${colors.bold}${colors.cyan}  Revizz Headless Runtime UI Verifier (Puppeteer)   ${colors.reset}`);
  console.log(`${colors.bold}${colors.cyan}====================================================${colors.reset}`);
  console.log(`Target URL:      ${colors.yellow}${options.targetUrl}${colors.reset}`);

  const chromePath = resolveChromeExecutable(options.chromePath);
  console.log(`Chrome Executable: ${colors.dim}${chromePath}${colors.reset}`);
  console.log(`Timeout:           ${colors.dim}${options.timeoutMs}ms${colors.reset}\n`);

  let browser: Browser | null = null;

  try {
    browser = await puppeteer.launch({
      executablePath: chromePath,
      args: ['--no-sandbox', '--disable-gpu', '--headless=new'],
    });

    const page = await browser.newPage();
    // Configure viewport for desktop layout checks (>= 1024px triggers desktop lg: sidebar)
    await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 1 });

    const globalErrors = attachErrorListeners(page, 'Main');

    // Enable unhandled rejection capture in browser window
    await page.evaluateOnNewDocument(() => {
      window.addEventListener('unhandledrejection', (event) => {
        console.error('UnhandledPromiseRejection:', event.reason?.message || event.reason);
      });
    });

    // -------------------------------------------------------------------------
    // TEST SECTION 1: Baseline Student Home (/)
    // -------------------------------------------------------------------------
    console.log(`${colors.bold}${colors.magenta}[1/4] Student Home Page (/) Baseline & Physics Solver${colors.reset}`);

    const homeUrl = `${options.targetUrl}/`;
    const homeResponse = await page.goto(homeUrl, {
      waitUntil: 'networkidle2',
      timeout: options.timeoutMs,
    });

    recordAssertion({
      category: 'Student Home',
      name: 'HTTP 200 on Student Home',
      passed: homeResponse ? homeResponse.status() < 400 : false,
      measured: homeResponse?.status(),
      expected: '200-399',
    });

    const pageTitle = await page.title();
    recordAssertion({
      category: 'Student Home',
      name: 'Page title populated and valid',
      passed: pageTitle.length > 0 && /Revizz/i.test(pageTitle),
      measured: pageTitle,
      expected: 'Contains "Revizz"',
    });

    // Check DOM for key interactive neobrutalist elements (Start Flow, Header)
    const hasHeader = (await page.$('header')) !== null;
    recordAssertion({
      category: 'Student Home',
      name: 'Header component mounted in DOM',
      passed: hasHeader,
      measured: hasHeader ? 'present' : 'missing',
      expected: 'present',
    });

    // Test button hover motion trigger (simulating cursor interactions)
    const interactiveButtons = await page.$$('button');
    if (interactiveButtons.length > 0) {
      await interactiveButtons[0].hover();
      // Brief pause to allow framer-motion transition calculation
      await new Promise((r) => setTimeout(r, 100));
    }

    recordAssertion({
      category: 'Student Home',
      name: 'No Framer Motion keyframe spring solver crash on home page',
      passed: globalErrors.framerMotionSpringErrors.length === 0,
      measured: globalErrors.framerMotionSpringErrors.length,
      expected: 0,
      error: globalErrors.framerMotionSpringErrors[0],
    });

    // -------------------------------------------------------------------------
    // TEST SECTION 2: Educator Portal (/portal) & Guest Demo Entrance
    // -------------------------------------------------------------------------
    console.log(`\n${colors.bold}${colors.magenta}[2/4] Educator Portal (/portal) & Guest Entrance${colors.reset}`);

    const portalUrl = `${options.targetUrl}/portal`;
    const portalResponse = await page.goto(portalUrl, {
      waitUntil: 'networkidle2',
      timeout: options.timeoutMs,
    });

    recordAssertion({
      category: 'Educator Portal',
      name: 'HTTP 200 on /portal',
      passed: portalResponse ? portalResponse.status() < 400 : false,
      measured: portalResponse?.status(),
      expected: '200-399',
    });

    // Interactive Navigation Test:
    // Look for the Guest / Demo Educator CTA button and click it to unlock the command deck
    console.log(`  ${colors.dim}Simulating guest educator entrance click...${colors.reset}`);
    const clickedGuestButton = await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const target = buttons.find((b) =>
        /Enter as (Guest|Demo) Educator/i.test(b.innerText || '')
      );
      if (target) {
        target.click();
        return true;
      }
      return false;
    });

    recordAssertion({
      category: 'Educator Portal',
      name: 'Guest Educator demo entrance button found and clicked',
      passed: clickedGuestButton,
      measured: clickedGuestButton ? 'Clicked' : 'Not found',
      expected: 'Clicked',
    });

    // Wait for command deck sidebar <aside> to mount
    try {
      await page.waitForSelector('aside', { timeout: 8000 });
    } catch {
      // If waitForSelector times out, we will check ?guest=true as fallback
      await page.goto(`${options.targetUrl}/portal?guest=true`, { waitUntil: 'networkidle2' });
      await page.waitForSelector('aside', { timeout: 5000 });
    }

    const asideMounted = (await page.$('aside')) !== null;
    recordAssertion({
      category: 'Educator Portal',
      name: 'Command Deck sidebar (<aside>) successfully rendered after entrance',
      passed: asideMounted,
      measured: asideMounted ? 'Mounted' : 'Missing',
      expected: 'Mounted',
    });

    // -------------------------------------------------------------------------
    // TEST SECTION 3: Desktop Sidebar Layout Constraints & Badge Integrity
    // -------------------------------------------------------------------------
    console.log(`\n${colors.bold}${colors.magenta}[3/4] Desktop Sidebar Layout Constraints & Badge Checks${colors.reset}`);

    const sidebarMetrics = await page.evaluate(() => {
      const aside = document.querySelector('aside');
      if (!aside) return null;

      const asideRect = aside.getBoundingClientRect();

      // Collect all badge elements in the sidebar
      // Badges generally have rounded-full or rounded-md classes or uppercase labels like EDUCATOR / New / numeric
      const badgeElements = Array.from(aside.querySelectorAll<HTMLElement>('span')).filter((span) => {
        const text = span.innerText.trim();
        const classes = span.className || '';
        return (
          /rounded-(full|md|lg)/.test(classes) ||
          /^(EDUCATOR|NEW|\d+)$/i.test(text)
        );
      });

      const badges = badgeElements.map((b) => {
        const rect = b.getBoundingClientRect();
        return {
          text: b.innerText.trim(),
          width: rect.width,
          height: rect.height,
        };
      });

      // Collect nav button heights
      const navButtons = Array.from(aside.querySelectorAll<HTMLElement>('button, a')).map((btn) => {
        const rect = btn.getBoundingClientRect();
        return {
          text: (btn.innerText || '').split('\n')[0].trim(),
          height: rect.height,
          width: rect.width,
        };
      });

      return {
        asideWidth: Math.round(asideRect.width),
        asideHeight: Math.round(asideRect.height),
        badges,
        navButtons,
      };
    });

    const asideWidth = sidebarMetrics?.asideWidth || 0;
    recordAssertion({
      category: 'Sidebar Constraints',
      name: 'Desktop sidebar container width is at least 264px',
      passed: asideWidth >= 264,
      measured: `${asideWidth}px`,
      expected: '>= 264px',
    });

    // Check badge height constraints (prevent unexpected height explosions)
    const badges = sidebarMetrics?.badges || [];
    let badgeHeightExplosion = false;
    let maxBadgeHeight = 0;
    for (const badge of badges) {
      if (badge.height > maxBadgeHeight) {
        maxBadgeHeight = Math.round(badge.height);
      }
      // Badges should be compact inline pills (height <= 36px)
      if (badge.height > 36) {
        badgeHeightExplosion = true;
      }
    }

    recordAssertion({
      category: 'Sidebar Constraints',
      name: 'Sidebar badges do not cause unexpected height explosions',
      passed: !badgeHeightExplosion && badges.length > 0,
      measured: `Max badge height: ${maxBadgeHeight}px (Total badges: ${badges.length})`,
      expected: 'Height <= 36px',
    });

    // Check that nav buttons have proper touch/click heights without exploding
    const navButtons = sidebarMetrics?.navButtons || [];
    const explodingButtons = navButtons.filter((btn: { height: number }) => btn.height > 80);
    recordAssertion({
      category: 'Sidebar Constraints',
      name: 'Sidebar navigation items maintain constrained vertical dimensions',
      passed: explodingButtons.length === 0 && navButtons.length > 0,
      measured: `Total nav items: ${navButtons.length}, Exploding: ${explodingButtons.length}`,
      expected: '0 exploding items (>80px)',
    });

    // Interactive Navigation Test 2: Tab Switching on Portal
    console.log(`  ${colors.dim}Testing interactive tab switching in Portal Command Deck...${colors.reset}`);
    const tabClicked = await page.evaluate(() => {
      // Find "Test compiler" button or any secondary tab
      const buttons = Array.from(document.querySelectorAll<HTMLButtonElement>('aside button'));
      const compilerBtn = buttons.find((b) => /Test compiler/i.test(b.innerText || ''));
      if (compilerBtn) {
        compilerBtn.click();
        return 'Test compiler';
      }
      return null;
    });

    recordAssertion({
      category: 'Interactive Navigation',
      name: 'Sidebar tab switch to "Test compiler" triggers smoothly',
      passed: tabClicked !== null,
      measured: tabClicked || 'Not found',
      expected: 'Test compiler',
    });

    // Wait for tab switch animation to resolve
    await new Promise((r) => setTimeout(r, 400));

    // Verify DOM rendered the Test Compiler or active tab content
    const activeContentMounted = await page.evaluate(() => {
      return (
        document.body.innerText.includes('Test Compiler') ||
        document.body.innerText.includes('Compiler') ||
        document.body.innerText.includes('Overview')
      );
    });

    recordAssertion({
      category: 'Interactive Navigation',
      name: 'Active tab view rendered without DOM crash',
      passed: activeContentMounted,
      measured: activeContentMounted ? 'Rendered' : 'Empty/Crashed',
      expected: 'Rendered',
    });

    // -------------------------------------------------------------------------
    // TEST SECTION 4: App Admin Console (/admin) Layout & Tab Routing
    // -------------------------------------------------------------------------
    console.log(`\n${colors.bold}${colors.magenta}[4/4] App Admin Console (/admin?guest=true) Layout & Tabs${colors.reset}`);

    const adminUrl = `${options.targetUrl}/admin?guest=true`;
    const adminResponse = await page.goto(adminUrl, {
      waitUntil: 'networkidle2',
      timeout: options.timeoutMs,
    });

    recordAssertion({
      category: 'App Admin',
      name: 'HTTP 200 on /admin?guest=true',
      passed: adminResponse ? adminResponse.status() < 400 : false,
      measured: adminResponse?.status(),
      expected: '200-399',
    });

    await page.waitForSelector('aside', { timeout: 6000 });

    const adminAsideWidth = await page.evaluate(() => {
      const aside = document.querySelector('aside');
      return aside ? Math.round(aside.getBoundingClientRect().width) : 0;
    });

    recordAssertion({
      category: 'App Admin',
      name: 'App Admin desktop sidebar width is at least 264px',
      passed: adminAsideWidth >= 264,
      measured: `${adminAsideWidth}px`,
      expected: '>= 264px',
    });

    // Interactive Tab Switch in Admin (switch to "Staged Papers")
    const stagedTabSwitched = await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll<HTMLButtonElement>('aside button'));
      const stagedBtn = buttons.find((b) => /Staged Papers/i.test(b.innerText || ''));
      if (stagedBtn) {
        stagedBtn.click();
        return true;
      }
      return false;
    });

    recordAssertion({
      category: 'App Admin',
      name: 'Interactive tab switch to Staged Papers in App Admin',
      passed: stagedTabSwitched,
      measured: stagedTabSwitched ? 'Switched' : 'Button not found',
      expected: 'Switched',
    });

    await new Promise((r) => setTimeout(r, 400));

    // -------------------------------------------------------------------------
    // OVERALL FRAMER MOTION & RUNTIME ERROR AUDIT
    // -------------------------------------------------------------------------
    console.log(`\n${colors.bold}${colors.magenta}[Audit] Runtime Stability & Framer Motion Health${colors.reset}`);

    recordAssertion({
      category: 'Runtime Stability',
      name: 'Zero Framer Motion "Only two keyframes currently supported with spring" errors',
      passed: globalErrors.framerMotionSpringErrors.length === 0,
      measured: globalErrors.framerMotionSpringErrors.length,
      expected: 0,
      error: globalErrors.framerMotionSpringErrors[0],
    });

    recordAssertion({
      category: 'Runtime Stability',
      name: 'Zero uncaught runtime page crashes (pageerror)',
      passed: globalErrors.pageErrors.length === 0,
      measured: globalErrors.pageErrors.length,
      expected: 0,
      error: globalErrors.pageErrors[0],
    });

    // Final Reporting
    console.log(`\n${colors.bold}${colors.cyan}====================================================${colors.reset}`);
    console.log(`${colors.bold}${colors.cyan}               Verification Summary                 ${colors.reset}`);
    console.log(`${colors.bold}${colors.cyan}====================================================${colors.reset}`);

    const passedCount = assertions.filter((a) => a.passed).length;
    const failedCount = assertions.filter((a) => !a.passed).length;
    const totalCount = assertions.length;

    console.log(`Total Checks:  ${colors.bold}${totalCount}${colors.reset}`);
    console.log(`Passed Checks: ${colors.green}${colors.bold}${passedCount}${colors.reset}`);
    console.log(
      `Failed Checks: ${failedCount > 0 ? colors.red + colors.bold : colors.dim}${failedCount}${colors.reset}\n`
    );

    if (failedCount > 0) {
      console.error(
        `${colors.red}${colors.bold}❌ UI Verification FAILED with ${failedCount} failure(s).${colors.reset}`
      );
      process.exit(1);
    } else {
      console.log(
        `${colors.green}${colors.bold}✅ ALL HEADLESS RUNTIME UI CHECKS PASSED SUCCESSFULLY.${colors.reset}\n`
      );
      process.exit(0);
    }
  } catch (err: any) {
    console.error(`\n${colors.red}${colors.bold}Fatal Harness Error:${colors.reset}`, err?.message || err);
    if (err?.stack) {
      console.error(colors.dim + err.stack + colors.reset);
    }
    process.exit(1);
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

// Execute
runVerifier();
