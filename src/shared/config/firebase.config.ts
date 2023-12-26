import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';

import { getEnvVar } from './config.service';

const apiKey = getEnvVar('FIREBASE_API_KEY');
const messagingSenderId = getEnvVar('MESSAGING_SENDER_ID');
const appId = getEnvVar('APP_ID');
const measurementId = getEnvVar('MEASUREMENT_ID');

export const firebaseConfig = {
	apiKey,
	authDomain: 'awesome-football-stats.firebaseapp.com',
	projectId: 'awesome-football-stats',
	storageBucket: 'awesome-football-stats.appspot.com',
	messagingSenderId,
	appId,
	measurementId,
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
