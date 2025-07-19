// IndexedDB 存储工具 - 专门用于大容量数据存储（如聊天历史）
// 提供比 chrome.storage 更大的存储配额（可达几GB）

interface DBConfig {
  name: string
  version: number
  stores: {
    name: string
    keyPath?: string
    autoIncrement?: boolean
    indexes?: Array<{
      name: string
      keyPath: string | string[]
      unique?: boolean
    }>
  }[]
}

class IndexedDBStorage {
  private db: IDBDatabase | null = null
  private dbName: string
  private version: number
  private stores: DBConfig['stores']

  constructor(config: DBConfig) {
    this.dbName = config.name
    this.version = config.version
    this.stores = config.stores
  }

  // 初始化数据库
  async init(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.version)

      request.onerror = () => {
        reject(new Error(`Failed to open database: ${request.error}`))
      }

      request.onsuccess = () => {
        this.db = request.result
        resolve()
      }

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result

        // 创建对象存储
        this.stores.forEach(storeConfig => {
          if (!db.objectStoreNames.contains(storeConfig.name)) {
            const store = db.createObjectStore(storeConfig.name, {
              keyPath: storeConfig.keyPath,
              autoIncrement: storeConfig.autoIncrement
            })

            // 创建索引
            if (storeConfig.indexes) {
              storeConfig.indexes.forEach(index => {
                store.createIndex(index.name, index.keyPath, {
                  unique: index.unique || false
                })
              })
            }
          }
        })
      }
    })
  }

  // 确保数据库已初始化
  private async ensureDB(): Promise<IDBDatabase> {
    if (!this.db) {
      await this.init()
    }
    if (!this.db) {
      throw new Error('Database not initialized')
    }
    return this.db
  }

  // 设置值
  async set<T>(storeName: string, key: string, value: T): Promise<void> {
    const db = await this.ensureDB()
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([storeName], 'readwrite')
      const store = transaction.objectStore(storeName)
      
      const request = store.put({ id: key, data: value, timestamp: Date.now() })
      
      request.onsuccess = () => resolve()
      request.onerror = () => reject(new Error(`Failed to set ${key}: ${request.error}`))
    })
  }

  // 获取值
  async get<T>(storeName: string, key: string): Promise<T | undefined> {
    const db = await this.ensureDB()
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([storeName], 'readonly')
      const store = transaction.objectStore(storeName)
      
      const request = store.get(key)
      
      request.onsuccess = () => {
        const result = request.result
        resolve(result ? result.data : undefined)
      }
      request.onerror = () => reject(new Error(`Failed to get ${key}: ${request.error}`))
    })
  }

  // 删除值
  async remove(storeName: string, key: string): Promise<void> {
    const db = await this.ensureDB()
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([storeName], 'readwrite')
      const store = transaction.objectStore(storeName)
      
      const request = store.delete(key)
      
      request.onsuccess = () => resolve()
      request.onerror = () => reject(new Error(`Failed to remove ${key}: ${request.error}`))
    })
  }

  // 获取所有键
  async getAllKeys(storeName: string): Promise<string[]> {
    const db = await this.ensureDB()
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([storeName], 'readonly')
      const store = transaction.objectStore(storeName)
      
      const request = store.getAllKeys()
      
      request.onsuccess = () => resolve(request.result as string[])
      request.onerror = () => reject(new Error(`Failed to get all keys: ${request.error}`))
    })
  }

  // 清空存储
  async clear(storeName: string): Promise<void> {
    const db = await this.ensureDB()
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([storeName], 'readwrite')
      const store = transaction.objectStore(storeName)
      
      const request = store.clear()
      
      request.onsuccess = () => resolve()
      request.onerror = () => reject(new Error(`Failed to clear store: ${request.error}`))
    })
  }

  // 获取存储大小估算
  async getStorageEstimate(): Promise<StorageEstimate | null> {
    if ('storage' in navigator && 'estimate' in navigator.storage) {
      return await navigator.storage.estimate()
    }
    return null
  }
}

// 创建聊天历史专用的 IndexedDB 实例
const chatHistoryDB = new IndexedDBStorage({
  name: 'ChatOverleafDB',
  version: 1,
  stores: [
    {
      name: 'chatHistory',
      keyPath: 'id',
      indexes: [
        { name: 'lastUpdated', keyPath: 'lastUpdated' },
        { name: 'createdAt', keyPath: 'createdAt' }
      ]
    }
  ]
})

// 导出聊天历史存储工具
export const chatHistoryStorage = {
  // 初始化
  init: () => chatHistoryDB.init(),

  // 设置聊天历史
  set: (key: string, value: any) => chatHistoryDB.set('chatHistory', key, value),

  // 获取聊天历史
  get: <T>(key: string) => chatHistoryDB.get<T>('chatHistory', key),

  // 删除聊天历史
  remove: (key: string) => chatHistoryDB.remove('chatHistory', key),

  // 获取所有键
  getAllKeys: () => chatHistoryDB.getAllKeys('chatHistory'),

  // 清空所有聊天历史
  clear: () => chatHistoryDB.clear('chatHistory'),

  // 获取存储使用情况
  getStorageEstimate: () => chatHistoryDB.getStorageEstimate()
}

export default IndexedDBStorage
