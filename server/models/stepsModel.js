import mongoose from 'mongoose';

const stepSchema = new mongoose.Schema({
  user:              { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  id:                { type: String, required: true, unique: true },
  lastModifiedTime:  { type: Date, required: true },
  count:             { type: Number, required: true, min: 0 },
  startTime:         { type: Date, required: true },
  endTime:           { type: Date, required: true },
}, {
  timestamps: true,
});

const Step = mongoose.model('Step', stepSchema);
export default Step;



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
//     "lastModifiedTime": "2025-05-21T11:01:37.888Z",
//     "id": "57da0c4f-4d0b-42a0-ac4f-7e61b6edbdeb"
//   },
//   "count": 2,
//   "endTime": "2025-05-21T10:57:11.042Z",
//   "startTime": "2025-05-21T10:56:11.041Z"
// }