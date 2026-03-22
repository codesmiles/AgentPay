'use client';

import { useState, useEffect } from 'react';

interface AiProviderStatus {
    currentProvider: 'openai' | 'gemini';
    availableProviders: ('openai' | 'gemini')[];
    openaiConfigured: boolean;
    geminiConfigured: boolean;
}

export default function AiProvider() {
    const [status, setStatus] = useState<AiProviderStatus | null>(null);
    const [loading, setLoading] = useState(true);
    const [switching, setSwitching] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        fetchStatus();
    }, []);

    const fetchStatus = async () => {
        try {
            setLoading(true);
            const response = await fetch('http://localhost:3001/agent/ai/status');
            if (!response.ok) throw new Error('Failed to fetch AI provider status');
            
            const data = await response.json();
            setStatus(data);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Unknown error');
        } finally {
            setLoading(false);
        }
    };

    const switchProvider = async (provider: 'openai' | 'gemini') => {
        try {
            setSwitching(true);
            const response = await fetch('http://localhost:3001/agent/ai/switch', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ provider }),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to switch provider');
            }

            const data = await response.json();
            setStatus(data.status);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Unknown error');
        } finally {
            setSwitching(false);
        }
    };

    if (loading) {
        return (
            <div className="p-6 bg-white rounded-lg shadow-md">
                <h2 className="text-xl font-bold mb-4">AI Provider Status</h2>
                <div className="animate-pulse">
                    <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                    <div className="h-4 bg-gray-200 rounded w-1/2 mb-2"></div>
                    <div className="h-4 bg-gray-200 rounded w-2/3"></div>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="p-6 bg-white rounded-lg shadow-md">
                <h2 className="text-xl font-bold mb-4 text-red-600">AI Provider Error</h2>
                <p className="text-red-500">{error}</p>
                <button
                    onClick={fetchStatus}
                    className="mt-4 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
                >
                    Retry
                </button>
            </div>
        );
    }

    if (!status) {
        return (
            <div className="p-6 bg-white rounded-lg shadow-md">
                <h2 className="text-xl font-bold mb-4">AI Provider Status</h2>
                <p className="text-gray-500">No AI provider status available</p>
            </div>
        );
    }

    return (
        <div className="p-6 bg-white rounded-lg shadow-md">
            <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-bold">AI Provider Status</h2>
                <button
                    onClick={fetchStatus}
                    className="px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600 text-sm"
                >
                    Refresh
                </button>
            </div>

            <div className="space-y-4">
                {/* Current Provider */}
                <div>
                    <span className="font-semibold text-gray-700">Current Provider:</span>
                    <div className="mt-1">
                        <span className={`px-3 py-1 rounded text-sm font-medium ${
                            status.currentProvider === 'openai' 
                                ? 'bg-green-100 text-green-800' 
                                : 'bg-blue-100 text-blue-800'
                        }`}>
                            {status.currentProvider.toUpperCase()}
                        </span>
                    </div>
                </div>

                {/* Available Providers */}
                <div>
                    <span className="font-semibold text-gray-700">Available Providers:</span>
                    <div className="mt-2 flex flex-wrap gap-2">
                        {status.availableProviders.map(provider => (
                            <span
                                key={provider}
                                className={`px-2 py-1 rounded text-sm ${
                                    provider === status.currentProvider
                                        ? provider === 'openai'
                                            ? 'bg-green-100 text-green-800'
                                            : 'bg-blue-100 text-blue-800'
                                        : 'bg-gray-100 text-gray-600'
                                }`}
                            >
                                {provider.toUpperCase()}
                                {provider === status.currentProvider && ' (Active)'}
                            </span>
                        ))}
                    </div>
                </div>

                {/* Configuration Status */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className={`p-3 rounded ${status.openaiConfigured ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
                        <div className="flex items-center space-x-2">
                            <div className={`w-3 h-3 rounded-full ${status.openaiConfigured ? 'bg-green-500' : 'bg-red-500'}`}></div>
                            <span className="font-medium">OpenAI</span>
                        </div>
                        <div className="text-sm text-gray-600 mt-1">
                            {status.openaiConfigured ? 'API key configured' : 'API key missing'}
                        </div>
                    </div>
                    <div className={`p-3 rounded ${status.geminiConfigured ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
                        <div className="flex items-center space-x-2">
                            <div className={`w-3 h-3 rounded-full ${status.geminiConfigured ? 'bg-green-500' : 'bg-red-500'}`}></div>
                            <span className="font-medium">Gemini</span>
                        </div>
                        <div className="text-sm text-gray-600 mt-1">
                            {status.geminiConfigured ? 'API key configured' : 'API key missing'}
                        </div>
                    </div>
                </div>

                {/* Provider Switching */}
                {status.availableProviders.length > 1 && (
                    <div className="pt-4 border-t">
                        <h3 className="font-semibold text-gray-700 mb-3">Switch Provider</h3>
                        <div className="flex space-x-3">
                            {status.availableProviders.map(provider => (
                                <button
                                    key={provider}
                                    onClick={() => switchProvider(provider)}
                                    disabled={provider === status.currentProvider || switching}
                                    className={`px-4 py-2 rounded text-sm font-medium transition-colors ${
                                        provider === status.currentProvider
                                            ? 'bg-gray-200 text-gray-500 cursor-not-allowed'
                                            : switching
                                                ? 'bg-gray-300 text-gray-500 cursor-wait'
                                                : provider === 'openai'
                                                    ? 'bg-green-500 text-white hover:bg-green-600'
                                                    : 'bg-blue-500 text-white hover:bg-blue-600'
                                    }`}
                                >
                                    {provider === status.currentProvider ? 'Current' : `Switch to ${provider.toUpperCase()}`}
                                </button>
                            ))}
                        </div>
                        {switching && (
                            <p className="text-sm text-gray-600 mt-2">Switching provider...</p>
                        )}
                    </div>
                )}

                {/* Setup Instructions */}
                {status.availableProviders.length === 0 && (
                    <div className="p-4 bg-yellow-50 border border-yellow-200 rounded">
                        <h3 className="font-semibold text-yellow-800 mb-2">⚠️ No AI Providers Configured</h3>
                        <p className="text-sm text-yellow-700 mb-3">
                            Add API keys to your .env file to enable AI reasoning:
                        </p>
                        <div className="text-xs font-mono bg-yellow-100 p-2 rounded">
                            <div>OPENAI_API_KEY=your_openai_key_here</div>
                            <div>GEMINI_API_KEY=your_gemini_key_here</div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
