import { BasePlugin, type CommandCallback } from '@atri-bot/core'
import { Command } from 'commander'
import ejs from 'ejs'
import { Structs } from 'node-napcat-ts'
import fs from 'node:fs'
import path from 'node:path'
import url from 'node:url'
import puppeteer, { type Browser, type Page } from 'puppeteer'

export interface PuppeteerConfig {
  browser: {
    headless?: boolean
    args?: string[]
  }
}

export type RenderOptions = ({ templatePath: string } | { html: string }) & {
  data?: Record<string, unknown>
  element?: string
}

export interface TestPuppeteerContext {
  args: [string[]]
}

export class Plugin extends BasePlugin<PuppeteerConfig> {
  static browser: Browser
  static pluginDir: string

  defaultConfig: PuppeteerConfig = {
    browser: {
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    },
  }

  async load() {
    Plugin.pluginDir = path.dirname(url.fileURLToPath(import.meta.url))

    try {
      this.logger.INFO('正在启动 Puppeteer 浏览器...')
      Plugin.browser = await puppeteer.launch({
        headless: this.config.browser.headless,
        args: this.config.browser.args,
      })
      this.logger.INFO('Puppeteer 浏览器启动成功')
    } catch (error) {
      this.logger.ERROR('Puppeteer 浏览器启动失败:', error)
      throw error
    }

    // 注册测试命令
    this.regCommandEvent({
      commandName: 'test-puppeteer',
      needAdmin: true,
      commander: new Command()
        .description('测试 Puppeteer 插件')
        .argument('[testDomElement...]', '要测试的 DOM 元素', `<p>测试文本喵</p>`),
      callback: this.testPuppeteer.bind(this),
    })
  }

  async testPuppeteer({ context, args }: CommandCallback<TestPuppeteerContext>) {
    const html = args[0].join(' ')
    const image = await Plugin.render({
      templatePath: path.join(Plugin.pluginDir, 'template/index.html'),
      data: { testDomElement: html },
    })
    this.bot.sendMsg(context, [Structs.image(image)])
  }

  async unload() {
    if (Plugin.browser) {
      await Plugin.browser.close()
      this.logger.INFO('Puppeteer 浏览器已关闭')
    }
  }

  /**
   * 渲染 HTML 并截图
   */
  static async render(options: RenderOptions) {
    if (!Plugin.browser) throw new Error('Puppeteer 浏览器未初始化')

    const page: Page = await Plugin.browser.newPage()

    try {
      await page.setViewport({
        width: 1920,
        height: 1080,
        deviceScaleFactor: 1,
      })

      let html: string

      if ('html' in options) {
        // 直接使用传入的 HTML
        html = options.html
      } else if ('templatePath' in options) {
        const templateContent = fs.readFileSync(options.templatePath, 'utf-8')
        html = ejs.render(templateContent, options.data || {})
      } else {
        throw new Error('必须提供 html 或 templatePath 参数')
      }

      // 设置页面内容
      await page.setContent(html, { waitUntil: 'networkidle0' })
      const element = await page.$(options.element || 'body')

      const screenshotBuffer = await (element ?? page).screenshot({
        type: 'png',
        fullPage: element === null,
      })

      return `base64://${Buffer.from(screenshotBuffer).toString('base64')}`
    } finally {
      await page.close()
    }
  }

  /**
   * 渲染 EJS 模板到 HTML
   */
  static async renderTemplate(
    templatePath: string,
    data: Record<string, unknown> = {},
  ): Promise<string> {
    if (!fs.existsSync(templatePath)) {
      throw new Error(`模板文件不存在: ${templatePath}`)
    }

    const templateContent = fs.readFileSync(templatePath, 'utf-8')
    return ejs.render(templateContent, data)
  }
}
