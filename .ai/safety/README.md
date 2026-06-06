---
layer: governance
type: spec
last_verified: 2026-06-05
depends_on: [.claude/hooks/check-protected-write.sh]
teaches: "AI 文件操作的可写/只读/禁区三类边界契约及其演进路径"
use_when: "AI 要写文件前确认是否越界、或 P3 落地正式安全拦截与回滚时"
---

# AI 安全契约(种子)

> 用途:声明 AI 在本项目里能写哪些文件、哪些只读、哪些是禁区。
> 什么时候更新:边界规则变化、或 P3·#7 把执行层接入本声明时。
> 不要写什么:具体业务密钥、临时调试白名单。

## 这是什么

本目录是**北极星四级台阶 P3「操作工程」的安全底座的种子**。

- 现在(P1·#3):只确立**契约的数据结构和位置**,不改执行逻辑。
- 未来(P3·#7):`check-protected-write.sh` 改为**读** `write-policy.json`,并补齐回滚机制;接真实工具(#8)时填充生产资源禁区。

## 为什么现在就埋

P3 是从「只读治理」到「可写操作」的生死线。等到接代码仓/DB 时才搭安全,风险跑在能力前面。提前把边界声明的结构定下来,#7 在已有结构上扩展即可,不必从零搭。

## 三类边界

| 类别 | 含义 | 当前状态 |
|------|------|---------|
| `protected` | 写入需用户确认 | check-protected-write.sh 硬编码实现中 |
| `readonly` | 生成物/契约源,建议只读 | 声明占位,#7 接入软拦截 |
| `forbidden` | 禁区,任何情况不得写 | 声明占位,#8 填生产资源清单 |

详见 [`write-policy.json`](./write-policy.json)。

## 相关文件

| 文件 | 关系 |
|------|------|
| `write-policy.json` | 边界声明 SSOT |
| `.claude/hooks/check-protected-write.sh` | 当前执行层(硬编码),#7 改读本声明 |
| `docs/PRODUCT_PLAN.md` | 北极星四级台阶,#3/#7/#8 上下文 |
