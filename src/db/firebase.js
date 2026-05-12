const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

let initialized = false;

function getCredentialFromFile(serviceAccountPath) {
  const resolvedPath = path.isAbsolute(serviceAccountPath)
    ? serviceAccountPath
    : path.resolve(process.cwd(), serviceAccountPath);

  if (!fs.existsSync(resolvedPath)) {
    throw new Error(`No existe el archivo de credenciales Firebase: ${resolvedPath}`);
  }

  const serviceAccount = JSON.parse(fs.readFileSync(resolvedPath, 'utf8'));
  return admin.credential.cert(serviceAccount);
}

function getCredentialFromEnv() {
  const { FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY } = process.env;

  if (!FIREBASE_PROJECT_ID || !FIREBASE_CLIENT_EMAIL || !FIREBASE_PRIVATE_KEY) {
    throw new Error(
      'Configura FIREBASE_SERVICE_ACCOUNT_PATH o FIREBASE_PROJECT_ID/FIREBASE_CLIENT_EMAIL/FIREBASE_PRIVATE_KEY'
    );
  }

  return admin.credential.cert({
    projectId: FIREBASE_PROJECT_ID,
    clientEmail: FIREBASE_CLIENT_EMAIL,
    privateKey: FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
  });
}

function getFirebase() {
  if (!initialized) {
    const credential = process.env.FIREBASE_SERVICE_ACCOUNT_PATH
      ? getCredentialFromFile(process.env.FIREBASE_SERVICE_ACCOUNT_PATH)
      : getCredentialFromEnv();

    admin.initializeApp({
      credential,
    });

    initialized = true;
    console.log('✅ Firebase Admin SDK inicializado');
  }
  return admin;
}

module.exports = { getFirebase };
