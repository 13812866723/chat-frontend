import axios from 'axios';
import type { AxiosInstance, InternalAxiosRequestConfig, AxiosResponse } from 'axios';

const request: AxiosInstance = axios.create({
    baseURL: '/api',
    timeout: 30000
});

// 请求拦截器：自动带上 Token
request.interceptors.request.use(
    (config: InternalAxiosRequestConfig) => {
        const token = localStorage.getItem('token');
        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
    },
    (error) => {
        return Promise.reject(error);
    }
);

// 响应拦截器：处理错误
request.interceptors.response.use(
    (response: AxiosResponse) => {
        return response;
    },
    (error) => {
        const errorMessage = error.response?.data?.detail || '请求失败，请稍后重试';
        console.error('请求失败:', errorMessage);
        // 可以根据错误码进行其他处理，如跳转登录页
        if (error.response?.status === 401) {
            // 处理 401 错误，如跳转登录页
            window.location.href = '/login';
        }
        // 其他错误码的处理
        return Promise.reject(error);
    }
);

export default request;
