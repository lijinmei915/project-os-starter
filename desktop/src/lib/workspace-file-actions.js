function errorMessage(error) {
  return error instanceof Error ? error.message : String(error);
}

export function createWorkspaceFileActions({ fileClient, setActiveTaskId, setPlanError, setReadonlyPlan, setSelectedEngineeringFile }) {
  return {
    selectEngineeringFile: async (file) => {
      if (!file) return setSelectedEngineeringFile(null);
      const nextFile = { ...file, error: "", loading: true, preview: null };
      setSelectedEngineeringFile(nextFile);
      setActiveTaskId("");
      setReadonlyPlan(null);
      setPlanError("");
      if (file.virtual && Array.isArray(file.relatedFiles)) {
        setSelectedEngineeringFile({ ...nextFile, loading: false, topic: {
          id: file.id, title: file.title || file.path, description: file.description, governanceRole: file.governanceRole,
          maturity: file.maturity, nextAction: file.nextAction, relatedFiles: file.relatedFiles, statusSource: file.statusSource, updatesWhen: file.updatesWhen,
        } });
        return;
      }
      if (file.virtual) {
        setSelectedEngineeringFile({ ...nextFile, loading: false, preview: {
          content: "这个入口属于 OmniDesk 全局记忆，不属于当前项目文件。\n\n建议后续保存到应用级本地配置：\n- user-profile.json：用户画像\n- global-preferences.json：全局偏好\n\n这样它会跨项目生效，不污染当前项目的 .project-os/。",
          language: "text", name: file.path.replace("OmniDesk global: ", ""), size: 0, truncated: false,
        } });
        return;
      }
      try {
        const preview = await fileClient.readEngineeringFile(file.path);
        setSelectedEngineeringFile({ ...nextFile, loading: false, preview });
      } catch (error) {
        setSelectedEngineeringFile({ ...nextFile, error: errorMessage(error), loading: false });
      }
    },
  };
}
