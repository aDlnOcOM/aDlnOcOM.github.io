/** Чистая проверка версии: вызывается с действительно доступными источниками. */
export function assessReport(data, submission, availableIds) {
  // Закрытые источники и повторы не могут подменить независимую цепь.
  const available = new Set(availableIds);
  const evidenceIds = [...new Set(submission.evidenceIds)].filter((id) => available.has(id));
  const correctSuspect = submission.suspect === data.culpritId;
  const correctMotive = submission.motive === data.motive;
  const correctMethod = submission.method === data.method;
  const includesChain = (ids) => ids.length >= 3 && ids.every((id) => evidenceIds.includes(id));
  const archiveChain = data.strongEvidenceIds.filter((id) => !data.fieldStrongIds.includes(id));
  // Догадка и длинный текст не заменяют источник мотива и проверку особого эпизода.
  const completeChain = includesChain(data.fieldStrongIds) || includesChain(archiveChain);
  const requiredFound = data.requiredEvidenceIds.every((id) => evidenceIds.includes(id));
  const proven = correctSuspect && correctMotive && correctMethod && completeChain && requiredFound
    && evidenceIds.length >= 3 && evidenceIds.length <= 5;
  return { ...submission, evidenceIds, correctSuspect, correctMotive, correctMethod, completeChain, requiredFound, proven };
}
