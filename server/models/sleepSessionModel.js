import mongoose from 'mongoose';

const sleepStageSchema = new mongoose.Schema({
  startTime:  { type: Date, required: true },
  endTime:    { type: Date, required: true },
  stage:      { type: Number },
}, { _id: false });

const sleepSessionSchema = new mongoose.Schema({
  user:              { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  stages:            { type: [sleepStageSchema], default: [] },
  lastModifiedTime:  { type: Date, required: true },
  id:                { type: String, required: true, unique: true },
  title:             { type: String, default: null },
  startTime:         { type: Date, required: true },
  endTime:           { type: Date, required: true },
}, {
  timestamps: true,
});

const SleepSession = mongoose.model('SleepSession', sleepSessionSchema);
export default SleepSession;


// Sample data from Health Connect
// {
//   "endTime": "2025-05-21T08:43:00Z",
//   "stages": [],
//   "notes": null,
//   "metadata": {
//     "recordingMethod": 3,
//     "device": {
//       "model": null,
//       "manufacturer": null,
//       "type": 0
//     },
//     "clientRecordVersion": 1747842969918,
//     "dataOrigin": "com.google.android.apps.fitness",
//     "clientRecordId": "956c74fc-4c7c-4a92-aadf-acc178a2abf9",
//     "lastModifiedTime": "2025-05-21T15:56:09.936Z",
//     "id": "0cd33688-fe5b-3d36-aa31-2c7c8dc47363"
//   },
//   "title": null,
//   "startTime": "2025-05-21T00:43:00Z"
// }

// SleepStageType
//   UNKNOWN: 0,
//   AWAKE: 1,
//   SLEEPING: 2,
//   OUT_OF_BED: 3,
//   LIGHT: 4,
//   DEEP: 5,
//   REM: 6