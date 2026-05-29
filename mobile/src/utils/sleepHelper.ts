import { mapAppleSleepStageToHC } from './healthCompatibility';

export const groupSleepSamplesIntoSessions = (samples: any[]) => {
  // Map night date to its samples
  const nightGroups: { [key: string]: any[] } = {};

  samples.forEach(sample => {
    if (!sample.startDate) return;
    
    const start = new Date(sample.startDate);
    let nightDate = new Date(start);
    // If before 12:00 PM, it belongs to the previous day's night
    if (start.getHours() < 12) {
      nightDate.setDate(nightDate.getDate() - 1);
    }
    const nightKey = nightDate.toISOString().split('T')[0]; // YYYY-MM-DD
    if (!nightGroups[nightKey]) {
      nightGroups[nightKey] = [];
    }
    nightGroups[nightKey].push(sample);
  });

  const sessions = Object.keys(nightGroups).map(nightKey => {
    const group = nightGroups[nightKey];
    
    // Check if we have detailed stage data
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

    return {
      id: `sleep_session_${nightKey}`,
      lastModifiedTime: maxEnd.toISOString(),
      startTime: minStart.toISOString(),
      endTime: maxEnd.toISOString(),
      title: `Sleep Night ${nightKey}`,
      stages
    };
  }).filter(Boolean);

  return sessions;
};
