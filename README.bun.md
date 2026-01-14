# 使用 Bun 管理 OGame-Vue-Ts 项目

本项目原本是使用 pnpm 作为包管理器，但也可以使用 Bun 来管理。本文档记录了如何使用 Bun 进行项目管理。

## 安装 Bun

请按照以下步骤安装 Bun：

### 在 Windows 上安装 Bun

1. 使用 PowerShell 安装：
   ```powershell
   powershell -c "irm bun.sh/install.ps1|iex"
   ```

2. 或者使用 Scoop 安装：
   ```powershell
   scoop install bun
   ```

3. 检查 Bun 是否安装成功：
   ```powershell
   bun --version
   ```

注意：如果安装后无法识别 `bun` 命令，请重启终端或重新登录，使环境变量生效。

## 安装依赖

```bash
bun install
```

## 运行项目

```bash
# 开发模式
bun run dev

# 构建项目
bun run build

# 预览构建结果
bun run preview
```

## 项目构建命令

```bash
# 构建 Electron 应用
bun run build:electron

# 构建 Android APK
bun run build:apk
```

## 注意事项

1. 项目使用了 `vite: npm:rolldown-vite@7.2.5` 的覆盖配置，确保 Bun 正确处理此依赖。
2. 由于 Bun 与 npm 生态高度兼容，大部分 npm 包都可以正常使用。
3. 如果遇到任何问题，原始的 pnpm 配置仍然保留，可以随时切换回 pnpm。

## 配置说明

- `bunfig.toml`: Bun 的配置文件，设置了包管理器行为和锁定文件格式
- `package.json`: 添加了 `overrides` 字段以确保 Bun 兼容性
- 原始的 `pnpm` 配置保留，以备需要时切换回 pnpm

## 与 pnpm 的兼容性

虽然项目已配置为支持 Bun，但以下功能在 Bun 中可能表现不同：

- `pnpm` 特定的 `onlyBuiltDependencies` 和 `ignoredBuiltDependencies` 配置不会被 Bun 使用
- pnpm 的 `shamefully-hoist` 等配置不会被 Bun 使用
- Bun 使用自己的依赖解析算法，可能与 pnpm 有所不同

## 故障排除

如果 Bun 安装依赖时出现问题：

1. 确保 Bun 已正确安装：`bun --version`
2. 清除任何可能存在的 [node_modules](file:///d:/WorkSpace/000_Project/d7g_org/ogame-vue-ts/node_modules/) 目录和锁定文件
3. 运行 `bun install` 重新安装依赖
4. 如仍有问题，可以暂时切换回 pnpm 使用：`pnpm install`

## 性能对比

Bun 通常比传统包管理器更快，特别是在：
- 依赖安装速度
- 脚本执行速度
- 构建时间

这是由于 Bun 使用 Zig 编写，具有高效的依赖解析和缓存机制。