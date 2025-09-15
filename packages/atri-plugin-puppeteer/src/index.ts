import { BasePlugin, type CommandCallback } from '@atri-bot/core'
import { Puppeteer } from '@atri-bot/lib-puppeteer'
import { Command } from 'commander'
import { Structs } from 'node-napcat-ts'
import path from 'node:path'
import url from 'node:url'

export type RenderOptions = ({ templatePath: string } | { html: string }) & {
  data?: Record<string, unknown>
  element?: string
}

export interface TestPuppeteerContext {
  args: [string[] | string]
}

export class Plugin extends BasePlugin {
  static pluginDir: string

  async load() {
    Plugin.pluginDir = path.dirname(url.fileURLToPath(import.meta.url))

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
    let html = args[0]
    if (Array.isArray(html)) html = html.join(' ')

    const image = await Puppeteer.render({
      templatePath: path.join(Plugin.pluginDir, 'template/index.html'),
      data: { testDomElement: html },
    })
    this.bot.sendMsg(context, [Structs.image(image)])
  }

  async unload() {
    Puppeteer.closeBrowser()
  }
}
