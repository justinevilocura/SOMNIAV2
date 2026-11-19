import ExerciseSession from '../models/exerciseModel.js';
import { cleanExerciseBatch } from '../services/dataCleaningService.js';

export const addExerciseSession = async (req, res) => {
    const raw = req.body;
    const userId = req.user?.id || req.body?.userId;

    if (!raw.id || !raw.startTime || !raw.endTime || !userId) {
        return res.status(400).json({ success: false, message: 'Missing required details' });
    }

    try {
        const { cleanedExercises, isValid, audit } = cleanExerciseBatch([{ ...raw, userId }]);

        if (!isValid || cleanedExercises.length === 0) {
            return res.status(422).json({
                success: false,
                message: 'Exercise session rejected: Artifact or physiological boundary violation.',
                audit
            });
        }

        const cleaned = cleanedExercises[0];

        await ExerciseSession.findOneAndUpdate(
            { id: cleaned.id },
            {
                user: userId,
                exerciseType: cleaned.exerciseType,
                lastModifiedTime: new Date(cleaned.lastModifiedTime),
                id: cleaned.id,
                title: cleaned.title,
                startTime: new Date(cleaned.startTime),
                endTime: new Date(cleaned.endTime)
            },
            { upsert: true, new: true, setDefaultsOnInsert: true }
        );

        return res.status(201).json({
            success: true,
            message: "Exercise session cleaned and added successfully",
            exercise: cleaned
        });

    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};

export const bulkAddExerciseSessions = async (req, res) => {
    const { exerciseRecords } = req.body;
    const userId = req.user?.id || req.body?.userId;

    if (!exerciseRecords || !Array.isArray(exerciseRecords) || exerciseRecords.length === 0) {
        return res.status(400).json({ success: false, message: 'Exercise records array is required' });
    }

    try {
        const recordsWithUser = exerciseRecords.map(r => ({ ...r, userId: r.userId || userId }));
        const { cleanedExercises, passRate, isValid, audit } = cleanExerciseBatch(recordsWithUser);

        if (!isValid && exerciseRecords.length >= 5) {
            console.warn(`[DataCleaning] Exercise batch rejected. Pass rate: ${passRate}%. Dropped:`, audit.reasons);
            return res.status(422).json({
                success: false,
                message: `Biometric validation failed: Anomaly noise exceeds 10% tolerance (Pass rate: ${passRate}%).`,
                audit
            });
        }

        let insertedCount = 0;

        for (const record of cleanedExercises) {
            const { exerciseType, lastModifiedTime, id, title, startTime, endTime, userId: targetUserId } = record;

            await ExerciseSession.findOneAndUpdate(
                { id },
                {
                    user: targetUserId,
                    exerciseType,
                    lastModifiedTime: new Date(lastModifiedTime),
                    id,
                    title: title || null,
                    startTime: new Date(startTime),
                    endTime: new Date(endTime)
                },
                { upsert: true, new: true, setDefaultsOnInsert: true }
            );

            insertedCount++;
        }

        return res.status(200).json({
            success: true,
            message: 'Exercise records cleaned and synced successfully',
            dataCleaningSummary: {
                totalReceived: audit.totalReceived,
                cleanWorkoutsSaved: insertedCount,
                passRate: `${passRate}%`,
                droppedCount: audit.droppedCount
            }
        });

    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};

export const getExerciseSessions = async (req, res) => {
    const userId = req.user.id;
    const { startDate, endDate, exerciseType, limit = 100, page = 1 } = req.query;

    try {
        let query = { user: userId };

        if (startDate || endDate) {
            query.startTime = {};
            if (startDate) {
                query.startTime.$gte = new Date(startDate);
            }
            if (endDate) {
                query.startTime.$lte = new Date(endDate);
            }
        }

        if (exerciseType !== undefined) {
            query.exerciseType = parseInt(exerciseType);
        }

        const skip = (page - 1) * parseInt(limit);

        const exerciseData = await ExerciseSession.find(query)
            .sort({ startTime: -1 })
            .limit(parseInt(limit))
            .skip(skip);

        const totalCount = await ExerciseSession.countDocuments(query);

        return res.status(200).json({
            success: true,
            data: exerciseData,
            pagination: {
                currentPage: parseInt(page),
                totalPages: Math.ceil(totalCount / parseInt(limit)),
                totalRecords: totalCount,
                hasNext: skip + exerciseData.length < totalCount,
                hasPrev: page > 1
            }
        });

    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};

export const getExerciseSessionById = async (req, res) => {
    const { id } = req.params;
    const userId = req.user.id;

    if (!id) {
        return res.status(400).json({ success: false, message: 'Exercise session ID is required' });
    }

    try {
        const exerciseData = await ExerciseSession.findOne({ id, user: userId });

        if (!exerciseData) {
            return res.status(404).json({ success: false, message: "Exercise session not found" });
        }

        return res.status(200).json({ success: true, data: exerciseData });

    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};

export const updateExerciseSession = async (req, res) => {
    const { id } = req.params;
    const { exerciseType, lastModifiedTime, title, startTime, endTime } = req.body;
    const userId = req.user.id;

    if (!id) {
        return res.status(400).json({ success: false, message: 'Exercise session ID is required' });
    }

    try {
        const exerciseData = await ExerciseSession.findOne({ id, user: userId });

        if (!exerciseData) {
            return res.status(404).json({ success: false, message: "Exercise session not found" });
        }

        if (exerciseType !== undefined) {
            exerciseData.exerciseType = exerciseType;
        }

        if (lastModifiedTime) {
            exerciseData.lastModifiedTime = new Date(lastModifiedTime);
        }

        if (title !== undefined) {
            exerciseData.title = title;
        }

        if (startTime) {
            exerciseData.startTime = new Date(startTime);
        }

        if (endTime) {
            exerciseData.endTime = new Date(endTime);
        }

        await exerciseData.save();

        return res.status(200).json({ success: true, message: "Exercise session updated successfully" });

    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};

export const deleteExerciseSession = async (req, res) => {
    const { id } = req.params;
    const userId = req.user.id;

    if (!id) {
        return res.status(400).json({ success: false, message: 'Exercise session ID is required' });
    }

    try {
        const exerciseData = await ExerciseSession.findOne({ id, user: userId });

        if (!exerciseData) {
            return res.status(404).json({ success: false, message: "Exercise session not found" });
        }

        await ExerciseSession.deleteOne({ id, user: userId });

        return res.status(200).json({ success: true, message: "Exercise session deleted successfully" });

    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};

export const getExerciseStats = async (req, res) => {
    const userId = req.user.id;
    const { startDate, endDate } = req.query;

    try {
        let matchQuery = { user: userId };

        if (startDate || endDate) {
            matchQuery.startTime = {};
            if (startDate) {
                matchQuery.startTime.$gte = new Date(startDate);
            }
            if (endDate) {
                matchQuery.startTime.$lte = new Date(endDate);
            }
        }

        const stats = await ExerciseSession.aggregate([
            { $match: matchQuery },
            {
                $addFields: {
                    duration: { $subtract: ["$endTime", "$startTime"] }
                }
            },
            {
                $group: {
                    _id: null,
                    totalSessions: { $sum: 1 },
                    totalDuration: { $sum: "$duration" },
                    avgDuration: { $avg: "$duration" },
                    exerciseTypes: { $addToSet: "$exerciseType" }
                }
            }
        ]);

        const exerciseTypeStats = await ExerciseSession.aggregate([
            { $match: matchQuery },
            {
                $group: {
                    _id: "$exerciseType",
                    count: { $sum: 1 },
                    totalDuration: { $sum: { $subtract: ["$endTime", "$startTime"] } }
                }
            },
            { $sort: { count: -1 } }
        ]);

        if (stats.length === 0) {
            return res.status(200).json({
                success: true,
                data: {
                    totalSessions: 0,
                    totalDurationMs: 0,
                    avgDurationMs: 0,
                    uniqueExerciseTypes: 0,
                    exerciseTypeBreakdown: []
                }
            });
        }

        return res.status(200).json({
            success: true,
            data: {
                totalSessions: stats[0].totalSessions,
                totalDurationMs: stats[0].totalDuration,
                avgDurationMs: Math.round(stats[0].avgDuration),
                uniqueExerciseTypes: stats[0].exerciseTypes.length,
                exerciseTypeBreakdown: exerciseTypeStats
            }
        });

    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};