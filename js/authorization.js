// js/authorization.js

// Assumes firebase-app-compat.js, firebase-auth-compat.js, and firebaseConfig
// have already run in app.html’s <head> or before this.

const auth = firebase.auth();

// As soon as this file runs, enforce auth:
auth.onAuthStateChanged(user => {
  if (!user) {
    // Not signed in → kick them back to login
    window.location.href = 'login.html';
  } else {
    // Signed in → dynamically load your main script.js
    const script = document.createElement('script');
    script.src = 'js/script.js';
    document.body.appendChild(script);
  }
});
