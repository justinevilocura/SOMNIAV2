import bloodPressure from '../models/bloodPressureModels.js';

export const addBloodPressureData = async (req, res) => {
    const { diastolic, systolic, bodyPosition, measurementLocation, lastModifiedTime, id, time } = req.body;
    const userId = req.body.userId;

    if (!diastolic || !systolic || bodyPosition === undefined || measurementLocation === undefined || !lastModifiedTime || !id || !time) {
        return res.status(400).json({ success: false, message: 'Missing required details' });
    }

    if (!diastolic.inMillimetersOfMercury || !systolic.inMillimetersOfMercury) {
        return res.status(400).json({ success: false, message: 'Blood pressure readings must include inMillimetersOfMercury values' });
    }

    try {
        const existingBp = await bloodPressure.findOne({ id });

        if (existingBp) {
            return res.status(400).json({ success: false, message: "Blood pressure data with this ID already exists" });
        }

        const bpData = new bloodPressure({
            user: userId,
            diastolic: {
                inMillimetersOfMercury: diastolic.inMillimetersOfMercury
            },
            systolic: {
                inMillimetersOfMercury: systolic.inMillimetersOfMercury
            },
            bodyPosition,
            measurementLocation,
            lastModifiedTime: new Date(lastModifiedTime),
            id,
            time: new Date(time)
        });

        await bpData.save();

        return res.status(201).json({ success: true, message: "Blood pressure data added successfully" });

    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};


// route: /api/bp/get/:userId
export const getLatestBloodPressure = async (req, res) => {
    const userId = req.params.userId;

    try {
        const latestBp = await bloodPressure.findOne({ user: userId }).sort({ time: -1 });

        if (!latestBp) {
            return res.status(404).json({ success: false, message: 'No blood pressure data found' });
        }

        return res.status(200).json({ success: true, data: latestBp });

    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};


export const updateBloodPressureData = async (req, res) => {
  const id = req.params.id;
  const updateData = req.body;

  try {
    const updatedBp = await bloodPressure.findByIdAndUpdate(id, updateData, { new: true });

    if (!updatedBp) {
      return res.status(404).json({ success: false, message: 'Blood pressure record not found' });
    }

    return res.status(200).json({ success: true, data: updatedBp });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};


export const deleteBloodPressureData = async (req, res) => {
    const { id } = req.params;      
    const userId = req.body.userId;      

    if (!id) {
        return res.status(400).json({ success: false, message: 'Blood pressure ID is required' });
    }

    try {
        const bpData = await bloodPressure.findOne({ _id: id, user: userId });
        if (!bpData) {
            return res.status(404).json({ success: false, message: "Blood pressure data not found or unauthorized" });
        }
        await bloodPressure.deleteOne({ _id: id, user: userId });

        return res.status(200).json({ success: true, message: "Blood pressure data deleted successfully" });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};

