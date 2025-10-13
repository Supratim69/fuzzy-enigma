// Example of how to use BetterAuth on the client side
// This would typically be in your frontend application

// Install: npm install better-auth

import { createAuthClient } from "better-auth/client";

const authClient = createAuthClient({
    baseURL: "http://localhost:4000", // Your backend URL
});

// Example usage:

// 1. Sign up a new user
async function signUp() {
    const { data, error } = await authClient.signUp.email({
        name: "John Doe",
        email: "john.doe@example.com",
        password: "password123",
    });

    if (error) {
        console.error("Sign up failed:", error);
        return;
    }

    console.log("User signed up:", data);
}

// 2. Sign in an existing user
async function signIn() {
    const { data, error } = await authClient.signIn.email({
        email: "john.doe@example.com",
        password: "password123",
        rememberMe: true,
    });

    if (error) {
        console.error("Sign in failed:", error);
        return;
    }

    console.log("User signed in:", data);
}

// 3. Get current session
async function getCurrentSession() {
    const { data } = await authClient.getSession();

    if (data) {
        console.log("Current user:", data.user);
        console.log("Session:", data.session);
    } else {
        console.log("No active session");
    }
}

// 4. Sign out
async function signOut() {
    await authClient.signOut();
    console.log("User signed out");
}

// 5. Change password
async function changePassword() {
    const { data, error } = await authClient.changePassword({
        newPassword: "newpassword123",
        currentPassword: "password123",
        revokeOtherSessions: true,
    });

    if (error) {
        console.error("Password change failed:", error);
        return;
    }

    console.log("Password changed successfully");
}

// 6. Request password reset
async function requestPasswordReset() {
    const { data, error } = await authClient.requestPasswordReset({
        email: "john.doe@example.com",
        redirectTo: "http://localhost:3000/reset-password",
    });

    if (error) {
        console.error("Password reset request failed:", error);
        return;
    }

    console.log("Password reset email sent");
}

// 7. Reset password (after clicking link in email)
async function resetPassword(token: string) {
    const { data, error } = await authClient.resetPassword({
        newPassword: "newpassword123",
        token,
    });

    if (error) {
        console.error("Password reset failed:", error);
        return;
    }

    console.log("Password reset successfully");
}

// 8. Making authenticated requests to your API
async function makeAuthenticatedRequest() {
    try {
        const response = await fetch("http://localhost:4000/api/auth/profile", {
            credentials: "include", // Important: include cookies
        });

        if (response.ok) {
            const data = await response.json();
            console.log("User profile:", data);
        } else {
            console.error("Failed to fetch profile");
        }
    } catch (error) {
        console.error("Request failed:", error);
    }
}

export {
    signUp,
    signIn,
    getCurrentSession,
    signOut,
    changePassword,
    requestPasswordReset,
    resetPassword,
    makeAuthenticatedRequest,
};
