import { Logger, LogLevel } from '@huan_kong/logger'
import _axios, {
  type AxiosInstance,
  type AxiosRequestConfig,
  type CreateAxiosDefaults,
} from 'axios'
import axiosRetry, { type IAxiosRetryConfig } from 'axios-retry'

export interface AxiosConfig {
  debug: boolean
  axiosRetry?: IAxiosRetryConfig
  createAxios?: CreateAxiosDefaults
}

export class Axios {
  axiosInstance: AxiosInstance
  config: AxiosConfig
  logger: Logger

  constructor(config: AxiosConfig = { debug: process.argv.includes('--debug') }) {
    this.config = config
    this.logger = new Logger({
      title: 'Axios',
      level: config.debug ? LogLevel.DEBUG : LogLevel.INFO,
    })
    this.axiosInstance = _axios.create({
      ...this.config.createAxios,
    })

    axiosRetry(this.axiosInstance, {
      ...this.config.axiosRetry,
      retries: this.config.axiosRetry?.retries ?? 3,
      retryDelay: (...args) => {
        this.logger.DEBUG(
          `收到网络请求失败响应[${args[0]}/${this.config.axiosRetry?.retries ?? 3}]`,
          {
            url: args[1].config?.url,
            method: args[1].config?.method,
            status: args[1].response?.status,
            message: args[1].message,
            response: args[1].response?.data,
          },
        )
        return (this.config.axiosRetry?.retryDelay ?? axiosRetry.linearDelay())(...args)
      },
    })

    // 添加请求拦截器
    this.axiosInstance.interceptors.request.use(
      (config) => {
        this.logger.DEBUG('发送网络请求', {
          method: config.method,
          url: config.url,
          headers: config.headers,
          params: config.params,
          data: config.data,
        })

        return config
      },
      (error) => {
        this.logger.ERROR('发送网络请求时遇到问题', error)
        return Promise.reject(error)
      },
    )

    // 添加响应拦截器
    this.axiosInstance.interceptors.response.use((response) => {
      this.logger.DEBUG('收到网络请求成功响应', {
        status: response.status,
        statusText: response.statusText,
        url: response.config.url,
        response: response.data,
      })
      return response
    })
  }

  request<T, P = null>(config: AxiosRequestConfig<P>) {
    return this.axiosInstance.request<T>(config)
  }

  get<T, P = null>(config: AxiosRequestConfig<P>) {
    return this.request<T, P>({ ...config, method: 'GET' })
  }

  delete<T, P = null>(config: AxiosRequestConfig<P>) {
    return this.request<T, P>({ ...config, method: 'DELETE' })
  }

  head<T, P = null>(config: AxiosRequestConfig<P>) {
    return this.request<T, P>({ ...config, method: 'HEAD' })
  }

  options<T, P = null>(config: AxiosRequestConfig<P>) {
    return this.request<T, P>({ ...config, method: 'OPTIONS' })
  }

  post<T, P = null>(config: AxiosRequestConfig<P>) {
    return this.request<T, P>({ ...config, method: 'POST' })
  }

  put<T, P = null>(config: AxiosRequestConfig<P>) {
    return this.request<T, P>({ ...config, method: 'PUT' })
  }

  patch<T, P = null>(config: AxiosRequestConfig<P>) {
    return this.request<T, P>({ ...config, method: 'PATCH' })
  }

  static instance: Axios

  static getInstance() {
    if (!this.instance) this.instance = new Axios()
    return this.instance
  }

  static request<T, P = null>(config: AxiosRequestConfig<P>) {
    return this.getInstance().request<T, P>(config)
  }

  static get<T, P = null>(config: AxiosRequestConfig<P>) {
    return this.getInstance().get<T, P>(config)
  }

  static delete<T, P = null>(config: AxiosRequestConfig<P>) {
    return this.getInstance().delete<T, P>(config)
  }

  static head<T, P = null>(config: AxiosRequestConfig<P>) {
    return this.getInstance().head<T, P>(config)
  }

  static options<T, P = null>(config: AxiosRequestConfig<P>) {
    return this.getInstance().options<T, P>(config)
  }

  static post<T, P = null>(config: AxiosRequestConfig<P>) {
    return this.getInstance().post<T, P>(config)
  }

  static put<T, P = null>(config: AxiosRequestConfig<P>) {
    return this.getInstance().put<T, P>(config)
  }

  static patch<T, P = null>(config: AxiosRequestConfig<P>) {
    return this.getInstance().patch<T, P>(config)
  }
}
