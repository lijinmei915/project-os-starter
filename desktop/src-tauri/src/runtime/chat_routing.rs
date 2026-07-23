/// Pure message classification shared by the local fallback and the model
/// request boundary. It deliberately has no Runtime, filesystem, or Provider
/// dependency so routing decisions stay deterministic and testable.
pub fn is_greeting_message(message: &str) -> bool {
    let normalized = message
        .trim()
        .trim_matches(|ch: char| {
            ch.is_ascii_punctuation() || ch.is_whitespace() || "。！？!，,".contains(ch)
        })
        .to_lowercase();
    matches!(
        normalized.as_str(),
        "hi" | "hello" | "hey" | "你好" | "您好" | "哈喽" | "嗨" | "在吗" | "在么"
    )
}

pub fn should_create_plan_for_message(message: &str, has_attachments: bool) -> bool {
    if is_task_like_message(message) {
        return true;
    }
    if is_question_like_message(message) {
        return false;
    }
    has_attachments
}

pub fn is_question_like_message(message: &str) -> bool {
    let text = message.trim().to_lowercase();
    [
        "为什么",
        "怎么",
        "哪些",
        "还有哪些",
        "是什么",
        "吗",
        "呢",
        "咋回事",
        "看一下",
        "看看",
        "风险",
        "问题在哪",
        "自然吗",
        "正常吗",
        "why",
        "how",
        "what",
        "which",
        "risk",
        "risks",
    ]
    .iter()
    .any(|keyword| text.contains(keyword))
}

pub fn is_task_like_message(message: &str) -> bool {
    let text = message.trim().to_lowercase();
    [
        "帮我改",
        "帮我修",
        "帮我优化",
        "帮我生成",
        "帮我创建",
        "帮我新增",
        "帮我删除",
        "帮我执行",
        "帮我跑",
        "开始执行",
        "生成计划",
        "创建任务",
        "改代码",
        "修复",
        "实现",
        "接入",
        "配置",
        "做成",
        "设计",
        "重构",
        "提交",
        "推送",
        "帮我处理",
        "处理一下",
        "解决一下",
        "看看解决",
        "看下解决",
        "整理一下",
        "梳理一下",
        "制定方案",
        "出个方案",
        "给个方案",
        "整理待办",
        "处理方案",
        "commit",
        "push",
        "build",
        "apply patch",
    ]
    .iter()
    .any(|keyword| text.contains(keyword))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn task_intent_overrides_question_words() {
        assert!(should_create_plan_for_message(
            "帮我处理一下这个风险",
            false
        ));
        assert!(!should_create_plan_for_message("这个风险是什么", false));
    }

    #[test]
    fn attachments_are_only_a_fallback_when_text_is_not_a_question() {
        assert!(should_create_plan_for_message("这是截图", true));
        assert!(!should_create_plan_for_message("看看这个截图是什么", true));
    }

    #[test]
    fn recognizes_common_greetings() {
        assert!(is_greeting_message("你好！"));
        assert!(!is_greeting_message("你好，帮我修复这个问题"));
    }
}
