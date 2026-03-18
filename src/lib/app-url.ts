export function getAppBaseUrl() {
  if (process.env.NEXT_PUBLIC_APP_URL) {
    return process.env.NEXT_PUBLIC_APP_URL
  }

  const port = process.env.PORT || '3000'
  return `http://127.0.0.1:${port}`
}
