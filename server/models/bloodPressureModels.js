import mongoose from 'mongoose';

const bpSchema = new mongoose.Schema({
  user:                 { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  diastolic: {
    inMillimetersOfMercury:  { type: Number, required: true },
},
  systolic: {
    inMillimetersOfMercury:  { type: Number, required: true },
  },
  bodyPosition:         { type: Number, required: true },
  measurementLocation:  { type: Number, required: true },
  lastModifiedTime:     { type: Date, required: true },
  id:                   { type: String, required: true, unique: true },
  time:                 { type: Date, required: true },
}, {
  timestamps: true,
});

const bloodPressure = mongoose.model('Bp', bpSchema)
export default bloodPressure;


// Sample data from Health Connect
// {
//     "diastolic": {
//       "inMillimetersOfMercury": 77
//     },
//     "systolic": {
//       "inMillimetersOfMercury": 123
//     },
//     "bodyPosition": 0,
//     "metadata": {
//       "recordingMethod": 0,
//       "device": {
//         "model": null,
//         "manufacturer": null,
//         "type": 0
//       },
//       "clientRecordVersion": 0,
//       "dataOrigin": "com.google.android.apps.fitness",
//       "clientRecordId": null,
//       "lastModifiedTime": "2025-05-21T10:03:37.916Z",
//       "id": "28ce0948-8cc1-4620-9dfb-2c1dd2d4b46a"
//     },
//     "measurementLocation": 0,
//     "time": "2025-05-21T10:03:00Z"
// }

//   BloodPressureBodyPosition
//    UNKNOWN: 0,
//    STANDING_UP: 1,
//    SITTING_DOWN: 2,
//    LYING_DOWN: 3,
//    RECLINING: 4,

// BloodPressureMeasurementLocation
//   UNKNOWN: 0,
//   LEFT_WRIST: 1,
//   RIGHT_WRIST: 2,
//   LEFT_UPPER_ARM: 3,
//   RIGHT_UPPER_ARM: 4,