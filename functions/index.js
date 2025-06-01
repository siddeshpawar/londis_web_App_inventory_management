// functions/index.js

// Import the necessary modules for 2nd Gen callable functions and HttpsError
const {onCall, HttpsError} = require("firebase-functions/v2/https"); //

// The Firebase Admin SDK to access Firestore, Realtime Database, etc.
const admin = require("firebase-admin");

// Initialize Firebase Admin SDK
// This automatically uses the default service account associated with your Firebase project
admin.initializeApp();

// Get references to Firestore and Auth
const db = admin.firestore();
const auth = admin.auth();

/**
 * Cloud Function to handle user sign-up.
 * It creates a user in Firebase Authentication, sends a verification email,
 * and creates a corresponding user document in Firestore.
 *
 * @param {Object} request - The request object for 2nd Gen callable functions.
 * @param {Object} request.data - The data sent from the client.
 * @param {string} request.data.email - The user"s email address.
 * @param {string} request.data.password - The user"s password.
 * @param {string} request.data.mobileNumber - The user"s mobile number.
 * @returns {Object} An object containing the user"s UID and email on success.
 * @throws {HttpsError} If there"s an error during the process.
 */
exports.signUpUser = onCall(async (request) => { //
  // In 2nd Gen, `data` is accessed via `request.data`
  const {email, password, mobileNumber} = request.data; //

  // 1. Input Validation
  if (!email || !password || !mobileNumber) {
    throw new HttpsError( //
      "invalid-argument",
      "Email, password, and mobile number are required.",
    );
  }

  // Basic mobile number validation (can be enhanced)
  const mobileRegex = /^\+?[0-9]{7,15}$/;
  if (!mobileRegex.test(mobileNumber)) {
    throw new HttpsError( //
      "invalid-argument",
      "Please enter a valid mobile number (e.g., +447911123456 or 07911123456).",
    );
  }

  try {
    // 2. Create user in Firebase Authentication
    const userRecord = await auth.createUser({
      email: email,
      password: password,
      // You can also set phoneNumber here if you want it directly in Auth,
      // but ensure it"s in E.164 format (e.g., +447911123456)
      // phoneNumber: mobileNumber,
      emailVerified: false, // User is not verified until they click the link
      disabled: false, // Account is active
    });

    // 3. Send email verification
    // Note: This requires you to set up the email action URL in Firebase Console -> Authentication -> Templates
    // and ensure your Firebase project has a support email configured.
    const link = await auth.generateEmailVerificationLink(email);
    await auth.sendEmailVerification(userRecord.uid, {url: link});
    console.log(`Verification email sent to ${email}`);

    // 4. Create a document for the user in Firestore
    // Use the user"s UID as the document ID for easy lookup
    const userDocRef = db.collection("users").doc(userRecord.uid);
    await userDocRef.set({
      uid: userRecord.uid,
      email: userRecord.email,
      mobileNumber: mobileNumber,
      isAllowed: false, // Default to false, requires admin approval
      createdAt: admin.firestore.FieldValue.serverTimestamp(), // Server-side timestamp
      // Add any other initial user data you want to store
      // e.g., displayName: data.displayName || null,
      // profilePicture: data.profilePicture || null,
    });

    console.log(`User ${userRecord.uid} created in Auth and document created in Firestore.`);

    // Return success response to the client
    return {
      uid: userRecord.uid,
      email: userRecord.email,
      message: "Sign up successful! Please check your email for verification. " +
                     "Account pending admin approval.",
    };
  } catch (error) {
    console.error("Error during signUpUser Cloud Function:", error);

    // Handle specific Firebase Auth errors and re-throw as HttpsError
    if (error.code === "auth/email-already-in-use") {
      throw new HttpsError( //
        "already-exists",
        "This email is already in use. Please sign in or use a different email.",
      );
    } else if (error.code === "auth/weak-password") {
      throw new HttpsError( //
        "weak-password",
        "Password is too weak. " +
                "Please use at least 6 characters.",
      );
    } else if (error.code === "auth/invalid-email") {
      throw new HttpsError("invalid-argument", "The email address is not valid."); //
    } else {
      // Generic error for unexpected issues
      throw new HttpsError( //
        "internal",
        "An unexpected error occurred during sign up. Please try again later.",
        error.message,
      );
    }
  }
});
