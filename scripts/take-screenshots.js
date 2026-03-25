const puppeteer = require('puppeteer')
const path = require('path')

const PAGES = [
  { name: 'screenshot-dashboard', url: 'http://localhost:3000/', wait: 3000 },
  { name: 'screenshot-analytics', url: 'http://localhost:3000/costs', wait: 3000 },
  { name: 'screenshot-features', url: 'http://localhost:3000/presets', wait: 2000 },
  { name: 'screenshot-replay', url: 'http://localhost:3000/audit', wait: 2000 },
]

const OUT = path.join(__dirname, '..', 'website')

;(async () => {
  const browser = await puppeteer.launch({
    headless: 'new',
    defaultViewport: { width: 1440, height: 900, deviceScaleFactor: 2 },
    args: ['--no-sandbox']
  })

  for (const page of PAGES) {
    console.log(`Capturing ${page.name}...`)
    const tab = await browser.newPage()
    await tab.goto(page.url, { waitUntil: 'networkidle2', timeout: 15000 })
    await new Promise(r => setTimeout(r, page.wait))

    // Dismiss onboarding if on dashboard
    if (page.url.endsWith('/')) {
      try {
        // Click the dismiss X button on onboarding checklist if present
        await tab.evaluate(() => {
          const btns = document.querySelectorAll('button')
          for (const b of btns) {
            if (b.closest('[class*="glass"]') && b.querySelector('svg') && !b.textContent.trim()) {
              // This is likely the close/dismiss button
              const parent = b.closest('[class*="glass"]')
              if (parent && parent.textContent.includes('Get Started')) {
                b.click()
                return true
              }
            }
          }
          return false
        })
        await new Promise(r => setTimeout(r, 500))
      } catch {}
    }

    await tab.screenshot({
      path: path.join(OUT, `${page.name}.png`),
      type: 'png',
      clip: { x: 0, y: 0, width: 1440, height: 900 }
    })
    console.log(`  saved ${page.name}.png`)
    await tab.close()
  }

  // Extra: forecast page
  console.log('Capturing screenshot-forecast...')
  const forecastTab = await browser.newPage()
  await forecastTab.goto('http://localhost:3000/forecast', { waitUntil: 'networkidle2', timeout: 15000 })
  await new Promise(r => setTimeout(r, 2000))
  await forecastTab.screenshot({
    path: path.join(OUT, 'screenshot-forecast.png'),
    type: 'png',
    clip: { x: 0, y: 0, width: 1440, height: 900 }
  })
  console.log('  saved screenshot-forecast.png')
  await forecastTab.close()

  // Extra: alerts page
  console.log('Capturing screenshot-alerts...')
  const alertsTab = await browser.newPage()
  await alertsTab.goto('http://localhost:3000/alerts', { waitUntil: 'networkidle2', timeout: 15000 })
  await new Promise(r => setTimeout(r, 2000))
  await alertsTab.screenshot({
    path: path.join(OUT, 'screenshot-alerts.png'),
    type: 'png',
    clip: { x: 0, y: 0, width: 1440, height: 900 }
  })
  console.log('  saved screenshot-alerts.png')
  await alertsTab.close()

  await browser.close()
  console.log('\nDone! All screenshots saved to website/')
})()
