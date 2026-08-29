import 'dotenv/config';

async function testAllSyncs() {
  const backendUrl = 'http://localhost:4000';
  
  const endpoints = [
    '/api/heartRate/addHeartRate',
    '/api/sleepSession/addSleepSession',
    '/api/step/addStep',
    '/api/exercise/bulkAddExercise'
  ];

  for (const endpoint of endpoints) {
    try {
      console.log(`\nTesting ${endpoint}...`);
      const response = await fetch(`${backendUrl}${endpoint}`, {
          method: "POST",
          headers: {
              "Content-Type": "application/json"
          },
          body: JSON.stringify([{ id: "test" }]), // dummy payload
      });
      
      const text = await response.text();
      console.log("Status:", response.status);
      console.log("Response starts with:", text.substring(0, 50));
      
      if (text.trim().startsWith('<')) {
          console.log("!!! THIS ENDPOINT RETURNS HTML !!!");
      }
    } catch (e) {
      console.error(e);
    }
  }
}

testAllSyncs();
