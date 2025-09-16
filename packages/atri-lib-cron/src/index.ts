import { Logger, LogLevel } from '@huan_kong/logger'
import { CronJob } from 'cron'
import process from 'node:process'

export interface CronConfig {
  debug: boolean
}

export type AddCronOptions = Parameters<typeof CronJob.from>[0] & {
  onTick: () => void | Promise<void>
  name: string
}

export class Cron {
  config: CronConfig
  logger: Logger
  cronJobs: Record<string, CronJob> = {}

  constructor(config: CronConfig = { debug: process.argv.includes('--debug') }) {
    this.config = config
    this.logger = new Logger({
      title: 'Cron',
      level: this.config.debug ? LogLevel.DEBUG : LogLevel.INFO,
    })
  }

  add(options: AddCronOptions): [1, string] | [0, CronJob] {
    if (this.cronJobs[options.name]) return [1, `Cron job with name ${options.name} already exists`]

    if (!('timeZone' in options)) options.timeZone = 'Asia/Shanghai'

    options.onTick = () => {
      this.logger.DEBUG('定时任务触发!')
      options.onTick()
    }

    const job = CronJob.from(options) as CronJob
    this.cronJobs[options.name] = job
    return [0, job]
  }

  getCronJobs() {
    return this.cronJobs
  }

  static instance: Cron

  static getInstance() {
    if (!this.instance) this.instance = new Cron()
    return this.instance
  }

  static add(options: AddCronOptions) {
    return this.getInstance().add(options)
  }

  static getCronJobs() {
    return this.getInstance().getCronJobs()
  }
}
