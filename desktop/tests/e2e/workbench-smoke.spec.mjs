import { expect, test } from "@playwright/test";

test("conversation and terminal surfaces preserve their runtime boundary", async ({ page }) => {
  await page.goto("/");
  const composer = page.getByRole("textbox", { name: "任务输入" });
  await expect(composer).toBeVisible();
  await composer.fill("检查当前项目还有哪些风险");
  await expect(page.getByRole("button", { name: "发送" })).toBeEnabled();
  await composer.fill("");
  await expect(page.getByRole("button", { name: "发送" })).toBeDisabled();
  await composer.fill("当前使用什么模型");
  await page.getByRole("button", { name: "发送" }).click();
  await expect(page.getByRole("log")).toContainText("当前使用什么模型");
  await expect(page.getByRole("log")).toContainText(/当前使用的模型|当前没有启用模型连接/);
  await page.getByRole("tab", { name: "终端" }).click();
  await expect(page.getByText("浏览器预览不启动本地终端")).toBeVisible();
  await expect(page.getByText("浏览器预览不能启动本地终端。请在桌面 App 窗口里使用完整终端。")).toBeVisible();
  await page.getByRole("tab", { name: "对话" }).click();
  await expect(composer).toBeVisible();
  await page.getByRole("button", { name: "对话历史管理" }).click();
  await expect(page.getByRole("dialog", { name: "历史管理" })).toContainText("归档可恢复，永久删除的对话不会保留记录");
  await page.getByRole("button", { name: "关闭" }).click();
});

test("browser preview stops controlled task execution with an explicit desktop boundary", async ({ page }) => {
  await page.goto("/");
  const composer = page.getByRole("textbox", { name: "任务输入" });
  await composer.fill("整理当前任务并生成计划");
  await page.getByRole("button", { name: "发送" }).click();
  await expect(page.getByRole("log")).toContainText("这次计划没有生成成功，已停止后续操作。");
  await expect(page.getByText("生成计划失败：浏览器预览不能执行此操作，请在桌面 App 窗口里使用。")).toBeVisible();
});

test("project file tree hides local runtime and generated assets by default", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "切换到项目文件" }).click();
  await expect(page.getByRole("region", { name: "项目文件" })).toBeVisible();
  await expect(page.getByText(".project-os", { exact: true })).toHaveCount(0);
  await expect(page.getByText("tmp", { exact: true })).toHaveCount(0);
  await expect(page.getByText(".env.local", { exact: true })).toHaveCount(0);
});
