const https = require('https');

// Firebase Web API configuration
const firebaseConfig = {
  apiKey: "AIzaSyCVwde47xofIaRyJQr5QjeDgKCinQ7s8_U",
  projectId: "londisinventoryapp"
};

async function updateAnnouncement() {
  try {
    const url = `https://firestore.googleapis.com/v1/projects/${firebaseConfig.projectId}/databases/(default)/documents/appSettings/messages?key=${firebaseConfig.apiKey}`;
    
    const data = {
      fields: {
        currentMessage: {
          stringValue: "Everyone should take care of shift timings and inventory"
        }
      }
    };

    const options = {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json'
      }
    };

    const req = https.request(url, options, (res) => {
      let body = '';
      res.on('data', (chunk) => {
        body += chunk;
      });
      res.on('end', () => {
        if (res.statusCode === 200) {
          console.log('Announcement updated successfully!');
          console.log('New message: "Everyone should take care of shift timings and inventory"');
        } else {
          console.error('Failed to update announcement:', res.statusCode, body);
        }
      });
    });

    req.on('error', (error) => {
      console.error('Error updating announcement:', error);
    });

    req.write(JSON.stringify(data));
    req.end();
    
  } catch (error) {
    console.error('Error updating announcement:', error);
  }
}

updateAnnouncement();
