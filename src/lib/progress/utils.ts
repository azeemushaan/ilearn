export const buildProgressDocId = (studentId: string, assignmentId: string | null, videoId: string) => {
  const normalizedAssignment = assignmentId && assignmentId.length > 0 ? assignmentId : 'na';
  return `${studentId}__${normalizedAssignment}__${videoId}`;
};
