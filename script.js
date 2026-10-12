// ==========================================
// YUMMY CHAT 🍔
// Main application script
// ==========================================

import { initializeApp } from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js';

import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
} from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js';

import {
  getFirestore,
  collection,
  doc,
  addDoc,
  setDoc,
  getDoc,
  getDocs,
  updateDoc,
  deleteDoc,
  query,
  orderBy,
  limit,
  onSnapshot,
  where,
  serverTimestamp,
} from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js';

import {
  getStorage,
  ref,
  uploadBytes,
  getDownloadURL,
} from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-storage.js';

import { firebaseConfig } from './firebase.js';

// ==========================================
// FIREBASE
// ==========================================

const app = initializeApp(firebaseConfig);

const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);

// ==========================================
// GLOBAL STATE
// ==========================================

let currentUser = null;
let currentProfile = null;

let messages = [];
let friends = [];

let unsubscribeMessages = null;

let selectedMessageId = null;

let browserHistory = [];
let browserHistoryIndex = -1;

let currentTheme = localStorage.getItem('yummyTheme') || 'light';

let compactMode = localStorage.getItem('yummyCompact') === 'true';

let enterToSend = localStorage.getItem('yummyEnter') !== 'false';

let foodEmojis = localStorage.getItem('yummyFood') !== 'false';

// ==========================================
// ELEMENTS
// ==========================================

const authScreen = document.getElementById('authScreen');

const appElement = document.getElementById('app');

const loginBox = document.getElementById('loginBox');

const signupBox = document.getElementById('signupBox');

const loginForm = document.getElementById('loginForm');

const signupForm = document.getElementById('signupForm');

const showSignup = document.getElementById('showSignup');

const showLogin = document.getElementById('showLogin');

const authMessage = document.getElementById('authMessage');

const logoutButton = document.getElementById('logoutButton');

const messagesElement = document.getElementById('messages');

const messageForm = document.getElementById('messageForm');

const messageInput = document.getElementById('messageInput');

const imageInput = document.getElementById('imageInput');

const emojiButton = document.getElementById('emojiButton');

const emojiMenu = document.getElementById('emojiMenu');

const toast = document.getElementById('toast');

const toastText = document.getElementById('toastText');

const toastIcon = document.getElementById('toastIcon');

const globalSearch = document.getElementById('globalSearch');

const profileModal = document.getElementById('profileModal');

const profileForm = document.getElementById('profileForm');

const messageMenu = document.getElementById('messageMenu');

// ==========================================
// AUTH SCREEN
// ==========================================

showSignup.addEventListener('click', () => {
  loginBox.classList.add('hidden');
  signupBox.classList.remove('hidden');

  hideAuthMessage();
});

showLogin.addEventListener('click', () => {
  signupBox.classList.add('hidden');
  loginBox.classList.remove('hidden');

  hideAuthMessage();
});

function showAuthMessage(message) {
  authMessage.textContent = message;
  authMessage.classList.remove('hidden');
}

function hideAuthMessage() {
  authMessage.textContent = '';
  authMessage.classList.add('hidden');
}

// ==========================================
// LOGIN
// ==========================================

loginForm.addEventListener('submit', async (event) => {
  event.preventDefault();

  const email = document.getElementById('loginEmail').value.trim();

  const password = document.getElementById('loginPassword').value;

  try {
    hideAuthMessage();

    await signInWithEmailAndPassword(auth, email, password);
  } catch (error) {
    console.error(error);

    showAuthMessage(friendlyAuthError(error));
  }
});

// ==========================================
// SIGN UP
// ==========================================

signupForm.addEventListener('submit', async (event) => {
  event.preventDefault();

  const username = document.getElementById('signupUsername').value.trim();

  const email = document.getElementById('signupEmail').value.trim();

  const password = document.getElementById('signupPassword').value;

  if (!/^[a-zA-Z0-9_]+$/.test(username)) {
    showAuthMessage('Username can only use letters, numbers, and underscores.');

    return;
  }

  if (username.length < 3) {
    showAuthMessage('Username must be at least 3 characters.');

    return;
  }

  try {
    hideAuthMessage();

    const usernameKey = username.toLowerCase();

    const existingUsername = await getDoc(doc(db, 'usernames', usernameKey));

    if (existingUsername.exists()) {
      showAuthMessage('That username is already taken.');

      return;
    }

    const credential = await createUserWithEmailAndPassword(
      auth,
      email,
      password
    );

    const uid = credential.user.uid;

    await setDoc(doc(db, 'usernames', usernameKey), {
      uid,
      username,
    });

    await setDoc(doc(db, 'profiles', uid), {
      uid,
      username,
      usernameLower: usernameKey,
      bio: '🍔 New to Yummy Chat!',
      avatar: '🍔',
      createdAt: serverTimestamp(),
      online: true,
    });

    showToast('🎉', 'Account created!');
  } catch (error) {
    console.error(error);

    showAuthMessage(friendlyAuthError(error));
  }
});

// ==========================================
// AUTH STATE
// ==========================================

onAuthStateChanged(auth, async (user) => {
  if (user) {
    currentUser = user;

    await enterApp();
  } else {
    currentUser = null;
    currentProfile = null;

    authScreen.classList.remove('hidden');
    appElement.classList.add('hidden');

    if (unsubscribeMessages) {
      unsubscribeMessages();
      unsubscribeMessages = null;
    }
  }
});

// ==========================================
// ENTER APP
// ==========================================

async function enterApp() {
  authScreen.classList.add('hidden');
  appElement.classList.remove('hidden');

  applyTheme();

  await loadProfile();

  await loadFriends();

  setupMessagesListener();

  updateSettingsUI();

  showPage('home');
}

// ==========================================
// PROFILE
// ==========================================

async function loadProfile() {
  if (!currentUser) return;

  const profileRef = doc(db, 'profiles', currentUser.uid);

  const profileSnap = await getDoc(profileRef);

  if (profileSnap.exists()) {
    currentProfile = profileSnap.data();
  } else {
    currentProfile = {
      uid: currentUser.uid,
      username: currentUser.email?.split('@')[0] || 'YummyUser',
      bio: '🍔 Yummy Chat user',
      avatar: '🍔',
    };

    await setDoc(profileRef, currentProfile, { merge: true });
  }

  updateProfileUI();
}

function updateProfileUI() {
  if (!currentProfile) return;

  const username = currentProfile.username || 'YummyUser';

  const avatar = currentProfile.avatar || '🍔';

  const bio = currentProfile.bio || 'No bio yet.';

  document.getElementById('sidebarUsername').textContent = username;

  document.getElementById('topUsername').textContent = username;

  document.getElementById('homeUsername').textContent = username;

  document.getElementById('profileUsername').textContent = username;

  document.getElementById('profileDetailUsername').textContent = username;

  document.getElementById('profileBio').textContent = bio;

  document.getElementById('sidebarAvatar').textContent = avatar;

  document.getElementById('topAvatar').textContent = avatar;

  document.getElementById('profileAvatar').textContent = avatar;

  document.getElementById('profileUsernameInput').value = username;

  document.getElementById('profileBioInput').value = bio;

  document.getElementById('profileAvatarInput').value = avatar;

  const joined = currentProfile.createdAt?.toDate?.();

  if (joined) {
    document.getElementById('profileJoined').textContent =
      joined.toLocaleDateString();
  }
}

// ==========================================
// EDIT PROFILE
// ==========================================

document.getElementById('editProfileButton').addEventListener('click', () => {
  profileModal.classList.remove('hidden');
});

document.querySelectorAll('[data-close-modal]').forEach((button) => {
  button.addEventListener('click', () => {
    profileModal.classList.add('hidden');
  });
});

profileModal.querySelector('.modal-backdrop').addEventListener('click', () => {
  profileModal.classList.add('hidden');
});

profileForm.addEventListener('submit', async (event) => {
  event.preventDefault();

  if (!currentUser) return;

  const username = document.getElementById('profileUsernameInput').value.trim();

  const bio = document.getElementById('profileBioInput').value.trim();

  const avatar =
    document.getElementById('profileAvatarInput').value.trim() || '🍔';

  if (username.length < 3) {
    showToast('⚠️', 'Username is too short.');

    return;
  }

  try {
    const usernameKey = username.toLowerCase();

    const oldUsername = currentProfile.usernameLower;

    if (usernameKey !== oldUsername) {
      const existing = await getDoc(doc(db, 'usernames', usernameKey));

      if (existing.exists()) {
        showToast('❌', 'That username is taken.');

        return;
      }

      await deleteDoc(doc(db, 'usernames', oldUsername));

      await setDoc(doc(db, 'usernames', usernameKey), {
        uid: currentUser.uid,
        username,
      });
    }

    await updateDoc(doc(db, 'profiles', currentUser.uid), {
      username,
      usernameLower: usernameKey,
      bio,
      avatar,
    });

    currentProfile = {
      ...currentProfile,
      username,
      usernameLower: usernameKey,
      bio,
      avatar,
    };

    updateProfileUI();

    profileModal.classList.add('hidden');

    showToast('✅', 'Profile updated!');
  } catch (error) {
    console.error(error);

    showToast('❌', 'Could not update profile.');
  }
});

// ==========================================
// LOG OUT
// ==========================================

logoutButton.addEventListener('click', async () => {
  try {
    await signOut(auth);
  } catch (error) {
    console.error(error);
  }
});

// ==========================================
// NAVIGATION
// ==========================================

document.querySelectorAll('[data-page]').forEach((button) => {
  button.addEventListener('click', () => {
    showPage(button.dataset.page);
  });
});

function showPage(pageName) {
  document.querySelectorAll('.page').forEach((page) => {
    page.classList.remove('active-page');
  });

  const page = document.getElementById(`page-${pageName}`);

  if (page) {
    page.classList.add('active-page');
  }

  document.querySelectorAll('.nav-item').forEach((item) => {
    item.classList.toggle('active', item.dataset.page === pageName);
  });

  if (pageName === 'friends') {
    loadFriends();
  }

  if (pageName === 'profile') {
    updateProfileUI();
  }

  if (pageName === 'notifications') {
    loadNotifications();
  }
}

// ==========================================
// PROFILE SHORTCUTS
// ==========================================

document.getElementById('sidebarProfile').addEventListener('click', () => {
  showPage('profile');
});

document.getElementById('topProfileButton').addEventListener('click', () => {
  showPage('profile');
});

// ==========================================
// TOP NOTIFICATION
// ==========================================

document
  .getElementById('topNotificationButton')
  .addEventListener('click', () => {
    showPage('notifications');
  });

// ==========================================
// THEME
// ==========================================

document.getElementById('themeButton').addEventListener('click', cycleTheme);

document.getElementById('themeSelect').addEventListener('change', (event) => {
  currentTheme = event.target.value;

  localStorage.setItem('yummyTheme', currentTheme);

  applyTheme();
});

function cycleTheme() {
  const themes = ['light', 'dark', 'purple'];

  const currentIndex = themes.indexOf(currentTheme);

  currentTheme = themes[(currentIndex + 1) % themes.length];

  localStorage.setItem('yummyTheme', currentTheme);

  applyTheme();

  showToast('🎨', `${currentTheme} theme`);
}

function applyTheme() {
  document.documentElement.dataset.theme = currentTheme;

  const select = document.getElementById('themeSelect');

  if (select) {
    select.value = currentTheme;
  }
}

// ==========================================
// SETTINGS
// ==========================================

document.getElementById('compactMode').addEventListener('change', (event) => {
  compactMode = event.target.checked;

  localStorage.setItem('yummyCompact', compactMode);

  document.body.classList.toggle('compact-mode', compactMode);
});

document.getElementById('enterToSend').addEventListener('change', (event) => {
  enterToSend = event.target.checked;

  localStorage.setItem('yummyEnter', enterToSend);
});

document.getElementById('foodEmojis').addEventListener('change', (event) => {
  foodEmojis = event.target.checked;

  localStorage.setItem('yummyFood', foodEmojis);
});

function updateSettingsUI() {
  document.getElementById('compactMode').checked = compactMode;

  document.getElementById('enterToSend').checked = enterToSend;

  document.getElementById('foodEmojis').checked = foodEmojis;

  document.body.classList.toggle('compact-mode', compactMode);

  applyTheme();
}

// ==========================================
// CHAT LISTENER
// ==========================================

function setupMessagesListener() {
  if (unsubscribeMessages) {
    unsubscribeMessages();
  }

  const messagesQuery = query(
    collection(db, 'messages'),
    orderBy('time', 'asc'),
    limit(200)
  );

  unsubscribeMessages = onSnapshot(
    messagesQuery,
    (snapshot) => {
      messages = snapshot.docs.map((docSnap) => ({
        id: docSnap.id,
        ...docSnap.data(),
      }));

      renderMessages();

      updateChatStats();

      renderPinned();

      renderPeople();
    },
    (error) => {
      console.error('Messages listener error:', error);

      showToast('❌', 'Could not load messages.');
    }
  );
}

// ==========================================
// SEND MESSAGE
// ==========================================

messageForm.addEventListener('submit', async (event) => {
  event.preventDefault();

  await sendMessage();
});

async function sendMessage() {
  if (!currentUser) return;

  const text = messageInput.value.trim();

  if (!text && !imageInput.files.length) {
    return;
  }

  try {
    let imageURL = '';

    if (imageInput.files.length) {
      const file = imageInput.files[0];

      if (!file.type.startsWith('image/')) {
        showToast('❌', 'Please choose an image.');

        return;
      }

      if (file.size > 5 * 1024 * 1024) {
        showToast('❌', 'Images must be under 5MB.');

        return;
      }

      const fileName = `${Date.now()}_${file.name}`;

      const storageRef = ref(
        storage,
        `messageImages/${currentUser.uid}/${fileName}`
      );

      await uploadBytes(storageRef, file);

      imageURL = await getDownloadURL(storageRef);
    }

    await addDoc(collection(db, 'messages'), {
      uid: currentUser.uid,
      username: currentProfile?.username || 'YummyUser',
      avatar: currentProfile?.avatar || '🍔',
      text,
      imageURL,
      time: serverTimestamp(),
      edited: false,
      pinned: false,
      reactions: {},
    });

    messageInput.value = '';
    imageInput.value = '';

    emojiMenu.classList.add('hidden');
  } catch (error) {
    console.error(error);

    showToast('❌', 'Could not send message.');
  }
}

// ==========================================
// ENTER TO SEND
// ==========================================

messageInput.addEventListener('keydown', (event) => {
  if (event.key === 'Enter' && !event.shiftKey && enterToSend) {
    event.preventDefault();

    sendMessage();
  }
});

// ==========================================
// EMOJI MENU
// ==========================================

emojiButton.addEventListener('click', () => {
  emojiMenu.classList.toggle('hidden');
});

emojiMenu.querySelectorAll('button').forEach((button) => {
  button.addEventListener('click', () => {
    messageInput.value += button.textContent;

    messageInput.focus();

    emojiMenu.classList.add('hidden');
  });
});

// ==========================================
// RENDER MESSAGES
// ==========================================

function renderMessages() {
  messagesElement.innerHTML = '';

  if (!messages.length) {
    messagesElement.innerHTML = `
      <div class="empty-state">
        <span>🍔</span>
        <h3>No messages yet!</h3>
        <p>Be the first person to say hello.</p>
      </div>
    `;

    return;
  }

  messages.forEach((message) => {
    messagesElement.appendChild(createMessageElement(message));
  });

  messagesElement.scrollTop = messagesElement.scrollHeight;
}

function createMessageElement(message) {
  const row = document.createElement('div');

  const mine = message.uid === currentUser?.uid;

  row.className = `message-row${mine ? ' mine' : ''}`;

  const avatar = document.createElement('div');

  avatar.className = 'avatar avatar-small';

  avatar.textContent = message.avatar || '🍔';

  const content = document.createElement('div');

  const meta = document.createElement('div');

  meta.className = 'message-meta';

  meta.textContent = mine ? 'You' : message.username || 'YummyUser';

  const bubble = document.createElement('div');

  bubble.className = 'message-bubble';

  const text = document.createElement('div');

  text.className = 'message-text';

  text.textContent = message.text || '';

  if (message.text) {
    bubble.appendChild(text);
  }

  if (message.imageURL) {
    const image = document.createElement('img');

    image.className = 'message-image';

    image.src = message.imageURL;

    image.alt = 'Shared image';

    image.loading = 'lazy';

    bubble.appendChild(image);
  }

  if (message.edited) {
    const edited = document.createElement('span');

    edited.textContent = ' (edited)';

    edited.style.opacity = '.6';

    text.appendChild(edited);
  }

  const time = document.createElement('div');

  time.className = 'message-time';

  time.textContent = formatTime(message.time);

  bubble.appendChild(time);

  // Reactions

  const reactions = document.createElement('div');

  reactions.className = 'reaction-row';

  const reactionData = message.reactions || {};

  Object.entries(reactionData).forEach(([emoji, count]) => {
    if (!count) return;

    const reaction = document.createElement('button');

    reaction.className = 'reaction';

    reaction.textContent = `${emoji} ${count}`;

    reaction.addEventListener('click', () => reactToMessage(message.id, emoji));

    reactions.appendChild(reaction);
  });

  bubble.appendChild(reactions);

  // Context menu button

  const menuButton = document.createElement('button');

  menuButton.className = 'message-menu-button';

  menuButton.textContent = '⋯';

  menuButton.addEventListener('click', (event) => {
    event.stopPropagation();

    selectedMessageId = message.id;

    openMessageMenu(event.clientX, event.clientY);
  });

  bubble.appendChild(menuButton);

  content.appendChild(meta);
  content.appendChild(bubble);

  row.appendChild(avatar);
  row.appendChild(content);

  return row;
}

// ==========================================
// MESSAGE TIME
// ==========================================

function formatTime(timestamp) {
  if (!timestamp) {
    return 'Just now';
  }

  let date;

  if (typeof timestamp.toDate === 'function') {
    date = timestamp.toDate();
  } else if (timestamp.seconds) {
    date = new Date(timestamp.seconds * 1000);
  } else {
    date = new Date(timestamp);
  }

  if (Number.isNaN(date.getTime())) {
    return 'Just now';
  }

  return date.toLocaleTimeString([], {
    hour: 'numeric',
    minute: '2-digit',
  });
}

// ==========================================
// MESSAGE CONTEXT MENU
// ==========================================

function openMessageMenu(x, y) {
  messageMenu.classList.remove('hidden');

  messageMenu.style.left = `${Math.min(x, window.innerWidth - 170)}px`;

  messageMenu.style.top = `${Math.min(y, window.innerHeight - 230)}px`;
}

document.addEventListener('click', (event) => {
  if (!messageMenu.contains(event.target)) {
    messageMenu.classList.add('hidden');
  }
});

// ==========================================
// REACT
// ==========================================

document.getElementById('menuReact').addEventListener('click', () => {
  if (!selectedMessageId) return;

  const emojis = ['❤️', '😂', '👍', '🔥', '🍔', '🍕', '🍟'];

  const emoji = emojis[Math.floor(Math.random() * emojis.length)];

  reactToMessage(selectedMessageId, emoji);

  messageMenu.classList.add('hidden');
});

async function reactToMessage(messageId, emoji) {
  try {
    const message = messages.find((item) => item.id === messageId);

    if (!message) return;

    const reactions = {
      ...(message.reactions || {}),
    };

    reactions[emoji] = (reactions[emoji] || 0) + 1;

    await updateDoc(doc(db, 'messages', messageId), {
      reactions,
    });
  } catch (error) {
    console.error(error);
  }
}

// ==========================================
// PIN
// ==========================================

document.getElementById('menuPin').addEventListener('click', async () => {
  if (!selectedMessageId) return;

  const message = messages.find((item) => item.id === selectedMessageId);

  if (!message) return;

  try {
    await updateDoc(doc(db, 'messages', selectedMessageId), {
      pinned: !message.pinned,
    });

    showToast('📌', message.pinned ? 'Unpinned' : 'Pinned!');
  } catch (error) {
    console.error(error);
  }

  messageMenu.classList.add('hidden');
});

// ==========================================
// EDIT MESSAGE
// ==========================================

document.getElementById('menuEdit').addEventListener('click', async () => {
  if (!selectedMessageId) return;

  const message = messages.find((item) => item.id === selectedMessageId);

  if (!message) return;

  if (message.uid !== currentUser?.uid) {
    showToast('⚠️', 'You can only edit your messages.');

    return;
  }

  const newText = prompt('Edit your message:', message.text || '');

  if (newText === null || !newText.trim()) {
    return;
  }

  try {
    await updateDoc(doc(db, 'messages', selectedMessageId), {
      text: newText.trim(),
      edited: true,
    });
  } catch (error) {
    console.error(error);

    showToast('❌', 'Could not edit message.');
  }

  messageMenu.classList.add('hidden');
});

// ==========================================
// DELETE MESSAGE
// ==========================================

document.getElementById('menuDelete').addEventListener('click', async () => {
  if (!selectedMessageId) return;

  const message = messages.find((item) => item.id === selectedMessageId);

  if (!message) return;

  if (message.uid !== currentUser?.uid) {
    showToast('⚠️', 'You can only delete your messages.');

    return;
  }

  const confirmed = confirm('Delete this message?');

  if (!confirmed) return;

  try {
    await deleteDoc(doc(db, 'messages', selectedMessageId));

    showToast('🗑️', 'Message deleted.');
  } catch (error) {
    console.error(error);

    showToast('❌', 'Could not delete message.');
  }

  messageMenu.classList.add('hidden');
});

// ==========================================
// PINNED MESSAGES
// ==========================================

function renderPinned() {
  const pinned = messages.filter((message) => message.pinned);

  const list = document.getElementById('pinnedMessages');

  const bar = document.getElementById('pinnedBar');

  const preview = document.getElementById('pinnedPreview');

  list.innerHTML = '';

  if (!pinned.length) {
    list.innerHTML = `
      <div class="empty-state small">
        <span>📌</span>
        <p>No pinned messages.</p>
      </div>
    `;

    bar.classList.add('hidden');

    return;
  }

  const newest = pinned[pinned.length - 1];

  preview.textContent = newest.text || 'Pinned image';

  bar.classList.remove('hidden');

  pinned.forEach((message) => {
    const item = document.createElement('div');

    item.className = 'pinned-item';

    item.textContent = message.text || '📷 Image';

    list.appendChild(item);
  });
}

document.getElementById('closePinned').addEventListener('click', () => {
  document.getElementById('pinnedBar').classList.add('hidden');
});

// ==========================================
// PEOPLE
// ==========================================

function renderPeople() {
  const list = document.getElementById('peopleList');

  const unique = new Map();

  messages.forEach((message) => {
    if (!unique.has(message.uid)) {
      unique.set(message.uid, message);
    }
  });

  document.getElementById('peopleCount').textContent = unique.size;

  list.innerHTML = '';

  if (!unique.size) {
    list.innerHTML = `
      <div class="empty-state small">
        <span>👥</span>
        <p>No people yet.</p>
      </div>
    `;

    return;
  }

  unique.forEach((person) => {
    const item = document.createElement('div');

    item.className = 'person';

    item.innerHTML = `
      <div class="avatar avatar-small">
        ${escapeHTML(person.avatar || '🍔')}
      </div>

      <div class="person-info">
        <strong>
          ${escapeHTML(person.username || 'YummyUser')}
        </strong>

        <small>
          ${person.uid === currentUser?.uid ? 'You' : 'Yummy Chat member'}
        </small>
      </div>

      <span class="person-status"></span>
    `;

    list.appendChild(item);
  });
}

// ==========================================
// CHAT STATS
// ==========================================

function updateChatStats() {
  document.getElementById('statMessages').textContent = messages.length;

  let reactions = 0;

  messages.forEach((message) => {
    Object.values(message.reactions || {}).forEach((count) => {
      reactions += Number(count) || 0;
    });
  });

  document.getElementById('statReactions').textContent = reactions;

  document.getElementById('profileMessages').textContent = messages.filter(
    (message) => message.uid === currentUser?.uid
  ).length;
}

// ==========================================
// FRIENDS
// ==========================================

async function loadFriends() {
  if (!currentUser) return;

  try {
    const q = query(
      collection(db, 'friends'),
      where('ownerUid', '==', currentUser.uid)
    );

    const snapshot = await getDocs(q);

    friends = snapshot.docs.map((item) => ({
      id: item.id,
      ...item.data(),
    }));

    renderFriends();
  } catch (error) {
    console.error(error);
  }
}

function renderFriends() {
  const list = document.getElementById('friendsList');

  document.getElementById('friendsCount').textContent = friends.length;

  document.getElementById('statFriends').textContent = friends.length;

  list.innerHTML = '';

  if (!friends.length) {
    list.innerHTML = `
      <div class="empty-state">
        <span>👥</span>
        <h3>No friends yet</h3>
        <p>Search for someone and add them!</p>
      </div>
    `;

    return;
  }

  friends.forEach((friend) => {
    const card = document.createElement('div');

    card.className = 'friend-card';

    card.innerHTML = `
      <div class="avatar avatar-small">
        ${escapeHTML(friend.avatar || '🍔')}
      </div>

      <div class="friend-info">
        <strong>
          ${escapeHTML(friend.username || 'YummyUser')}
        </strong>

        <small>
          Yummy Chat friend
        </small>
      </div>

      <span class="friend-status"></span>
    `;

    list.appendChild(card);
  });
}

// ==========================================
// SEARCH FRIENDS
// ==========================================

document
  .getElementById('friendSearchForm')
  .addEventListener('submit', async (event) => {
    event.preventDefault();

    const search = document
      .getElementById('friendSearchInput')
      .value.trim()
      .toLowerCase();

    const results = document.getElementById('friendSearchResults');

    results.innerHTML = '';

    if (!search) return;

    try {
      const q = query(
        collection(db, 'profiles'),
        where('usernameLower', '>=', search),
        where('usernameLower', '<=', search + '\uf8ff'),
        limit(10)
      );

      const snapshot = await getDocs(q);

      if (snapshot.empty) {
        results.innerHTML = `
          <div class="empty-state small">
            <span>🔎</span>
            <p>No users found.</p>
          </div>
        `;

        return;
      }

      snapshot.forEach((profileSnap) => {
        const profile = profileSnap.data();

        if (profile.uid === currentUser?.uid) return;

        const card = document.createElement('div');

        card.className = 'friend-card';

        card.innerHTML = `
          <div class="avatar avatar-small">
            ${escapeHTML(profile.avatar || '🍔')}
          </div>

          <div class="friend-info">
            <strong>
              ${escapeHTML(profile.username || 'YummyUser')}
            </strong>

            <small>
              ${escapeHTML(profile.bio || 'Yummy Chat user')}
            </small>
          </div>

          <button
            class="primary-button add-friend-button"
          >
            Add
          </button>
        `;

        card
          .querySelector('.add-friend-button')
          .addEventListener('click', () => addFriend(profile));

        results.appendChild(card);
      });
    } catch (error) {
      console.error(error);

      showToast('❌', 'Could not search users.');
    }
  });

async function addFriend(profile) {
  try {
    const friendId = `${currentUser.uid}_${profile.uid}`;

    await setDoc(doc(db, 'friends', friendId), {
      ownerUid: currentUser.uid,
      friendUid: profile.uid,
      username: profile.username,
      avatar: profile.avatar || '🍔',
      createdAt: serverTimestamp(),
    });

    await loadFriends();

    showToast('👥', `${profile.username} added!`);
  } catch (error) {
    console.error(error);

    showToast('❌', 'Could not add friend.');
  }
}

// ==========================================
// NOTIFICATIONS
// ==========================================

async function loadNotifications() {
  const list = document.getElementById('notificationsList');

  list.innerHTML = `
    <div class="notification-item">
      <div class="notification-icon">
        🍔
      </div>

      <div class="notification-info">
        <strong>Welcome to Yummy Chat!</strong>
        <small>
          You're ready to chat.
        </small>
      </div>
    </div>
  `;
}

// ==========================================
// SEARCH MESSAGES
// ==========================================

globalSearch.addEventListener('keydown', (event) => {
  if (event.key !== 'Enter') return;

  const term = globalSearch.value.trim().toLowerCase();

  if (!term) {
    renderMessages();

    return;
  }

  showPage('chat');

  const results = messages.filter((message) =>
    (message.text || '').toLowerCase().includes(term)
  );

  messagesElement.innerHTML = '';

  if (!results.length) {
    messagesElement.innerHTML = `
        <div class="empty-state">
          <span>🔎</span>
          <h3>No messages found</h3>
          <p>
            Nothing matched "${escapeHTML(term)}".
          </p>
        </div>
      `;

    return;
  }

  results.forEach((message) => {
    messagesElement.appendChild(createMessageElement(message));
  });
});

// ==========================================
// BROWSER
// ==========================================

const browserForm = document.getElementById('browserForm');

const browserAddress = document.getElementById('browserAddress');

const browserFrame = document.getElementById('browserFrame');

const browserHomeScreen = document.getElementById('browserHomeScreen');

const browserSearchScreen = document.getElementById('browserSearchScreen');

const browserSearchText = document.getElementById('browserSearchText');

const openDuckSearch = document.getElementById('openDuckSearch');

browserForm.addEventListener('submit', (event) => {
  event.preventDefault();

  navigateBrowser(browserAddress.value.trim());
});

document
  .getElementById('browserSearchForm')
  .addEventListener('submit', (event) => {
    event.preventDefault();

    const search = document.getElementById('browserSearchInput').value.trim();

    if (!search) return;

    showDuckSearch(search);
  });

document.querySelectorAll('.browser-shortcut').forEach((button) => {
  button.addEventListener('click', () => {
    navigateBrowser(button.dataset.url);
  });
});

function navigateBrowser(value) {
  if (!value) return;

  let url = value;

  const looksLikeURL =
    /^https?:\/\//i.test(value) || /^[a-z0-9.-]+\.[a-z]{2,}/i.test(value);

  if (!looksLikeURL) {
    showDuckSearch(value);

    return;
  }

  if (!/^https?:\/\//i.test(url)) {
    url = 'https://' + url;
  }

  try {
    new URL(url);
  } catch {
    showDuckSearch(value);

    return;
  }

  browserAddress.value = url;

  browserHistory = browserHistory.slice(0, browserHistoryIndex + 1);

  browserHistory.push(url);

  browserHistoryIndex = browserHistory.length - 1;

  browserHomeScreen.classList.add('hidden');

  browserSearchScreen.classList.add('hidden');

  browserFrame.classList.remove('hidden');

  browserFrame.src = url;
}

function showDuckSearch(search) {
  const encoded = encodeURIComponent(search);

  const duckURL = `https://duckduckgo.com/?q=${encoded}`;

  browserAddress.value = search;

  browserHomeScreen.classList.add('hidden');

  browserFrame.classList.add('hidden');

  browserSearchScreen.classList.remove('hidden');

  browserSearchText.textContent = `Search results for "${search}"`;

  openDuckSearch.href = duckURL;

  browserHistory = browserHistory.slice(0, browserHistoryIndex + 1);

  browserHistory.push(`search:${search}`);

  browserHistoryIndex = browserHistory.length - 1;
}

document.getElementById('browserHome').addEventListener('click', () => {
  browserFrame.classList.add('hidden');

  browserSearchScreen.classList.add('hidden');

  browserHomeScreen.classList.remove('hidden');

  browserAddress.value = '';
});

document.getElementById('browserBack').addEventListener('click', () => {
  if (browserHistoryIndex <= 0) return;

  browserHistoryIndex--;

  openBrowserHistory();
});

document.getElementById('browserForward').addEventListener('click', () => {
  if (browserHistoryIndex >= browserHistory.length - 1) return;

  browserHistoryIndex++;

  openBrowserHistory();
});

document.getElementById('browserReload').addEventListener('click', () => {
  if (!browserFrame.classList.contains('hidden')) {
    browserFrame.src = browserFrame.src;
  }
});

function openBrowserHistory() {
  const item = browserHistory[browserHistoryIndex];

  if (!item) return;

  if (item.startsWith('search:')) {
    showDuckSearch(item.substring(7));

    return;
  }

  browserAddress.value = item;

  browserHomeScreen.classList.add('hidden');

  browserSearchScreen.classList.add('hidden');

  browserFrame.classList.remove('hidden');

  browserFrame.src = item;
}

// ==========================================
// HOME BUTTONS
// ==========================================

document.querySelectorAll('.hero-button, .primary-button').forEach((button) => {
  if (button.dataset.page) {
    button.addEventListener('click', () => {
      showPage(button.dataset.page);
    });
  }
});

// ==========================================
// NOTIFICATION BUTTON
// ==========================================

document
  .getElementById('markNotificationsRead')
  .addEventListener('click', () => {
    document.getElementById('notificationBadge').classList.add('hidden');

    document.getElementById('topNotificationBadge').classList.add('hidden');

    showToast('✅', 'Notifications cleared.');
  });

// ==========================================
// TOAST
// ==========================================

function showToast(icon, message) {
  toastIcon.textContent = icon;

  toastText.textContent = message;

  toast.classList.remove('hidden');

  clearTimeout(showToast.timeout);

  showToast.timeout = setTimeout(() => {
    toast.classList.add('hidden');
  }, 2500);
}

// ==========================================
// FIREBASE ERROR MESSAGES
// ==========================================

function friendlyAuthError(error) {
  const code = error?.code || '';

  switch (code) {
    case 'auth/invalid-credential':
      return 'Email or password is incorrect.';

    case 'auth/invalid-email':
      return 'Please enter a valid email.';

    case 'auth/email-already-in-use':
      return 'That email is already registered.';

    case 'auth/weak-password':
      return 'Password must be at least 6 characters.';

    case 'auth/user-not-found':
      return 'No account was found with that email.';

    case 'auth/wrong-password':
      return 'Incorrect password.';

    case 'auth/network-request-failed':
      return 'Network error. Check your internet connection.';

    default:
      return error?.message || 'Something went wrong.';
  }
}

// ==========================================
// ESCAPE HTML
// ==========================================

function escapeHTML(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

// ==========================================
// INITIAL UI
// ==========================================

applyTheme();

updateSettingsUI();

// ==========================================
// DONE 🍔
// ==========================================

console.log('🍔 Yummy Chat loaded!');
