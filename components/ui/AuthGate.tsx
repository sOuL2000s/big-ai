// components/ui/AuthGate.tsx
'use client';

import { useState } from 'react';
import { useAuth } from '@/components/providers/AuthProvider';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, GoogleAuthProvider, signInWithPopup } from 'firebase/auth';
import { FirebaseError } from 'firebase/app';
import { auth } from '@/utils/firebase';

export default function AuthGate() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [isRegister, setIsRegister] = useState(false);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const { loading: authLoading } = useAuth();


    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            if (isRegister) {
                await createUserWithEmailAndPassword(auth, email, password);
            } else {
                await signInWithEmailAndPassword(auth, email, password);
            }
        } catch (err) {
            console.error(err);
            // FIX: Check if error is a FirebaseError for better typing
            const errorMessage = err instanceof FirebaseError ? err.message : 'Authentication failed.';
            setError(errorMessage);
        } finally {
            setLoading(false);
        }
    };

    const handleGoogleSignIn = async () => {
        setLoading(true);
        setError('');
        try {
            const provider = new GoogleAuthProvider();
            await signInWithPopup(auth, provider);
        } catch (err) {
            const errorMessage = err instanceof FirebaseError ? err.message : 'Google Sign-In failed.';
             setError(errorMessage);
        } finally {
             setLoading(false);
        }
    };

    if (authLoading) {
        return <div className="flex h-screen items-center justify-center bg-gray-900 text-white">Loading Auth...</div>
    }

    return (
        <div className="flex h-screen items-center justify-center bg-gray-900 text-white">
            <div className="w-full max-w-md p-8 space-y-6 bg-gray-800 rounded-xl shadow-2xl">
                <h2 className="text-2xl font-bold text-center">
                    {isRegister ? 'Sign Up for Big AI' : 'Sign In to Big AI'}
                </h2>
                {error && <p className="text-red-400 text-center">{error}</p>}
                
                <form onSubmit={handleSubmit} className="space-y-4">
                    <input
                        type="email"
                        placeholder="Email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="w-full p-3 border border-gray-700 rounded-lg bg-gray-700 text-white placeholder-gray-400 focus:ring-blue-500 focus:border-blue-500"
                        required
                    />
                    <input
                        type="password"
                        placeholder="Password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="w-full p-3 border border-gray-700 rounded-lg bg-gray-700 text-white placeholder-gray-400 focus:ring-blue-500 focus:border-blue-500"
                        required
                    />
                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full p-3 text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition duration-200 disabled:bg-blue-400"
                    >
                        {loading ? 'Processing...' : isRegister ? 'Register' : 'Sign In'}
                    </button>
                </form>

                <div className="relative flex items-center justify-center">
                    <span className="absolute px-3 bg-gray-800 text-gray-400 text-sm">OR</span>
                    <div className="w-full border-t border-gray-700"></div>
                </div>

                <button
                    onClick={handleGoogleSignIn}
                    disabled={loading}
                    className="w-full p-3 flex items-center justify-center gap-2 border border-gray-700 rounded-lg text-gray-300 hover:bg-gray-700 transition disabled:opacity-50"
                >
                    <svg width="20" height="20" viewBox="0 0 48 48"><path fill="#FFC107" d="M43.6 24c0-1.6-.2-3.3-.5-4.9H24v9.2h10.9c-.6 2.9-2.2 5.4-4.7 7.2v6.4h8.2c4.7-4.4 7.4-10.9 7.4-18z"/><path fill="#FF3D00" d="M24 48c6.6 0 12.3-2.2 16.4-6L31.9 35.6c-2.3 1.5-5.2 2.4-8 2.4-6.4 0-11.8-4.3-13.7-10.1h-8.5v6.6C4.8 41.7 13.7 48 24 48z"/><path fill="#4CAF50" d="M10.3 28.5c-.5-1.5-.8-3.1-.8-4.5s.3-3 .8-4.5V13H1.8C.6 15.6 0 18.5 0 24c0 5.5.6 8.4 1.8 11L10.3 28.5z"/><path fill="#1976D2" d="M24 9.6c3.4 0 6.4 1.2 8.8 3.5l7.3-7.3C36.3 3.4 30.5 0 24 0c-10.3 0-19.2 6.3-22.3 15.6l8.5 6.6C12.2 13.9 17.6 9.6 24 9.6z"/></svg>
                    Sign in with Google
                </button>

                <button
                    onClick={() => setIsRegister(p => !p)}
                    className="w-full text-sm text-center text-gray-400 hover:text-blue-500 transition"
                >
                    {isRegister ? 'Already have an account? Sign In' : 'Need an account? Register'}
                </button>
            </div>
        </div>
    );
}