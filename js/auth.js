// ============================================================
// AUTHENTICATION MODULE
// ============================================================

const Auth = {

    // Check if user is authenticated, redirect if not
    async requireAuth() {
        const { data: { session } } = await db.auth.getSession();
        if (!session) {
            window.location.href = 'index.html';
            return null;
        }
        return session;
    },

    // Get current session
    async getSession() {
        const { data: { session } } = await db.auth.getSession();
        return session;
    },

    // Get current user profile
    async getProfile() {
        const session = await this.getSession();
        if (!session) return null;
        const { data, error } = await db
            .from('profiles')
            .select('*')
            .eq('id', session.user.id)
            .single();
        if (error) {
            console.error('Error fetching profile:', error);
            return null;
        }
        return data;
    },

    // Register
    async register(formData) {
        const { data, error } = await db.auth.signUp({
            email: formData.email,
            password: formData.password,
            options: {
                data: {
                    full_name: formData.full_name,
                    phone: formData.phone,
                    location: formData.location,
                    role: formData.role
                }
            }
        });
        if (error) throw error;
        return data;
    },

    // Login
    async login(email, password) {
        const { data, error } = await db.auth.signInWithPassword({
            email,
            password
        });
        if (error) throw error;
        return data;
    },

    // Password reset
    async resetPassword(email) {
        const { data, error } = await db.auth.resetPasswordForEmail(email, {
            redirectTo: window.location.origin + '/index.html?reset=true'
        });
        if (error) throw error;
        return data;
    },

    // Logout
    async logout() {
        const { error } = await db.auth.signOut();
        if (error) throw error;
        window.location.href = 'index.html';
    },

    // Update profile
    async updateProfile(updates) {
        const session = await this.getSession();
        if (!session) throw new Error('Not authenticated');

        const { data, error } = await db
            .from('profiles')
            .update(updates)
            .eq('id', session.user.id)
            .select()
            .single();

        if (error) throw error;
        return data;
    },

    // Upload avatar
    async uploadAvatar(file) {
        const session = await this.getSession();
        if (!session) throw new Error('Not authenticated');

        const fileExt = file.name.split('.').pop();
        const filePath = `${session.user.id}/avatar.${fileExt}`;

        const { error: uploadError } = await db.storage
            .from('avatars')
            .upload(filePath, file, { upsert: true });

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = db.storage
            .from('avatars')
            .getPublicUrl(filePath);

        await this.updateProfile({ avatar_url: publicUrl + '?t=' + Date.now() });
        return publicUrl + '?t=' + Date.now();
    },

    // Listen for auth state changes
    onAuthChange(callback) {
        db.auth.onAuthStateChange((event, session) => {
            callback(event, session);
        });
    }
};