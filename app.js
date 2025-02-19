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
    joinDate: new Date().toISOString()
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

// DOM Elements
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

// Update UI
function updateUI() {
    // Update balance display
    balanceElement.textContent = userData.balance.toFixed(3);
    
    // Enable/disable withdraw button
    withdrawBtn.disabled = userData.balance < WITHDRAWAL_THRESHOLD;
    
    // Update withdrawal history
    withdrawalHistory.innerHTML = userData.withdrawals.map(w => `
        <div class="history-item">
            <p>Amount: $${w.amount} - Date: ${new Date(w.date).toLocaleDateString()}</p>
            <p>ECV: ${w.ecv}</p>
            <p>Streak: ${userStats.streakDays} days</p>
            <p>Total Watched: ${userStats.totalAdsWatched}</p>
        </div>
    `).join('');

    // Check for popup opportunity
    showPopupAd();
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

// Initialize UI and Ads
updateUI();
initializeInAppAds();
