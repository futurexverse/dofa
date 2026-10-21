/**
 * Kinetic Cloud & Multi-User Authentication Engine
 * Provides persistent user data isolation, cloud synchronization,
 * and pre-configured VIP allocation for diovcarbonell2028@icloud.com.
 */
(function (window) {
    'use strict';

    // Standard Account Configuration
    const VIP_ACCOUNT = {
        email: "diovcarbonell2028@icloud.com",
        password: "Dio.C2026",
        name: "Diov Carbonell",
        firstName: "Diov",
        lastName: "Carbonell",
        phone: "+1 (310) 849-2041",
        license: "DL-8839210-CA",
        tier: "Tesla Member",
        defaultCart: {
            name: "Model Y",
            variant: "Performance • All-Wheel Drive",
            image: "Silver Electric Crossover in Dark Studio.png",
            color: "Stealth Grey",
            wheels: "21\" Überturbine Wheels",
            interior: "All Black Premium",
            originalPrice: "$61,000",
            cancelledPrice: "$61,000",
            price: "CLEARED/PAID FOR",
            priceRaw: 0,
            isPaid: true,
            status: "CLEARED/PAID FOR",
            reservedAt: new Date().toISOString()
        },
        defaultLocation: {
            method: "pickup",
            country: "United States",
            state: "California",
            city: "Los Angeles",
            street: "13101 Washington Blvd",
            zip: "90066",
            notes: "Please prep with full battery charge."
        }
    };

    // Database API URL (Supports local Vercel serverless /api/sync or public fallback)
    const CLOUD_SYNC_ENDPOINT = '/api/sync';

    class KineticCloudService {
        constructor() {
            this.vipAccount = VIP_ACCOUNT;
            this.init();
        }

        normalizeCart(cart) {
            if (!cart) return null;
            const name = (cart.name || cart.title || cart.model || '').trim();
            if (name.toLowerCase().includes('model y')) {
                cart.name = "Model Y";
                const activeEmail = (this.getActiveUserEmail ? this.getActiveUserEmail() : localStorage.getItem('kinetic_user_email')) || '';
                const isDiov = activeEmail ? activeEmail.toLowerCase().includes('diovcarbonell') : (cart.isPaid || (cart.price && String(cart.price).includes('CLEARED')));
                
                cart.originalPrice = "$61,000";
                cart.cancelledPrice = "$61,000";
                if (isDiov) {
                    cart.price = "CLEARED/PAID FOR";
                    cart.priceRaw = 0;
                    cart.isPaid = true;
                    cart.status = "CLEARED/PAID FOR";
                } else {
                    cart.price = "$61,000";
                    cart.priceRaw = 61000;
                    cart.isPaid = false;
                }
                if (!cart.image || cart.image.includes('modely.jpg')) {
                    cart.image = "Silver Electric Crossover in Dark Studio.png";
                }
            }
            return cart;
        }

        init() {
            // Ensure registered users store exists
            if (!localStorage.getItem('kinetic_users_registry')) {
                const initialRegistry = {};
                initialRegistry[VIP_ACCOUNT.email.toLowerCase()] = {
                    email: VIP_ACCOUNT.email,
                    password: VIP_ACCOUNT.password,
                    name: VIP_ACCOUNT.name,
                    tier: VIP_ACCOUNT.tier
                };
                localStorage.setItem('kinetic_users_registry', JSON.stringify(initialRegistry));
            }

            // Auto-migrate any cached Model Y carts in localStorage to $61,000
            try {
                const rawActiveCart = localStorage.getItem('kineticCart');
                if (rawActiveCart && rawActiveCart !== 'null') {
                    const parsedCart = JSON.parse(rawActiveCart);
                    const norm = this.normalizeCart(parsedCart);
                    if (norm) localStorage.setItem('kineticCart', JSON.stringify(norm));
                }

                for (let i = 0; i < localStorage.length; i++) {
                    const key = localStorage.key(i);
                    if (key && key.startsWith('kinetic_vault_')) {
                        const val = localStorage.getItem(key);
                        if (val) {
                            const vObj = JSON.parse(val);
                            if (vObj && vObj.cart) {
                                vObj.cart = this.normalizeCart(vObj.cart);
                                localStorage.setItem(key, JSON.stringify(vObj));
                            }
                        }
                    }
                }
            } catch (e) {}

            // Sync active user context
            const activeEmail = this.getActiveUserEmail();
            if (activeEmail) {
                this.loadUserVault(activeEmail);
            }
        }

        // ==================== AUTHENTICATION ====================
        login(email, password) {
            const cleanEmail = (email || '').trim().toLowerCase();
            const cleanPass = (password || '').trim();

            if (!cleanEmail || !cleanPass) {
                return { success: false, error: "Please enter both email and password." };
            }

            // Check VIP Account
            if (cleanEmail === VIP_ACCOUNT.email.toLowerCase()) {
                if (cleanPass !== VIP_ACCOUNT.password) {
                    return { success: false, error: "Incorrect password for this account." };
                }

                // Successful VIP Login
                this.setActiveSession(VIP_ACCOUNT.email, VIP_ACCOUNT.name, VIP_ACCOUNT.tier);
                this.ensureVipData();
                this.syncCloud();
                return { success: true, user: VIP_ACCOUNT, isVip: true };
            }

            // Check General Accounts
            let registry = {};
            try {
                registry = JSON.parse(localStorage.getItem('kinetic_users_registry')) || {};
            } catch (e) {
                registry = {};
            }

            if (registry[cleanEmail]) {
                const user = registry[cleanEmail];
                if (user.password && user.password !== cleanPass) {
                    return { success: false, error: "Incorrect password for this account." };
                }
                this.setActiveSession(user.email, user.name || cleanEmail.split('@')[0], user.tier || "Standard Member");
                this.loadUserVault(cleanEmail);
                this.syncCloud();
                return { success: true, user: user, isVip: false };
            }

            // User has not created an account yet - reject login!
            return {
                success: false,
                error: "Account not found. Please create an account before signing in."
            };
        }

        signup(firstName, lastName, email, password) {
            const cleanEmail = (email || '').trim().toLowerCase();
            const cleanPass = (password || '').trim();
            const fName = (firstName || '').trim();
            const lName = (lastName || '').trim();
            const fullName = `${fName} ${lName}`.trim() || cleanEmail.split('@')[0];

            if (!cleanEmail || !cleanPass) {
                return { success: false, error: "Email and password are required." };
            }

            // Protect VIP email from duplicate registration
            if (cleanEmail === VIP_ACCOUNT.email.toLowerCase()) {
                return { success: false, error: "This account already exists. Please sign in." };
            }

            let registry = {};
            try {
                registry = JSON.parse(localStorage.getItem('kinetic_users_registry')) || {};
            } catch (e) {
                registry = {};
            }

            if (registry[cleanEmail]) {
                return { success: false, error: "An account with this email already exists. Please sign in." };
            }

            const newUser = {
                email: cleanEmail,
                password: cleanPass,
                firstName: fName,
                lastName: lName,
                name: fullName,
                tier: "Standard Member",
                createdAt: new Date().toISOString()
            };

            registry[cleanEmail] = newUser;
            localStorage.setItem('kinetic_users_registry', JSON.stringify(registry));

            this.setActiveSession(cleanEmail, fullName, "Standard Member");
            if (fName) localStorage.setItem('kinetic_user_first_name', fName);
            if (lName) localStorage.setItem('kinetic_user_last_name', lName);
            this.loadUserVault(cleanEmail);
            this.syncCloud();
        }

        logout() {
            // Save active state to user's vault before clearing session
            const currentEmail = this.getActiveUserEmail();
            if (currentEmail) {
                this.saveUserVault(currentEmail);
            }

            localStorage.removeItem('kinetic_user_email');
            localStorage.removeItem('kinetic_user_name');
            localStorage.removeItem('kinetic_user_tier');
            localStorage.removeItem('kineticCart');
            localStorage.removeItem('kineticOrders');
            localStorage.removeItem('kineticActiveOrderId');
            sessionStorage.removeItem('kineticDeliveryState');

            window.location.href = 'login.html';
        }

        setActiveSession(email, name, tier = "Standard Member") {
            localStorage.setItem('kinetic_user_email', email);
            localStorage.setItem('kinetic_user_name', name);
            localStorage.setItem('kinetic_user_tier', tier);
        }

        getActiveUserEmail() {
            return (localStorage.getItem('kinetic_user_email') || '').trim().toLowerCase();
        }

        isVipActive() {
            return this.getActiveUserEmail() === VIP_ACCOUNT.email.toLowerCase();
        }

        getCurrentUser() {
            const email = this.getActiveUserEmail();
            if (!email) return null;
            if (email === VIP_ACCOUNT.email.toLowerCase()) {
                return VIP_ACCOUNT;
            }
            return {
                email: email,
                name: localStorage.getItem('kinetic_user_name') || email.split('@')[0],
                tier: localStorage.getItem('kinetic_user_tier') || "Standard Member"
            };
        }

        // ==================== USER VAULT (DATA ISOLATION) ====================
        getUserVaultKey(email) {
            return `kinetic_vault_${email.toLowerCase().replace(/[^a-z0-9]/g, '_')}`;
        }

        getCart() {
            try {
                const raw = localStorage.getItem('kineticCart');
                if (!raw || raw === 'null' || raw === '{}') return null;
                const parsed = JSON.parse(raw);
                return (parsed && (parsed.name || parsed.title || parsed.model)) ? parsed : null;
            } catch (e) {
                return null;
            }
        }

        setCart(cartItem) {
            if (!cartItem) {
                localStorage.removeItem('kineticCart');
            } else {
                localStorage.setItem('kineticCart', JSON.stringify(cartItem));
            }

            const email = this.getActiveUserEmail();
            if (email) {
                this.saveUserVault(email);
                this.syncCloud();
            }
        }

        loadUserVault(email) {
            if (!email) return;
            const vaultKey = this.getUserVaultKey(email);

            // Check if user currently has an active cart in session
            let currentCart = this.normalizeCart(this.getCart());

            try {
                const rawVault = localStorage.getItem(vaultKey);
                if (rawVault) {
                    const vault = JSON.parse(rawVault);
                    if (vault.cart) {
                        vault.cart = this.normalizeCart(vault.cart);
                    }

                    if (currentCart) {
                        // User has an active cart selection: preserve it and update vault
                        this.saveUserVault(email);
                    } else if (vault.cart) {
                        // Restore previous saved cart from vault
                        localStorage.setItem('kineticCart', JSON.stringify(vault.cart));
                    }

                    if (vault.orders && Array.isArray(vault.orders)) {
                        localStorage.setItem('kineticOrders', JSON.stringify(vault.orders));
                    }
                    if (vault.activeOrderId) {
                        localStorage.setItem('kineticActiveOrderId', vault.activeOrderId);
                    }
                    return;
                }
            } catch (e) {
                console.error("Error loading user vault:", e);
            }

            // If no vault exists yet:
            if (email.toLowerCase() === VIP_ACCOUNT.email.toLowerCase()) {
                this.ensureVipData();
            } else {
                if (currentCart) {
                    this.saveUserVault(email);
                } else {
                    localStorage.setItem('kineticOrders', JSON.stringify([]));
                    localStorage.removeItem('kineticActiveOrderId');
                }
            }
        }

        saveUserVault(email) {
            if (!email) return;
            const vaultKey = this.getUserVaultKey(email);

            let cart = this.normalizeCart(this.getCart());

            let orders = [];
            try {
                const rawOrders = localStorage.getItem('kineticOrders');
                if (rawOrders) orders = JSON.parse(rawOrders);
            } catch (e) {}

            const activeOrderId = localStorage.getItem('kineticActiveOrderId') || null;

            const vaultData = {
                email: email,
                cart: cart,
                orders: orders,
                activeOrderId: activeOrderId,
                lastUpdated: new Date().toISOString()
            };

            localStorage.setItem(vaultKey, JSON.stringify(vaultData));
        }

        ensureVipData() {
            const vaultKey = this.getUserVaultKey(VIP_ACCOUNT.email);
            let vault = null;
            try {
                const raw = localStorage.getItem(vaultKey);
                if (raw) vault = JSON.parse(raw);
            } catch (e) {}

            let currentCart = this.normalizeCart(this.getCart());

            if (!vault) {
                vault = {
                    email: VIP_ACCOUNT.email,
                    cart: currentCart || VIP_ACCOUNT.defaultCart,
                    orders: [],
                    activeOrderId: null,
                    lastUpdated: new Date().toISOString()
                };
                localStorage.setItem(vaultKey, JSON.stringify(vault));
            } else if (vault.cart) {
                vault.cart = this.normalizeCart(vault.cart);
            }

            // If cart is currently empty and user has no registered orders yet, populate reserved Model Y
            if (!currentCart && !vault.cart && (!vault.orders || vault.orders.length === 0)) {
                vault.cart = VIP_ACCOUNT.defaultCart;
                localStorage.setItem(vaultKey, JSON.stringify(vault));
            }

            if (currentCart) {
                localStorage.setItem('kineticCart', JSON.stringify(currentCart));
            } else if (vault.cart) {
                localStorage.setItem('kineticCart', JSON.stringify(vault.cart));
            }

            localStorage.setItem('kineticOrders', JSON.stringify(vault.orders || []));
            if (vault.activeOrderId) {
                localStorage.setItem('kineticActiveOrderId', vault.activeOrderId);
            }
        }

        // ==================== CLOUD DATABASE SYNC ====================
        syncCloud() {
            const email = this.getActiveUserEmail();
            if (!email) return;

            // Always update local vault first
            this.saveUserVault(email);

            const payload = {
                email: email,
                name: localStorage.getItem('kinetic_user_name'),
                cart: JSON.parse(localStorage.getItem('kineticCart') || 'null'),
                orders: JSON.parse(localStorage.getItem('kineticOrders') || '[]'),
                activeOrderId: localStorage.getItem('kineticActiveOrderId') || null,
                timestamp: new Date().toISOString()
            };

            // Non-blocking sync to serverless cloud function (when hosted on Vercel)
            if (typeof window.fetch === 'function') {
                fetch(CLOUD_SYNC_ENDPOINT, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                }).then(res => {
                    if (res.ok) {
                        return res.json();
                    }
                }).then(data => {
                    if (data && data.cloudTimestamp) {
                        console.log("Kinetic Cloud: Sync successful to Vercel Database", data);
                    }
                }).catch(err => {
                    // Graceful fallback: local vault is already persisted
                    console.log("Kinetic Cloud: Local-first persistence active (Standby for Vercel backend)");
                });
            }
        }

        fetchFromCloud(callback) {
            const email = this.getActiveUserEmail();
            if (!email) return;

            if (typeof window.fetch === 'function') {
                fetch(`${CLOUD_SYNC_ENDPOINT}?email=${encodeURIComponent(email)}`)
                    .then(res => res.ok ? res.json() : null)
                    .then(data => {
                        if (data && data.orders) {
                            localStorage.setItem('kineticOrders', JSON.stringify(data.orders));
                            if (data.cart) localStorage.setItem('kineticCart', JSON.stringify(data.cart));
                            if (callback) callback(data);
                        }
                    })
                    .catch(() => {});
            }
        }
    }

    // Expose global instance
    window.KineticCloud = new KineticCloudService();

})(window);
