/* =========================================
   firebase-config.js – Firebase Initialization
   =========================================
   NOTE: AppId hiện tại là từ Android app.
   Để dùng đúng cho web, vào Firebase Console
   → Project Settings → Your apps → Add app → Web
   và lấy appId web mới.
   Firestore vẫn hoạt động với config hiện tại.
   ========================================= */

const firebaseConfig = {
  apiKey: "AIzaSyC9NBlTH_UStt0Y_Ex9ftwzIOYBj9dJI-I",
  authDomain: "lovin-c69f3.firebaseapp.com",
  projectId: "lovin-c69f3",
  storageBucket: "lovin-c69f3.firebasestorage.app",
  messagingSenderId: "730119079486",
  appId: "1:730119079486:android:4fa00525fde83d392d736f"
};

// Tránh khởi tạo nhiều lần khi load nhiều trang
if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}

const db = firebase.firestore();
