import 'dotenv/config';

async function testLargePayload() {
  const backendUrl = 'http://localhost:4000';
  
  // Create a massive payload (e.g. 5MB)
  const largeArray = new Array(50000).fill({
      beatsPerMinute: 80,
      time: new Date().toISOString()
  });

  const payload = [{
      userId: "6a0f4c00125006cde73497ae",
      id: "test-large",
      lastModifiedTime: new Date().toISOString(),
      startTime: new Date().toISOString(),
      endTime: new Date().toISOString(),
      samples: largeArray
  }];

  try {
      console.log("Sending large request...");
      
      const response = await fetch(`${backendUrl}/api/heartRate/addHeartRate`, {
          method: "POST",
          headers: {
              "Content-Type": "application/json"
          },
          body: JSON.stringify(payload),
      });
      
      const text = await response.text();
      console.log("Status:", response.status);
      console.log("Response starts with:", text.substring(0, 100));
  } catch (e) {
      console.error(e);
  }
}

testLargePayload();
