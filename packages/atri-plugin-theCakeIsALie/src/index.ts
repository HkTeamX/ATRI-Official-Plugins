import { BasePlugin, type MessageCallback } from '@atri-bot/core'
import { Structs, type SendMessageSegment } from 'node-napcat-ts'

export class Plugin extends BasePlugin {
  pluginName = 'the_cake_is_a_lie'
  disableAutoLoadConfig = true

  load() {
    this.regMessageEvent({
      regexp: /^(the cake is a lie|蛋糕是个谎言)$/i,
      callback: this.cakeIsALie.bind(this),
    })
  }

  unload() {}

  private messages: SendMessageSegment[] = [
    Structs.text('You Will Be Baked, And Then There Will Be Cake'),
    Structs.music('163', 2005125394),
    Structs.text('But The Cake Is A Lie'),
  ]

  private async cakeIsALie({ context }: MessageCallback) {
    this.messages.forEach(async (message, index) => {
      setTimeout(async () => {
        await this.bot.sendMsg(context, [message], { reply: false, at: false })
      }, index * 1000)
    })
  }
}
