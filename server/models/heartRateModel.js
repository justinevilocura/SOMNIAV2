import mongoose from 'mongoose';

const heartRateSampleSchema = new mongoose.Schema({
  beatsPerMinute:  { type: Number, required: true },
  time:            { type: Date, required: true },
}, { _id: false });

const heartRateSchema = new mongoose.Schema({
  user:              { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  lastModifiedTime:  { type: Date, required: true },
  id:                { type: String, required: true, unique: true },
  samples:           { type: [heartRateSampleSchema], required: true },
  startTime:         { type: Date, required: true },
  endTime:           { type: Date, required: true },
}, {
  timestamps: true,
});

const HeartRate = mongoose.model('HeartRate', heartRateSchema);
export default HeartRate;



// Sample data from Health Connect
// {
//   "metadata": {
//     "recordingMethod": 0,
//     "device": {
//       "model": null,
//       "manufacturer": null,
//       "type": 0
//     },
//     "clientRecordVersion": 0,
//     "dataOrigin": "com.google.android.apps.fitness",
//     "clientRecordId": null,
//     "lastModifiedTime": "2025-05-21T08:43:25.189Z",
//     "id": "60b69b12-72e9-44b6-888d-e9abce7855d7"
//   },
//   "samples": [
//     {
//       "beatsPerMinute": 79,
//       "time": "2025-05-21T08:43:00Z"
//     }
//   ],
//   "endTime": "2025-05-21T08:43:00.001Z",
//   "startTime": "2025-05-21T08:43:00Z"
// }