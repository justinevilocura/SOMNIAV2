import 'dotenv/config';

async function testSync() {
  const backendUrl = 'http://localhost:4000';
  
  // mock exercise payload
  const exercisePayload = [{
      userId: "6a0f4c00125006cde73497ae",
      id: "test-exercise-123",
      lastModifiedTime: new Date().toISOString(),
      startTime: new Date().toISOString(),
      endTime: new Date().toISOString(),
      title: "Test",
      exerciseType: 1
  }];

  try {
      console.log("Sending request to:", `${backendUrl}/api/exercise/bulkAddExercise`);
      
      const response = await fetch(`${backendUrl}/api/exercise/bulkAddExercise`, {
          method: "POST",
          headers: {
              "Content-Type": "application/json",
              // We need a valid token to bypass auth middleware
          },
          body: JSON.stringify({ exerciseRecords: exercisePayload }),
      });
      
      const text = await response.text();
      console.log("Status:", response.status);
      console.log("Response:", text.substring(0, 200));
  } catch (e) {
      console.error(e);
  }
}

testSync();
