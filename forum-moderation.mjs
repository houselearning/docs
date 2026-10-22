import { getApp, getApps, initializeApp } from 'https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js';
import { getAuth, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js';
import {
  collection,
  collectionGroup,
  doc,
  getDocs,
  getFirestore,
  limit,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where
} from 'https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js';

const firebaseConfig = {
  apiKey: 'AIzaSyDoXSwni65CuY1_32ZE8B1nwfQO_3VNpTw',
  authDomain: 'contract-center-llc-10.firebaseapp.com',
  projectId: 'contract-center-llc-10',
  storageBucket: 'contract-center-llc-10.firebasestorage.app',
  messagingSenderId: '323221512767',
  appId: '1:323221512767:web:6421260f875997dbf64e8a'
};
const appId = 'default-app-id';
const REVIEW_CATEGORIES = [
  ['sexual-content', 'Sexual content'],
  ['hate-or-harassment', 'Hate or harassment'],
  ['dangerous-instructions', 'Dangerous instructions'],
  ['malicious-code', 'Malicious code']
];

let db;
let signedInAdmin = false;
let panel;

function button(text, className, onClick) {
  const control = document.createElement('button');
  control.type = 'button';
  control.className = className;
  control.textContent = text;
  control.addEventListener('click', onClick);
  return control;
}

function createPanel() {
  if (panel) return panel;
  panel = document.createElement('section');
  panel.className = 'hidden fixed inset-0 z-[100] bg-black/50 p-3 sm:p-8';
  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-modal', 'true');
  panel.setAttribute('aria-labelledby', 'forum-moderation-title');

  const windowPanel = document.createElement('div');
  windowPanel.className = 'mx-auto mt-4 max-h-[88vh] max-w-3xl overflow-auto rounded-xl bg-white p-5 shadow-xl sm:mt-10 sm:p-7';
  const header = document.createElement('div');
  header.className = 'flex items-center justify-between gap-4 border-b pb-4';
  const title = document.createElement('h2');
  title.id = 'forum-moderation-title';
  title.className = 'text-xl font-bold text-gray-900';
  title.textContent = 'Forum Moderation Queue';
  header.append(title, button('Close', 'rounded-md border px-3 py-2 text-sm', () => panel.classList.add('hidden')));

  const status = document.createElement('p');
  status.dataset.queueStatus = '';
  status.className = 'py-4 text-sm text-gray-600';
  status.setAttribute('role', 'status');
  status.setAttribute('aria-live', 'polite');

  const items = document.createElement('div');
  items.dataset.queueItems = '';
  items.className = 'space-y-3';
  windowPanel.append(header, status, items);
  panel.appendChild(windowPanel);
  panel.addEventListener('click', event => {
    if (event.target === panel) panel.classList.add('hidden');
  });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape') panel.classList.add('hidden');
  });
  document.body.appendChild(panel);
  return panel;
}

function renderItem(item) {
  const article = document.createElement('article');
  article.className = 'rounded-lg border border-gray-200 p-4';
  const heading = document.createElement('h3');
  heading.className = 'font-semibold text-gray-900';
  heading.textContent = `${item.type === 'post' ? 'Post' : 'Comment'} · ${item.status}`;
  const content = document.createElement('p');
  content.className = 'my-3 whitespace-pre-wrap break-words text-sm text-gray-700';
  content.textContent = item.text;

  const actions = document.createElement('div');
  actions.className = 'flex flex-wrap items-center gap-2';
  const category = document.createElement('select');
  category.className = 'min-h-10 rounded-md border px-2 text-sm';
  category.setAttribute('aria-label', 'Reason for blocking this contribution');
  for (const [value, label] of REVIEW_CATEGORIES) {
    const option = document.createElement('option');
    option.value = value;
    option.textContent = label;
    category.appendChild(option);
  }
  actions.append(
    category,
    button('Approve', 'rounded-md bg-emerald-700 px-3 py-2 text-sm font-semibold text-white', () => resolveItem(item, 'approve', 'safe')),
    button('Block', 'rounded-md bg-red-700 px-3 py-2 text-sm font-semibold text-white', () => resolveItem(item, 'block', category.value))
  );
  article.append(heading, content, actions);
  return article;
}

async function loadQueue() {
  const activePanel = createPanel();
  const status = activePanel.querySelector('[data-queue-status]');
  const itemsContainer = activePanel.querySelector('[data-queue-items]');
  status.textContent = 'Loading pending forum content...';
  itemsContainer.replaceChildren();
  activePanel.classList.remove('hidden');
  if (!signedInAdmin || !db) {
    status.textContent = 'Administrator access is required.';
    return;
  }

  try {
    const posts = await getDocs(query(
      collection(db, `artifacts/${appId}/public/data/forum_posts`),
      where('moderationStatus', 'in', ['pending', 'review']),
      orderBy('timestamp', 'asc'),
      limit(50)
    ));
    const queue = posts.docs.map(document => {
      const post = document.data();
      return {
        type: 'post',
        status: post.moderationStatus,
        postId: document.id,
        commentId: '',
        text: `${post.title}\n\n${post.content}`
      };
    });

    const comments = await getDocs(query(
      collectionGroup(db, 'comments'),
      where('moderationStatus', 'in', ['pending', 'review']),
      orderBy('timestamp', 'asc'),
      limit(100)
    ));
    for (const document of comments.docs) {
      const segments = document.ref.path.split('/');
      const postIndex = segments.indexOf('forum_posts');
      if (postIndex < 0 || segments[postIndex + 2] !== 'comments') continue;
      const comment = document.data();
      queue.push({
        type: 'comment',
        status: comment.moderationStatus,
        postId: segments[postIndex + 1],
        commentId: document.id,
        text: comment.content
      });
    }

    status.textContent = queue.length ? `${queue.length} items require review.` : 'No forum items need review.';
    itemsContainer.replaceChildren(...queue.map(renderItem));
  } catch (error) {
    status.textContent = 'The moderation queue could not be loaded. Check Firebase rules, indexes, and deployment.';
    console.error('Unable to load forum moderation queue:', error);
  }
}

async function resolveItem(item, action, category) {
  const status = panel.querySelector('[data-queue-status]');
  status.textContent = 'Saving moderator decision...';
  try {
    const target = item.type === 'post'
      ? doc(db, `artifacts/${appId}/public/data/forum_posts`, item.postId)
      : doc(db, `artifacts/${appId}/public/data/forum_posts/${item.postId}/comments`, item.commentId);
    await updateDoc(target, {
      moderationStatus: action === 'approve' ? 'approved' : 'blocked',
      moderationCategory: action === 'approve' ? 'safe' : category,
      moderationReviewedBy: getAuthUserId(),
      moderationReviewedAt: serverTimestamp()
    });
    await loadQueue();
  } catch (error) {
    status.textContent = 'Could not save that decision. The item remains hidden pending review.';
    console.error('Unable to resolve forum moderation item:', error);
  }
}

let moderatorUid = '';

function getAuthUserId() {
  return moderatorUid;
}

function addQueueButton(dropdown) {
  if (!signedInAdmin || !dropdown || dropdown.querySelector('[data-open-forum-queue]')) return;
  const control = button('Moderation Queue', 'block w-full px-4 py-2 text-left hover:bg-gray-100', loadQueue);
  control.dataset.openForumQueue = '';
  dropdown.prepend(control);
}

function initialize() {
  const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
  db = getFirestore(app);
  const auth = getAuth(app);
  const dropdown = document.getElementById('user-menu-dropdown');
  if (dropdown) {
    new MutationObserver(() => addQueueButton(dropdown)).observe(dropdown, { childList: true });
  }

  onAuthStateChanged(auth, async user => {
    signedInAdmin = false;
    moderatorUid = user ? user.uid : '';
    if (user) {
      try {
        const token = await user.getIdTokenResult();
        signedInAdmin = token.claims.admin === true
          || user.email === 'cajm23331@gmail.com'
          || user.uid === '2nuzhsYAXiaMhm4RhRWksNLIBcJ3';
      } catch (_error) {
        signedInAdmin = false;
      }
    }
    if (!signedInAdmin) dropdown?.querySelector('[data-open-forum-queue]')?.remove();
    else addQueueButton(dropdown);
  });
}

window.addEventListener('load', () => window.setTimeout(initialize, 0), { once: true });