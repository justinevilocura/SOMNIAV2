import { RecordResult } from "react-native-health-connect";
import AsyncStorage from '@react-native-async-storage/async-storage';

const backendUrl = process.env.EXPO_PUBLIC_API_URL || 'http://10.50.77.201:4000';

const handleResponse = async (response: Response, dataType: string) => {
    if (!response.ok) {
        const text = await response.text();
        let errorData;
        try {
            errorData = JSON.parse(text);
        } catch (e) {
            console.error(`Raw HTML response for ${dataType}:`, text.substring(0, 500));
            throw new Error(`Failed to sync ${dataType} data: Server returned HTML instead of JSON. Status: ${response.status}`);
        }
        throw new Error(`Failed to sync ${dataType} data: ${errorData.message || response.statusText}`);
    }
    const text = await response.text();
    try {
        return JSON.parse(text);
    } catch (e) {
        console.error(`Raw HTML success response for ${dataType}:`, text.substring(0, 500));
        throw new Error(`Failed to parse success response for ${dataType}. Status: ${response.status}`);
    }
};

const getAuthToken = async () => {
    try {
        const token = await AsyncStorage.getItem('token');
        if (!token) {
            throw new Error('No authentication token found');
        }
        return token;
    } catch (error) {
        console.error('Error getting auth token:', error);
        throw error;
    }
};


export const syncToDB = async (
    heartRate: RecordResult<"HeartRate">[],
    sleepSession: RecordResult<"SleepSession">[],
    steps: RecordResult<"Steps">[],
    exerciseSession: RecordResult<"ExerciseSession">[],
    userID: string
) => {
    try {
        const token = await getAuthToken();
        const headers = {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${token}`
        };

        // Heart Rate
        const heartRatePayload = heartRate.map((record) => ({
            userId: userID,
            id: record.metadata.id,
            lastModifiedTime: record.metadata.lastModifiedTime,
            startTime: record.startTime,
            endTime: record.endTime,
            samples: record.samples.map((s) => ({
                beatsPerMinute: s.beatsPerMinute,
                time: s.time,
            })),
        }));

        const heartRateResponse = await fetch(`${backendUrl}/api/heartRate/addHeartRate`, {
            method: "POST",
            headers,
            body: JSON.stringify(heartRatePayload),
        });
        await handleResponse(heartRateResponse, "heart rate");

        // Sleep Session
        const sleepPayload = sleepSession.map((record) => ({
            userId: userID,
            id: record.metadata.id,
            lastModifiedTime: record.metadata.lastModifiedTime,
            startTime: record.startTime,
            endTime: record.endTime,
            title: record.title || null,
            stages: (record.stages || []).map((stage) => ({
                startTime: stage.startTime,
                endTime: stage.endTime,
                stage: stage.stage,
            })),
        }));

        const sleepResponse = await fetch(`${backendUrl}/api/sleepSession/addSleepSession`, {
            method: "POST",
            headers,
            body: JSON.stringify(sleepPayload),
        });
        await handleResponse(sleepResponse, "sleep session");

        // Steps
        const stepsPayload = steps.map((record) => ({
            userId: userID,
            id: record.metadata.id,
            lastModifiedTime: record.metadata.lastModifiedTime,
            startTime: record.startTime,
            endTime: record.endTime,
            count: record.count,
        }));

        const stepsResponse = await fetch(`${backendUrl}/api/step/addStep`, {
            method: "POST",
            headers,
            body: JSON.stringify(stepsPayload),
        });
        await handleResponse(stepsResponse, "steps");

        // Exercise Session
        if (exerciseSession && exerciseSession.length > 0) {
            const exercisePayload = exerciseSession.map((record) => ({
                userId: userID,
                id: record.metadata.id,
                lastModifiedTime: record.metadata.lastModifiedTime,
                startTime: record.startTime,
                endTime: record.endTime,
                title: record.title || null,
                exerciseType: record.exerciseType || 0,
            }));

            const exerciseResponse = await fetch(`${backendUrl}/api/exercise/bulkAddExercise`, {
                method: "POST",
                headers,
                body: JSON.stringify({ exerciseRecords: exercisePayload }),
            });
            await handleResponse(exerciseResponse, "exercise session");
        }

        console.log("Health data synced successfully.");
    } catch (error) {
        console.error("Error syncing data:", error);
        throw error;
    }
};
