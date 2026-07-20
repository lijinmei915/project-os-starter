export function findProjectByCanonicalPath(projects = [], canonicalPath = "") {
  if (!canonicalPath) return null;
  return projects.find((project) => project?.path === canonicalPath) || null;
}

export function isSameProjectIdentity(left, right) {
  return Boolean(left?.path && right?.path && left.path === right.path);
}
