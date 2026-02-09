import React, { useState, useEffect } from 'react';

// Simple Error Boundary Component
class DashboardErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; error?: Error }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error) {
    console.error('Dashboard Error Boundary caught:', error);
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: any) {
    console.error('Dashboard Error Details:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#050505] text-[#E5E7EB] flex items-center justify-center p-4">
          <div className="text-center">
            <h2 className="text-2xl font-bold text-red-400 mb-4">Dashboard Error</h2>
            <p className="text-gray-300 mb-4">Something went wrong loading the dashboard.</p>
            <pre className="text-xs text-gray-400 bg-gray-900 p-4 rounded">
              {this.state.error?.message || 'Unknown error'}
            </pre>
            <button 
              onClick={() => window.location.reload()} 
              className="mt-4 px-4 py-2 bg-[#3b82f6] text-white rounded"
            >
              Reload Page
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

// Lazy load ChatInterface with error handling
const ChatInterface = React.lazy(() => {
  console.log('Dashboard: Attempting to load ChatInterface...');
  return import('../components/ChatInterface')
    .then(module => {
      console.log('Dashboard: ChatInterface loaded successfully');
      return module;
    })
    .catch(error => {
      console.error('Dashboard: Failed to load ChatInterface:', error);
      // Return a fallback component
      return {
        default: () => (
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <p className="text-red-400 mb-2">ChatInterface failed to load</p>
              <p className="text-gray-400 text-sm">{error.message}</p>
            </div>
          </div>
        )
      };
    });
});

// Main Dashboard Component
const Dashboard: React.FC = () => {
  const [isAuthorized, setIsAuthorized] = useState<boolean | null>(null);
  const [currentMission, setCurrentMission] = useState('guardian');
  const [menuOpen, setMenuOpen] = useState(false);
  const [zoomLevel, setZoomLevel] = useState(100);

  console.log('Dashboard: Component rendering...');

  // Check authorization on mount
  useEffect(() => {
    console.log('Dashboard: Checking localStorage for lylo_assessment_complete...');
    
    try {
      const assessmentComplete = localStorage.getItem('lylo_assessment_complete');
      console.log('Dashboard: localStorage value:', assessmentComplete);
      
      if (assessmentComplete === 'true') {
        console.log('Dashboard: User authorized, setting isAuthorized to true');
        setIsAuthorized(true);
      } else {
        console.log('Dashboard: User not authorized, redirecting to assessment');
        setIsAuthorized(false);
        // Redirect to assessment if not completed
        window.location.href = '/assessment';
      }
    } catch (error) {
      console.error('Dashboard: Error checking localStorage:', error);
      setIsAuthorized(false);
    }
  }, []);

  // Mission configurations (using simple text instead of icons)
  const missions = {
    guardian: { icon: '🛡️', name: 'Guardian', description: 'Security protection' },
    chef: { icon: '👨‍🍳', name: 'Chef', description: 'Cooking guidance' },
    tech: { icon: '💻', name: 'Tech Guru', description: 'Technical support' },
    legal: { icon: '⚖️', name: 'Legal', description: 'Legal information' },
    assistant: { icon: '🤝', name: 'Assistant', description: 'General help' }
  };

  console.log('Dashboard: Current state - isAuthorized:', isAuthorized, 'currentMission:', currentMission);

  // Loading state
  if (isAuthorized === null) {
    return (
      <div className="min-h-screen bg-[#050505] text-[#E5E7EB] flex items-center justify-center">
        <div className="text-center">
          <div className="text-[#3b82f6] text-4xl font-bold mb-4">LYLO</div>
          <div className="text-gray-400">Checking authorization...</div>
        </div>
      </div>
    );
  }

  // Unauthorized state
  if (isAuthorized === false) {
    return (
      <div className="min-h-screen bg-[#050505] text-[#E5E7EB] flex items-center justify-center">
        <div className="text-center">
          <div className="text-red-400 text-2xl mb-4">Access Denied</div>
          <div className="text-gray-400 mb-4">Please complete the assessment first.</div>
          <button 
            onClick={() => window.location.href = '/assessment'}
            className="px-6 py-2 bg-[#3b82f6] text-white rounded"
          >
            Go to Assessment
          </button>
        </div>
      </div>
    );
  }

  console.log('Dashboard: Rendering main dashboard UI');

  return (
    <DashboardErrorBoundary>
      <div className="h-screen bg-[#050505] text-[#E5E7EB] flex flex-col relative overflow-hidden">
        
        {/* Fixed Header */}
        <header className="fixed top-0 left-0 right-0 bg-[#050505] border-b border-gray-800 z-50">
          <div className="flex items-center justify-between p-4 h-16">
            
            {/* Left: Username & Status */}
            <div className="flex items-center space-x-3">
              <span className="font-light text-lg">Christopher</span>
              <div className="flex items-center space-x-1">
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                <span className="text-xs text-gray-400">Connected</span>
              </div>
            </div>

            {/* Center: Logo */}
            <div className="text-2xl font-bold text-[#3b82f6] tracking-wide">LYLO</div>

            {/* Right: Controls (using simple text) */}
            <div className="flex items-center space-x-3">
              <button
                onClick={() => setZoomLevel(Math.max(80, zoomLevel - 10))}
                className="px-2 py-1 text-gray-400 hover:text-white border border-gray-600 rounded"
                title="Zoom Out"
              >
                A-
              </button>
              <button
                onClick={() => setZoomLevel(Math.min(120, zoomLevel + 10))}
                className="px-2 py-1 text-gray-400 hover:text-white border border-gray-600 rounded"
                title="Zoom In"
              >
                A+
              </button>
              <button
                onClick={() => setMenuOpen(!menuOpen)}
                className="px-2 py-1 text-gray-400 hover:text-white border border-gray-600 rounded"
                title="Menu"
              >
                ≡
              </button>
            </div>
          </div>

          {/* Mission Bar */}
          <div className="flex justify-around border-t border-gray-800 py-2 bg-[#050505]">
            {Object.entries(missions).map(([key, mission]) => (
              <button
                key={key}
                onClick={() => {
                  console.log('Dashboard: Mission changed to:', key);
                  setCurrentMission(key);
                }}
                className={`p-3 rounded-lg transition-all ${
                  currentMission === key
                    ? 'bg-[#3b82f6] text-white'
                    : 'text-gray-400 hover:text-white hover:bg-gray-800'
                }`}
                title={mission.name}
              >
                <span className="text-lg">{mission.icon}</span>
              </button>
            ))}
          </div>
        </header>

        {/* Hamburger Menu Overlay */}
        {menuOpen && (
          <div className="fixed inset-0 z-40 flex">
            <div 
              className="flex-1 bg-black bg-opacity-50"
              onClick={() => setMenuOpen(false)}
            />
            <div className="w-80 bg-[#050505] border-l border-gray-800 p-6 space-y-6">
              <h2 className="text-xl font-light text-[#3b82f6] mb-6">Menu</h2>
              
              <div>
                <h3 className="text-sm font-medium text-gray-400 mb-3">Debug Info</h3>
                <div className="space-y-2 text-xs">
                  <div>• Zoom Level: {zoomLevel}%</div>
                  <div>• Current Mission: {currentMission}</div>
                  <div>• Menu Open: {menuOpen ? 'Yes' : 'No'}</div>
                  <div>• Assessment Complete: {localStorage.getItem('lylo_assessment_complete')}</div>
                </div>
              </div>

              <div>
                <h3 className="text-sm font-medium text-gray-400 mb-3">Capabilities</h3>
                <div className="space-y-2 text-sm">
                  <div>• Scan messages & links for threats</div>
                  <div>• Memory vault for personal data</div>
                  <div>• Cooking & nutrition guidance</div>
                  <div>• Tech support & tutorials</div>
                  <div>• Legal information</div>
                </div>
              </div>

              <div className="pt-6 border-t border-gray-800">
                <button 
                  onClick={() => {
                    console.log('Dashboard: Logging out...');
                    localStorage.removeItem('lylo_assessment_complete');
                    window.location.href = '/assessment';
                  }}
                  className="flex items-center space-x-3 text-red-400 hover:text-red-300"
                >
                  <span>🚪</span>
                  <span>Reset & Logout</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Main Content Area */}
        <main className="flex-1 pt-32 pb-4" style={{ fontSize: `${zoomLevel}%` }}>
          <div className="h-full">
            <React.Suspense 
              fallback={
                <div className="flex items-center justify-center h-full">
                  <div className="text-center">
                    <div className="text-[#3b82f6] text-2xl mb-2">⏳</div>
                    <div className="text-gray-400">Loading Chat Interface...</div>
                  </div>
                </div>
              }
            >
              <ChatInterface 
                currentMission={currentMission}
                zoomLevel={zoomLevel}
              />
            </React.Suspense>
          </div>
        </main>
      </div>
    </DashboardErrorBoundary>
  );
};

export default Dashboard;
