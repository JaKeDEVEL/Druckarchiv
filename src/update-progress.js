export function createUpdateProgress() {
  return { downloaded: 0, total: null, finished: false };
}

export function reduceUpdateProgress(progress, event) {
  const next = { ...progress };
  if (event?.event === "Started") {
    next.downloaded = 0;
    next.total = Number.isFinite(event.data?.contentLength) ? event.data.contentLength : null;
    next.finished = false;
  } else if (event?.event === "Progress") {
    next.downloaded += Math.max(0, Number(event.data?.chunkLength) || 0);
  } else if (event?.event === "Finished") {
    next.finished = true;
    if (next.total !== null) next.downloaded = next.total;
  }
  return next;
}

export function updateProgressPercent(progress) {
  if (progress.finished) return 100;
  if (!progress.total || progress.total <= 0) return null;
  return Math.min(99, Math.max(0, Math.round((progress.downloaded / progress.total) * 100)));
}
