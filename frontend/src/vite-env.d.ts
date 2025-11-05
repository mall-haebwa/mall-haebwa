/// <reference types="vite/client" />

interface ImportMetaEnv {
readonly VITE_API_URL: string
readonly VITE_BACKEND_URL: string
readonly VITE_TOSS_CLIENT_KEY: string
// 필요한 다른 환경변수 추가...
}

interface ImportMeta {
readonly env: ImportMetaEnv
}