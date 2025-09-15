import { Logger, LogLevel } from '@huan_kong/logger'
import ejs from 'ejs'
import fs from 'node:fs'
import process from 'node:process'
import puppeteer, { type Viewport } from 'puppeteer'

export type RenderOptions<T extends object = Record<string, unknown>> = (
  | { templatePath: string; data?: T }
  | { html: string; data?: T }
  | { url: string }
) & {
  element?: string
  viewport?: Viewport
}

export interface PuppeteerConfig {
  debug: boolean
}

let browser = await puppeteer.launch()
process.on('exit', browser.close)

export class Puppeteer {
  config: PuppeteerConfig
  logger: Logger

  constructor(config: PuppeteerConfig = { debug: process.argv.includes('--debug') }) {
    this.config = config
    this.logger = new Logger({
      level: config.debug ? LogLevel.DEBUG : LogLevel.INFO,
    })
  }

  async render(options: RenderOptions) {
    if (!browser.connected) {
      this.logger.DEBUG('浏览器被异常关闭, 正在重新启动')
      browser = await puppeteer.launch()
      this.logger.DEBUG('浏览器被异常关闭, 重新启动成功')
    }

    const page = await browser.newPage()

    try {
      await page.setViewport({
        width: 1920,
        height: 1080,
        deviceScaleFactor: 1,
        ...options.viewport,
      })

      if ('url' in options) {
        await page.goto(options.url)
      } else {
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

        this.logger.DEBUG('模板处理成功, html:', html)

        // 设置页面内容
        await page.setContent(html, { waitUntil: 'networkidle0' })
      }

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

  async closeBrowser() {
    if (browser && browser.connected) await browser.close()
  }

  static instance: Puppeteer

  static getInstance() {
    if (!this.instance) this.instance = new Puppeteer()
    return this.instance
  }

  static async render(options: RenderOptions) {
    return this.getInstance().render(options)
  }

  static async closeBrowser() {
    return this.getInstance().closeBrowser()
  }
}
