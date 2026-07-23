import React, { useState } from "react";
import { ChevronDown, ClipboardList, MoreVertical, PanelRightClose, PanelRightOpen, Plus } from "lucide-react";
import { Button } from "../ui/button";
import { Dialog, DialogClose, DialogContent, DialogTrigger } from "../ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "../ui/dropdown-menu";
import { Field } from "../ui/field";
import { Input } from "../ui/input";
import { Notice } from "../ui/notice";
import { Tooltip } from "../ui/tooltip";
import { ConversationHistoryItem } from "./conversation-history-item";
import { RailDisclosure, GoalTaskItem, ProjectProfileItem } from "./right-rail-components";
import { TaskRailDetail } from "./task-rail";
import { buildRightRailViewModel } from "../../lib/right-rail-view-model";
import { compactGoalTitle } from "../../lib/goal-presentation";

/**
 * Owns RightRail interaction state and rendering. Task, goal, and conversation
 * mutations remain explicit callbacks injected by the Workbench.
 */
export function RightRail({
  collapsed,
  onResizeStart,
  onToggleCollapsed,
  snapshot,
  tasks,
  activeTaskId,
  conversations,
  activeConversationId,
  onSelectConversation,
  onArchiveConversation,
  onDeleteConversation,
  onRestoreConversation,
  onSelectTask,
  onSendGoalToChat,
  onSendGoalToTerminal,
  onSendTaskToChat,
  onSendTaskToTerminal,
  onMarkTaskWaiting,
  onValidateGoal,
  onSignOffGoal,
  onRefineGoal,
  onCreateGoal,
  onSwitchGoal,
  onConfirmGoal,
  validatingGoal,
  signingGoal,
  planLoading,
  terminalRunningId,
  presentation,
}) {
  const { isNoiseTask, taskStatuses } = presentation;
  const [taskFilter, setTaskFilter] = useState("todo");
  const [historyManagementOpen, setHistoryManagementOpen] = useState(false);
  const [confirmGoalOpen, setConfirmGoalOpen] = useState(false);
  const [newGoalOpen, setNewGoalOpen] = useState(false);
  const [newGoalTitle, setNewGoalTitle] = useState("");
  const [newGoalSummary, setNewGoalSummary] = useState("");
  const {
    activeConversationCount, activeGoal, conversationGroups, currentPhaseTodos,
    futurePhaseTodos, goalIsDraft, goalIsPlanned, goalMeta, goalNeedsVerification,
    goalSignedOff, goalSteps, goalTitle, goalVerified, hasActiveWorkGoal, profileItems,
    progressValue, todoMeta, useDialoguePhaseGroups, validationCriteria, visibleGoalTodos,
  } = buildRightRailViewModel({
    activeConversationId, activeTaskId, conversations, isNoiseTask, planLoading, snapshot,
    taskFilter, taskStatuses, tasks, terminalRunningId,
  });
  const taskFilterLabel = {
    all: "全部",
    done: "已完成",
    todo: "待办",
  }[taskFilter];
  const viewingCompletedGoal = false;
  const showGoalDetail = hasActiveWorkGoal;
  const visibleTaskFilterLabel = useDialoguePhaseGroups ? "当前阶段" : viewingCompletedGoal ? "记录" : taskFilterLabel;
  const visibleTaskFilterCount = useDialoguePhaseGroups ? currentPhaseTodos.length : visibleGoalTodos.length;
  const recordedProfileCount = profileItems.filter((item) => !item.missing).length;
  const submitNewGoal = (event) => {
    event.preventDefault();
    const title = newGoalTitle.trim();
    if (!title) return;
    onCreateGoal?.({
      title,
      summary: newGoalSummary.trim(),
    });
    setNewGoalOpen(false);
    setNewGoalTitle("");
    setNewGoalSummary("");
  };

  if (collapsed) {
    return (
      <aside className="right right-collapsed" aria-label="右侧状态栏已折叠">
        <div className="collapsedRail collapsedRail-right">
          <Tooltip content={`目标 ${progressValue}%`}>
            <button className="collapsedRailItem active" type="button" onClick={onToggleCollapsed} aria-label={`目标 ${progressValue}%`}>
              <span className="collapsedProgress">{progressValue}</span>
            </button>
          </Tooltip>
          <Tooltip content={`任务 ${todoMeta}`}>
            <button className="collapsedRailItem" type="button" onClick={onToggleCollapsed} aria-label={`任务 ${todoMeta}`}>
              <ClipboardList strokeWidth={2.15} aria-hidden="true" />
            </button>
          </Tooltip>
          <Tooltip content="展开状态栏">
            <Button className="railToggleButton sideCornerButton" size="icon" variant="ghost" type="button" onClick={onToggleCollapsed} aria-label="展开状态栏">
              <PanelRightOpen strokeWidth={1.75} aria-hidden="true" />
            </Button>
          </Tooltip>
        </div>
      </aside>
    );
  }

  return (
    <aside className="right">
      <div className="rightScroll">
        <RailDisclosure title="目标">
          <div className="goalStack">
            {showGoalDetail ? (
              <div className="goalProgress">
                <div className="goalProgressHeader">
                  <strong>
                    <span>{compactGoalTitle(goalTitle)}</span>
                    <em>{viewingCompletedGoal ? "已完成" : goalMeta}</em>
                  </strong>
                </div>
                <div className="goalProgressBar" aria-hidden="true">
                  <span style={{ width: `${progressValue}%` }} />
                </div>
                <div className="goalSteps">
                  {goalSteps.map((step) => (
                    <span key={step}>{step}</span>
                  ))}
                </div>
                {viewingCompletedGoal ? (
                  <div className="goalVerifyNotice">
                    <span>这是已完成目标的历史记录。</span>
                  </div>
                ) : goalIsDraft ? (
                  <div className="goalVerifyNotice">
                    <span>这个目标还没有确认。确认后，我会先生成任务拆解草案。</span>
                    <div className="goalVerifyActions">
                      <Button size="sm" variant="primary" type="button" onClick={() => activeGoal?.id && onConfirmGoal?.(activeGoal.id)}>
                        确认目标
                      </Button>
                    </div>
                  </div>
                ) : goalIsPlanned ? (
                  <div className="goalVerifyNotice">
                    <span>目标已确认。下一步生成任务拆解草案，确认拆解后进入进行中。</span>
                    <div className="goalVerifyActions">
                      <Button size="sm" variant="primary" type="button">
                        生成拆解
                      </Button>
                    </div>
                  </div>
                ) : goalNeedsVerification ? (
                  <div className="goalVerifyNotice">
                    <span>
                      {goalVerified ? "验证已通过。你可以继续打磨，也可以确认完成。" : "任务已完成，等待验收。"}
                      {validationCriteria.length ? ` 验收标准 ${validationCriteria.length} 项。` : ""}
                    </span>
                    {goalVerified ? (
                      <div className="goalVerifyActions">
                        <Button size="sm" variant="subtle" type="button" onClick={onRefineGoal}>
                          继续打磨
                        </Button>
                        <Dialog open={confirmGoalOpen} onOpenChange={setConfirmGoalOpen}>
                          <DialogTrigger asChild>
                            <Button size="sm" variant="primary" type="button" disabled={signingGoal}>
                              {signingGoal ? "确认中" : "确认完成"}
                            </Button>
                          </DialogTrigger>
                          <DialogContent
                            className="goalConfirmDialog"
                            title="确认这个阶段完成？"
                            description="系统会记录当前验收结果和完成时间，后续工作将从新的目标或下一轮打磨继续。"
                          >
                            <div className="goalConfirmActions">
                              <DialogClose asChild>
                                <Button size="sm" variant="default" type="button">取消</Button>
                              </DialogClose>
                              <Button
                                size="sm"
                                variant="primary"
                                type="button"
                                disabled={signingGoal}
                                onClick={async () => {
                                  await onSignOffGoal?.();
                                  setConfirmGoalOpen(false);
                                }}
                              >
                                {signingGoal ? "确认中" : "确认完成"}
                              </Button>
                            </div>
                          </DialogContent>
                        </Dialog>
                      </div>
                    ) : (
                      <button type="button" onClick={onValidateGoal} disabled={validatingGoal}>
                        {validatingGoal ? "验证中" : "验证目标"}
                      </button>
                    )}
                  </div>
                ) : null}
              </div>
            ) : (
              <div className="goalEmptyState">
                <span>暂无进行中目标，请&nbsp;</span>
                <button className="goalEmptyAction" type="button" onClick={() => setNewGoalOpen(true)}>
                  <Plus strokeWidth={2.2} aria-hidden="true" />
                  添加目标
                </button>
              </div>
            )}
            <Dialog open={newGoalOpen} onOpenChange={setNewGoalOpen}>
              <DialogContent
                className="goalCreateDialog"
                title="开始一个新目标"
                description="新目标会先保存为草案，确认目标和拆解后才进入进行中。"
              >
                <form className="goalCreateForm" onSubmit={submitNewGoal}>
                  <Field label="目标名称">
                    {({ id }) => (
                      <Input
                        id={id}
                        autoFocus
                        value={newGoalTitle}
                        onChange={(event) => setNewGoalTitle(event.target.value)}
                        placeholder="例如：打磨对话体验"
                      />
                    )}
                  </Field>
                  <Field label="说明">
                    {({ id }) => (
                      <Input
                        id={id}
                        value={newGoalSummary}
                        onChange={(event) => setNewGoalSummary(event.target.value)}
                        placeholder="可选：这个阶段想达到什么结果"
                      />
                    )}
                  </Field>
                  <div className="goalConfirmActions">
                    <DialogClose asChild>
                      <Button size="sm" variant="default" type="button">取消</Button>
                    </DialogClose>
                    <Button size="sm" variant="primary" type="submit" disabled={!newGoalTitle.trim()}>
                      创建目标
                    </Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
            {showGoalDetail ? (
              <>
                <div className="goalTaskHeader">
                  {useDialoguePhaseGroups ? <span>当前阶段</span> : <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button className="goalTaskFilter" type="button">
                        <span>任务拆解 · {compactGoalTitle(goalTitle)} · {visibleTaskFilterLabel}</span>
                        <ChevronDown strokeWidth={2} aria-hidden="true" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start" className="goalTaskFilterMenu">
                      <DropdownMenuItem onSelect={() => setTaskFilter("todo")}>待办</DropdownMenuItem>
                      <DropdownMenuItem onSelect={() => setTaskFilter("all")}>全部</DropdownMenuItem>
                      <DropdownMenuItem onSelect={() => setTaskFilter("done")}>已完成</DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>}
                  <span>{useDialoguePhaseGroups ? currentPhaseTodos.length : visibleTaskFilterCount}</span>
                </div>
                {visibleGoalTodos.length ? (
                  <>
                  <ol className="goalTodoList">
                    {(useDialoguePhaseGroups ? currentPhaseTodos : visibleGoalTodos).map((todo, index) => (
                      <GoalTaskItem
                        active={todo.id === activeTaskId}
                        displayStatus={todo.displayStatus}
                        index={index}
                        key={todo.id}
                        status={todo.status}
                        taskStatuses={taskStatuses}
                        subtasks={todo.subtasks}
                        title={todo.title}
                        onSelect={() => onSelectTask(todo.id)}
                        detail={todo.id === activeTaskId ? (
                          <TaskRailDetail
                            task={todo.task || todo}
                            onMarkTaskWaiting={onMarkTaskWaiting}
                            onSendTaskToChat={onSendTaskToChat}
                            onSendTaskToTerminal={onSendTaskToTerminal}
                          />
                        ) : null}
                      />
                    ))}
                  </ol>
                  {useDialoguePhaseGroups && futurePhaseTodos.length ? (
                    <details className="goalFutureTasks">
                      <summary><span>后续任务</span><em>{futurePhaseTodos.length}</em></summary>
                      <ol className="goalTodoList">
                        {futurePhaseTodos.map((todo, index) => (
                          <GoalTaskItem
                            active={todo.id === activeTaskId}
                            index={currentPhaseTodos.length + index}
                            key={todo.id}
                            status={todo.status}
                            taskStatuses={taskStatuses}
                            title={todo.title}
                            onSelect={() => onSelectTask(todo.id)}
                            detail={todo.id === activeTaskId ? (
                              <TaskRailDetail
                                task={todo.task || todo}
                                onMarkTaskWaiting={onMarkTaskWaiting}
                                onSendTaskToChat={onSendTaskToChat}
                                onSendTaskToTerminal={onSendTaskToTerminal}
                              />
                            ) : null}
                          />
                        ))}
                      </ol>
                    </details>
                  ) : null}
                  </>
                ) : (
                  <div className="goalEmpty">{viewingCompletedGoal ? "还没有任务记录。" : taskFilter === "done" ? "还没有完成任务。" : "当前没有待办任务。"}</div>
                )}
              </>
            ) : null}
          </div>
        </RailDisclosure>

        <RailDisclosure
          className="railHistory"
          title="对话"
          meta={
            <span className="railSectionActions">
              <em>{activeConversationCount}</em>
              <Tooltip content="历史管理">
              <Button
                aria-label="对话历史管理"
                className="sectionIconAction"
                size="icon"
                type="button"
                variant="ghost"
                onClick={() => setHistoryManagementOpen(true)}
              >
                <MoreVertical strokeWidth={1.8} aria-hidden="true" />
              </Button>
              </Tooltip>
            </span>
          }
        >
          <div className="queue">
            {conversationGroups.length ? (
              conversationGroups.map((group) => (
                <div className="conversationHistoryGroup" key={group.label}>
                  {conversationGroups.length > 1 ? (
                    <div className="conversationHistoryGroupLabel">{group.label}</div>
                  ) : null}
                  {group.items.map((conversation) => (
                    <ConversationHistoryItem
                      active={conversation.id === activeConversationId}
                      conversation={conversation}
                      key={conversation.id}
                      onArchiveConversation={onArchiveConversation}
                      onDeleteConversation={onDeleteConversation}
                      onRestoreConversation={onRestoreConversation}
                      onSelectConversation={onSelectConversation}
                    />
                  ))}
                </div>
              ))
            ) : (
              <Notice variant="muted">没有匹配的对话。</Notice>
            )}
          </div>
        </RailDisclosure>

        <Dialog open={historyManagementOpen} onOpenChange={setHistoryManagementOpen}>
          <DialogContent title="历史管理" description="这里只显示已归档对话；归档可恢复，永久删除的对话不会保留记录。">
            <div className="conversationHistoryManagement">
              {conversations.filter((conversation) => conversation.archivedAt).map((conversation) => (
                <ConversationHistoryItem
                  active={false}
                  conversation={conversation}
                  key={conversation.id}
                  onArchiveConversation={onArchiveConversation}
                  onDeleteConversation={onDeleteConversation}
                  onRestoreConversation={onRestoreConversation}
                  onSelectConversation={onSelectConversation}
                />
              ))}
              {!conversations.some((conversation) => conversation.archivedAt) ? <Notice variant="info">暂无已归档对话。</Notice> : null}
            </div>
            <div className="taskCreateActions">
              <DialogClose asChild><Button type="button" variant="subtle">关闭</Button></DialogClose>
            </div>
          </DialogContent>
        </Dialog>

        <RailDisclosure className="contextSection" title="项目档案" meta={`${recordedProfileCount}/${profileItems.length}`}>
          <div className="contextPack">
            {profileItems.map((item) => (
              <ProjectProfileItem body={item.body} missing={item.missing} title={item.title} key={item.title} />
            ))}
          </div>
        </RailDisclosure>
      </div>
      <Tooltip content="折叠状态栏">
        <Button className="sideCornerButton sideCornerButton-right" size="icon" variant="ghost" type="button" onClick={onToggleCollapsed} aria-label="折叠状态栏">
          <PanelRightClose strokeWidth={1.75} aria-hidden="true" />
        </Button>
      </Tooltip>
      <div className="sidebarResizer sidebarResizer-right" role="separator" aria-label="拖拽调整右侧宽度" onPointerDown={onResizeStart} />
    </aside>
  );
}

function currentRuntimeSource() {
  return isTauriRuntime() ? "tauri" : "preview";
}
