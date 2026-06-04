---
layer: knowledge
type: guide
last_verified: 2026-06-04
---

# 运行手册

> 用途：记录常见操作、发布流程和故障处理步骤。
> 什么时候更新：操作命令、发布步骤、恢复方式或常见故障变化时。
> 不要写什么：长期路线图、详细变更历史、一次性操作。

---

## 本地自检

```bash
# 按项目实际命令填写，示例：
npm test
npm run lint
```

## 发布流程

1. 运行本地自检
2. 查看 `git diff --stat`
3. 更新 `HANDOFF.md` 当前状态
4. 如有结构性改动，更新 `docs/CHANGELOG.md`

## 恢复方式

<!-- 描述误操作后如何回退，示例：git revert / 备份恢复 / 数据库回滚 -->

## 常见故障

### 示例：启动失败

```txt
症状：npm run dev 报端口被占用
原因：上一个进程没退干净
处理：lsof -i :3000 | kill 对应 PID
```

<!-- 按项目实际场景补充 -->

## 相关文件

| 文件 | 关系 |
|------|------|
| `docs/ENVIRONMENT.md` | 环境配置和依赖 |
| `docs/TESTING.md` | 测试和验收命令 |
| `HANDOFF.md` | 发布后更新交接状态 |
| `docs/CHANGELOG.md` | 结构性改动记录 |
