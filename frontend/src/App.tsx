// --- THE GATEKEEPER (With Boot-Delay Fix) ---
const Gatekeeper = ({ children, requireRedirect = false }: { children: React.ReactNode, requireRedirect?: boolean }) => {
  const [isAuthorized, setIsAuthorized] = useState<boolean>(false);
  const [shouldRedirectToDash, setShouldRedirectToDash] = useState<boolean>(false);
  const [isBooting, setIsBooting] = useState<boolean>(true); // NEW: System loading state

  useEffect(() => {
    const initializeGatekeeper = async () => {
      // 1. Force-scan URL for credentials
      const fullUrl = window.location.href;
      const getParam = (param: string) => {
        const match = fullUrl.match(new RegExp(`[?&]${param}=([^&]*)`));
        return match ? decodeURIComponent(match[1]) : null;
      };

      const emailFromUrl = getParam('email');
      const tierFromUrl = getParam('tier');
      const nameFromUrl = getParam('name');

      if (emailFromUrl) {
        localStorage.setItem('userEmail', emailFromUrl);
        if (tierFromUrl) localStorage.setItem('userTier', tierFromUrl);
        if (nameFromUrl) localStorage.setItem('userName', nameFromUrl);
        
        const cleanUrl = fullUrl.split('?')[0]; 
        window.history.replaceState({}, document.title, cleanUrl);
        
        setIsAuthorized(true);
        if (requireRedirect) setShouldRedirectToDash(true);
        setIsBooting(false);
        return;
      }

      // 2. CHECK STORAGE
      const storedEmail = localStorage.getItem('userEmail');
      if (storedEmail) {
        setIsAuthorized(true);
        if (requireRedirect) setShouldRedirectToDash(true);
      } else {
        // Only eject if we are SURE there is no data after booting
        window.location.assign('https://mylylo.pro');
      }
      
      // Give the system 300ms to catch its breath
      setTimeout(() => setIsBooting(false), 300);
    };

    initializeGatekeeper();
  }, [requireRedirect]);

  // Show the black screen ONLY while booting. 
  // If authorized, it will transition smoothly.
  if (isBooting || !isAuthorized) {
    return (
      <div className="fixed inset-0 bg-black flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-blue-500/20 border-t-blue-500 rounded-full animate-spin"></div>
      </div>
    );
  }

  if (shouldRedirectToDash) {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
};
