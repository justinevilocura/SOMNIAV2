import { mapAppleSleepStageToHC } from './healthCompatibility';

const calculateAsleepDuration = (group: any[]): number => {
  const asleepSamples = group.filter(s => ['CORE', 'DEEP', 'REM', 'ASLEEP'].includes(s.value));
  if (asleepSamples.length === 0) return 0;

  const intervals = asleepSamples.map(s => ({
    start: new Date(s.startDate).getTime(),
    end: new Date(s.endDate).getTime()
  })).sort((a, b) => a.start - b.start);

  const merged: { start: number; end: number }[] = [];
  let current = intervals[0];

  for (let i = 1; i < intervals.length; i++) {
    const next = intervals[i];
    if (next.start <= current.end) {
      current.end = Math.max(current.end, next.end);
    } else {
      merged.push(current);
      current = next;
    }
  }
  merged.push(current);

  let totalMs = 0;
  merged.forEach(interval => {
    totalMs += (interval.end - interval.start);
  });

  return totalMs;
};

export const groupSleepSamplesIntoSessions = (samples: any[]) => {
  if (!samples || samples.length === 0) return [];

  // Sort samples chronologically by start date
  const sortedSamples = [...samples].sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime());

  const sessionGroups: any[][] = [];
  let currentSessionSamples: any[] = [];

  const GAP_THRESHOLD_MS = 3 * 60 * 60 * 1000; // 3 hours gap threshold to start a new session

  sortedSamples.forEach(sample => {
    if (!sample.startDate || !sample.endDate) return;

    if (currentSessionSamples.length === 0) {
      currentSessionSamples.push(sample);
    } else {
      const prevSample = currentSessionSamples[currentSessionSamples.length - 1];
      const prevEnd = new Date(prevSample.endDate).getTime();
      const currStart = new Date(sample.startDate).getTime();

      if (currStart - prevEnd > GAP_THRESHOLD_MS) {
        // Gap is too large, push current session and start a new one
        sessionGroups.push(currentSessionSamples);
        currentSessionSamples = [sample];
      } else {
        currentSessionSamples.push(sample);
      }
    }
  });

  if (currentSessionSamples.length > 0) {
    sessionGroups.push(currentSessionSamples);
  }

  // Map each session group to the expected SleepSession format
  const sessions = sessionGroups.map((group, index) => {
    // Check if we have detailed stage data in this group
    const hasDetailedStages = group.some(s => ['CORE', 'DEEP', 'REM', 'AWAKE'].includes(s.value));

    // Filter samples based on detail availability
    const filteredSamples = group.filter(s => {
      if (hasDetailedStages) {
        // If detailed stages are present, exclude INBED and ASLEEP
        return ['CORE', 'DEEP', 'REM', 'AWAKE'].includes(s.value);
      } else {
        // Fallback to ASLEEP or INBED
        return ['ASLEEP', 'INBED'].includes(s.value);
      }
    });

    if (filteredSamples.length === 0) return null;

    // Find min startTime and max endTime
    let minStart = new Date(filteredSamples[0].startDate);
    let maxEnd = new Date(filteredSamples[0].endDate);

    filteredSamples.forEach(s => {
      const sStart = new Date(s.startDate);
      const sEnd = new Date(s.endDate);
      if (sStart < minStart) minStart = sStart;
      if (sEnd > maxEnd) maxEnd = sEnd;
    });

    const stages = filteredSamples.map(s => ({
      startTime: s.startDate,
      endTime: s.endDate,
      stage: mapAppleSleepStageToHC(s.value)
    }));

    // Generate a unique ID using the date of the session
    const sessionDateStr = minStart.toISOString().split('T')[0];

    return {
      id: `sleep_session_${sessionDateStr}_${index}`,
      lastModifiedTime: maxEnd.toISOString(),
      startTime: minStart.toISOString(),
      endTime: maxEnd.toISOString(),
      title: `Sleep Session ${sessionDateStr}`,
      stages,
      asleepMs: calculateAsleepDuration(group)
    };
  }).filter(Boolean);

  return sessions;
};
