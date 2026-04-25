const crypto = require('crypto');
const admin = require('firebase-admin');
const functions = require('firebase-functions');

admin.initializeApp();

const db = admin.firestore();
const DEFAULT_PASSWORD = 'cndwntkdrh1234';
const SESSION_MINUTES = 15;

function assertSignedIn(context) {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', '로그인이 필요합니다.');
  }
  return context.auth.uid;
}

async function getUser(uid) {
  const snap = await db.collection('users').doc(uid).get();
  if (!snap.exists) {
    throw new functions.https.HttpsError('permission-denied', '사용자 정보가 없습니다.');
  }
  const user = snap.data() || {};
  if (user.active === false || user.deleted === true) {
    throw new functions.https.HttpsError('permission-denied', '사용할 수 없는 계정입니다.');
  }
  return user;
}

function isAdmin(user) {
  return String(user.role || 'user') === 'admin';
}

function canUseGrades(user) {
  return isAdmin(user) || user.gradeAccess === true;
}

function hashPassword(password, salt) {
  return crypto.pbkdf2Sync(String(password), salt, 210000, 32, 'sha256').toString('hex');
}

async function getSecret() {
  const ref = db.collection('appSecrets').doc('grades');
  const snap = await ref.get();
  return { ref, data: snap.exists ? snap.data() || {} : {} };
}

async function verifyPassword(password) {
  const { data } = await getSecret();
  if (!data.passwordHash || !data.passwordSalt) {
    return String(password) === DEFAULT_PASSWORD;
  }
  return hashPassword(password, data.passwordSalt) === data.passwordHash;
}

exports.verifyGradesPassword = functions.https.onCall(async (data, context) => {
  const uid = assertSignedIn(context);
  const user = await getUser(uid);
  if (!canUseGrades(user)) {
    throw new functions.https.HttpsError('permission-denied', '성적관리 권한이 없습니다.');
  }

  const password = String((data && data.password) || '').trim();
  const deviceId = String((data && data.deviceId) || '').trim();
  if (!password || !deviceId) {
    throw new functions.https.HttpsError('invalid-argument', '비밀번호 정보가 올바르지 않습니다.');
  }

  const ok = await verifyPassword(password);
  if (!ok) {
    throw new functions.https.HttpsError('permission-denied', '비밀번호가 맞지 않습니다.');
  }

  const expiresAt = admin.firestore.Timestamp.fromMillis(Date.now() + SESSION_MINUTES * 60 * 1000);
  await db.collection('gradeBooks').doc('default').collection('sessions').doc(uid).set({
    active: true,
    deviceId,
    email: String(user.email || ''),
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    expiresAt
  }, { merge: true });

  return { ok: true, expiresAt: expiresAt.toMillis() };
});

exports.setGradesPassword = functions.https.onCall(async (data, context) => {
  const uid = assertSignedIn(context);
  const user = await getUser(uid);
  if (!isAdmin(user)) {
    throw new functions.https.HttpsError('permission-denied', '관리자만 변경할 수 있습니다.');
  }

  const password = String((data && data.password) || '').trim();
  if (password.length < 4) {
    throw new functions.https.HttpsError('invalid-argument', '비밀번호는 4자 이상이어야 합니다.');
  }

  const salt = crypto.randomBytes(16).toString('hex');
  const passwordHash = hashPassword(password, salt);
  const { ref } = await getSecret();
  await ref.set({
    passwordHash,
    passwordSalt: salt,
    updatedBy: String(user.email || uid),
    updatedAt: admin.firestore.FieldValue.serverTimestamp()
  }, { merge: true });

  return { ok: true };
});
