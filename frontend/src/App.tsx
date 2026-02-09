import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Assessment from './pages/Assessment';
import Dashboard from './pages/Dashboard';

// THE CRASH REPORTER
// This catches the invisible errors and prints them on the screen
class CrashReporter extends React.Component<any, { hasError: boolean, error: any }> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: any) {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-white text-black p-10 font-mono overflow-auto">
          <h1 className="text-3xl font-bold text-red-600 mb-4">🚨 CRASH DETECTED</h1>
          <div className="bg-gray-100 p-6 rounded-lg border-2 border-red-600 mb-6">
            <h2 className="font-bold mb-2">The Error:</h2>
            <p className="text-lg text-red-700 font-bold mb-4">
              {this.state.error && this.state.error.toString()}
            </p>
            <h2 className="font-bold mb-2">Where it happened:</h2>
            <pre className="text-xs bg-black text-white p-4 rounded">
              {this.state.error && this.state.error.stack}
            </pre>
          </div>
          <p className="text-xl font-bold">
            👉 COPY THE TEXT ABOVE AND PASTE IT TO CLAUDE.
          </p>
        </div>
      );
    }
    return this.props.children;
  }
}

// YOUR MAIN APP (Wrapped in the reporter)
function App() {
  return (
    <CrashReporter>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Navigate to="/assessment" replace />} />
          <Route path="/assessment" element={<Assessment />} />
          <Route path="/dashboard" element={<Dashboard />} />
        </Routes>
      </BrowserRouter>
    </CrashReporter>
  );
}

export default App;
