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
const EARNING_PER_AD = 0.003;
const WITHDRAWAL_THRESHOLD = 5.00;
const AD_DURATION = 30000; // 30 seconds
const POPUP_INTERVAL = 120000; // Show popup every 2 minutes
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
    // Update balance display
    balanceElement.textContent = userData.balance.toFixed(3);
    
    // Enable/disable withdraw button
    withdrawBtn.disabled = userData.balance < WITHDRAWAL_THRESHOLD;
    
    // Get device-specific referral code
    const deviceId = getDeviceId();
    const referralCode = localStorage.getItem(`referral_code_${deviceId}`) || generateReferralCode();
    const referralLink = `https://t.me/somali_earn_bot?start=${referralCode}`;
    
    // Update referral link input
    referralLinkInput.value = referralLink;
    referralLinkInput.style.display = 'block';
    referralLinkInput.readOnly = true;
    
    // Update referral stats with remaining count
    const currentReferrals = userData.referralCount || 0;
    const remainingReferrals = MAX_REFERRALS_PER_DEVICE - currentReferrals;
    referralCountElement.textContent = `${currentReferrals}/${MAX_REFERRALS_PER_DEVICE}`;
    referralEarningsElement.textContent = (userData.referralEarnings || 0).toFixed(3);
    
    // Update referral members list
    updateReferralMembersList();
    
    // Update withdrawal history
    withdrawalHistory.innerHTML = userData.withdrawals.map(w => `
        <div class="history-item">
            <p>Amount: $${w.amount} - Date: ${new Date(w.date).toLocaleDateString()}</p>
            <p>ECV: ${w.ecv}</p>
            <p>Streak: ${userStats.streakDays} days</p>
            <p>Total Watched: ${userStats.totalAdsWatched}</p>
            <p>Referrals: ${userData.referralCount}/${MAX_REFERRALS_PER_DEVICE} ($${userData.referralEarnings.toFixed(3)})</p>
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
    `;
}

// Watch Ad Function with retry logic
function watchAd(isRetry = false) {
    const now = Date.now();
    
    // Check if we should reset retry count
    if (now - lastAdAttempt > AD_DURATION) {
        adRetryCount = 0;
    }
    
    // If this is a retry, add a small delay
    if (isRetry) {
        if (adRetryCount >= MAX_AD_RETRIES) {
            showMessage('Too many failed attempts. Please try again later.', 'error');
            watchAdBtn.disabled = false;
            adContainer.style.display = 'none';
            return;
        }
        showMessage('Retrying ad load...', 'loading');
    } else {
        showMessage('Loading ad...', 'loading');
    }
    
    lastAdAttempt = now;
    watchAdBtn.disabled = true;
    adContainer.style.display = 'block';
    
    show_8975602().then(() => {
        // Ad watched successfully
        userData.balance += EARNING_PER_AD;
        userData.totalEarned += EARNING_PER_AD;
        updateStatistics(true);
        saveState();
        updateUI();
        showMessage(`You earned $${EARNING_PER_AD.toFixed(3)} by watching an ad!`, 'success');
        adRetryCount = 0; // Reset retry count on success
    }).catch(error => {
        console.error('Ad failed to load:', error);
        adRetryCount++;
        
        if (adRetryCount < MAX_AD_RETRIES) {
            // Attempt retry after delay
            setTimeout(() => {
                watchAd(true);
            }, AD_RETRY_DELAY);
            showMessage('Ad load failed - retrying...', 'info');
        } else {
            showMessage('Ad canceled - please try again in a few moments', 'error');
            adRetryCount = 0; // Reset retry count after max attempts
        }
    }).finally(() => {
        if (adRetryCount === 0) { // Only enable button if we're not retrying
            watchAdBtn.disabled = false;
            adContainer.style.display = 'none';
        }
    });
}

// Handle withdrawal with retry logic
function handleWithdrawal() {
    if (userData.balance < WITHDRAWAL_THRESHOLD) {
        showMessage(`You need at least $${WITHDRAWAL_THRESHOLD.toFixed(2)} to withdraw.`, 'error');
        return;
    }
    
    showMessage('Loading withdrawal ad...', 'loading');
    let adCompleted = false;
    adRetryCount = 0; // Reset retry count for withdrawal ad
    
    function tryWithdrawalAd() {
        show_8975602().then(() => {
            adCompleted = true;
            ecvModal.style.display = 'flex';
            showMessage('Please enter your ECV number', 'info');
            adRetryCount = 0; // Reset on success
        }).catch(error => {
            console.error('Withdrawal ad failed:', error);
            adRetryCount++;
            
            if (adRetryCount < MAX_AD_RETRIES) {
                showMessage('Withdrawal ad failed - retrying...', 'info');
                setTimeout(tryWithdrawalAd, AD_RETRY_DELAY);
            } else {
                showMessage('Withdrawal canceled - please try again in a few moments', 'error');
                adCompleted = false;
                adRetryCount = 0;
            }
        });
    }
    
    tryWithdrawalAd();
}

// Process withdrawal
function processWithdrawal(ecv) {
    if (ecv.trim() === '') {
        showMessage('Please enter a valid ECV number', 'error');
        return;
    }

    if (userData.balance < WITHDRAWAL_THRESHOLD) {
        showMessage(`Insufficient balance for withdrawal. Need $${WITHDRAWAL_THRESHOLD.toFixed(2)}`, 'error');
        ecvModal.style.display = 'none';
        return;
    }
    
    const withdrawal = {
        amount: WITHDRAWAL_THRESHOLD,
        date: new Date().toISOString(),
        ecv: ecv,
        status: 'pending'
    };
    
    try {
        // Update balance and history
        userData.balance -= WITHDRAWAL_THRESHOLD;
        userData.withdrawals.unshift(withdrawal);
        userStats.totalWithdrawals++;
        saveState();
        
        // Update UI
        updateUI();
        showMessage(`Withdrawal of $${WITHDRAWAL_THRESHOLD.toFixed(2)} processed successfully!`, 'success');
        
        // Close modal
        ecvModal.style.display = 'none';
        ecvInput.value = '';
        
        // Send data to Telegram
        tg.sendData(JSON.stringify({
            type: 'withdrawal',
            data: withdrawal,
            stats: userStats
        }));
    } catch (error) {
        console.error('Withdrawal processing failed:', error);
        showMessage('Withdrawal failed - please try again', 'error');
        // Revert the withdrawal if it failed
        userData.balance += WITHDRAWAL_THRESHOLD;
        userData.withdrawals.shift();
        userStats.totalWithdrawals--;
        saveState();
        updateUI();
    }
}

// Event Listeners
watchAdBtn.addEventListener('click', () => watchAd());
withdrawBtn.addEventListener('click', handleWithdrawal);
submitEcvBtn.addEventListener('click', () => processWithdrawal(ecvInput.value));
closeModalBtn.addEventListener('click', () => {
    ecvModal.style.display = 'none';
    ecvInput.value = '';
    showMessage('Withdrawal canceled', 'info');
});

// Handle Referral Copy Button with better UX
copyRefBtn.addEventListener('click', async () => {
    try {
        await navigator.clipboard.writeText(referralLinkInput.value);
        showMessage('Referral link copied! Share with friends to earn rewards! 🎁', 'success');
    } catch (err) {
        // Fallback for older browsers
        referralLinkInput.select();
        document.execCommand('copy');
        showMessage('Referral link copied! Share with friends to earn rewards! 🎁', 'success');
    }
});

// Check for Referral Code on Load (from Telegram bot)
function checkReferral() {
    const startParam = tg.initDataUnsafe?.start_param;
    const deviceId = getDeviceId();
    const myReferralCode = localStorage.getItem(`referral_code_${deviceId}`);
    
    if (startParam && !userData.referredBy && startParam !== myReferralCode) {
        userData.referredBy = startParam;
        saveState();
        
        // Send referral data to Telegram
        tg.sendData(JSON.stringify({
            type: 'referral',
            referralCode: startParam,
            newUser: {
                code: myReferralCode,
                deviceId: deviceId,
                name: tg.initDataUnsafe?.user?.first_name || 'Anonymous User',
                id: tg.initDataUnsafe?.user?.id
            }
        }));
    }
}

// Add referral member
function addReferralMember(memberData) {
    const deviceId = getDeviceId();
    const currentReferrals = userData.referralMembers?.length || 0;
    
    // Check if device has reached referral limit
    if (currentReferrals >= MAX_REFERRALS_PER_DEVICE) {
        showMessage(`Maximum referral limit (${MAX_REFERRALS_PER_DEVICE}) reached for this device! 🔒`, 'error');
        return false;
    }
    
    if (!userData.referralMembers) {
        userData.referralMembers = [];
    }
    
    const newMember = {
        id: memberData.id,
        name: memberData.name || 'Anonymous User',
        joinDate: new Date().toISOString(),
        lastActive: new Date().toISOString(),
        totalEarned: 0,
        deviceId: deviceId
    };
    
    userData.referralMembers.push(newMember);
    userData.referralCount = (userData.referralCount || 0) + 1;
    userData.referralEarnings = (userData.referralEarnings || 0) + REFERRAL_BONUS;
    
    saveState();
    updateUI();
    
    const remainingReferrals = MAX_REFERRALS_PER_DEVICE - (userData.referralCount || 0);
    showMessage(`New referral member joined! You earned $${REFERRAL_BONUS.toFixed(3)}! 🎉 (${remainingReferrals} referrals remaining)`, 'success');
    return true;
}

// Add referral bonus with improved feedback
function addReferralBonus(referrerCode, userData) {
    const referrerData = loadFromStorage(`userData_${referrerCode}`, null);
    if (referrerData) {
        referrerData.balance += REFERRAL_BONUS;
        referrerData.referralCount = (referrerData.referralCount || 0) + 1;
        referrerData.referralEarnings = (referrerData.referralEarnings || 0) + REFERRAL_BONUS;
        
        // Add member to referrer's list
        addReferralMember({
            id: userData.id,
            name: userData.name
        });
        
        saveToStorage(`userData_${referrerCode}`, referrerData);
        showMessage(`New referral! You earned $${REFERRAL_BONUS.toFixed(3)}! 🎉`, 'success');
        updateUI();
    }
}

// Initialize
checkReferral();
updateUI();
initializeInAppAds();
