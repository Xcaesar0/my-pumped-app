import CryptoJS from 'crypto-js'

const ENCRYPTION_KEY = import.meta.env.VITE_ENCRYPTION_KEY || 'default-key-change-in-production'

export const encryptToken = (token: string): string => {
  try {
    return CryptoJS.AES.encrypt(token, ENCRYPTION_KEY).toString()
  } catch (error) {
    console.error('Error encrypting token:', error)
    return token // Fallback to plain text in case of error
  }
}

export const decryptToken = (encryptedToken: string): string => {
  try {
    const bytes = CryptoJS.AES.decrypt(encryptedToken, ENCRYPTION_KEY)
    return bytes.toString(CryptoJS.enc.Utf8)
  } catch (error) {
    console.error('Error decrypting token:', error)
    return encryptedToken // Fallback to return as-is in case of error
  }
}

export const hashData = (data: string): string => {
  return CryptoJS.SHA256(data).toString()
}