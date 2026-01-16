import { createClient } from '@supabase/supabase-js'

// Supabase 配置类型
export interface SupabaseStorageConfig {
  url: string // Supabase 项目 URL
  key: string // Supabase 项目 API 密钥
  bucketName: string // 存储桶名称
  basePath: string // 存档存放路径（相对存储桶）
}

// Supabase 存储服务
export class SupabaseStorageService {
  private supabase: any
  private config: SupabaseStorageConfig

  constructor(config: SupabaseStorageConfig) {
    this.config = config
    this.supabase = createClient(config.url, config.key)
  }

  // 测试连接
  async testConnection(): Promise<{ success: boolean; message: string }> {
    try {
      const { data, error } = await this.supabase.storage.from(this.config.bucketName).list(this.config.basePath)
      if (error) {
        return { success: false, message: `连接失败: ${error.message}` }
      }
      return { success: true, message: '连接成功' }
    } catch (error) {
      return { success: false, message: `连接异常: ${error instanceof Error ? error.message : String(error)}` }
    }
  }

  // 上传存档
  async upload(data: string, fileName?: string): Promise<{ success: boolean; message: string; fileName?: string }> {
    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
      const actualFileName = fileName || `ogame-save-${timestamp}.json`
      
      const { error } = await this.supabase.storage
        .from(this.config.bucketName)
        .upload(`${this.config.basePath}/${actualFileName}`, new Blob([data], { type: 'application/json' }), {
          upsert: true,
          contentType: 'application/json'
        })
      
      if (error) {
        return { success: false, message: `上传失败: ${error.message}` }
      }
      
      return { success: true, message: '上传成功', fileName: actualFileName }
    } catch (error) {
      return { success: false, message: `上传异常: ${error instanceof Error ? error.message : String(error)}` }
    }
  }

  // 列出存档文件
  async listFiles(): Promise<{ success: boolean; message: string; files?: Array<{ name: string; path: string; size: number; lastModified: Date }> }> {
    try {
      const { data, error } = await this.supabase.storage.from(this.config.bucketName).list(this.config.basePath)
      
      if (error) {
        return { success: false, message: `列出文件失败: ${error.message}` }
      }
      
      const files = data
        .filter(file => file.name.endsWith('.json'))
        .map(file => ({
          name: file.name,
          path: `${this.config.basePath}/${file.name}`,
          size: file.metadata?.size || 0,
          lastModified: new Date(file.updated_at)
        }))
        .sort((a, b) => b.lastModified.getTime() - a.lastModified.getTime())
      
      return { success: true, message: '列出文件成功', files }
    } catch (error) {
      return { success: false, message: `列出文件异常: ${error instanceof Error ? error.message : String(error)}` }
    }
  }

  // 下载存档
  async download(fileName: string): Promise<{ success: boolean; message: string; data?: string }> {
    try {
      const { data, error } = await this.supabase.storage
        .from(this.config.bucketName)
        .download(`${this.config.basePath}/${fileName}`)
      
      if (error) {
        return { success: false, message: `下载失败: ${error.message}` }
      }
      
      const text = await data.text()
      return { success: true, message: '下载成功', data: text }
    } catch (error) {
      return { success: false, message: `下载异常: ${error instanceof Error ? error.message : String(error)}` }
    }
  }

  // 删除存档
  async delete(fileName: string): Promise<{ success: boolean; message: string }> {
    try {
      const { error } = await this.supabase.storage
        .from(this.config.bucketName)
        .remove([`${this.config.basePath}/${fileName}`])
      
      if (error) {
        return { success: false, message: `删除失败: ${error.message}` }
      }
      
      return { success: true, message: '删除成功' }
    } catch (error) {
      return { success: false, message: `删除异常: ${error instanceof Error ? error.message : String(error)}` }
    }
  }
}