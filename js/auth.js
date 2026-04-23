const USERS = {
  'admin': {
    password: 'Crypteo2024!',
    name: 'Admin Crypteo',
    role: 'admin'
  }
};

let currentUser = null;
let lastResults = null;

function login() {
  const username = document.getElementById('login-user').value.trim();
  const password = document.getElementById('login-pass').value;
  const errorEl = document.getElementById('login-error');
  const user = USERS[username];
  if (!user || user.password !== password) {
    errorEl.style.display = 'block';
    return;
  }
  errorEl.style.display = 'none';
  currentUser = { username, ...user };
  sessionStorage.setItem('crypteo_user', JSON.stringify(currentUser));
  updateAuthUI();
  closeLogin();
  if (lastResults) displayResults(lastResults);
}

function logout() {
  currentUser = null;
  sessionStorage.removeItem('crypteo_user');
  updateAuthUI();
  if (lastResults) displayResults(lastResults);
}

function updateAuthUI() {
  const loginBtn = document.getElementById('login-btn');
  const userInfo = document.getElementById('user-info');
  const userName = document.getElementById('user-name');
  if (currentUser) {
    loginBtn.style.display = 'none';
    userInfo.style.display = 'flex';
    userName.textContent = currentUser.name;
  } else {
    loginBtn.style.display = 'block';
    userInfo.style.display = 'none';
  }
}

function isAdmin() {
  return currentUser && currentUser.role === 'admin';
}

function openLogin() {
  document.getElementById('login-modal').classList.add('open');
  document.getElementById('login-error').style.display = 'none';
  document.getElementById('login-user').value = '';
  document.getElementById('login-pass').value = '';
  setTimeout(() => document.getElementById('login-user').focus(), 100);
}

function closeLogin() {
  document.getElementById('login-modal').classList.remove('open');
}

(function init() {
  const stored = sessionStorage.getItem('crypteo_user');
  if (stored) {
    try { currentUser = JSON.parse(stored); } catch (e) {}
  }
  document.addEventListener('DOMContentLoaded', function() {
    updateAuthUI();
    document.getElementById('login-modal').addEventListener('click', function(e) {
      if (e.target === this) closeLogin();
    });
    document.getElementById('contact-modal').addEventListener('click', function(e) {
      if (e.target === this) closeContact();
    });
  });
})();
