import axios, { type AxiosInstance, type AxiosRequestConfig } from 'axios'
import axiosRetry from 'axios-retry'

export class Axios {
  static axiosInstance: AxiosInstance

  static initAxiosInstance() {
    if (!Axios.axiosInstance) {
      Axios.axiosInstance = axios.create({
        timeout: 300000,
      })
      axiosRetry(Axios.axiosInstance, { retries: 3 })
    }
  }

  static get<T, P = null>(url: string, config?: AxiosRequestConfig<P>) {
    Axios.initAxiosInstance()
    return Axios.axiosInstance.get<T>(url, config)
  }

  static post<T, P = object, U = null>(url: string, data?: P, config?: AxiosRequestConfig<U>) {
    Axios.initAxiosInstance()
    return Axios.axiosInstance.post<T>(url, data, config)
  }
}
