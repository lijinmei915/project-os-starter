---
layer: knowledge
type: spec
last_verified: 2026-06-04
---

# 后端技术说明

> 用途：说明后端技术栈选型、架构模式、数据库选型、API 契约及部署策略。
> 什么时候更新：后端架构变更、新增微服务、数据库迁移或核心安全策略改变时。
> 不要写什么：具体某个 API 的参数说明（应交由 Swagger/OpenAPI 等自动生成）、临时的服务器配置。

## 1. 技术栈选型

- **语言**：[例如：Node.js / Python / Go / Java]
- **框架**：[例如：Express / NestJS / FastAPI / Django / Gin]
- **运行时/环境**：[例如：Node 20+ / Python 3.11+]

## 2. 架构与 API

- **架构模式**：[例如：单体应用 / 微服务 / Serverless]
- **API 风格**：[例如：RESTful / GraphQL / tRPC / gRPC]
- **文档/契约**：[例如：Swagger / OpenAPI / Postman]

## 3. 数据库与存储

- **关系型数据库**：[例如：PostgreSQL / MySQL]
- **NoSQL/缓存**：[例如：Redis / MongoDB]
- **ORM / Query Builder**：[例如：Prisma / Drizzle / SQLAlchemy / GORM]
- **文件存储**：[例如：AWS S3 / 阿里云 OSS / 本地存储]

## 4. 安全与鉴权

- **认证方式**：[例如：JWT / Session / OAuth2.0 / OIDC]
- **权限控制**：[例如：RBAC (基于角色的访问控制) / ABAC]
- **数据加密**：敏感信息（密码、API Key）必须加密存储，严禁明文。

## 5. 核心约定

1. **环境隔离**：严格区分开发、测试、生产环境，配置信息必须通过环境变量注入（参考 `.env.example`）。
2. **错误处理**：统一异常捕获和错误码响应规范，不要向客户端暴露服务器内部错误堆栈。
3. **日志与监控**：关键业务路径和系统异常必须有清晰的结构化日志记录。

## 相关文件

| 文件 | 关系 |
|------|------|
| `docs/ARCHITECTURE.md` | 后端模块职责和系统边界 |
| `docs/ENVIRONMENT.md` | 后端依赖、环境变量和启动方式 |
| `docs/TESTING.md` | 后端测试和验收方式 |
