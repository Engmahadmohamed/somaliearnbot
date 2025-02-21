// Initialize Telegram WebApp
const tg = window.Telegram.WebApp;
tg.expand();

// Initialize OneSignal
window.OneSignal = window.OneSignal || [];
OneSignal.push(function() {
    OneSignal.init({
        appId: "YOUR_ONESIGNAL_APP_ID",
    });
});

// Initialize In-App Interstitial Ads
function initializeInAppAds() {
    show_8975602({ 
        type: 'inApp', 
        inAppSettings: { 
            frequency: 2,     // Show 2 ads
            capping: 0.1,     // Within 6 minutes
            interval: 30,     // 30 seconds between ads
            timeout: 5,       // 5 second delay before first ad
            everyPage: false  // Don't reset on page navigation
        } 
    }).catch(error => {
        console.error('Failed to initialize in-app ads:', error);
    });
}

// Constants
const EARNING_PER_AD = 0.1;
const WITHDRAWAL_THRESHOLD = 5.00;
const AD_DURATION = 1000; // Changed to 1 second
const POPUP_INTERVAL = 120000;
const MAX_AD_RETRIES = 2; // Maximum number of ad retry attempts
const REFERRAL_BONUS = 0.05; // Referral bonus amount
const MAX_REFERRALS_PER_DEVICE = 5; // Maximum referrals per device

// Add to State Management
let adRetryCount = 0;
let lastAdAttempt = 0;
const AD_RETRY_DELAY = 3000; // 3 seconds delay between retries

// LocalStorage Keys
const STORAGE_KEYS = {
    USER_DATA: 'userData',
    SETTINGS: 'appSettings',
    STATISTICS: 'userStats'
};

// Default Values
const DEFAULT_USER_DATA = {
    balance: 0,
    totalEarned: 0,
    withdrawals: [],
    lastActive: new Date().toISOString(),
    joinDate: new Date().toISOString(),
    referralCode: '', // User's referral code
    referredBy: '', // Who referred this user
    referralCount: 0, // Number of successful referrals
    referralEarnings: 0, // Total earnings from referrals
    referralMembers: [] // Array to store referral members
};

const DEFAULT_SETTINGS = {
    notifications: true,
    autoPlay: false,
    theme: 'light',
    language: 'en'
};

const DEFAULT_STATISTICS = {
    totalAdsWatched: 0,
    totalWithdrawals: 0,
    dailyWatchCount: 0,
    lastWatchDate: null,
    streakDays: 0
};

// State Management
let userData = loadFromStorage(STORAGE_KEYS.USER_DATA, DEFAULT_USER_DATA);
let appSettings = loadFromStorage(STORAGE_KEYS.SETTINGS, DEFAULT_SETTINGS);
let userStats = loadFromStorage(STORAGE_KEYS.STATISTICS, DEFAULT_STATISTICS);

// Storage Helper Functions
function loadFromStorage(key, defaultValue) {
    const stored = localStorage.getItem(key);
    return stored ? JSON.parse(stored) : defaultValue;
}

function saveToStorage(key, data) {
    localStorage.setItem(key, JSON.stringify(data));
}

// Update Statistics
function updateStatistics(adWatched = false) {
    const today = new Date().toDateString();
    
    if (adWatched) {
        userStats.totalAdsWatched++;
        
        if (userStats.lastWatchDate !== today) {
            userStats.dailyWatchCount = 1;
            if (new Date(userStats.lastWatchDate).toDateString() === new Date(Date.now() - 86400000).toDateString()) {
                userStats.streakDays++;
            } else {
                userStats.streakDays = 1;
            }
        } else {
            userStats.dailyWatchCount++;
        }
        
        userStats.lastWatchDate = today;
    }
    
    saveToStorage(STORAGE_KEYS.STATISTICS, userStats);
}

// Save all state
function saveState() {
    userData.lastActive = new Date().toISOString();
    saveToStorage(STORAGE_KEYS.USER_DATA, userData);
    saveToStorage(STORAGE_KEYS.SETTINGS, appSettings);
    saveToStorage(STORAGE_KEYS.STATISTICS, userStats);
}

// Additional DOM Elements
const balanceElement = document.getElementById('balance');
const watchAdBtn = document.getElementById('watchAdBtn');
const withdrawBtn = document.getElementById('withdrawBtn');
const ecvModal = document.getElementById('ecvModal');
const ecvInput = document.getElementById('ecvInput');
const submitEcvBtn = document.getElementById('submitEcv');
const closeModalBtn = document.getElementById('closeModal');
const successBanner = document.getElementById('successBanner');
const withdrawalHistory = document.getElementById('withdrawalHistory');
const adContainer = document.getElementById('adContainer');
const messageBox = document.getElementById('messageBox');
const referralLinkInput = document.getElementById('referralLink');
const copyRefBtn = document.getElementById('copyRefBtn');
const referralCountElement = document.getElementById('referralCount');
const referralEarningsElement = document.getElementById('referralEarnings');
const referralListElement = document.getElementById('referralList');
// Add this near the beginning of your app.js
function generateReferralLink(userId) {
    const baseUrl = 'https://adwatchingearnings.vercel.app/?ref=';
    const referralLink = document.getElementById('referralLink');
    referralLink.value = baseUrl + userId;
}

// Call this function when your app initializes with the user's ID
// For example, if you're getting the user ID from Telegram:
window.Telegram.WebApp.ready(() => {
    const userId = window.Telegram.WebApp.initDataUnsafe.user.id;
    generateReferralLink(userId);
});

// Message handling
function showMessage(message, type = 'info') {
    messageBox.textContent = message;
    messageBox.className = 'message-box ' + type;
    
    if (type !== 'loading') {
        setTimeout(() => {
            messageBox.textContent = '';
            messageBox.className = 'message-box';
        }, 3000);
    }
}

// Show Popup Ad
function showPopupAd() {
    const currentTime = Date.now();
    if (currentTime - lastPopupTime >= POPUP_INTERVAL) {
        showMessage('Loading popup ad...', 'loading');
        show_8975602('pop').then(() => {
            // Reward user for watching popup ad
            userData.balance += EARNING_PER_AD / 2;
            updateStatistics(true);
            saveState();
            updateUI();
            showMessage(`You earned $${(EARNING_PER_AD / 2).toFixed(3)} from popup ad!`, 'success');
            lastPopupTime = currentTime;
        }).catch(e => {
            console.error('Popup ad failed:', e);
            showMessage('Popup ad failed - no reward given', 'error');
        });
    }
}

// Start periodic popup checks
setInterval(showPopupAd, POPUP_INTERVAL);

// Add device ID management
function getDeviceId() {
    let deviceId = localStorage.getItem('device_id');
    if (!deviceId) {
        // Generate a unique device ID using timestamp and random string
        deviceId = 'DEV_' + Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
        localStorage.setItem('device_id', deviceId);
    }
    return deviceId;
}

// Generate Referral Code
function generateReferralCode() {
    const deviceId = getDeviceId();
    let referralCode = localStorage.getItem(`referral_code_${deviceId}`);
    
    if (!referralCode) {
        // Generate a unique 6-character code using device ID
        const randomPart = Math.random().toString(36).substring(2, 5).toUpperCase();
        const devicePart = deviceId.substring(4, 7).toUpperCase();
        referralCode = devicePart + randomPart;
        
        // Store the referral code for this device
        localStorage.setItem(`referral_code_${deviceId}`, referralCode);
        userData.referralCode = referralCode;
        saveState();
    }
    
    return referralCode;
}

// Update UI
function updateUI() {
    // Update balance displays
    balanceElement.textContent = userData.balance.toFixed(3);
    const currentBalanceElement = document.getElementById('currentBalance');
    if (currentBalanceElement) {
        currentBalanceElement.textContent = userData.balance.toFixed(3);
    }

    // Update total earnings
    const totalEarnedElement = document.getElementById('totalEarned');
    if (totalEarnedElement) {
        const totalEarned = (userData.totalEarned || 0) + (userData.referralEarnings || 0);
        totalEarnedElement.textContent = totalEarned.toFixed(3);
    }
    
    // Enable/disable withdraw button
    withdrawBtn.disabled = userData.balance < WITHDRAWAL_THRESHOLD;
    
    // Get device-specific referral code
    const deviceId = getDeviceId();
    const referralCode = localStorage.getItem(`referral_code_${deviceId}`) || generateReferralCode();
    const referralLink = `https://t.me/AdWatchingEarnings_bot?start=${referralCode}`;
    
    // Update referral link input
    referralLinkInput.value = referralLink;
    referralLinkInput.style.display = 'block';
    referralLinkInput.readOnly = true;
    
    // Update referral stats display
    const currentReferrals = userData.referralCount || 0;
    const remainingSlots = MAX_REFERRALS_PER_DEVICE - currentReferrals;
    
    // Update all referral UI elements
    if (referralCountElement) {
        referralCountElement.textContent = currentReferrals;
    }
    
    if (referralEarningsElement) {
        referralEarningsElement.textContent = (userData.referralEarnings || 0).toFixed(3);
    }

    // Update slots used display
    const currentReferralsElement = document.getElementById('currentReferrals');
    if (currentReferralsElement) {
        currentReferralsElement.textContent = currentReferrals;
    }

    // Update remaining slots
    const remainingSlotsElement = document.getElementById('remainingSlots');
    if (remainingSlotsElement) {
        remainingSlotsElement.textContent = remainingSlots;
    }

    // Update progress bar
    const progressBar = document.getElementById('referralProgressBar');
    if (progressBar) {
        const progressPercentage = (currentReferrals / MAX_REFERRALS_PER_DEVICE) * 100;
        progressBar.style.width = `${progressPercentage}%`;
    }

    // Update referral members count in the header
    const referralMembersHeader = document.querySelector('.referral-members h4');
    if (referralMembersHeader) {
        referralMembersHeader.textContent = `Your Referral Members 👥 (${currentReferrals}/${MAX_REFERRALS_PER_DEVICE})`;
    }

    // Save the updated state
    saveState();
    
    // Update referral members list
    updateReferralMembersList();
    
    // Update withdrawal history
    withdrawalHistory.innerHTML = userData.withdrawals.map(w => `
        <div class="history-item">
            <p>Amount: $${w.amount} - Date: ${new Date(w.date).toLocaleDateString()}</p>
            <p>ECV: ${w.ecv}</p>
            <p>Streak: ${userStats.streakDays} days</p>
            <p>Total Watched: ${userStats.totalAdsWatched}</p>
            <p>Referrals: ${userData.referralCount}/${MAX_REFERRALS_PER_DEVICE} ($${(userData.referralEarnings || 0).toFixed(3)})</p>
        </div>
    `).join('');

    // Check for popup opportunity
    showPopupAd();
    
    // Update referral link visibility based on limit
    if (currentReferrals >= MAX_REFERRALS_PER_DEVICE) {
        referralLinkInput.style.opacity = '0.5';
        copyRefBtn.disabled = true;
        copyRefBtn.style.opacity = '0.5';
        document.querySelector('.referral-info').textContent = 'Maximum referral limit reached! 🔒';
    }
}

// Update referral members list
function updateReferralMembersList() {
    if (!userData.referralMembers || userData.referralMembers.length === 0) {
        const remainingReferrals = MAX_REFERRALS_PER_DEVICE;
        referralListElement.innerHTML = `
            <div class="no-referrals">
                No referral members yet. Share your link to earn rewards! 🎁
                <br>
                <span style="color: var(--accent-color);">(${remainingReferrals} referrals available per user)</span>
            </div>
        `;
        return;
    }

    const remainingReferrals = MAX_REFERRALS_PER_DEVICE - userData.referralMembers.length;
    const referralStatus = remainingReferrals > 0 
        ? `<div class="referral-status">Remaining referrals: ${remainingReferrals} 🎯</div>`
        : '<div class="referral-status">Maximum referrals reached! 🔒</div>';

    referralListElement.innerHTML = `
        ${referralStatus}
        ${userData.referralMembers
            .sort((a, b) => new Date(b.joinDate) - new Date(a.joinDate))
            .map((member, index) => {
                const initial = member.name.charAt(0).toUpperCase();
                const joinDate = new Date(member.joinDate).toLocaleDateString();
                const isActive = new Date(member.lastActive) > new Date(Date.now() - 86400000);
                
                return `
                    <div class="referral-item">
                        <div class="member-info">
                            <div class="member-avatar">${initial}</div>
                            <div class="member-details">
                                <span class="member-name">${member.name}</span>
                                <span class="join-date">Joined: ${joinDate}</span>
                            </div>
                        </div>
                        <span class="member-status">
                            ${isActive ? '🟢 Active' : '⚪ Inactive'}
                        </span>
                    </div>
                `;
            }).join('')}
    `}
// Watch Ad Function with retry logic
function watchAd(isRetry = false) {
    const now = Date.now();
    
    if (now - lastAdAttempt > AD_DURATION) {
        adRetryCount = 0;
    }
    
    watchAdBtn.disabled = true;
    
    // Try to show rewarded popup ad first
    show_8975602('pop').then(() => {
        // Ad watched successfully
        userData.balance += EARNING_PER_AD;
        userData.totalEarned += EARNING_PER_AD;
        updateStatistics(true);
        saveState();
        updateUI();
        showMessage(`You earned $${EARNING_PER_AD.toFixed(3)} by watching an ad!`, 'success');
        adRetryCount = 0;
    }).catch(error => {
        console.error('Popup ad failed, trying interstitial:', error);
        // If popup fails, try regular interstitial
        show_8975602().then(() => {
            userData.balance += EARNING_PER_AD;
            userData.totalEarned += EARNING_PER_AD;
            updateStatistics(true);
            saveState();
            updateUI();
            showMessage(`You earned $${EARNING_PER_AD.toFixed(3)} by watching an ad!`, 'success');
            adRetryCount = 0;
        }).catch(e => {
            console.error('All ad attempts failed:', e);
            showMessage('Failed to load ad. Please try again later.', 'error');
            adRetryCount++;
        });
    }).finally(() => {
        setTimeout(() => {
            watchAdBtn.disabled = false;
        }, 1000); // Changed to 1-second cooldown
    });
}
// Initialize ads when document is ready
document.addEventListener('DOMContentLoaded', function() {
    initializeInAppAds();
    // Initial ad setup
    show_8975602({ 
        type: 'inApp', 
        inAppSettings: { 
            frequency: 2,
            capping: 0.1,
            interval: 30,
            timeout: 5,
            everyPage: false
        } 
    });
});