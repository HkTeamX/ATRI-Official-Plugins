import ejs from 'ejs'
import fs from 'node:fs'
import process from 'node:process'
import puppeteer, { type Browser, type Viewport } from 'puppeteer'

export type RenderOptions<T extends object = Record<string, unknown>> = (
  | { templatePath: string }
  | { html: string }
) & {
  data?: T
  element?: string
  viewport?: Viewport
}

export class Puppeteer {
  static browser: Browser

  static async render(options: RenderOptions) {
    if (!Puppeteer.browser) {
      console.log('启动浏览器...')
      Puppeteer.browser = await puppeteer.launch()

      process.on('exit', Puppeteer.closeBrowser)
    }

    const page = await Puppeteer.browser.newPage()

    try {
      await page.setViewport({
        width: 1920,
        height: 1080,
        deviceScaleFactor: 1,
        ...options.viewport,
      })

      let html: string

      if ('html' in options) {
        html = ejs.render(options.html, options.data)
      } else if ('templatePath' in options) {
        if (!fs.existsSync(options.templatePath)) {
          throw new Error(`模板文件不存在: ${options.templatePath}`)
        }

        const templateContent = fs.readFileSync(options.templatePath, 'utf-8')
        html = ejs.render(templateContent, options.data)
      } else {
        throw new Error('必须提供 html 或 templatePath 参数')
      }

      // 设置页面内容
      await page.setContent(html, { waitUntil: 'networkidle0' })
      const element = await page.$(options.element || 'html')

      const screenshotBuffer = await (element ?? page).screenshot({
        type: 'png',
        fullPage: element === null,
      })

      return `base64://${Buffer.from(screenshotBuffer).toString('base64')}`
    } finally {
      await page.close()
    }
  }

  static async closeBrowser() {
    if (Puppeteer.browser && Puppeteer.browser.connected) await Puppeteer.browser.close()
  }
}
