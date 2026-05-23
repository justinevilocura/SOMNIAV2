import mongoose from 'mongoose';

const exerciseSessionSchema = new mongoose.Schema({
  user:              { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  exerciseType:      { type: Number, required: true },
  lastModifiedTime:  { type: Date, required: true },
  id:                { type: String, required: true, unique: true },
  title:             { type: String },
  startTime:         { type: Date, required: true },
  endTime:           { type: Date, required: true },
}, {
  timestamps: true,
});

const ExerciseSession = mongoose.model('ExerciseSession', exerciseSessionSchema);
export default ExerciseSession;


// Sample data from Health Connect
// {
//   "exerciseRoute": {
//     "route": [],
//     "type": "NO_DATA"
//   },
//   "exerciseType": 79,
//   "metadata": {
//     "recordingMethod": 1,
//     "device": {
//       "model": null,
//       "manufacturer": null,
//       "type": 0
//     },
//     "clientRecordVersion": 1747820816775,
//     "dataOrigin": "com.google.android.apps.fitness",
//     "clientRecordId": "f3f56eebfee276da:activemode:walking:1747817185831",
//     "lastModifiedTime": "2025-05-21T09:46:56.798Z",
//     "id": "659e9da3-9719-3274-a70c-12ec440fcaff"
//   },
//   "title": "Afternoon walk",
//   "segments": [],
//   "notes": null,
//   "endTime": "2025-05-21T08:46:42.205Z",
//   "endZoneOffset": {
//     "totalSeconds": 28800,
//     "id": "+08:00"
//   },
//   "laps": [],
//   "startZoneOffset": {
//     "totalSeconds": 28800,
//     "id": "+08:00"
//   },
//   "startTime": "2025-05-21T08:46:25.850Z"
// }

// ExerciseType
//   OTHER_WORKOUT: 0,
//   BACK_EXTENSION: 1,
//   BADMINTON: 2,
//   BARBELL_SHOULDER_PRESS: 3,
//   BASEBALL: 4,
//   BASKETBALL: 5,
//   BENCH_PRESS: 6,
//   BENCH_SIT_UP: 7,
//   BIKING: 8,
//   BIKING_STATIONARY: 9,
//   BOOT_CAMP: 10,
//   BOXING: 11,
//   BURPEE: 12,
//   CALISTHENICS: 13,
//   CRICKET: 14,
//   CRUNCH: 15,
//   DANCING: 16,
//   DEADLIFT: 17,
//   DUMBBELL_CURL_LEFT_ARM: 18,
//   DUMBBELL_CURL_RIGHT_ARM: 19,
//   DUMBBELL_FRONT_RAISE: 20,
//   DUMBBELL_LATERAL_RAISE: 21,
//   DUMBBELL_TRICEPS_EXTENSION_LEFT_ARM: 22,
//   DUMBBELL_TRICEPS_EXTENSION_RIGHT_ARM: 23,
//   DUMBBELL_TRICEPS_EXTENSION_TWO_ARM: 24,
//   ELLIPTICAL: 25,
//   EXERCISE_CLASS: 26,
//   FENCING: 27,
//   FOOTBALL_AMERICAN: 28,
//   FOOTBALL_AUSTRALIAN: 29,
//   FORWARD_TWIST: 30,
//   FRISBEE_DISC: 31,
//   GOLF: 32,
//   GUIDED_BREATHING: 33,
//   GYMNASTICS: 34,
//   HANDBALL: 35,
//   HIGH_INTENSITY_INTERVAL_TRAINING: 36,
//   HIKING: 37,
//   ICE_HOCKEY: 38,
//   ICE_SKATING: 39,
//   JUMPING_JACK: 40,
//   JUMP_ROPE: 41,
//   LAT_PULL_DOWN: 42,
//   LUNGE: 43,
//   MARTIAL_ARTS: 44,
//   PADDLING: 46,
//   PARAGLIDING: 47,
//   PILATES: 48,
//   PLANK: 49,
//   RACQUETBALL: 50,
//   ROCK_CLIMBING: 51,
//   ROLLER_HOCKEY: 52,
//   ROWING: 53,
//   ROWING_MACHINE: 54,
//   RUGBY: 55,
//   RUNNING: 56,
//   RUNNING_TREADMILL: 57,
//   SAILING: 58,
//   SCUBA_DIVING: 59,
//   SKATING: 60,
//   SKIING: 61,
//   SNOWBOARDING: 62,
//   SNOWSHOEING: 63,
//   SOCCER: 64,
//   SOFTBALL: 65,
//   SQUASH: 66,
//   SQUAT: 67,
//   STAIR_CLIMBING: 68,
//   STAIR_CLIMBING_MACHINE: 69,
//   STRENGTH_TRAINING: 70,
//   STRETCHING: 71,
//   SURFING: 72,
//   SWIMMING_OPEN_WATER: 73,
//   SWIMMING_POOL: 74,
//   TABLE_TENNIS: 75,
//   TENNIS: 76,
//   UPPER_TWIST: 77,
//   VOLLEYBALL: 78,
//   WALKING: 79,
//   WATER_POLO: 80,
//   WEIGHTLIFTING: 81,
//   WHEELCHAIR: 82,
//   YOGA: 83