import React, { useState, useEffect } from 'react';

interface BetaTester {
  email: string;
  tier: string;
}

export default function BetaTesterAdmin() {
  const [betaTesters, setBetaTesters] = useState<Record<string, string>>({});
  const [newEmail, setNewEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  const adminEmail = 'stangman9898@gmail.com';
  const apiBase = process.env.REACT_APP_API_URL || 'https://lylo-backend.onrender.com';

  useEffect(() => {
    loadBetaTesters();
  }, []);

  const loadBetaTesters = async () => {
    try {
      const response = await fetch(`${apiBase}/admin/list-beta-testers/${adminEmail}`);
      if (response.ok) {
        const data = await response.json();
        setBetaTesters(data.beta_testers);
      }
    } catch (error) {
      console.error('Failed to load beta testers:', error);
    }
  };

  const addBetaTester = async () => {
    if (!newEmail.trim()) return;

    setLoading(true);
    try {
      const formData = new FormData();
      formData.append('admin_email', adminEmail);
      formData.append('new_email', newEmail.trim());
      formData.append('tier', 'elite');

      const response = await fetch(`${apiBase}/admin/add-beta-tester`, {
        method: 'POST',
        body: formData
      });

      if (response.ok) {
        const data = await response.json();
        setMessage(`✅ Added ${newEmail} as Elite beta tester`);
        setNewEmail('');
        await loadBetaTesters();
      } else {
        setMessage('❌ Failed to add beta tester');
      }
    } catch (error) {
      setMessage('❌ Error adding beta tester');
    } finally {
      setLoading(false);
    }
  };

  const removeBetaTester = async (email: string) => {
    setLoading(true);
    try {
      const formData = new FormData();
      formData.append('admin_email', adminEmail);
      formData.append('remove_email', email);

      const response = await fetch(`${apiBase}/admin/remove-beta-tester`, {
        method: 'DELETE',
        body: formData
      });

      if (response.ok) {
        setMessage(`❌ Removed ${email}`);
        await loadBetaTesters();
      }
    } catch (error) {
      setMessage('❌ Error removing beta tester');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#050505] text-white p-6">
      <div className="max-w-4xl mx-auto">
        
        <div className="text-center mb-8">
          <h1 className="text-3xl font-black uppercase tracking-[0.2em] mb-2">
            L<span className="text-[#3b82f6]">Y</span>LO Beta Tester Admin
          </h1>
          <p className="text-gray-400 uppercase tracking-wider">
            Manage Elite Access Users
          </p>
        </div>

        {/* Add Beta Tester */}
        <div className="bg-black/60 backdrop-blur-xl border border-white/10 rounded-xl p-6 mb-6">
          <h2 className="text-white font-bold uppercase tracking-wider mb-4">
            Add New Beta Tester
          </h2>
          
          <div className="flex gap-4">
            <input
              type="email"
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              placeholder="email@example.com"
              className="flex-1 bg-white/5 border border-white/20 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-[#3b82f6]"
              onKeyPress={(e) => e.key === 'Enter' && addBetaTester()}
            />
            
            <button
              onClick={addBetaTester}
              disabled={loading || !newEmail.trim()}
              className={`
                px-6 py-3 rounded-lg font-bold uppercase tracking-wider transition-all
                ${newEmail.trim() && !loading
                  ? 'bg-gradient-to-r from-[#3b82f6] to-[#1d4ed8] text-white hover:shadow-lg'
                  : 'bg-gray-800 text-gray-500 cursor-not-allowed'
                }
              `}
            >
              {loading ? 'Adding...' : 'Add Elite Access'}
            </button>
          </div>

          {message && (
            <div className="mt-4 p-3 bg-white/5 rounded-lg">
              <p className="text-sm">{message}</p>
            </div>
          )}
        </div>

        {/* Beta Testers List */}
        <div className="bg-black/60 backdrop-blur-xl border border-white/10 rounded-xl p-6">
          <h2 className="text-white font-bold uppercase tracking-wider mb-4">
            Current Beta Testers ({Object.keys(betaTesters).length})
          </h2>
          
          <div className="space-y-3">
            {Object.entries(betaTesters).map(([email, tier]) => (
              <div key={email} className="flex items-center justify-between bg-white/5 rounded-lg p-4">
                <div>
                  <div className="text-white font-medium">{email}</div>
                  <div className="text-[#3b82f6] text-sm uppercase font-bold">{tier}</div>
                </div>
                
                {email !== adminEmail && (
                  <button
                    onClick={() => removeBetaTester(email)}
                    disabled={loading}
                    className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-bold text-sm uppercase transition-colors"
                  >
                    Remove
                  </button>
                )}
              </div>
            ))}
          </div>

          {Object.keys(betaTesters).length === 0 && (
            <div className="text-center py-8 text-gray-400">
              No beta testers found
            </div>
          )}
        </div>

        {/* Website Link Instructions */}
        <div className="bg-black/60 backdrop-blur-xl border border-white/10 rounded-xl p-6 mt-6">
          <h2 className="text-white font-bold uppercase tracking-wider mb-4">
            Website Integration
          </h2>
          
          <div className="space-y-4 text-sm text-gray-300">
            <p>
              <strong>Beta Tester Link:</strong><br />
              <code className="bg-white/10 px-2 py-1 rounded text-[#3b82f6]">
                https://app.mylylo.pro/dashboard?beta=true
              </code>
            </p>
            
            <p>
              <strong>Regular User Link:</strong><br />
              <code className="bg-white/10 px-2 py-1 rounded text-[#3b82f6]">
                https://app.mylylo.pro/assessment
              </code>
            </p>
            
            <p className="text-gray-400 text-xs">
              Beta testers get instant Elite access. Regular users go through assessment first.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
