import axios, { type AxiosRequestConfig } from 'axios'

export class Axios {
  static axiosInstance = axios.create({
    timeout: 300000,
  })

  static get<T, P = null>(url: string, config?: AxiosRequestConfig<P>) {
    return Axios.axiosInstance.get<T>(url, config)
  }

  static post<T, P = object, U = null>(url: string, data?: P, config?: AxiosRequestConfig<U>) {
    return Axios.axiosInstance.post<T>(url, data, config)
  }
}
