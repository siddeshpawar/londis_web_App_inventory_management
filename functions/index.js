const functions = require("firebase-functions");
const admin = require("firebase-admin");

// Initialize Firebase Admin SDK
admin.initializeApp();
const db = admin.firestore();

/**
 * Scheduled Cloud Function to check for expiring products daily.
 * Runs at 1 AM everyday.
 */
exports.checkExpiredProducts = functions.pubsub.schedule("0 1 * * *")
  .timeZone("Europe/London") // Corrected to double quotes
  .onRun(async (context) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Normalize to start of today

    // Calculate dates for 2 days before expiry and on expiry day
    const twoDaysFromNow = new Date(today);
    twoDaysFromNow.setDate(today.getDate() + 2);

    const onExpiryDay = new Date(today);
    onExpiryDay.setDate(today.getDate()); // Already today

    console.log(`Running expiry check for ${today.toISOString()}`);
    console.log("Checking for products expiring on:" +
                `${onExpiryDay.toISOString().split("T")[0]}`);
    console.log("Checking for products expiring in 2 days (on):" +
                `${twoDaysFromNow.toISOString().split("T")[0]}`);


    const productsRef = db.collection("products");
    const snapshot = await productsRef.get();

    const notifications = [];

    snapshot.docs.forEach((doc) => {
      const product = doc.data();
      const productId = doc.id; // Barcode

      if (product.expiryDates && product.expiryDates.length > 0) {
        product.expiryDates.forEach((batch, index) => {
          if (batch.isRemoved) {
            return; // Skip batches that are already marked as removed
          }

          const expiryDate = new Date(batch.date);
          expiryDate.setHours(0, 0, 0, 0); // Normalize expiry date to start of day

          const diffTime = expiryDate.getTime() - today.getTime();
          const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); // Calculate days difference

          if (diffDays === 0) {
            // On the day of expiry
            const message = `Product: ${product.name} (Barcode: ${productId}) - ` +
                            `Batch expiring TODAY: ${batch.date}. Quantity: ${batch.quantity}`;
            notifications.push({
              type: "expiry_today",
              productId,
              batchIndex: index,
              message,
              timestamp: admin.firestore.FieldValue.serverTimestamp(),
            });
            console.log(`[Expiry TODAY] ${message}`);
          } else if (diffDays === 2) {
            // Two days before expiry
            const message = `Product: ${product.name} (Barcode: ${productId}) - ` +
                            `Batch expiring in 2 days: ${batch.date}. Quantity: ${batch.quantity}`;
            notifications.push({
              type: "expiry_2_days",
              productId,
              batchIndex: index,
              message,
              timestamp: admin.firestore.FieldValue.serverTimestamp(),
            });
            console.log(`[Expiry in 2 days] ${message}`);
          }
        });
      }
    });

    if (notifications.length > 0) {
      console.log(`Found ${notifications.length} notifications. ` +
            "Storing in \"notifications\" collection.");
      // Store notifications in a Firestore collection
      const notificationsBatch = db.batch();
      notifications.forEach((notification) => {
        const newNotificationRef = db.collection("notifications").doc();
        notificationsBatch.set(newNotificationRef, notification);
      });
      await notificationsBatch.commit();
      console.log("Notifications stored successfully.");
    } else {
      console.log("No expiring products found today.");
    }

    return null; // Cloud Functions should return null or a Promise
  });
