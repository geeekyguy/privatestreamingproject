// Global Application State
let sessionToken = localStorage.getItem('session_token') || '';
let username = localStorage.getItem('username') || '';
let currentPath = [{ id: 'root', name: 'My Drive' }];
let isRegisterMode = false;
let isSearchMode = false;

// Watch Party State
let roomId = '';
let wsConn = null;
let isRemoteEvent = false; // Flag to prevent event loops on sync events
let isHandlingPopState = false; // Prevent popstate cycle updates

// Audio/Video tracking for sync
let progressSyncInterval = null;
let activeFileId = null;
let activeFileName = null;

// DOM Elements
const loginContainer = document.getElementById('loginContainer');
const googleAuthContainer = document.getElementById('googleAuthContainer');
const explorerContainer = document.getElementById('explorerContainer');
const fileGrid = document.getElementById('fileGrid');
const loader = document.getElementById('loader');
const loaderText = document.getElementById('loaderText');
const emptyState = document.getElementById('emptyState');
const emptyStateTitle = document.getElementById('emptyStateTitle');
const emptyStateText = document.getElementById('emptyStateText');
const breadcrumbs = document.getElementById('breadcrumbs');
const userGreeting = document.getElementById('userGreeting');

// YouTube Dashboard Sections DOM Elements
const searchContainer = document.getElementById('searchContainer');
const searchInput = document.getElementById('searchInput');
const clearSearchBtn = document.getElementById('clearSearchBtn');
const continueWatchingSection = document.getElementById('continueWatchingSection');
const continueWatchingGrid = document.getElementById('continueWatchingGrid');
const recentlyWatchedSection = document.getElementById('recentlyWatchedSection');
const recentlyWatchedGrid = document.getElementById('recentlyWatchedGrid');
const filesListHeader = document.getElementById('filesListHeader');
const explorerTitle = document.getElementById('explorerTitle');

// Watch Party DOM Elements
const watchPartyCard = document.getElementById('watchPartyCard');
const createRoomBtn = document.getElementById('createRoomBtn');
const joinRoomInput = document.getElementById('joinRoomInput');
const joinRoomBtn = document.getElementById('joinRoomBtn');
const roomCreationArea = document.getElementById('roomCreationArea');
const roomActiveArea = document.getElementById('roomActiveArea');
const activeRoomCode = document.getElementById('activeRoomCode');
const copyRoomCodeBtn = document.getElementById('copyRoomCodeBtn');
const activeRoomMembers = document.getElementById('activeRoomMembers');
const leaveRoomBtn = document.getElementById('leaveRoomBtn');
const partySyncStatus = document.getElementById('partySyncStatus');
const youtubeUrlInput = document.getElementById('youtubeUrlInput');
const streamYoutubeBtn = document.getElementById('streamYoutubeBtn');

const connectGoogleHeaderBtn = document.getElementById('connectGoogleHeaderBtn');
const googleConnectBanner = document.getElementById('googleConnectBanner');
const connectGoogleBannerBtn = document.getElementById('connectGoogleBannerBtn');

// Buttons
const disconnectGoogleBtn = document.getElementById('disconnectGoogleBtn');
const logoutBtn = document.getElementById('logoutBtn');
const connectGoogleBtn = document.getElementById('connectGoogleBtn');

// Auth Form Elements
const authForm = document.getElementById('authForm');
const usernameInput = document.getElementById('usernameInput');
const passwordInput = document.getElementById('passwordInput');
const authSubmitBtn = document.getElementById('authSubmitBtn');
const authTitle = document.getElementById('authTitle');
const authSubtitle = document.getElementById('authSubtitle');
const authErrorMsg = document.getElementById('authErrorMsg');
const toggleAuthMode = document.getElementById('toggleAuthMode');
const toggleText = document.getElementById('toggleText');

// Forgot Password / Registration security questions DOM
const registerFields = document.getElementById('registerFields');
const securityQuestionInput = document.getElementById('securityQuestionInput');
const securityAnswerInput = document.getElementById('securityAnswerInput');
const forgotPasswordLink = document.getElementById('forgotPasswordLink');
const forgotPasswordLinkContainer = document.getElementById('forgotPasswordLinkContainer');

const forgotPasswordForm = document.getElementById('forgotPasswordForm');
const forgotStep1 = document.getElementById('forgotStep1');
const forgotStep2 = document.getElementById('forgotStep2');
const forgotUsernameInput = document.getElementById('forgotUsernameInput');
const forgotNextBtn = document.getElementById('forgotNextBtn');
const forgotQuestionLabel = document.getElementById('forgotQuestionLabel');
const forgotAnswerInput = document.getElementById('forgotAnswerInput');
const forgotNewPasswordInput = document.getElementById('forgotNewPasswordInput');
const forgotSubmitBtn = document.getElementById('forgotSubmitBtn');
const forgotErrorMsg = document.getElementById('forgotErrorMsg');

const googleSignInBtn = document.getElementById('googleSignInBtn');
const googleSignInContainer = document.getElementById('googleSignInContainer');

// Video Player DOM Elements
const videoModal = document.getElementById('videoModal');
const videoPlayer = document.getElementById('videoPlayer');
const modalVideoTitle = document.getElementById('modalVideoTitle');
const closeVideoBtn = document.getElementById('closeVideoBtn');
const customPlayerBody = document.querySelector('.custom-player-body');

// Custom Controller DOM Elements
const customPlayBtn = document.getElementById('customPlayBtn');
const playIconSvg = document.getElementById('playIconSvg');
const pauseIconSvg = document.getElementById('pauseIconSvg');
const customSeekBar = document.getElementById('customSeekBar');
const customVolumeBar = document.getElementById('customVolumeBar');
const customMuteBtn = document.getElementById('customMuteBtn');
const customTimeLabel = document.getElementById('customTimeLabel');
const customSpeedSelect = document.getElementById('customSpeedSelect');
const playerCenterPlay = document.getElementById('playerCenterPlay');

const customSkipBackBtn = document.getElementById('customSkipBackBtn');
const customSkipForwardBtn = document.getElementById('customSkipForwardBtn');
const playArrowOverlay = playerCenterPlay.querySelector('.play-arrow-overlay');

const customTheaterBtn = document.getElementById('customTheaterBtn');
const customFullscreenBtn = document.getElementById('customFullscreenBtn');
const fullscreenEnterSvg = document.getElementById('fullscreenEnterSvg');
const fullscreenExitSvg = document.getElementById('fullscreenExitSvg');
const videoModalContainer = document.querySelector('.video-modal-container');

// Event Listeners
toggleAuthMode.addEventListener('click', handleToggleAuthMode);
authForm.addEventListener('submit', handleAuthSubmit);
connectGoogleBtn.addEventListener('click', handleConnectGoogle);
disconnectGoogleBtn.addEventListener('click', handleDisconnectGoogle);
logoutBtn.addEventListener('click', handleLogout);
closeVideoBtn.addEventListener('click', closeVideoPlayer);
document.querySelector('.video-modal-backdrop').addEventListener('click', closeVideoPlayer);

// Search Bar Event Listeners
searchInput.addEventListener('keydown', handleSearchKeydown);
searchInput.addEventListener('input', handleSearchInput);
clearSearchBtn.addEventListener('click', handleClearSearch);

// Watch Party Controls Event Listeners
createRoomBtn.addEventListener('click', handleCreateRoom);
joinRoomBtn.addEventListener('click', handleJoinRoom);
leaveRoomBtn.addEventListener('click', handleLeaveRoom);
copyRoomCodeBtn.addEventListener('click', handleCopyRoomCode);
streamYoutubeBtn.addEventListener('click', handleStreamYoutube);

connectGoogleHeaderBtn.addEventListener('click', handleConnectGoogle);
connectGoogleBannerBtn.addEventListener('click', handleConnectGoogle);

forgotPasswordLink.addEventListener('click', handleToggleForgotPassword);
forgotNextBtn.addEventListener('click', handleForgotNext);
forgotPasswordForm.addEventListener('submit', handleForgotSubmit);
googleSignInBtn.addEventListener('click', handleGoogleSignInClick);

// Custom Player Event Listeners
customPlayBtn.addEventListener('click', togglePlayPause);
playerCenterPlay.addEventListener('click', togglePlayPause);
customSkipBackBtn.addEventListener('click', handleSkipBack);
customSkipForwardBtn.addEventListener('click', handleSkipForward);
videoPlayer.addEventListener('play', handleVideoPlay);
videoPlayer.addEventListener('pause', handleVideoPause);
videoPlayer.addEventListener('timeupdate', handleVideoTimeUpdate);
videoPlayer.addEventListener('durationchange', handleVideoTimeUpdate);
customSeekBar.addEventListener('input', handleSeekBarInput);
customVolumeBar.addEventListener('input', handleVolumeBarInput);
customMuteBtn.addEventListener('click', toggleMute);
customSpeedSelect.addEventListener('change', handleSpeedSelectChange);
customTheaterBtn.addEventListener('click', toggleTheaterMode);
customFullscreenBtn.addEventListener('click', toggleFullscreenMode);
document.addEventListener('fullscreenchange', handleFullscreenChange);

// Initialize App
window.addEventListener('DOMContentLoaded', init);

async function init() {
    // 1. Capture query credentials from direct Google Login redirect
    const urlParams = new URLSearchParams(window.location.search);
    const loginTokenParam = urlParams.get('loginToken');
    const usernameParam = urlParams.get('username');

    if (loginTokenParam && usernameParam) {
        sessionToken = loginTokenParam;
        username = usernameParam;
        localStorage.setItem('session_token', sessionToken);
        localStorage.setItem('username', username);
        // Clear URL query parameters cleanly
        window.history.replaceState({}, document.title, window.location.pathname);
    }

    if (!sessionToken) {
        showScreen('login');
        searchContainer.style.display = 'none';
        watchPartyCard.classList.add('hidden');
        return;
    }

    userGreeting.textContent = `Hello, ${username}`;
    logoutBtn.style.display = 'block';

    // Verify Session and Google Auth Status
    try {
        const response = await fetch('/api/auth-status', {
            headers: { 'Authorization': `Bearer ${sessionToken}` }
        });

        if (response.status === 401) {
            clearLocalSession();
            showScreen('login');
            searchContainer.style.display = 'none';
            watchPartyCard.classList.add('hidden');
            return;
        }

        const data = await response.json();
        
        showScreen('explorer');
        watchPartyCard.classList.remove('hidden');

        if (!data.authenticated) {
            disconnectGoogleBtn.style.display = 'none';
            connectGoogleHeaderBtn.style.display = 'block';
            searchContainer.style.display = 'none';
            googleConnectBanner.classList.remove('hidden');
            
            // Hide library components
            document.querySelector('.breadcrumb-bar').classList.add('hidden');
            filesListHeader.classList.add('hidden');
            fileGrid.innerHTML = '';
            continueWatchingSection.classList.add('hidden');
            recentlyWatchedSection.classList.add('hidden');
        } else {
            disconnectGoogleBtn.style.display = 'block';
            connectGoogleHeaderBtn.style.display = 'none';
            searchContainer.style.display = 'flex';
            googleConnectBanner.classList.add('hidden');
            
            document.querySelector('.breadcrumb-bar').classList.remove('hidden');
            filesListHeader.classList.remove('hidden');
            
            // Restore URL state on page reload
            const urlParams = new URLSearchParams(window.location.search);
            const watchId = urlParams.get('watch');
            const folderId = urlParams.get('folderId');
            
            if (watchId) {
                const name = urlParams.get('name') || 'Video Player';
                const isYT = urlParams.get('isYouTube') === 'true';
                const underlyingFolder = folderId || 'root';
                
                loadDirectory(underlyingFolder, false);
                openVideoPlayer(watchId, name, false, isYT, false);
            } else if (folderId) {
                loadDirectory(folderId, false);
            } else {
                loadDirectory('root', true);
            }
        }
    } catch (err) {
        console.error('Initial verification error:', err);
        clearLocalSession();
        showScreen('login');
        searchContainer.style.display = 'none';
        watchPartyCard.classList.add('hidden');
    }
}

// Toggle between Login and Register Mode
function handleToggleAuthMode(e) {
    e.preventDefault();
    
    if (isForgotPasswordMode) {
        isForgotPasswordMode = false;
        handleToggleForgotPassword();
        return;
    }

    isRegisterMode = !isRegisterMode;
    authErrorMsg.classList.add('hidden');
    
    if (isRegisterMode) {
        authTitle.textContent = 'Sign Up';
        authSubtitle.textContent = 'Create a secure account to stream your Google Drive video library.';
        authSubmitBtn.textContent = 'Register Account';
        toggleText.textContent = 'Already have an account?';
        toggleAuthMode.textContent = 'Sign In';
        
        registerFields.classList.remove('hidden');
        forgotPasswordLinkContainer.classList.add('hidden');
        googleSignInContainer.classList.add('hidden');
        securityQuestionInput.required = true;
        securityAnswerInput.required = true;
    } else {
        authTitle.textContent = 'Sign In';
        authSubtitle.textContent = 'Log in to browse your private video stream dashboard.';
        authSubmitBtn.textContent = 'Sign In';
        toggleText.textContent = "Don't have an account?";
        toggleAuthMode.textContent = 'Sign Up';
        
        registerFields.classList.add('hidden');
        forgotPasswordLinkContainer.classList.remove('hidden');
        googleSignInContainer.classList.remove('hidden');
        securityQuestionInput.required = false;
        securityAnswerInput.required = false;
    }
}

// Submit Authentication Request (Register / Login)
async function handleAuthSubmit(e) {
    e.preventDefault();
    const userVal = usernameInput.value.trim();
    const passVal = passwordInput.value;

    const endpoint = isRegisterMode ? '/api/register' : '/api/login';
    
    const bodyObj = { username: userVal, password: passVal };
    if (isRegisterMode) {
        bodyObj.securityQuestion = securityQuestionInput.value;
        bodyObj.securityAnswer = securityAnswerInput.value.trim();
    }

    try {
        const response = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(bodyObj)
        });

        const data = await response.json();
        if (!response.ok) {
            throw new Error(data.error || 'Authentication request failed');
        }

        sessionToken = data.token;
        username = data.username;
        localStorage.setItem('session_token', sessionToken);
        localStorage.setItem('username', username);

        authErrorMsg.classList.add('hidden');
        usernameInput.value = '';
        passwordInput.value = '';
        securityQuestionInput.value = '';
        securityAnswerInput.value = '';

        init();
    } catch (err) {
        authErrorMsg.textContent = err.message;
        authErrorMsg.classList.remove('hidden');
    }
}

// Forgot Password recovery state handlers
let isForgotPasswordMode = false;

function handleToggleForgotPassword(e) {
    if (e) e.preventDefault();
    isForgotPasswordMode = !isForgotPasswordMode;
    
    forgotErrorMsg.classList.add('hidden');
    authErrorMsg.classList.add('hidden');
    
    if (isForgotPasswordMode) {
        authTitle.textContent = 'Forgot Password';
        authSubtitle.textContent = 'Recover your account password using security question verification.';
        
        authForm.classList.add('hidden');
        forgotPasswordForm.classList.remove('hidden');
        
        forgotStep1.classList.remove('hidden');
        forgotStep2.classList.add('hidden');
        forgotUsernameInput.value = '';
        googleSignInContainer.classList.add('hidden');
        
        toggleText.textContent = 'Remembered your password?';
        toggleAuthMode.textContent = 'Sign In';
        isRegisterMode = false;
    } else {
        authTitle.textContent = 'Sign In';
        authSubtitle.textContent = 'Log in to browse your private video stream dashboard.';
        
        authForm.classList.remove('hidden');
        forgotPasswordForm.classList.add('hidden');
        googleSignInContainer.classList.remove('hidden');
        
        toggleText.textContent = "Don't have an account?";
        toggleAuthMode.textContent = 'Sign Up';
        isRegisterMode = false;
    }
}

async function handleGoogleSignInClick() {
    try {
        const response = await fetch('/api/google-login-url');
        const data = await response.json();
        if (data.url) {
            window.location.href = data.url;
        }
    } catch (err) {
        console.error('Google Sign In URL fetching failed:', err);
        authErrorMsg.textContent = 'Failed to fetch Google Sign In URL. Ensure server is configured.';
        authErrorMsg.classList.remove('hidden');
    }
}

async function handleForgotNext() {
    const userVal = forgotUsernameInput.value.trim();
    if (!userVal) {
        forgotErrorMsg.textContent = 'Please enter your username';
        forgotErrorMsg.classList.remove('hidden');
        return;
    }
    
    forgotErrorMsg.classList.add('hidden');
    
    try {
        const response = await fetch('/api/forgot-password/question', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: userVal })
        });
        const data = await response.json();
        if (!response.ok) {
            throw new Error(data.error || 'Failed to retrieve security question');
        }
        
        forgotQuestionLabel.textContent = `Security Question: ${data.question}`;
        forgotStep1.classList.add('hidden');
        forgotStep2.classList.remove('hidden');
        forgotAnswerInput.value = '';
        forgotNewPasswordInput.value = '';
    } catch (err) {
        forgotErrorMsg.textContent = err.message;
        forgotErrorMsg.classList.remove('hidden');
    }
}

async function handleForgotNewPasswordChange() {
    // optional validation helper
}

async function handleForgotSubmit(e) {
    e.preventDefault();
    const userVal = forgotUsernameInput.value.trim();
    const answerVal = forgotAnswerInput.value.trim();
    const newPassVal = forgotNewPasswordInput.value;
    
    forgotErrorMsg.classList.add('hidden');
    
    try {
        const response = await fetch('/api/forgot-password/reset', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                username: userVal,
                securityAnswer: answerVal,
                newPassword: newPassVal
            })
        });
        const data = await response.json();
        if (!response.ok) {
            throw new Error(data.error || 'Failed to reset password');
        }
        
        alert('Password reset successful! Please sign in with your new password.');
        isForgotPasswordMode = false;
        handleToggleForgotPassword();
    } catch (err) {
        forgotErrorMsg.textContent = err.message;
        forgotErrorMsg.classList.remove('hidden');
    }
}

// Clear state and cache
function clearLocalSession() {
    sessionToken = '';
    username = '';
    localStorage.removeItem('session_token');
    localStorage.removeItem('username');
    userGreeting.textContent = '';
    logoutBtn.style.display = 'none';
    disconnectGoogleBtn.style.display = 'none';
    handleLeaveRoom();
}

// Redirect to Google Consent Page
async function handleConnectGoogle() {
    try {
        const response = await fetch(`/api/auth-url?sessionToken=${encodeURIComponent(sessionToken)}`);
        const data = await response.json();
        if (data.url) {
            window.location.href = data.url;
        } else {
            alert('Failed to obtain Google authentication URL.');
        }
    } catch (err) {
        console.error('Error fetching Google auth URL:', err);
        alert('Network error connecting to authentication service.');
    }
}

// Disconnect Google Drive integration
async function handleDisconnectGoogle() {
    if (confirm('Disconnect Google Drive from your profile? You will need to log in again to view your files.')) {
        try {
            await fetch('/api/google-disconnect', {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${sessionToken}` }
            });
            window.location.reload();
        } catch (err) {
            console.error('Failed to disconnect Google account:', err);
        }
    }
}

// Log out user
async function handleLogout() {
    try {
        await fetch('/api/session-logout', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${sessionToken}` }
        });
    } catch (err) {
        console.error('Logout API failure:', err);
    }
    clearLocalSession();
    window.location.reload();
}

// Show/Hide Screens
function showScreen(screen) {
    loginContainer.classList.add('hidden');
    googleAuthContainer.classList.add('hidden');
    explorerContainer.classList.add('hidden');

    if (screen === 'login') {
        loginContainer.classList.remove('hidden');
    } else if (screen === 'google') {
        googleAuthContainer.classList.remove('hidden');
    } else if (screen === 'explorer') {
        explorerContainer.classList.remove('hidden');
    }
}

// ================= WATCH PARTY ROOM COORDINATION =================

function handleCreateRoom() {
    // Generate 6-char room code
    const generatedCode = Math.random().toString(36).substring(2, 8).toUpperCase();
    connectToWatchParty(generatedCode);
}

function handleJoinRoom() {
    const code = joinRoomInput.value.trim().toUpperCase();
    if (code.length === 0) {
        alert('Please enter a room code.');
        return;
    }
    connectToWatchParty(code);
}

function handleLeaveRoom() {
    if (wsConn) {
        wsConn.close();
        wsConn = null;
    }
    roomId = '';
    partySyncStatus.classList.add('hidden');
    roomCreationArea.classList.remove('hidden');
    roomActiveArea.classList.add('hidden');
    joinRoomInput.value = '';
}

function handleCopyRoomCodeBtn() {
    handleCopyRoomCode();
}

function handleCopyRoomCode() {
    if (roomId) {
        navigator.clipboard.writeText(roomId).then(() => {
            alert('Room code copied to clipboard!');
        }).catch(err => {
            console.error('Failed to copy room code:', err);
        });
    }
}

// Connect to WebSocket Server and synchronize room
function connectToWatchParty(targetRoomId) {
    if (wsConn) {
        wsConn.close();
    }

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/?sessionToken=${encodeURIComponent(sessionToken)}&roomId=${encodeURIComponent(targetRoomId)}`;
    
    wsConn = new WebSocket(wsUrl);

    wsConn.onopen = () => {
        roomId = targetRoomId;
        activeRoomCode.textContent = roomId;
        partySyncStatus.classList.remove('hidden');
        roomCreationArea.classList.add('hidden');
        roomActiveArea.classList.remove('hidden');
        console.log(`Connected to Watch Party Room: ${roomId}`);
    };

    wsConn.onmessage = (e) => {
        try {
            const data = JSON.parse(e.data);
            
            if (data.type === 'participants') {
                activeRoomMembers.textContent = data.list.join(', ');
            } else if (data.type === 'sync') {
                handleRemoteSyncEvent(data);
            }
        } catch (err) {
            console.error('WebSocket receive parse error:', err);
        }
    };

    wsConn.onclose = () => {
        console.log('Watch Party WebSocket disconnected.');
        handleLeaveRoom();
    };

    wsConn.onerror = (err) => {
        console.error('Watch Party WebSocket error:', err);
    };
}

// Helper: Broadcast sync message to room peers
function sendPartySync(action, time, speed = 1.0, youtubeId = null) {
    if (!wsConn || wsConn.readyState !== WebSocket.OPEN) return;
    
    const payload = {
        type: 'sync',
        action: action,
        time: time,
        speed: speed
    };
    
    // Add file details for 'load' / 'load_youtube' action
    if (action === 'load') {
        payload.fileId = activeFileId;
        payload.name = activeFileName;
    } else if (action === 'load_youtube') {
        payload.youtubeId = youtubeId;
        payload.name = 'YouTube Stream';
    }
    
    wsConn.send(JSON.stringify(payload));
}

// Stream YouTube video to room
function handleStreamYoutube() {
    const url = youtubeUrlInput.value.trim();
    if (!url) {
        alert('Please paste a YouTube video URL first!');
        return;
    }
    const yId = extractYoutubeId(url);
    if (!yId) {
        alert('Could not parse YouTube video ID from URL.');
        return;
    }
    youtubeUrlInput.value = '';
    if (roomId) {
        sendPartySync('load_youtube', 0, 1.0, yId);
    }
    openVideoPlayer(yId, 'YouTube Stream', false, true);
}

function extractYoutubeId(url) {
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
    const match = url.match(regExp);
    return (match && match[2].length === 11) ? match[2] : null;
}

// Handle real-time control events received from peers
function handleRemoteSyncEvent(data) {
    isRemoteEvent = true;
    
    if (data.action === 'load') {
        // Load video for guest
        console.log(`Remote Load triggered: ${data.name}`);
        openVideoPlayer(data.fileId, data.name, true, false);
        return;
    } else if (data.action === 'load_youtube') {
        // Load YouTube stream for guest
        console.log(`Remote YouTube Load triggered: ${data.name}`);
        openVideoPlayer(data.youtubeId, data.name, true, true);
        return;
    }

    // If currently watching YouTube, the iframe embed handles its own sync coordinates
    const ytIframe = document.getElementById('youtubePlayerIframe');
    if (ytIframe && !ytIframe.classList.contains('hidden')) {
        return;
    }
    
    if (data.action === 'play') {
        // Play video
        console.log(`Remote Play from ${data.sender}`);
        if (Math.abs(videoPlayer.currentTime - data.time) > 1.5) {
            videoPlayer.currentTime = data.time;
        }
        videoPlayer.play().catch(e => console.log('Autoplay sync blocked:', e));
    } else if (data.action === 'pause') {
        // Pause video
        console.log(`Remote Pause from ${data.sender}`);
        videoPlayer.pause();
        videoPlayer.currentTime = data.time;
    } else if (data.action === 'seek') {
        // Seek video
        console.log(`Remote Seek to ${data.time} from ${data.sender}`);
        videoPlayer.currentTime = data.time;
    } else if (data.action === 'speed') {
        // Change speed
        console.log(`Remote Speed to ${data.speed} from ${data.sender}`);
        videoPlayer.playbackRate = data.speed;
        customSpeedSelect.value = data.speed.toString();
    }
    
    // Reset remote flag after giving events time to dispatch
    setTimeout(() => {
        isRemoteEvent = false;
    }, 150);
}

// ================= CUSTOM HTML5 CONTROLLER FOR NATIVE FEEL =================

function togglePlayPause() {
    if (videoPlayer.paused) {
        videoPlayer.play();
    } else {
        videoPlayer.pause();
    }
}

function handleSkipBack() {
    videoPlayer.currentTime = Math.max(0, videoPlayer.currentTime - 30);
    if (roomId) {
        sendPartySync('seek', videoPlayer.currentTime);
    }
}

function handleSkipForward() {
    videoPlayer.currentTime = Math.min(videoPlayer.duration || 0, videoPlayer.currentTime + 30);
    if (roomId) {
        sendPartySync('seek', videoPlayer.currentTime);
    }
}

function handleVideoPlay() {
    playIconSvg.classList.add('hidden');
    pauseIconSvg.classList.remove('hidden');
    customPlayerBody.classList.remove('is-paused');
    playArrowOverlay.classList.add('paused');
    
    // Sync Playback to Room
    if (roomId && !isRemoteEvent) {
        sendPartySync('play', videoPlayer.currentTime);
    }
}

function handleVideoPause() {
    playIconSvg.classList.remove('hidden');
    pauseIconSvg.classList.add('hidden');
    customPlayerBody.classList.add('is-paused');
    playArrowOverlay.classList.remove('paused');
    
    // Sync Playback to Room
    if (roomId && !isRemoteEvent) {
        sendPartySync('pause', videoPlayer.currentTime);
    }
}

function handleVideoTimeUpdate() {
    if (isNaN(videoPlayer.duration)) return;

    // Update timeline position
    const value = (videoPlayer.currentTime / videoPlayer.duration) * 100;
    customSeekBar.value = value;

    // Update time label text
    customTimeLabel.textContent = `${formatTime(videoPlayer.currentTime)} / ${formatTime(videoPlayer.duration)}`;
}

function handleSeekBarInput() {
    if (isNaN(videoPlayer.duration)) return;

    const time = (customSeekBar.value / 100) * videoPlayer.duration;
    
    isRemoteEvent = true;
    videoPlayer.currentTime = time;
    setTimeout(() => { isRemoteEvent = false; }, 100);

    // Sync Seek coordinates to Room
    if (roomId) {
        sendPartySync('seek', time);
    }
}

function handleVolumeBarInput() {
    const volume = customVolumeBar.value / 100;
    videoPlayer.volume = volume;
    videoPlayer.muted = false;
    
    // Update mute icon visual
    if (volume === 0) {
        customMuteBtn.textContent = '🔇';
    } else if (volume < 0.5) {
        customMuteBtn.textContent = '🔉';
    } else {
        customMuteBtn.textContent = '🔊';
    }
}

function toggleMute() {
    videoPlayer.muted = !videoPlayer.muted;
    if (videoPlayer.muted) {
        customMuteBtn.textContent = '🔇';
        customVolumeBar.value = 0;
    } else {
        customVolumeBar.value = Math.round(videoPlayer.volume * 100);
        customMuteBtn.textContent = videoPlayer.volume < 0.5 ? '🔉' : '🔊';
    }
}

function handleSpeedSelectChange() {
    const rate = parseFloat(customSpeedSelect.value);
    videoPlayer.playbackRate = rate;

    // Sync Speed changes to Room
    if (roomId && !isRemoteEvent) {
        sendPartySync('speed', videoPlayer.currentTime, rate);
    }
}

function toggleTheaterMode() {
    videoModalContainer.classList.toggle('theater-mode');
}

function toggleFullscreenMode() {
    if (!document.fullscreenElement) {
        customPlayerBody.requestFullscreen().catch(err => {
            console.error(`Error attempting to enable fullscreen mode: ${err.message}`);
        });
    } else {
        document.exitFullscreen();
    }
}

function handleFullscreenChange() {
    if (document.fullscreenElement) {
        fullscreenEnterSvg.classList.add('hidden');
        fullscreenExitSvg.classList.remove('hidden');
    } else {
        fullscreenEnterSvg.classList.remove('hidden');
        fullscreenExitSvg.classList.add('hidden');
    }
}

// Helper: Format seconds to time string (MM:SS or HH:MM:SS)
function formatTime(seconds) {
    if (isNaN(seconds)) return '0:00';
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);

    const formattedSecs = secs < 10 ? `0${secs}` : secs;
    if (hrs > 0) {
        const formattedMins = mins < 10 ? `0${mins}` : mins;
        return `${hrs}:${formattedMins}:${formattedSecs}`;
    }
    return `${mins}:${formattedSecs}`;
}

// ================= YOUTUBE SEARCH & DASHBOARD IMPLEMENTATION =================

// Search event triggers
function handleSearchKeydown(e) {
    if (e.key === 'Enter') {
        const query = searchInput.value.trim();
        if (query) {
            executeSearch(query);
        }
    }
}

function handleSearchInput() {
    if (searchInput.value.trim().length > 0) {
        clearSearchBtn.classList.remove('hidden');
    } else {
        clearSearchBtn.classList.add('hidden');
        if (isSearchMode) {
            handleClearSearch();
        }
    }
}

function handleClearSearch() {
    searchInput.value = '';
    clearSearchBtn.classList.add('hidden');
    isSearchMode = false;
    
    // Reload current directory
    const activeFolder = currentPath[currentPath.length - 1];
    loadDirectory(activeFolder.id);
}

// Execute Google Drive search across entire cloud storage
async function executeSearch(query) {
    isSearchMode = true;
    showScreen('explorer');
    fileGrid.innerHTML = '';
    emptyState.classList.add('hidden');
    
    // Hide horizontal scrolling rows during search
    continueWatchingSection.classList.add('hidden');
    recentlyWatchedSection.classList.add('hidden');
    
    filesListHeader.classList.remove('hidden');
    explorerTitle.textContent = `Search results for "${query}"`;
    
    loaderText.textContent = `Searching Google Drive for "${query}"...`;
    loader.classList.remove('hidden');

    try {
        const response = await fetch(`/api/search?query=${encodeURIComponent(query)}`, {
            headers: { 'Authorization': `Bearer ${sessionToken}` }
        });

        if (response.status === 401) {
            clearLocalSession();
            showScreen('login');
            return;
        }

        const data = await response.json();
        loader.classList.add('hidden');

        if (!response.ok) {
            throw new Error(data.error || 'Search failed');
        }

        renderFiles(data.files);

        if (!data.files || data.files.length === 0) {
            emptyStateTitle.textContent = 'No Search Results';
            emptyStateText.textContent = `We couldn't find any videos matching "${query}".`;
            emptyState.classList.remove('hidden');
        }
    } catch (err) {
        loader.classList.add('hidden');
        console.error('Search error:', err);
        fileGrid.innerHTML = `<div class="error-text" style="grid-column: 1/-1; text-align: center; padding: 2rem;">Error: ${err.message}</div>`;
    }
}

// Load continue watching and recently played lists
async function loadDashboard() {
    // Show only at root directory, hide during search
    if (currentPath.length > 1 || isSearchMode) {
        continueWatchingSection.classList.add('hidden');
        recentlyWatchedSection.classList.add('hidden');
        explorerTitle.textContent = 'Files & Folders';
        return;
    }

    try {
        const response = await fetch('/api/dashboard', {
            headers: { 'Authorization': `Bearer ${sessionToken}` }
        });

        if (!response.ok) return; // Silent ignore on auth errors

        const data = await response.json();
        
        // 1. Render Continue Watching
        if (data.continueWatching && data.continueWatching.length > 0) {
            continueWatchingGrid.innerHTML = '';
            data.continueWatching.forEach(item => {
                const card = document.createElement('div');
                card.className = 'file-item video';
                
                const percent = (item.currentTime / item.duration) * 100;
                
                card.innerHTML = `
                    <div class="icon-wrapper">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <polygon points="23 7 16 12 23 17 23 7"></polygon>
                            <rect x="1" y="5" width="15" height="14" rx="2" ry="2"></rect>
                        </svg>
                    </div>
                    <div class="item-info">
                        <div class="item-name" title="${escapeHtml(item.name)}">${escapeHtml(item.name)}</div>
                        <div class="progress-container">
                            <div class="progress-fill" style="width: ${percent}%;"></div>
                        </div>
                    </div>
                `;
                
                card.addEventListener('click', () => openVideoPlayer(item.fileId, item.name));
                continueWatchingGrid.appendChild(card);
            });
            continueWatchingSection.classList.remove('hidden');
        } else {
            continueWatchingSection.classList.add('hidden');
        }

        // 2. Render Recently Watched
        if (data.history && data.history.length > 0) {
            recentlyWatchedGrid.innerHTML = '';
            data.history.forEach(item => {
                const card = document.createElement('div');
                card.className = 'file-item video';
                
                card.innerHTML = `
                    <div class="icon-wrapper">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <polygon points="23 7 16 12 23 17 23 7"></polygon>
                            <rect x="1" y="5" width="15" height="14" rx="2" ry="2"></rect>
                        </svg>
                    </div>
                    <div class="item-info">
                        <div class="item-name" title="${escapeHtml(item.name)}">${escapeHtml(item.name)}</div>
                    </div>
                `;
                
                card.addEventListener('click', () => openVideoPlayer(item.fileId, item.name));
                recentlyWatchedGrid.appendChild(card);
            });
            recentlyWatchedSection.classList.remove('hidden');
        } else {
            recentlyWatchedSection.classList.add('hidden');
        }

        explorerTitle.textContent = 'Files & Folders';

    } catch (err) {
        console.error('Dashboard load failed:', err);
    }
}

// Fetch and Display Directory Contents
async function loadDirectory(folderId, pushHistory = true) {
    if (pushHistory && !isHandlingPopState) {
        let url = `?folderId=${folderId}`;
        if (isSearchMode && searchInput.value.trim()) {
            url += `&search=${encodeURIComponent(searchInput.value.trim())}`;
        }
        window.history.pushState({ folderId, currentPath, isSearchMode, searchVal: searchInput.value }, '', url);
    }

    showScreen('explorer');
    fileGrid.innerHTML = '';
    emptyState.classList.add('hidden');
    
    // Manage dashboard headers
    if (folderId === 'root' && !isSearchMode) {
        loadDashboard();
        filesListHeader.classList.remove('hidden');
    } else {
        continueWatchingSection.classList.add('hidden');
        recentlyWatchedSection.classList.add('hidden');
        filesListHeader.classList.add('hidden');
    }

    loaderText.textContent = 'Retrieving items from Google Drive...';
    loader.classList.remove('hidden');
    renderBreadcrumbs();

    try {
        const response = await fetch(`/api/files?parentId=${folderId}`, {
            headers: { 'Authorization': `Bearer ${sessionToken}` }
        });
        
        if (response.status === 401) {
            clearLocalSession();
            showScreen('login');
            return;
        }

        if (!response.ok) {
            const errData = await response.json();
            throw new Error(errData.error || 'Failed to list files');
        }

        const data = await response.json();
        loader.classList.add('hidden');
        renderFiles(data.files);

        if (!data.files || data.files.length === 0) {
            emptyStateTitle.textContent = 'No Media Files Found';
            emptyStateText.textContent = "This directory doesn't contain any folders or video files.";
            emptyState.classList.remove('hidden');
        }

    } catch (err) {
        loader.classList.add('hidden');
        console.error('Error fetching files:', err);
        fileGrid.innerHTML = `<div class="error-text" style="grid-column: 1/-1; text-align: center; padding: 2rem;">Error: ${err.message}</div>`;
    }
}

// Render Folder and File Grid Cards
function renderFiles(files) {
    if (!files || files.length === 0) return;

    files.forEach(file => {
        const isFolder = file.mimeType === 'application/vnd.google-apps.folder';
        const itemTypeClass = isFolder ? 'folder' : 'video';
        
        const card = document.createElement('div');
        card.className = `file-item ${itemTypeClass}`;
        
        // SVG Icon Selection
        const folderIconSvg = `
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path>
            </svg>`;
            
        const videoIconSvg = `
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <polygon points="23 7 16 12 23 17 23 7"></polygon>
                <rect x="1" y="5" width="15" height="14" rx="2" ry="2"></rect>
            </svg>`;

        const icon = isFolder ? folderIconSvg : videoIconSvg;
        const sizeString = isFolder ? '' : formatBytes(parseInt(file.size, 10));

        card.innerHTML = `
            <div class="icon-wrapper">
                ${icon}
            </div>
            <div class="item-info">
                <div class="item-name" title="${escapeHtml(file.name)}">${escapeHtml(file.name)}</div>
                ${sizeString ? `<div class="item-size">${sizeString}</div>` : ''}
            </div>
        `;

        card.addEventListener('click', () => {
            if (isFolder) {
                // Navigate into folder
                currentPath.push({ id: file.id, name: file.name });
                isSearchMode = false; // exit search state on navigation
                searchInput.value = '';
                clearSearchBtn.classList.add('hidden');
                loadDirectory(file.id);
            } else {
                // Play video
                if (roomId) {
                    // Send LOAD command to other peers in room
                    activeFileId = file.id;
                    activeFileName = file.name;
                    sendPartySync('load', 0);
                }
                openVideoPlayer(file.id, file.name);
            }
        });

        fileGrid.appendChild(card);
    });
}

// Render Breadcrumbs
function renderBreadcrumbs() {
    breadcrumbs.innerHTML = '';
    currentPath.forEach((item, index) => {
        const isLast = index === currentPath.length - 1;
        const span = document.createElement('span');
        span.className = `breadcrumb-item ${isLast ? 'active' : ''}`;
        span.textContent = item.name;
        
        if (!isLast) {
            span.addEventListener('click', () => {
                currentPath = currentPath.slice(0, index + 1);
                isSearchMode = false;
                searchInput.value = '';
                clearSearchBtn.classList.add('hidden');
                loadDirectory(item.id);
            });
        }
        breadcrumbs.appendChild(span);
    });
}

// Open video overlay and start playback with auto-resume check
async function openVideoPlayer(fileId, fileName, isRemoteLoad = false, isYouTube = false, pushHistory = true) {
    if (pushHistory && !isHandlingPopState) {
        const activeFolder = currentPath[currentPath.length - 1]?.id || 'root';
        window.history.pushState({
            watch: fileId,
            name: fileName,
            isYouTube: isYouTube
        }, '', `?watch=${fileId}&name=${encodeURIComponent(fileName)}&isYouTube=${isYouTube}&folderId=${activeFolder}`);
    }

    modalVideoTitle.textContent = fileName;
    activeFileId = fileId;
    activeFileName = fileName;

    const iframe = document.getElementById('youtubePlayerIframe');
    const customControls = document.querySelector('.custom-controls-container');
    const centerPlay = document.getElementById('playerCenterPlay');

    if (isYouTube) {
        // Hide standard custom video elements
        videoPlayer.classList.add('hidden');
        customControls.classList.add('hidden');
        centerPlay.classList.add('hidden');
        iframe.classList.remove('hidden');

        // Load embedding page
        let embedUrl = `/youtube-player-embed.html?videoId=${encodeURIComponent(fileId)}`;
        if (roomId) {
            embedUrl += `&roomId=${encodeURIComponent(roomId)}&sessionToken=${encodeURIComponent(sessionToken)}`;
        }
        iframe.src = embedUrl;
        videoModal.classList.remove('hidden');
        return;
    }

    // Google Drive custom player mode
    iframe.classList.add('hidden');
    videoPlayer.classList.remove('hidden');
    customControls.classList.remove('hidden');
    centerPlay.classList.remove('hidden');

    if (roomId && !isRemoteLoad) {
        sendPartySync('load', 0);
    }

    let startTime = 0;

    // Reset controls UI
    customSpeedSelect.value = '1';
    videoPlayer.playbackRate = 1.0;
    customVolumeBar.value = Math.round(videoPlayer.volume * 100);

    // 1. Fetch saved progress coordinate
    try {
        const progressResponse = await fetch(`/api/progress/${fileId}`, {
            headers: { 'Authorization': `Bearer ${sessionToken}` }
        });
        if (progressResponse.ok) {
            const progressData = await progressResponse.json();
            startTime = progressData.currentTime || 0;
        }
    } catch (err) {
        console.error('Failed to retrieve progress:', err);
    }

    // 2. Set streaming URI
    let streamUrl = `/api/stream/${fileId}?sessionToken=${encodeURIComponent(sessionToken)}`;
    if (roomId) {
        streamUrl += `&roomId=${encodeURIComponent(roomId)}`;
    }
    
    isRemoteEvent = true; // prevent sending 'pause' during src load
    videoPlayer.src = streamUrl;
    videoModal.classList.remove('hidden');
    videoPlayer.load();

    // Seek to saved position on metadata load
    const resumeHandler = () => {
        videoPlayer.currentTime = startTime;
        console.log(`Resumed playback at ${startTime}s`);
        videoPlayer.removeEventListener('loadedmetadata', resumeHandler);
        
        // Wait a tiny bit then clear remote event flag
        setTimeout(() => {
            isRemoteEvent = false;
        }, 200);
    };
    videoPlayer.addEventListener('loadedmetadata', resumeHandler);

    videoPlayer.play().catch(e => console.log('Autoplay blocked:', e));

    // 3. Set interval to sync progress with the server every 5 seconds (only if not a guest in room)
    progressSyncInterval = setInterval(syncPlaybackProgress, 5000);
}

// Post current progress coordinates to server
async function syncPlaybackProgress() {
    if (!activeFileId || !videoPlayer.duration) return;

    try {
        await fetch('/api/progress', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${sessionToken}`
            },
            body: JSON.stringify({
                fileId: activeFileId,
                name: activeFileName,
                currentTime: videoPlayer.currentTime,
                duration: videoPlayer.duration
            })
        });
    } catch (err) {
        console.error('Progress sync failed:', err);
    }
}

// Close player, sync final progress, and cancel streaming buffer
async function closeVideoPlayer(pushHistory = true) {
    clearInterval(progressSyncInterval);

    const iframe = document.getElementById('youtubePlayerIframe');
    
    // Send final progress sync if we were playing Google Drive video
    if (activeFileId && iframe.classList.contains('hidden')) {
        await syncPlaybackProgress();
    }

    // Pause and clear elements
    videoPlayer.pause();
    videoPlayer.removeAttribute('src'); 
    videoPlayer.load();

    iframe.removeAttribute('src');
    iframe.classList.add('hidden');
    
    videoModal.classList.add('hidden');

    activeFileId = null;
    activeFileName = null;
    
    if (pushHistory && !isHandlingPopState) {
        if (window.history.state && window.history.state.watch) {
            window.history.back();
        } else {
            const currentFolder = currentPath[currentPath.length - 1]?.id || 'root';
            window.history.pushState({ folderId: currentFolder, currentPath: currentPath }, '', `?folderId=${currentFolder}`);
        }
    }

    // Refresh dashboard to show updated progress bar
    if (currentPath.length === 1 && !isSearchMode) {
        loadDashboard();
    }
}

// Helper: Format Bytes to human readable size
function formatBytes(bytes, decimals = 2) {
    if (!bytes || bytes === 0) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

// Helper: Escape HTML
function escapeHtml(text) {
    const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    };
    return text.replace(/[&<>"']/g, function(m) { return map[m]; });
}

// Restore state from HTML5 PopState navigation actions
window.addEventListener('popstate', (event) => {
    isHandlingPopState = true;
    const urlParams = new URLSearchParams(window.location.search);
    const watchId = urlParams.get('watch');
    const folderId = urlParams.get('folderId');
    const searchVal = urlParams.get('search');

    if (watchId) {
        const name = urlParams.get('name') || 'Video Player';
        const isYT = urlParams.get('isYouTube') === 'true';
        openVideoPlayer(watchId, name, false, isYT, false);
    } else {
        if (!videoModal.classList.contains('hidden')) {
            closeVideoPlayer(false);
        }
        
        if (event.state && event.state.currentPath) {
            currentPath = event.state.currentPath;
        } else if (folderId === 'root' || !folderId) {
            currentPath = [{ id: 'root', name: 'My Drive' }];
        } else {
            currentPath = [
                { id: 'root', name: 'My Drive' },
                { id: folderId, name: urlParams.get('name') || 'Folder' }
            ];
        }

        if (searchVal) {
            searchInput.value = searchVal;
            isSearchMode = true;
            clearSearchBtn.classList.remove('hidden');
            loadDirectory(folderId || 'root', false);
        } else {
            searchInput.value = '';
            isSearchMode = false;
            clearSearchBtn.classList.add('hidden');
            loadDirectory(folderId || 'root', false);
        }
    }
    isHandlingPopState = false;
});

// TV Remote D-Pad & Keyboard Controls for Video Playback
window.addEventListener('keydown', (e) => {
    // 1. If video player modal is not open, ignore keyboard events
    if (videoModal.classList.contains('hidden')) return;

    // 2. Ignore keydown events if user is currently focusing on input elements
    const activeEl = document.activeElement;
    if (activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA' || activeEl.tagName === 'SELECT')) {
        return;
    }

    const iframe = document.getElementById('youtubePlayerIframe');
    const isDriveVideo = !videoPlayer.classList.contains('hidden');
    const isYTVideo = !iframe.classList.contains('hidden');

    if (isDriveVideo) {
        switch (e.key) {
            case 'ArrowLeft':
                e.preventDefault();
                videoPlayer.currentTime = Math.max(0, videoPlayer.currentTime - 10);
                if (roomId) {
                    sendPartySync('seek', videoPlayer.currentTime);
                }
                break;
            case 'ArrowRight':
                e.preventDefault();
                videoPlayer.currentTime = Math.min(videoPlayer.duration || 0, videoPlayer.currentTime + 10);
                if (roomId) {
                    sendPartySync('seek', videoPlayer.currentTime);
                }
                break;
            case ' ':
            case 'Enter':
                e.preventDefault();
                togglePlayPause();
                break;
            case 'ArrowUp':
                e.preventDefault();
                videoPlayer.volume = Math.min(1, videoPlayer.volume + 0.1);
                customVolumeBar.value = Math.round(videoPlayer.volume * 100);
                break;
            case 'ArrowDown':
                e.preventDefault();
                videoPlayer.volume = Math.max(0, videoPlayer.volume - 0.1);
                customVolumeBar.value = Math.round(videoPlayer.volume * 100);
                break;
            case 'Escape':
                e.preventDefault();
                closeVideoPlayer();
                break;
        }
    } else if (isYTVideo) {
        // Send control messages directly to the YouTube iframe API handler
        switch (e.key) {
            case 'ArrowLeft':
                e.preventDefault();
                iframe.contentWindow.postMessage({ type: 'control', action: 'seekBackward' }, '*');
                break;
            case 'ArrowRight':
                e.preventDefault();
                iframe.contentWindow.postMessage({ type: 'control', action: 'seekForward' }, '*');
                break;
            case ' ':
            case 'Enter':
                e.preventDefault();
                iframe.contentWindow.postMessage({ type: 'control', action: 'togglePlay' }, '*');
                break;
            case 'ArrowUp':
                e.preventDefault();
                iframe.contentWindow.postMessage({ type: 'control', action: 'volumeUp' }, '*');
                break;
            case 'ArrowDown':
                e.preventDefault();
                iframe.contentWindow.postMessage({ type: 'control', action: 'volumeDown' }, '*');
                break;
            case 'Escape':
                e.preventDefault();
                closeVideoPlayer();
                break;
        }
    }
});
