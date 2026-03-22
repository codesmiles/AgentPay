'use client';

import { useState, useEffect } from 'react';
// import WDK from '@tetherto/wdk';
// import WalletManagerEvm from '@tetherto/wdk-wallet-evm';

interface WalletStatus {
  address: string;
  ethBalance: string;
  usdtBalance: string;
  network: string;
  chainId: number;
  walletType: string;
  seedPhraseGenerated?: boolean;
}

export default function WdkWallet() {
  const [walletStatus, setWalletStatus] = useState<WalletStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showSeedPhrase, setShowSeedPhrase] = useState(false);

  useEffect(() => {
    fetchWalletStatus();
  }, []);

  const fetchWalletStatus = async () => {
    try {
      setLoading(true);
      const response = await fetch('http://localhost:3001/agent/status');
      if (!response.ok) throw new Error('Failed to fetch wallet status');
      
      const data = await response.json();
      setWalletStatus(data.agent?.wallet || null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  const refreshBalances = async () => {
    await fetchWalletStatus();
  };

  if (loading) {
    return (
      <div className="p-6 bg-white rounded-lg shadow-md">
        <h2 className="text-xl font-bold mb-4">WDK Wallet Status</h2>
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
        <h2 className="text-xl font-bold mb-4 text-red-600">WDK Wallet Error</h2>
        <p className="text-red-500">{error}</p>
        <button
          onClick={fetchWalletStatus}
          className="mt-4 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
        >
          Retry
        </button>
      </div>
    );
  }

  if (!walletStatus) {
    return (
      <div className="p-6 bg-white rounded-lg shadow-md">
        <h2 className="text-xl font-bold mb-4">WDK Wallet Status</h2>
        <p className="text-gray-500">No wallet status available</p>
      </div>
    );
  }

  return (
    <div className="p-6 bg-white rounded-lg shadow-md">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-bold">WDK Wallet Status</h2>
        <button
          onClick={refreshBalances}
          className="px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600 text-sm"
        >
          Refresh
        </button>
      </div>

      <div className="space-y-4">
        {/* Wallet Type */}
        <div className="flex items-center space-x-2">
          <span className="font-semibold text-gray-700">Type:</span>
          <span className="px-2 py-1 bg-green-100 text-green-800 rounded text-sm">
            {walletStatus.walletType}
          </span>
          {walletStatus.seedPhraseGenerated && (
            <span className="px-2 py-1 bg-yellow-100 text-yellow-800 rounded text-sm">
              Auto-generated
            </span>
          )}
        </div>

        {/* Address */}
        <div>
          <span className="font-semibold text-gray-700">Address:</span>
          <div className="mt-1 p-2 bg-gray-50 rounded font-mono text-sm break-all">
            {walletStatus.address}
          </div>
        </div>

        {/* Network */}
        <div className="flex items-center space-x-2">
          <span className="font-semibold text-gray-700">Network:</span>
          <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-sm">
            {walletStatus.network} (Chain ID: {walletStatus.chainId})
          </span>
        </div>

        {/* Balances */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="p-3 bg-gray-50 rounded">
            <div className="text-sm text-gray-600">ETH Balance</div>
            <div className="text-lg font-semibold">{walletStatus.ethBalance} ETH</div>
          </div>
          <div className="p-3 bg-gray-50 rounded">
            <div className="text-sm text-gray-600">USDT Balance</div>
            <div className="text-lg font-semibold">{walletStatus.usdtBalance} USDT</div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex space-x-3 pt-4 border-t">
          <button
            onClick={() => setShowSeedPhrase(!showSeedPhrase)}
            className="px-4 py-2 bg-yellow-500 text-white rounded hover:bg-yellow-600"
          >
            {showSeedPhrase ? 'Hide' : 'Show'} Seed Phrase
          </button>
          <button
            onClick={refreshBalances}
            className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600"
          >
            Refresh Balances
          </button>
        </div>

        {/* Seed Phrase Warning */}
        {showSeedPhrase && (
          <div className="mt-4 p-4 bg-yellow-50 border border-yellow-200 rounded">
            <h3 className="font-semibold text-yellow-800 mb-2">⚠️ Security Notice</h3>
            <p className="text-sm text-yellow-700">
              This is a demo environment. In production, never share your seed phrase. 
              Store it securely and never expose it in frontend applications.
            </p>
            <div className="mt-2 p-2 bg-yellow-100 rounded text-xs font-mono">
              Seed phrase is managed securely by the backend WDK instance
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
