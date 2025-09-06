import { Command } from 'commander'
import { Structs, type SendMessageSegment } from 'node-napcat-ts'
import fs from 'node:fs'
import path from 'node:path'
import url from 'node:url'
import type { PluginHookContext } from '../atri.js'
import { BasePlugin } from '../plugin.js'
import type { CommandCallback } from '../reg_event.js'
import { commander_parse_enum } from '../utils.js'

export interface PluginStoreConfig {
  plugins: Record<string, boolean>
  repositories: {
    name: string
    url: string
  }[]
}

export interface ShowPluginListContext {
  params: {
    refresh?: boolean
  }
}

export interface PluginManagementContext {
  args: ['启用' | '禁用' | '加载' | '卸载', string]
}

export class Plugin extends BasePlugin<PluginStoreConfig> {
  name = 'plugin_store'
  version = '1.0.0'
  default_config: PluginStoreConfig = {
    plugins: {},
    repositories: [
      {
        name: '官方插件库',
        url: 'https://github.com/HkTeamX/atri-plugins',
      },
    ],
  }
  plugins: Record<string, BasePlugin> = {}
  plugins_by_name_to_path: Record<string, string> = {}

  async load() {
    this.atri.add_load_plugin_hook('plugin_store', this.load_plugin_hook.bind(this))
    await this.refresh_plugin_list()

    this.reg_command_event({
      command_name: '插件列表',
      commander: new Command()
        .description('显示已安装的插件列表')
        .option('-r, --refresh', '刷新插件列表'),
      need_admin: true,
      callback: this.handle_show_plugin_list.bind(this),
    })

    this.reg_command_event({
      command_name: '插件管理',
      commander: new Command()
        .description('管理已安装的插件')
        .argument(
          '<action>',
          '操作 [启用/禁用/加载/卸载]',
          commander_parse_enum(['启用', '禁用', '加载', '卸载']),
        )
        .argument('<plugin_name>', '插件名'),
      need_admin: true,
      callback: this.handle_plugin_management.bind(this),
    })
  }

  unload() {}

  load_plugin_hook(plugin_context: PluginHookContext) {
    const is_enabled = this.config.plugins[plugin_context.plugin_name] ?? true
    if (!is_enabled) this.logger.INFO(`插件 ${plugin_context.plugin_name} 被禁用, 跳过加载`)
    return is_enabled
  }

  async refresh_plugin_list() {
    // 内置插件
    const built_in_files = fs
      .readdirSync(import.meta.dirname)
      .map((file) => path.join(import.meta.dirname, file))

    const plugin_dir = path.join(this.atri.config.base_dir, 'plugins')
    const files = fs.readdirSync(plugin_dir).map((file) => path.join(plugin_dir, file))

    for (const file of [...built_in_files, ...files]) {
      try {
        const plugin = await import(url.pathToFileURL(file).toString())
        const plugin_variable = plugin.Plugin
        if (plugin_variable) {
          const plugin_entity = new plugin_variable(this.atri)
          this.plugins[file] = plugin_entity
          this.plugins_by_name_to_path[plugin_entity.name] = file
        }
      } catch {
        this.logger.ERROR(`获取插件 ${file} 信息失败`)
      }
    }
  }

  async handle_show_plugin_list({ context, params }: CommandCallback<ShowPluginListContext>) {
    if (params.refresh) await this.refresh_plugin_list()

    const message: SendMessageSegment[] = [
      Structs.text(
        `当前已有插件${Object.keys(this.plugins).length}个${params.refresh ? '(已刷新)' : ''}:\n`,
      ),
      ...Object.entries(this.plugins).map(([file, plugin]) =>
        Structs.text(
          [
            ` - ${plugin.name} (${plugin.version})`,
            `   - 内置插件: ${file.startsWith(import.meta.dirname) ? '是' : '否'}`,
            `   - 插件状态: ${!(plugin.name in this.config.plugins) || this.config.plugins[plugin.name] ? '启用' : '禁用'}`,
            `   - 加载状态: ${plugin.name in this.atri.loaded_plugins ? '已加载' : '未加载'}\n`,
          ].join('\n'),
        ),
      ),
    ]
    await this.bot.send_msg(context, message)
  }

  async handle_plugin_management(event_context: CommandCallback<PluginManagementContext>) {
    const { context, args } = event_context
    const [action, plugin_name] = args

    if (!this.plugins_by_name_to_path[plugin_name]) {
      await this.bot.send_msg(context, [Structs.text(`插件 ${plugin_name} 不存在`)])
      return
    }

    switch (action) {
      case '启用':
        return await this.enable_plugin(event_context, plugin_name)
      case '禁用':
        return await this.disable_plugin(event_context, plugin_name)
      case '加载':
        return await this.load_plugin(event_context, plugin_name)
      case '卸载':
        return await this.unload_plugin(event_context, plugin_name)
    }
  }

  async enable_plugin({ context }: CommandCallback<PluginManagementContext>, plugin_name: string) {
    if (plugin_name in this.config.plugins && this.config.plugins[plugin_name]) {
      await this.bot.send_msg(context, [Structs.text(`插件 ${plugin_name} 无法启用, 因为已经启用`)])
      return
    }
    this.config.plugins[plugin_name] = true
    this.save_config()
    const [ret_code] = await this.atri.load_plugin(this.plugins_by_name_to_path[plugin_name], '')
    if (ret_code !== 0) {
      await this.bot.send_msg(context, [
        Structs.text(`插件 ${plugin_name} 启用成功, 但自动加载失败, ret_code: ${ret_code}`),
      ])
    }

    await this.bot.send_msg(context, [Structs.text(`插件 ${plugin_name} 启用成功`)])
  }

  async disable_plugin({ context }: CommandCallback<PluginManagementContext>, plugin_name: string) {
    if (plugin_name in this.config.plugins && !this.config.plugins[plugin_name]) {
      await this.bot.send_msg(context, [Structs.text(`插件 ${plugin_name} 无法禁用, 因为已经禁用`)])
      return
    }
    this.config.plugins[plugin_name] = false
    this.save_config()
    await this.atri.unload_plugin(plugin_name)

    await this.bot.send_msg(context, [Structs.text(`插件 ${plugin_name} 禁用成功`)])
  }

  async load_plugin({ context }: CommandCallback<PluginManagementContext>, plugin_name: string) {
    const [ret_code] = await this.atri.load_plugin(this.plugins_by_name_to_path[plugin_name], '')
    if (ret_code !== 0) {
      await this.bot.send_msg(context, [
        Structs.text(`插件 ${plugin_name} 加载失败, ret_code: ${ret_code}`),
      ])
      return
    }

    await this.bot.send_msg(context, [Structs.text(`插件 ${plugin_name} 加载成功`)])
  }

  async unload_plugin({ context }: CommandCallback<PluginManagementContext>, plugin_name: string) {
    const [ret_code] = await this.atri.unload_plugin(plugin_name)
    if (ret_code !== 0) {
      await this.bot.send_msg(context, [
        Structs.text(`插件 ${plugin_name} 卸载失败, ret_code: ${ret_code}`),
      ])
      return
    }

    await this.bot.send_msg(context, [Structs.text(`插件 ${plugin_name} 卸载成功`)])
  }
}
