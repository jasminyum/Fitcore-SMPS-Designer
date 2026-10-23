// ================================================================
// Firebase Settings
// SPDX-License-Identifier: AGPL-3.0-only
// ================================================================
const firebaseConfig = {
    apiKey: "AIzaSyCWJNUYEAxDJGjI32lyT63MHtd2TOgNI4U",
    authDomain: "calculator-tool-78d20.firebaseapp.com",
    projectId: "calculator-tool-78d20",
    storageBucket: "calculator-tool-78d20.appspot.com",
    messagingSenderId: "111933880055",
    appId: "1:111933880055:web:b7ea42f9533d4aac8c05f2",
    measurementId: "G-LCB0THGWRV"
};

if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}

const db = firebase.firestore();
