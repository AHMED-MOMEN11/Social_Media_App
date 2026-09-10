// ==========================================
// IMPORTS & DEPENDENCIES
// ==========================================
import axios from "axios";
import './style.css';
import * as bootstrap from 'bootstrap';
window.bootstrap = bootstrap;

// ==========================================
// CONFIGURATION & GLOBAL STATE
// ==========================================
const API_BASE_URL = 'https://tarmeezacademy.com/api/v1';
const FALLBACK_AVATAR = '/ProfilePics/profile-icon-design-free-vector.jpg';

const state = {
  token: localStorage.getItem('Token') || '',
  currentPage: 1,
  lastPage: 1,
  isLoading: false,
  refreshAfterLoad: false,
  currentPostId: null,
  currentRoute: 'home',
  profileUserId: null,
};

// ==========================================
// UTILITY / HELPER FUNCTIONS
// ==========================================

/**
 * Escapes special HTML characters to prevent XSS attacks.
 * @param {string} str 
 * @returns {string} Sanitized string
 */
function escapeHTML(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Gets stored auth data safely from localStorage.
 */
function getStoredUser() {
  try {
    const user = localStorage.getItem('User');
    return user ? JSON.parse(user) : null;
  } catch (error) {
    console.error("Error parsing stored user data:", error);
    return null;
  }
}

/**
 * Saves auth session into local storage and updates state.
 */
function setAuthSession(token, user) {
  state.token = token;
  localStorage.setItem('Token', token);
  localStorage.setItem('User', JSON.stringify(user));
}

/**
 * Clears local auth storage and resets state token.
 */
function clearAuthSession() {
  state.token = '';
  localStorage.removeItem('Token');
  localStorage.removeItem('User');
}

/**
 * Helper to dismiss a Bootstrap modal by element ID.
 */
function closeModal(modalId, onClosed) {
  const modalElement = document.getElementById(modalId);
  if (!modalElement) return;

  const modalInstance = bootstrap.Modal.getOrCreateInstance(modalElement);

  if (onClosed) {
    modalElement.addEventListener('hidden.bs.modal', onClosed, { once: true });
  }

  if (document.activeElement && modalElement.contains(document.activeElement)) {
    document.activeElement.blur();
  }

  modalInstance.hide();
}

function showModal(modalId) {
  const modalElement = document.getElementById(modalId);
  if (modalElement) {
    bootstrap.Modal.getOrCreateInstance(modalElement).show();
  }
}

/**
 * Get Authenticated User
 **/

function getAuthenticatedUser() {
  const user = getStoredUser();

  if (!state.token || !user || user.id === undefined || user.id === null) {
    return null;
  }

  return user;
}

function isPostOwner(post, user = getAuthenticatedUser()) {
  const authorId = post?.author?.id ?? post?.author_id;

  // Compare normalized IDs because one may be a number and the other a string.
  return Boolean(
    user &&
    authorId !== undefined &&
    authorId !== null &&
    String(authorId) === String(user.id)
  );
}

/**
 * Re-renders whatever page the user is currently on.
 * Home → refresh the paginated feed.
 * Profile → re-fetch the profile (so owner actions update).
 */
function refreshCurrentView() {
  if (state.currentRoute === 'profile' && state.profileUserId) {
    renderProfilePage(state.profileUserId);
    return;
  }

  // Home route
  if (state.isLoading) {
    state.refreshAfterLoad = true;
    return;
  }
  fetchAndRenderPosts(1);
}

// Keep the old name as an alias so nothing else has to change
const refreshFeedForAuthChange = refreshCurrentView;

function handleExpiredSession(message = 'Your session has expired. Please log in again.') {
  clearAuthSession();
  updateNavigationUI();
  renderCreatePostWidget();
  refreshFeedForAuthChange();
  renderToastAlert(message, 'failed');
}

function getRequestErrorMessage(error, fallback) {
  if (error.response?.status === 401) {
    handleExpiredSession();
    return null;
  }

  return error.response?.data?.message || fallback;
}

async function getOwnedPost(postId, actionLabel) {
  const user = getAuthenticatedUser();

  if (!user) {
    handleExpiredSession('Please log in to manage a post.');
    return null;
  }

  try {
    const response = await axios.get(`${API_BASE_URL}/posts/${postId}`);
    const post = response.data.data;

    if (!isPostOwner(post, user)) {
      renderToastAlert(`Only the author can ${actionLabel} this post.`, 'failed');
      return null;
    }

    return post;
  } catch (error) {
    const message = getRequestErrorMessage(
      error,
      `Could not load this post before ${actionLabel}ing it.`
    );

    if (message) renderToastAlert(message, 'failed');
    return null;
  }
}

// Global scope window attachment for inline HTML event handler
window.PostId = function (id) {
  state.currentPostId = id;
  fetchAndRenderComments();
};

// ==========================================
// APPLICATION INITIALIZATION (MAIN HTML RENDER)
// ==========================================
function renderAppSkeleton() {
  document.querySelector('#app').innerHTML = `
    <!-- Navbar -->
<nav class="navbar navbar-expand-md navbar-light bg-white border-bottom sticky-top py-2 shadow-sm">
  <div class="container max-w-screen-md">
    <a class="navbar-brand fw-bold text-primary fs-4 tracking-wide" href="#/">
      <i class="bi bi-hexagon-fill me-1"></i>LOREM
    </a>

    <button class="navbar-toggler border-0 shadow-none" type="button" data-bs-toggle="collapse"
      data-bs-target="#navbarContent" aria-controls="navbarContent" aria-expanded="false" aria-label="Toggle navigation">
      <span class="navbar-toggler-icon"></span>
    </button>

    <div class="collapse navbar-collapse" id="navbarContent">
      <ul class="navbar-nav mx-auto mb-2 mb-md-0 gap-md-1">
        <li class="nav-item">
          <a class="nav-link active fw-semibold text-primary px-3" id="home-nav-link" href="#/">
  <i class="bi bi-house-door-fill me-1"></i>Home
</a>
        </li>
        <!-- Hidden until the visitor is signed in -->
        <li class="nav-item" id="profile-nav-item" style="display: none;">
  <a class="nav-link fw-medium text-secondary px-3" id="profile-nav-link" href="#/">
    <i class="bi bi-person-fill me-1"></i>Profile
  </a>
</li>
      </ul>

          <div class="d-flex align-items-center gap-2 pt-2 pt-md-0" id="nav-btns">
            <button type="button" class="btn btn-light text-secondary rounded-circle p-2 mx-2" id="themeToggle" aria-label="Toggle theme">
              <i class="bi bi-moon-stars-fill" id="themeIcon"></i>
            </button>
            <button type="button" class="btn btn-light fw-medium px-3 text-secondary" id="log-in-btn" data-bs-toggle="modal" data-bs-target="#LoginModal">
              Log in
            </button>
            <button type="button" class="btn btn-primary fw-medium px-4 rounded-pill shadow-sm" id="register-btn" data-bs-toggle="modal" data-bs-target="#RegisterModal">
              Register
            </button>
          </div>
        </div>
      </div>
    </nav>

    <!-- Register Modal -->
    <div class="modal fade" id="RegisterModal" tabindex="-1" aria-hidden="true">
      <div class="modal-dialog modal-dialog-centered">
        <div class="modal-content border-0 shadow-lg rounded-4">
          <div class="modal-header border-0 pb-0">
            <h5 class="modal-title fw-bold">Create an account</h5>
            <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
          </div>
          <div class="modal-body p-4">
            <form id="registerForm">
              <div class="mb-3">
                <label for="register-email" class="form-label small fw-medium text-secondary">Email address</label>
                <input type="email" class="form-control rounded-3" id="register-email" placeholder="name@example.com">
              </div>
              <div class="mb-3">
                <label for="UserName" class="form-label small fw-medium text-secondary">User name</label>
                <input type="text" class="form-control rounded-3" id="UserName" placeholder="ex: Abod">
              </div>
              <div class="mb-3">
                <label for="Name" class="form-label small fw-medium text-secondary">Name</label>
                <input type="text" class="form-control rounded-3" id="Name" placeholder="ex: John Doe">
              </div>
              <div class="mb-3">
                <label for="register-password" class="form-label small fw-medium text-secondary">Password</label>
                <input type="password" class="form-control rounded-3" id="register-password" placeholder="Create a password">
              </div>
              <div class="mb-3">
                <label for="profileImage" class="custom-file-label form-label small fw-medium text-body">Upload a profile image</label>
                <input type="file" class="form-control rounded-3 bg-body-tertiary text-body border-secondary-subtle custom-file-input" id="profileImage">
              </div>
              <button type="button" class="btn btn-primary w-100 rounded-3 py-2 fw-semibold mt-2" id="register">Register</button>
            </form>
          </div>
        </div>
      </div>
    </div>

    <!-- Login Modal -->
    <div class="modal fade" id="LoginModal" tabindex="-1" aria-hidden="true">
      <div class="modal-dialog modal-dialog-centered">
        <div class="modal-content border-0 shadow-lg rounded-4">
          <div class="modal-header border-0 pb-0">
            <h5 class="modal-title fw-bold">Welcome back</h5>
            <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
          </div>
          <div class="modal-body p-4">
            <form id="loginForm">
              <div class="mb-3">
                <label for="login-username" class="form-label small fw-medium text-secondary">User Name</label>
                <input type="text" class="form-control rounded-3" id="login-username" placeholder="ex: abod">
              </div>
              <div class="mb-3">
                <label for="login-password" class="form-label small fw-medium text-secondary">Password</label>
                <input type="password" class="form-control rounded-3" id="login-password" placeholder="Enter your password">
              </div>
              <button type="button" class="btn btn-primary w-100 rounded-3 py-2 fw-semibold mt-2" id="login">Log in</button>
            </form>
          </div>
        </div>
      </div>
    </div>

    <!-- Create Post Modal -->
    <div class="modal fade" id="CreatePostModal" tabindex="-1" aria-hidden="true">
      <div class="modal-dialog modal-dialog-centered">
        <div class="modal-content border-0 shadow-lg rounded-4">
          <div class="modal-header border-0 pb-0">
            <h5 class="modal-title fw-bold">Create a post</h5>
            <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
          </div>
          <div class="modal-body p-4">
            <form id="createPostForm">
              <div class="mb-3">
                <label for="Title" class="form-label small fw-medium text-secondary">Title</label>
                <input type="text" class="form-control rounded-3" id="Title" placeholder="This is a title">
              </div>
              <div class="mb-3">
                <label for="Body" class="form-label small fw-medium text-secondary">Body</label>
                <input type="text" class="form-control rounded-3" id="Body" placeholder="This is a body">
              </div>
              <div class="mb-3">
                <label for="image" class="custom-file-label form-label small fw-medium text-body">Upload an image</label>
                <input type="file" class="form-control rounded-3 bg-body-tertiary text-body border-secondary-subtle custom-file-input" id="image">
              </div>
              <button type="button" class="btn btn-primary w-100 rounded-3 py-2 fw-semibold mt-2 z-3" id="create-post">Share</button>
            </form>
          </div>
        </div>
      </div>
    </div>

    <!-- Update Post Modal -->
    <div class="modal fade" id="UpdatePostModal" tabindex="-1" aria-hidden="true">
      <div class="modal-dialog modal-dialog-centered">
        <div class="modal-content border-0 shadow-lg rounded-4">
          <div class="modal-header border-0 pb-0">
            <h5 class="modal-title fw-bold">Update your post</h5>
            <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
          </div>
          <div class="modal-body p-4" id = "Update-body">
            <form id="updatePostForm">
              <div class="mb-3">
                <label for="Title" class="form-label small fw-medium text-secondary">Title</label>
                <input type="text" class="form-control rounded-3" id="Title-1" placeholder="This is a title">
              </div>
              <div class="mb-3">
                <label for="Body" class="form-label small fw-medium text-secondary">Body</label>
                <input type="text" class="form-control rounded-3" id="Body-1" placeholder="This is a body">
              </div>
              <div class="mb-3">
                <label for="image" class="custom-file-label form-label small fw-medium text-body">Upload an image</label>
                <input type="file" class="form-control rounded-3 bg-body-tertiary text-body border-secondary-subtle custom-file-input" id="image-1">
              </div>
              <button type="submit" class="btn btn-primary w-100 rounded-3 py-2 fw-semibold mt-2 z-3" id="update-post">Update</button>
            </form>
          </div>
        </div>
      </div>
    </div>

    <!-- Comments Modal -->
    <div class="modal fade" id="CommentsModal" tabindex="-1" aria-labelledby="CommentsModalLabel">
      <div class="modal-dialog modal-dialog-scrollable modal-lg">
        <div class="modal-content">
          <div class="modal-header border-bottom">
            <h5 class="modal-title" id="CommentsModalLabel">Comments</h5>
            <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
          </div>
          <div class="modal-body">
            <div id="Comment-body" class="d-flex flex-column gap-3"></div>
          </div>
          <div class="modal-footer d-block border-top">
            <form id="addCommentForm" class="d-flex gap-2">
              <input id="comment" type="text" class="form-control" placeholder="Write a comment..." required>
              <button type="submit" class="btn btn-primary" id="commentSubmitBtn">Send</button>
            </form>
          </div>
        </div>
      </div>
    </div>

    <!-- Delete Post Modal -->
    <div class="modal fade" id="DeletePostModal" tabindex="-1" aria-hidden="true">
      <div class="modal-dialog modal-dialog-centered modal-sm">
        <div class="modal-content border-0 shadow-lg rounded-4 overflow-hidden">
          <div class="modal-body p-4 text-center">
            <!-- Warning Icon -->
            <div class="bg-danger-subtle text-danger rounded-circle d-inline-flex align-items-center justify-content-center mb-3" style="width: 60px; height: 60px;">
              <i class="bi bi-trash3-fill fs-3"></i>
            </div>

            <h5 class="fw-bold mb-2">Delete Post?</h5>
            <p class="text-secondary small mb-4">Are you sure you want to delete this post? This action cannot be undone.</p>

            <!-- Action Buttons -->
            <div class="d-flex gap-2 justify-content-center">
              <button type="button" class="btn btn-light fw-semibold w-50 py-2 rounded-3 text-secondary" data-bs-dismiss="modal">Cancel</button>
              <button type="button" class="btn btn-danger fw-semibold w-50 py-2 rounded-3 shadow-sm" id="confirm-delete-btn">Delete</button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Alert Toast Container -->
    <div id="AlertContainer"></div>

    <!-- Back to Top Button -->
    <button id="backToTopBtn" aria-label="Back to Top" title="Back to Top" class="z-2">
      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
        <path d="m18 15-6-6-6 6" />
      </svg>
    </button>

    <!-- Main Feed Container -->
    <main class="container py-4 my-2" style="max-width: 680px;">
      <div id="AddPostContainer"></div>
      <section class="cards" id="ins-post">
        <div id="scroll-sentinel" class="d-flex justify-content-center my-4">
          <div class="spinner-border text-primary" role="status" id="loading-spinner">
            <span class="visually-hidden">Loading more posts...</span>
          </div>
        </div>
      </section>
    </main>
  `;
}

// ==========================================
// UI & NOTIFICATION COMPONENT MANAGERS
// ==========================================

function toggleTheme() {
  const themeToggleBtn = document.getElementById('themeToggle');
  const themeIcon = document.getElementById('themeIcon');
  const htmlElement = document.documentElement;

  const savedTheme = localStorage.getItem('theme');
  const systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  const initialTheme = savedTheme || (systemPrefersDark ? 'dark' : 'light');

  const applyTheme = (theme) => {
    htmlElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);

    if (themeIcon && themeToggleBtn) {
      if (theme === 'dark') {
        themeIcon.classList.replace('bi-moon-stars-fill', 'bi-sun-fill');
        themeToggleBtn.classList.replace('text-secondary', 'text-warning');
      } else {
        themeIcon.classList.replace('bi-sun-fill', 'bi-moon-stars-fill');
        themeToggleBtn.classList.replace('text-warning', 'text-secondary');
      }
    }
  };

  applyTheme(initialTheme);

  if (themeToggleBtn) {
    themeToggleBtn.addEventListener('click', () => {
      const currentTheme = htmlElement.getAttribute('data-theme');
      applyTheme(currentTheme === 'dark' ? 'light' : 'dark');
    });
  }
}

function renderToastAlert(message, type = 'success') {
  const alertContainer = document.getElementById('AlertContainer');
  if (!alertContainer) return;

  const isSuccess = type === 'success';
  const bgClass = isSuccess ? 'bg-success' : 'bg-danger';
  const iconMarkup = isSuccess
    ? `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="currentColor" class="bi bi-check2-circle" viewBox="0 0 16 16"><path d="M2.5 8a5.5 5.5 0 0 1 8.25-4.764.5.5 0 0 0 .5-.866A6.5 6.5 0 1 0 14.5 8a.5.5 0 0 0-1 0 5.5 5.5 0 1 1-11 0"/><path d="M15.354 3.354a.5.5 0 0 0-.708-.708L8 9.293 5.354 6.646a.5.5 0 1 0-.708.708l3 3a.5.5 0 0 0 .708 0z"/></svg>`
    : `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-bug" viewBox="0 0 16 16"><path d="M4.355.522a.5.5 0 0 1 .623.333l.291.956A5 5 0 0 1 8 1c1.007 0 1.946.298 2.731.811l.29-.956a.5.5 0 1 1 .957.29l-.41 1.352A5 5 0 0 1 13 6h.5a.5.5 0 0 0 .5-.5V5a.5.5 0 0 1 1 0v.5A1.5 1.5 0 0 1 13.5 7H13v1h1.5a.5.5 0 0 1 0 1H13v1h.5a1.5 1.5 0 0 1 1.5 1.5v.5a.5.5 0 1 1-1 0v-.5a.5.5 0 0 0-.5-.5H13a5 5 0 0 1-10 0h-.5a.5.5 0 0 0-.5.5v.5a.5.5 0 1 1-1 0v-.5A1.5 1.5 0 0 1 2.5 10H3V9H1.5a.5.5 0 0 1 0-1H3V7h-.5A1.5 1.5 0 0 1 1 5.5V5a.5.5 0 0 1 1 0v.5a.5.5 0 0 0 .5.5H3c0-1.364.547-2.601 1.432-3.503l-.41-1.352a.5.5 0 0 1 .333-.623M4 7v4a4 4 0 0 0 3.5 3.97V7zm4.5 0v7.97A4 4 0 0 0 12 11V7zM12 6a4 4 0 0 0-1.334-2.982A3.98 3.98 0 0 0 8 2a3.98 3.98 0 0 0-2.667 1.018A4 4 0 0 0 4 6z"/></svg>`;

  alertContainer.innerHTML = `
    <div class="position-fixed bottom-0 end-0 p-3" style="z-index: 1100;">
      <div class="toast align-items-center text-white ${bgClass} border-0 show shadow-lg rounded-3" role="alert" aria-live="assertive" aria-atomic="true">
        <div class="d-flex">
          <div class="toast-body d-flex align-items-center gap-2 fs-6 fw-medium">
            <span>${escapeHTML(message)}</span>
            ${iconMarkup}
          </div>
          <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast" aria-label="Close"></button>
        </div>
      </div>
    </div>
  `;

  setTimeout(() => { alertContainer.innerHTML = ''; }, 5000);
}

function updateNavigationUI() {
  const userData = getStoredUser();
  const navBtnsContainer = document.getElementById('nav-btns');
  const loginNavButton = document.getElementById('log-in-btn');
  const registerNavButton = document.getElementById('register-btn');

  if (userData && state.token) {
    const logoutHTML = `
      <div id="logout-container" class="d-flex align-items-center">
        <span class="text-muted fw-medium me-2 text-truncate">${escapeHTML(userData.username)}</span>
        <img src="${getAvatarUrl(userData.profile_image)}" 
             alt="avatar" 
             class="rounded-circle border border-2 border-primary-subtle" 
             style="width: 42px; height: 42px; object-fit: cover;" 
             onerror="this.onerror=null;this.src='${FALLBACK_AVATAR}';">
        <button class="btn btn-danger fw-medium px-4 rounded-pill shadow-sm mx-2" id="logout">Log out</button>
      </div>
    `;

    if (navBtnsContainer && !document.getElementById('logout-container')) {
      navBtnsContainer.insertAdjacentHTML('beforeend', logoutHTML);
    }

    if (loginNavButton) loginNavButton.style.display = 'none';
    if (registerNavButton) registerNavButton.style.display = 'none';

    const logoutBtn = document.getElementById('logout');
    if (logoutBtn) logoutBtn.onclick = handleLogout;

  } else {
    if (loginNavButton) loginNavButton.style.display = 'block';
    if (registerNavButton) registerNavButton.style.display = 'block';

    const logoutContainer = document.getElementById('logout-container');
    if (logoutContainer) logoutContainer.remove();
  }

  // Profile link: visible only for signed-in users
  const profileNavItem = document.getElementById('profile-nav-item');
  if (profileNavItem) {
    profileNavItem.style.display =
      userData && state.token ? 'block' : 'none';
  }

  // Wire the profile link to the logged-in user's own profile
  const profileLink = document.getElementById('profile-nav-link');
  if (profileLink) {
    profileLink.onclick = (event) => {
      event.preventDefault();
      const me = getAuthenticatedUser();
      if (me) {
        window.location.hash = `#/profile/${me.id}`;
      } else {
        renderToastAlert('Please log in to view your profile.', 'failed');
      }
    };
  }
}

function renderCreatePostWidget() {
  const createPostContainer = document.getElementById('AddPostContainer');
  if (!createPostContainer) return;

  // Never show the composer while viewing someone's profile
  if (state.currentRoute === 'profile') {
    createPostContainer.innerHTML = '';
    return;
  }

  const userData = getStoredUser();

  if (!state.token || !userData) {
    createPostContainer.innerHTML = '';
    return;
  }

  const firstName = userData?.name ? userData.name.split(' ')[0] : 'User';

  createPostContainer.innerHTML = `
    <div class="card border-0 shadow-sm rounded-4 p-3 mb-4 bg-body-tertiary">
      <div class="d-flex align-items-center gap-3">
        <img id="create-post-user-avatar" 
             src="${getAvatarUrl(userData.profile_image)}"
             onerror="this.onerror=null; this.src='${FALLBACK_AVATAR}';"
             alt="User Avatar" 
             class="rounded-circle border border-2 border-primary-subtle"
             style="width: 40px; height: 40px; object-fit: cover;">
        <div class="flex-grow-1 py-2 px-3 rounded-pill text-body-secondary border border-secondary-subtle d-flex align-items-center bg-body cursor-pointer shadow-sm-hover"
             style="cursor: pointer; min-height: 42px;" 
             data-bs-toggle="modal" 
             data-bs-target="#CreatePostModal">
          <span id="create-post-placeholder" class="text-secondary small fw-normal">What's on your mind, ${escapeHTML(firstName)}?</span>
        </div>
      </div>
    </div>
  `;
}

function getAvatarUrl(image) {
  if (image && typeof image === 'string' && image.trim() !== '' && image !== '[object Object]') {
    return image;
  }
  return FALLBACK_AVATAR;
}

// ==========================================
// AUTHENTICATION HANDLERS
// ==========================================

async function handleRegister() {
  const email = document.getElementById('register-email').value.trim();
  const username = document.getElementById('UserName').value.trim();
  const name = document.getElementById('Name').value.trim();
  const password = document.getElementById('register-password').value.trim();
  const profileImage = document.getElementById('profileImage').files[0];

  if (!email || !username || !name || !password) {
    renderToastAlert("Please add your email, username, name, and password to register.", 'failed');
    return;
  }

  const formData = new FormData();
  formData.append('email', email);
  formData.append('username', username);
  formData.append('name', name);
  formData.append('password', password);
  if (profileImage) formData.append('image', profileImage);

  try {
    const response = await axios.post(`${API_BASE_URL}/register`, formData);
    const { token, user } = response.data;

    setAuthSession(token, user);
    closeModal('RegisterModal');
    updateNavigationUI();
    renderCreatePostWidget();
    refreshFeedForAuthChange();
    renderToastAlert(`Welcome to our community, ${user.name}`);

    // Clear form fields
    document.getElementById('register-email').value = '';
    document.getElementById('UserName').value = '';
    document.getElementById('Name').value = '';
    document.getElementById('register-password').value = '';
    document.getElementById('profileImage').value = '';

  } catch (error) {
    renderToastAlert(error.response?.data?.message || "Registration Failed", 'failed');
  }
}

async function handleLogin() {
  const username = document.getElementById('login-username').value.trim();
  const password = document.getElementById('login-password').value.trim();

  if (!username || !password) {
    renderToastAlert("Please add your username and password to login.", 'failed');
    return;
  }

  const formData = new FormData();
  formData.append('username', username);
  formData.append('password', password);

  try {
    const response = await axios.post(`${API_BASE_URL}/login`, formData);
    const { token, user } = response.data;

    setAuthSession(token, user);
    closeModal('LoginModal');
    updateNavigationUI();
    renderCreatePostWidget();
    refreshFeedForAuthChange();
    renderToastAlert(`Welcome Back ${user.name}`);

    // Clear form fields
    document.getElementById('login-username').value = '';
    document.getElementById('login-password').value = '';

  } catch (error) {
    renderToastAlert(error.response?.data?.message || "Login Failed", 'failed');
  }
}

async function handleLogout() {
  if (state.token) {
    try {
      await axios.post(`${API_BASE_URL}/logout`, {}, {
        headers: { 'Authorization': `Bearer ${state.token}` }
      });
    } catch (error) {
      renderToastAlert(error.response?.data?.message || "Logout Error", 'failed');
    } finally {
      clearAuthSession();
      updateNavigationUI();
      renderCreatePostWidget();
      refreshFeedForAuthChange();
      renderToastAlert("See you soon!");
    }
  }
}

// ==========================================
// FEED & POST SERVICE HANDLERS
// ==========================================

function createPostCardHTML(post) {
  const ownerActions = isPostOwner(post)
    ? `
    <div class="post-actions d-flex align-items-center gap-2">
  <span class="post-owner-label text-muted small d-none d-md-inline">
    Your post
  </span>

  <div class="btn-group post-action-group" role="group" aria-label="Post actions">
    <button
      type="button"
      class="btn btn-sm post-action-btn post-edit-btn"
      aria-label="Edit your post"
      title="Edit post"
      data-post-action="edit"
      data-post-id="${escapeHTML(post.id)}"
    >
      <i class="bi bi-pencil-square"></i>
      <span class="post-action-text">Edit</span>
    </button>

    <button
      type="button"
      class="btn btn-sm post-action-btn post-delete-btn"
      aria-label="Delete your post"
      title="Delete post"
      data-post-action="delete"
      data-post-id="${escapeHTML(post.id)}"
    >
      <i class="bi bi-trash3"></i>
      <span class="post-action-text">Delete</span>
    </button>
  </div>
</div>
  `
    : '';

  const titleHtml = post.title ? escapeHTML(post.title) : '';
  let imageHtml = '';

  if (post.image && typeof post.image === 'string' && post.image.trim() !== '' && post.image !== '[object Object]') {
    imageHtml = `
      <div class="mt-2 px-3 post-image-wrapper">
        <div class="rounded-3 overflow-hidden shadow-sm bg-black bg-opacity-25 d-flex justify-content-center align-items-center">
          <img src="${post.image}" 
               onerror="this.closest('.post-image-wrapper').style.display='none';" 
               alt="Post Banner" 
               class="w-100 d-block" 
               style="max-height: 380px; object-fit: contain;">
        </div>
      </div>
    `;
  }

  return `
    <article id="post-${post.id}" class="card border-0 shadow-sm rounded-4 overflow-hidden mb-4 bg-white">
  <div class="card-header bg-white border-0 d-flex align-items-center justify-content-between pt-3 px-3">
  <button type="button"
          class="btn p-0 border-0 bg-transparent d-flex align-items-center gap-2 author-link text-start"
          data-user-id="${escapeHTML(post.author.id)}"
          aria-label="View ${escapeHTML(post.author.name)}'s profile">
    <img src="${getAvatarUrl(post.author.profile_image)}"
         alt="avatar"
         class="rounded-circle border border-2 border-primary-subtle"
         style="width: 42px; height: 42px; object-fit: cover;"
         onerror="this.onerror=null;this.src='${FALLBACK_AVATAR}';">
    <div>
      <h6 class="mb-0 fw-bold text-dark fs-6">${escapeHTML(post.author.name)}</h6>
      <small class="text-muted" style="font-size: 0.75rem;">${escapeHTML(post.author.email)}</small>
    </div>
  </button>

  ${ownerActions}
</div>
  ${imageHtml}
  <div class="card-body px-3 pt-3 pb-2">
    <div class="d-flex align-items-center justify-content-between text-muted fs-7 mb-2 px-1">
      <span class="small"><i class="bi bi-clock me-1"></i>${escapeHTML(post.created_at)}</span>
    </div>
    <h5 class="fw-bold text-dark mt-2 mb-1">${titleHtml}</h5>
    <p class="text-secondary small mb-3">${escapeHTML(post.body)}</p>
    <hr class="text-secondary opacity-25 my-2">
    <div class="d-flex align-items-center justify-content-between pt-1">
      <div class="d-flex gap-1">
        <button onclick="PostId(${post.id})" class="btn btn-sm btn-light text-secondary rounded-pill px-3 fw-medium" data-bs-toggle="modal" data-bs-target="#CommentsModal">
          <i class="bi bi-chat me-1"></i> Comment <span class="badge bg-secondary-subtle text-secondary rounded-pill ms-1">${post.comments_count}</span>
        </button>
      </div>
    </div>
  </div>
</article>
  `;
}

function renderFeedLoadingSkeleton() {
  return `
    <div class="d-flex justify-content-center align-items-center py-5">
      <div class="pulse-loader">
        <div></div><div></div><div></div>
      </div>
    </div>
    <style>
      .pulse-loader { display: flex; align-items: center; gap: 8px; }
      .pulse-loader div {
        width: 12px; height: 12px; background-color: var(--bs-primary, #0d6efd);
        border-radius: 50%; animation: pulse-bounce 1.4s infinite ease-in-out both;
      }
      .pulse-loader div:nth-child(1) { animation-delay: -0.32s; }
      .pulse-loader div:nth-child(2) { animation-delay: -0.16s; }
      @keyframes pulse-bounce {
        0%, 80%, 100% { transform: scale(0); opacity: 0.3; }
        40% { transform: scale(1); opacity: 1; }
      }
    </style>
  `;
}

async function fetchAndRenderPosts(page = 1) {
  if (state.isLoading) return;
  state.isLoading = true;

  const postsContainer = document.getElementById('ins-post');
  const spinner = document.getElementById('loading-spinner');

  if (spinner) spinner.style.display = 'block';
  if (!postsContainer) return;

  if (page === 1) {
    postsContainer.innerHTML = renderFeedLoadingSkeleton();
  }

  try {
    const response = await axios.get(`${API_BASE_URL}/posts?limit=15&page=${page}`);
    const posts = response.data.data;
    state.lastPage = response.data.meta?.last_page || 1;

    const postsMarkup = posts.map(createPostCardHTML).join('');

    if (page === 1) {
      postsContainer.innerHTML = postsMarkup;
    } else {
      postsContainer.insertAdjacentHTML('beforeend', postsMarkup);
    }

    state.currentPage = page;

  } catch (error) {
    renderToastAlert(error.response?.data?.message || "Failed to load posts.", 'failed');
    if (page === 1) {
      postsContainer.innerHTML = `
        <div class="alert alert-danger text-center my-4" role="alert">
            Failed to load posts. Please try again later.
        </div>
      `;
    }
  } finally {
    state.isLoading = false;
    if (state.currentPage >= state.lastPage && spinner) {
      spinner.style.display = 'none';
    }
    if (state.refreshAfterLoad) {
      state.refreshAfterLoad = false;
      fetchAndRenderPosts(1);
    }
  }
}

async function handleSharePost() {
  const title = document.getElementById('Title').value.trim();
  const body = document.getElementById('Body').value.trim();
  const imageInput = document.getElementById('image');
  const imageFile = imageInput.files[0];

  if (!body && !title) {
    renderToastAlert("Please add a title or body to your post.", 'failed');
    return;
  }

  const formData = new FormData();
  formData.append('title', title);
  formData.append('body', body);
  if (imageFile) formData.append('image', imageFile);

  try {
    await axios.post(`${API_BASE_URL}/posts`, formData, {
      headers: {
        'Authorization': `Bearer ${state.token}`,
        'Content-Type': 'multipart/form-data'
      }
    });

    document.getElementById('Title').value = '';
    document.getElementById('Body').value = '';
    imageInput.value = '';

    closeModal('CreatePostModal');
    renderToastAlert("Post created successfully");
    fetchAndRenderPosts(1);

  } catch (error) {
    renderToastAlert(error.response?.data?.message || "Failed to create post", 'failed');
  }
}

async function openUpdatePost(postId) {
  const user = getStoredUser();

  // 1. Check login state first
  if (!state.token || !user?.id) {
    renderToastAlert('Please log in to edit a post.', 'failed');
    return;
  }

  try {
    // 2. Get the latest post data from the API
    const response = await axios.get(`${API_BASE_URL}/posts/${postId}`);
    const post = response.data.data;

    // 3. Check ownership for this specific post
    if (!post?.author?.id || String(post.author.id) !== String(user.id)) {
      renderToastAlert('You can edit only your own posts.', 'failed');
      return;
    }

    const updateModalContent = document.getElementById('Update-body');
    if (!updateModalContent) return;

    updateModalContent.innerHTML = `
      <form id="updatePostForm">
        <div class="mb-3">
          <label for="Title-1" class="form-label small fw-medium text-secondary">
            Title
          </label>
          <input
            type="text"
            class="form-control rounded-3"
            id="Title-1"
            placeholder="This is a title"
            value="${escapeHTML(post.title || '')}"
          >
        </div>

        <div class="mb-3">
          <label for="Body-1" class="form-label small fw-medium text-secondary">
            Body
          </label>
          <input
            type="text"
            class="form-control rounded-3"
            id="Body-1"
            placeholder="This is a body"
            value="${escapeHTML(post.body || '')}"
          >
        </div>

        <div class="mb-3">
          <label for="image-1" class="form-label small fw-medium text-body">
            Upload an image
          </label>
          <input type="file" class="form-control rounded-3" id="image-1">
        </div>

        <button
          type="submit"
          class="btn btn-primary w-100 rounded-3 py-2 fw-semibold mt-2"
          id="update-post"
        >
          Update post
        </button>
      </form>
    `;

    document.getElementById('updatePostForm').addEventListener('submit', async (event) => {
      event.preventDefault();

      const submitButton = document.getElementById('update-post');
      const title = document.getElementById('Title-1').value.trim();
      const body = document.getElementById('Body-1').value.trim();
      const imageInput = document.getElementById('image-1');

      if (!title && !body) {
        renderToastAlert('Please enter a title or post content.', 'failed');
        return;
      }

      const formData = new FormData();
      formData.append('title', title);
      formData.append('body', body);
      formData.append('_method', 'PUT');

      if (imageInput.files[0]) {
        formData.append('image', imageInput.files[0]);
      }

      try {
        submitButton.disabled = true;
        submitButton.innerHTML = `
          <span class="spinner-border spinner-border-sm me-2"></span>
          Updating...
        `;

        // 4. Update API request — backend still verifies authorization
        await axios.post(`${API_BASE_URL}/posts/${postId}`, formData, {
          headers: {
            Authorization: `Bearer ${state.token}`
          }
        });

        closeModal('UpdatePostModal');
        renderToastAlert('Post updated successfully.');
        fetchAndRenderPosts(1);
      } catch (error) {
        if (error.response?.status === 401) {
          clearAuthSession();
          updateNavigationUI();
          renderCreatePostWidget();
          fetchAndRenderPosts(1);
        }

        renderToastAlert(
          error.response?.data?.message || 'Could not update this post.',
          'failed'
        );
      } finally {
        submitButton.disabled = false;
        submitButton.textContent = 'Update post';
      }
    });

    // Open only after login + ownership checks pass
    bootstrap.Modal.getOrCreateInstance(
      document.getElementById('UpdatePostModal')
    ).show();

  } catch (error) {
    renderToastAlert(
      error.response?.data?.message || 'Could not load this post.',
      'failed'
    );
  }
}

async function openDeletePost(postId) {
  const post = await getOwnedPost(postId, 'delete');
  if (!post) return;

  const confirmButton = document.getElementById('confirm-delete-btn');
  if (!confirmButton) return;

  // Replace the old click handler each time a different post is selected.
  confirmButton.onclick = () => deletePost(postId);
  showModal('DeletePostModal');
}

async function deletePost(postId) {
  const ownedPost = await getOwnedPost(postId, 'delete');
  if (!ownedPost) {
    closeModal('DeletePostModal');
    return;
  }

  const confirmButton = document.getElementById('confirm-delete-btn');

  try {
    if (confirmButton) confirmButton.disabled = true;

    await axios.delete(`${API_BASE_URL}/posts/${postId}`, {
      headers: { Authorization: `Bearer ${state.token}` }
    });

    closeModal('DeletePostModal');
    renderToastAlert('Post deleted successfully.');
    fetchAndRenderPosts(1);
  } catch (error) {
    const message = getRequestErrorMessage(
      error,
      "You don't have permission to delete this post."
    );

    if (message) renderToastAlert(message, 'failed');
  } finally {
    if (confirmButton) confirmButton.disabled = false;
  }
}

// ==========================================
// COMMENTS SERVICE HANDLERS
// ==========================================

async function fetchAndRenderComments() {
  const commentsContainer = document.getElementById('Comment-body');
  if (!commentsContainer) return;

  // Render skeleton state
  commentsContainer.innerHTML = Array(3).fill(0).map(() => `
    <div class="d-flex gap-3 align-items-start p-2 placeholder-glow">
      <div class="placeholder rounded-circle bg-secondary-subtle flex-shrink-0" style="width: 38px; height: 38px;"></div>
      <div class="flex-grow-1">
        <div class="p-3 rounded-4 bg-body-tertiary">
          <span class="placeholder col-4 rounded mb-2 d-block"></span>
          <span class="placeholder col-10 rounded mb-1 d-block"></span>
          <span class="placeholder col-7 rounded d-block"></span>
        </div>
      </div>
    </div>
  `).join('');

  try {
    const response = await axios.get(`${API_BASE_URL}/posts/${state.currentPostId}`);
    const comments = response.data.data.comments || [];

    if (comments.length === 0) {
      commentsContainer.innerHTML = `
        <div class="text-center py-5 text-secondary">
          <i class="bi bi-chat-square-dots fs-1 d-block mb-2 text-secondary opacity-50"></i>
          <p class="fw-medium mb-1">No comments yet</p>
          <small class="text-muted">Be the first to share your thoughts!</small>
        </div>
      `;
      return;
    }

    commentsContainer.innerHTML = comments.map(comment => {
      const author = comment.author || {};
      const authorName = escapeHTML(author.name || author.username || 'Anonymous');
      const authorImg = (typeof author.profile_image === 'string' && author.profile_image.trim() !== '' && author.profile_image !== '[object Object]')
        ? author.profile_image
        : FALLBACK_AVATAR;

      return `
        <div class="d-flex gap-2.5 align-items-start mb-1">
          <img src="${authorImg}" alt="${authorName}" 
               class="rounded-circle border border-secondary-subtle flex-shrink-0 mt-1" 
               style="width: 36px; height: 36px; object-fit: cover;"
               onerror="this.onerror=null;this.src='${FALLBACK_AVATAR}';">
          <div class="flex-grow-1">
            <div class="bg-body-tertiary px-3 py-2 rounded-4 d-inline-block mw-100 border border-secondary-subtle shadow-sm">
              <h6 class="mb-0 fw-bold fs-7 text-body">${authorName}</h6>
              <p class="mb-0 text-body-secondary small text-break" style="white-space: pre-line; line-height: 1.4;">${escapeHTML(comment.body)}</p>
            </div>
          </div>
        </div>
      `;
    }).join('');

    commentsContainer.scrollTop = commentsContainer.scrollHeight;

  } catch (error) {
    commentsContainer.innerHTML = `
      <div class="alert alert-danger border-0 bg-danger-subtle text-danger text-center my-3 py-3 rounded-3 small" role="alert">
        <i class="bi bi-exclamation-triangle-fill me-2"></i> Failed to load comments.
      </div>
    `;
  }
}

function initializeCommentForm() {
  const commentForm = document.getElementById('addCommentForm');
  if (!commentForm) return;

  commentForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const commentInput = document.getElementById('comment');
    const commentSubmitBtn = document.getElementById('commentSubmitBtn');
    const commentText = commentInput.value.trim();

    if (!state.token) return renderToastAlert("Please log in to leave a comment.", 'failed');
    if (!state.currentPostId) return renderToastAlert("No post selected.", 'failed');
    if (!commentText) return renderToastAlert("Comment cannot be empty.", 'failed');

    try {
      commentSubmitBtn.disabled = true;
      const targetPostId = state.currentPostId;

      await axios.post(
        `${API_BASE_URL}/posts/${targetPostId}/comments`,
        { body: commentText },
        { headers: { Authorization: `Bearer ${state.token}` } }
      );

      commentInput.value = '';
      renderToastAlert("Comment posted successfully");

      // Update badge locally
      const postCard = document.getElementById(`post-${targetPostId}`);
      if (postCard) {
        const badge = postCard.querySelector('.badge');
        if (badge) badge.textContent = (parseInt(badge.textContent, 10) || 0) + 1;
      }

      closeModal('CommentsModal', () => {
        const postCard = document.getElementById(`post-${targetPostId}`);
        if (postCard) {
          postCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
          postCard.classList.add('comment-target');
          setTimeout(() => postCard.classList.remove('comment-target'), 1500);
        }
      });

    } catch (error) {
      renderToastAlert(error.response?.data?.message || "Failed to post comment", 'failed');
    } finally {
      commentSubmitBtn.disabled = false;
    }
  });
}

// ==========================================
// PROFILE PAGE ROUTER & RENDERER
// ==========================================

/**
 * Returns the userId from the current hash, or null when on the home route.
 * Supports:  #/        → home
 *            #/profile/:id → profile page
 */
function parseProfileRoute() {
  const hash = window.location.hash || '';
  const match = hash.match(/^#\/profile\/(\d+)/);
  return match ? match[1] : null;
}

// ==========================================
// PROFILE PAGE RENDERER
// ==========================================

function renderProfileHeader(user) {
  const name = escapeHTML(user.name || user.username || 'User');
  const username = escapeHTML(user.username || '');
  const email = escapeHTML(user.email || '');

  const postsCount =
    user.posts_count ?? user.postsCount ?? (Array.isArray(user.posts) ? user.posts.length : 0);
  const commentsCount =
    user.comments_count ?? user.commentsCount ?? 0;

  return `
    <div class="card border-0 shadow-sm rounded-4 mb-4 bg-body-tertiary overflow-hidden">
      <div class="card-body p-4">
        <div class="d-flex flex-column flex-sm-row align-items-center gap-4">
          <img src="${getAvatarUrl(user.profile_image)}"
               onerror="this.onerror=null;this.src='${FALLBACK_AVATAR}';"
               alt="${name}"
               class="rounded-circle border border-3 border-primary-subtle shadow-sm"
               style="width: 110px; height: 110px; object-fit: cover;">

          <div class="text-center text-sm-start flex-grow-1">
            <h3 class="fw-bold mb-1">${name}</h3>
            ${username ? `<p class="text-secondary mb-1"><i class="bi bi-at"></i> ${username}</p>` : ''}
            ${email ? `<p class="text-secondary small mb-3"><i class="bi bi-envelope"></i> ${email}</p>` : ''}

            <div class="d-flex gap-2 justify-content-center justify-content-sm-start flex-wrap">
              <span class="badge bg-primary-subtle text-primary rounded-pill px-3 py-2">
                <i class="bi bi-file-post me-1"></i>
                ${postsCount} ${postsCount === 1 ? 'Post' : 'Posts'}
              </span>
              <span class="badge bg-success-subtle text-success rounded-pill px-3 py-2">
                <i class="bi bi-chat-square-text me-1"></i>
                ${commentsCount} ${commentsCount === 1 ? 'Comment' : 'Comments'}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;
}

function renderProfilePosts(posts, user) {
  if (!posts.length) {
    return `
      <div class="text-center py-5 text-secondary">
        <i class="bi bi-file-post fs-1 d-block mb-2 opacity-50"></i>
        <p class="fw-medium mb-1">No posts yet</p>
        <small class="text-muted">
          When ${escapeHTML(user.name || 'this user')} posts, it'll show up here.
        </small>
      </div>
    `;
  }

  return posts.map(createPostCardHTML).join('');
}

// ==========================================
// PROFILE PAGE RENDERER
// ==========================================

/**
 * Fetches ONE page of the feed and keeps only this author's posts.
 * Called on demand only — never in a loop.
 */
async function fetchProfileUser(userId) {
  const res = await axios.get(`${API_BASE_URL}/users/${userId}`);
  return res.data?.data || {};
}

/**
 * Fetches ALL of a single user's posts via the dedicated endpoint.
 * Safe to do in full because this is scoped to one user, not the whole feed.
 */
async function fetchAllUserPosts(userId) {
  const firstRes = await axios.get(`${API_BASE_URL}/users/${userId}/posts`, {
    params: { sortBy: 'created_at', orderBy: 'desc', page: 1 }
  });

  let posts = firstRes.data?.data || [];
  const lastPage = firstRes.data?.meta?.last_page || 1;

  if (lastPage > 1) {
    const requests = [];
    for (let p = 2; p <= lastPage; p++) {
      requests.push(
        axios.get(`${API_BASE_URL}/users/${userId}/posts`, {
          params: { sortBy: 'created_at', orderBy: 'desc', page: p }
        })
      );
    }
    const responses = await Promise.all(requests);
    responses.forEach(res => {
      const pagePosts = res.data?.data || [];
      posts = posts.concat(pagePosts);
    });
  }

  return posts;
}

async function renderProfilePage(userId) {
  const postsContainer = document.getElementById('ins-post');
  const addPostContainer = document.getElementById('AddPostContainer');
  const spinner = document.getElementById('loading-spinner');
  if (!postsContainer) return;

  if (addPostContainer) addPostContainer.innerHTML = '';
  if (spinner) spinner.style.display = 'none';
  postsContainer.innerHTML = renderFeedLoadingSkeleton();

  try {
    // 2 requests to start (user + posts page 1), plus one per extra page —
    // bounded by this user's own post count, not the whole site.
    const [user, posts] = await Promise.all([
      fetchProfileUser(userId),
      fetchAllUserPosts(userId)
    ]);

    user.posts_count = user.posts_count ?? user.postsCount ?? posts.length;

    postsContainer.innerHTML = `
      ${renderProfileHeader(user)}
      <div class="d-flex align-items-center justify-content-between mb-3 px-1">
        <h5 class="fw-bold mb-0">
          <i class="bi bi-collection-fill text-primary me-2"></i>
          ${escapeHTML(user.name || user.username || 'User')}'s Posts
        </h5>
        <span class="text-secondary small">
          ${posts.length} ${posts.length === 1 ? 'post' : 'posts'}
        </span>
      </div>
      <div id="profile-posts-feed">${renderProfilePosts(posts, user)}</div>
    `;

    state.profileUserId = userId;
    window.scrollTo({ top: 0, behavior: 'smooth' });

  } catch (error) {
    const status = error.response?.status;
    const message =
      status === 404
        ? 'This user does not exist.'
        : status === 429
          ? 'Too many requests — please wait a moment and try again.'
          : error.response?.data?.message || 'Could not load this profile.';

    postsContainer.innerHTML = `
      <div class="alert alert-danger text-center my-4 rounded-3" role="alert">
        <i class="bi bi-exclamation-triangle-fill me-2"></i>${escapeHTML(message)}
      </div>
      <div class="text-center">
        <a href="#/" class="btn btn-primary rounded-pill px-4">
          <i class="bi bi-house-door me-1"></i> Back to Home
        </a>
      </div>
    `;
  }
}

/**
 * Central hash router. Called on load and on every hashchange.
 */
async function handleProfilePage() {
  const userId = parseProfileRoute();
  const homeLink = document.getElementById('home-nav-link');
  const profileLink = document.getElementById('profile-nav-link');

  if (!userId) {
    // -------- HOME ROUTE --------
    state.currentRoute = 'home';
    homeLink?.classList.add('active');
    profileLink?.classList.remove('active');
    renderCreatePostWidget();
    fetchAndRenderPosts(1);
    return;
  }

  // -------- PROFILE ROUTE --------
  state.currentRoute = 'profile';
  homeLink?.classList.remove('active');
  profileLink?.classList.add('active');
  await renderProfilePage(userId);
}

// ==========================================
// SCROLL & GLOBAL EVENT LISTENERS
// ==========================================

function attachGlobalEventListeners() {
  const registerBtn = document.getElementById('register');
  const loginBtn = document.getElementById('login');
  const createPostBtn = document.getElementById('create-post');
  const backToTopBtn = document.getElementById('backToTopBtn');

  if (registerBtn) registerBtn.addEventListener('click', handleRegister);
  if (loginBtn) loginBtn.addEventListener('click', handleLogin);
  if (createPostBtn) createPostBtn.addEventListener('click', handleSharePost);

  // ---- Hash routing ----
  window.addEventListener('hashchange', handleProfilePage);

  // ---- Infinite scroll (home feed only) ----
  window.addEventListener('scroll', () => {
    if (state.currentRoute === 'profile') return;

    const reachedBottom =
      window.innerHeight + window.scrollY >=
      document.documentElement.scrollHeight - 350;

    if (reachedBottom && !state.isLoading && state.currentPage < state.lastPage) {
      fetchAndRenderPosts(state.currentPage + 1);
    }
  });

  // ---- Back to top ----
  if (backToTopBtn) {
    window.addEventListener('scroll', () => {
      backToTopBtn.classList.toggle('show', window.scrollY > 400);
    });
    backToTopBtn.addEventListener('click', () => {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }

  const postsContainer = document.getElementById('ins-post');
  if (postsContainer) {
    postsContainer.addEventListener('click', (event) => {
      // --- Author click → go to that user's profile ---
      const authorBtn = event.target.closest('.author-link');
      if (authorBtn) {
        const authorId = authorBtn.dataset.userId;
        if (authorId) {
          const me = getAuthenticatedUser();
          const isMe = me && String(me.id) === String(authorId);

          // Anyone can view any profile.
          // If it's the signed-in user, no issue.
          // If it's someone else, we still allow it.
          window.location.hash = `#/profile/${authorId}`;
        }
        return;
      }

      // --- Post owner actions (edit / delete) ---
      const actionBtn = event.target.closest('[data-post-action]');
      if (!actionBtn) return;

      const postId = actionBtn.dataset.postId;
      if (!postId) {
        renderToastAlert('No post was selected.', 'failed');
        return;
      }

      if (actionBtn.dataset.postAction === 'edit') openUpdatePost(postId);
      if (actionBtn.dataset.postAction === 'delete') openDeletePost(postId);
    });
  }
}

// ==========================================
// APPLICATION INITIALIZATION ENTRY POINT
// ==========================================

document.addEventListener('DOMContentLoaded', () => {
  renderAppSkeleton();
  toggleTheme();
  updateNavigationUI();
  renderCreatePostWidget();
  initializeCommentForm();
  attachGlobalEventListeners();

  // Decide initial route from the hash
  if (!window.location.hash) {
    window.location.hash = '#/';      // fires hashchange → handleProfilePage()
  } else {
    handleProfilePage();              // deep-link into a profile
  }
});