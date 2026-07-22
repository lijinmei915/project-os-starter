const accessModes = {
  browse: {
    description: "只读取、扫描并生成建议。",
    label: "仅浏览",
  },
  controlled: {
    description: "每次确认后修改工程文件并运行验证。",
    label: "允许受控修改",
  },
  governed: {
    description: "可写入项目治理记录，不修改工程文件。",
    label: "接入治理",
  },
};

export const projectAccessChoices = ["browse", "governed", "controlled"].map((mode) => ({
  mode,
  ...accessModes[mode],
}));

export function projectAccessPresentation(mode) {
  return accessModes[mode] || accessModes.browse;
}
